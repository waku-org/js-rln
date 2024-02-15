import { createDecoder, createEncoder } from "@waku/core";
import type { IRateLimitProof } from "@waku/interfaces";
import type {
  ContentTopic,
  IDecodedMessage,
  EncoderOptions as WakuEncoderOptions,
} from "@waku/interfaces";
import init from "@waku/zerokit-rln-wasm";
import * as zerokitRLN from "@waku/zerokit-rln-wasm";
import { ethers } from "ethers";

import type { RLNDecoder, RLNEncoder } from "./codec.js";
import { createRLNDecoder, createRLNEncoder } from "./codec.js";
import { SEPOLIA_CONTRACT } from "./constants.js";
import { RLNContract } from "./contract/index.js";
import { dateToEpoch, epochIntToBytes } from "./epoch.js";
import { Keystore } from "./keystore/index.js";
import type {
  DecryptedCredentials,
  EncryptedCredentials,
} from "./keystore/index.js";
import { KeystoreEntity, Password } from "./keystore/types.js";
import verificationKey from "./resources/verification_key.js";
import {
  buildBigIntFromUint8Array,
  poseidonHash,
  writeUIntLE,
} from "./utils/index.js";
import { concatenate, extractMetaMaskSigner } from "./utils/index.js";
import * as wc from "./witness_calculator.js";
import { WitnessCalculator } from "./witness_calculator.js";

async function loadWitnessCalculator(): Promise<WitnessCalculator> {
  const url = new URL("./resources/rln.wasm", import.meta.url);
  const response = await fetch(url);
  return await wc.builder(new Uint8Array(await response.arrayBuffer()), false);
}

async function loadZkey(): Promise<Uint8Array> {
  const url = new URL("./resources/rln_final.zkey", import.meta.url);
  const response = await fetch(url);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Create an instance of RLN
 * @returns RLNInstance
 */
export async function create(): Promise<RLNInstance> {
  await (init as any)?.();
  zerokitRLN.init_panic_hook();

  const witnessCalculator = await loadWitnessCalculator();
  const zkey = await loadZkey();

  const stringEncoder = new TextEncoder();
  const vkey = stringEncoder.encode(JSON.stringify(verificationKey));

  const DEPTH = 20;
  const zkRLN = zerokitRLN.newRLN(DEPTH, zkey, vkey);

  return new RLNInstance(zkRLN, witnessCalculator);
}

export class IdentityCredential {
  constructor(
    public readonly IDTrapdoor: Uint8Array,
    public readonly IDNullifier: Uint8Array,
    public readonly IDSecretHash: Uint8Array,
    public readonly IDCommitment: Uint8Array,
    public readonly IDCommitmentBigInt: bigint
  ) {}

  static fromBytes(memKeys: Uint8Array): IdentityCredential {
    const idTrapdoor = memKeys.subarray(0, 32);
    const idNullifier = memKeys.subarray(32, 64);
    const idSecretHash = memKeys.subarray(64, 96);
    const idCommitment = memKeys.subarray(96);
    const idCommitmentBigInt = buildBigIntFromUint8Array(idCommitment);

    return new IdentityCredential(
      idTrapdoor,
      idNullifier,
      idSecretHash,
      idCommitment,
      idCommitmentBigInt
    );
  }
}

const proofOffset = 128;
const rootOffset = proofOffset + 32;
const epochOffset = rootOffset + 32;
const shareXOffset = epochOffset + 32;
const shareYOffset = shareXOffset + 32;
const nullifierOffset = shareYOffset + 32;
const rlnIdentifierOffset = nullifierOffset + 32;

export class ProofMetadata {
  constructor(
    public readonly nullifier: Uint8Array,
    public readonly shareX: Uint8Array,
    public readonly shareY: Uint8Array,
    public readonly externalNullifier: Uint8Array
  ) {}
}
export class Proof implements IRateLimitProof {
  readonly proof: Uint8Array;
  readonly merkleRoot: Uint8Array;
  readonly epoch: Uint8Array;
  readonly shareX: Uint8Array;
  readonly shareY: Uint8Array;
  readonly nullifier: Uint8Array;
  readonly rlnIdentifier: Uint8Array;

  constructor(proofBytes: Uint8Array) {
    if (proofBytes.length < rlnIdentifierOffset) throw "invalid proof";
    // parse the proof as proof<128> | share_y<32> | nullifier<32> | root<32> | epoch<32> | share_x<32> | rln_identifier<32>
    this.proof = proofBytes.subarray(0, proofOffset);
    this.merkleRoot = proofBytes.subarray(proofOffset, rootOffset);
    this.epoch = proofBytes.subarray(rootOffset, epochOffset);
    this.shareX = proofBytes.subarray(epochOffset, shareXOffset);
    this.shareY = proofBytes.subarray(shareXOffset, shareYOffset);
    this.nullifier = proofBytes.subarray(shareYOffset, nullifierOffset);
    this.rlnIdentifier = proofBytes.subarray(
      nullifierOffset,
      rlnIdentifierOffset
    );
  }

  extractMetadata(): ProofMetadata {
    const externalNullifier = poseidonHash(this.epoch, this.rlnIdentifier);
    return new ProofMetadata(
      this.nullifier,
      this.shareX,
      this.shareY,
      externalNullifier
    );
  }
}

export function proofToBytes(p: IRateLimitProof): Uint8Array {
  return concatenate(
    p.proof,
    p.merkleRoot,
    p.epoch,
    p.shareX,
    p.shareY,
    p.nullifier,
    p.rlnIdentifier
  );
}

type StartRLNOptions = {
  /**
   * If not set - will extract MetaMask account and get signer from it.
   */
  signer?: ethers.Signer;
  /**
   * If not set - will use default SEPOLIA_CONTRACT address.
   */
  registryAddress?: string;
  /**
   * Credentials to use for generating proofs and connecting to the contract and network.
   * If provided used for validating the network chainId and connecting to registry contract.
   */
  credentials?: EncryptedCredentials | DecryptedCredentials;
};

type RegisterMembershipOptions =
  | { signature: string }
  | { identity: IdentityCredential };

type WakuRLNEncoderOptions = WakuEncoderOptions & {
  credentials: EncryptedCredentials | DecryptedCredentials;
};

export class RLNInstance {
  private started = false;
  private starting = false;

  private _contract: undefined | RLNContract;
  private _signer: undefined | ethers.Signer;

  private keystore = Keystore.create();
  private _credentials: undefined | DecryptedCredentials;

  constructor(
    private zkRLN: number,
    private witnessCalculator: WitnessCalculator
  ) {}

  public get contract(): undefined | RLNContract {
    return this._contract;
  }

  public get signer(): undefined | ethers.Signer {
    return this._signer;
  }

  public async start(options: StartRLNOptions = {}): Promise<void> {
    if (this.started || this.starting) {
      return;
    }

    this.starting = true;

    try {
      const { credentials, keystore } =
        await RLNInstance.decryptCredentialsIfNeeded(options.credentials);
      const { signer, registryAddress } = await this.determineStartOptions(
        options,
        credentials
      );

      if (keystore) {
        this.keystore = keystore;
      }

      this._credentials = credentials;
      this._signer = signer!;
      this._contract = await RLNContract.init(this, {
        registryAddress: registryAddress!,
        signer: signer!,
      });
      this.started = true;
    } finally {
      this.starting = false;
    }
  }

  private async determineStartOptions(
    options: StartRLNOptions,
    credentials: KeystoreEntity | undefined
  ): Promise<StartRLNOptions> {
    let chainId = credentials?.membership.chainId;
    const registryAddress =
      credentials?.membership.address ||
      options.registryAddress ||
      SEPOLIA_CONTRACT.address;

    if (registryAddress === SEPOLIA_CONTRACT.address) {
      chainId = SEPOLIA_CONTRACT.chainId;
    }

    const signer = options.signer || (await extractMetaMaskSigner());
    const currentChainId = await signer.getChainId();

    if (chainId && chainId !== currentChainId) {
      throw Error(
        `Failed to start RLN contract, chain ID of contract is different from current one: contract-${chainId}, current network-${currentChainId}`
      );
    }

    return {
      signer,
      registryAddress,
    };
  }

  private static async decryptCredentialsIfNeeded(
    credentials?: EncryptedCredentials | DecryptedCredentials
  ): Promise<{ credentials?: DecryptedCredentials; keystore?: Keystore }> {
    if (!credentials) {
      return {};
    }

    if ("identity" in credentials) {
      return { credentials };
    }

    const keystore = Keystore.fromString(credentials.keystore);

    if (!keystore) {
      return {};
    }

    const decryptedCredentials = await keystore.readCredential(
      credentials.id,
      credentials.password
    );

    return {
      keystore,
      credentials: decryptedCredentials,
    };
  }

  public async registerMembership(
    options: RegisterMembershipOptions
  ): Promise<undefined | DecryptedCredentials> {
    if (!this.contract) {
      throw Error("RLN Contract is not initialized.");
    }

    let identity = "identity" in options && options.identity;

    if ("signature" in options) {
      identity = await this.generateSeededIdentityCredential(options.signature);
    }

    if (!identity) {
      throw Error("Missing signature or identity to register membership.");
    }

    return this.contract.registerWithIdentity(identity);
  }

  /**
   * Changes credentials in use by relying on provided Keystore earlier in rln.start
   * @param id: string, hash of credentials to select from Keystore
   * @param password: string or bytes to use to decrypt credentials from Keystore
   */
  public async useCredentials(id: string, password: Password): Promise<void> {
    this._credentials = await this.keystore?.readCredential(id, password);
  }

  public async createEncoder(
    options: WakuRLNEncoderOptions
  ): Promise<RLNEncoder> {
    const { credentials: decryptedCredentials } =
      await RLNInstance.decryptCredentialsIfNeeded(options.credentials);
    const credentials = decryptedCredentials || this._credentials;

    if (!credentials) {
      throw Error(
        "Failed to create Encoder: missing RLN credentials. Use createRLNEncoder directly."
      );
    }

    await this.verifyCredentialsAgainstContract(credentials);

    return createRLNEncoder({
      encoder: createEncoder(options),
      rlnInstance: this,
      index: credentials.membership.treeIndex,
      credential: credentials.identity,
    });
  }

  private async verifyCredentialsAgainstContract(
    credentials: KeystoreEntity
  ): Promise<void> {
    if (!this._contract) {
      throw Error(
        "Failed to verify chain coordinates: no contract initialized."
      );
    }

    const registryAddress = credentials.membership.address;
    const currentRegistryAddress = this._contract.registry.address;
    if (registryAddress !== currentRegistryAddress) {
      throw Error(
        `Failed to verify chain coordinates: credentials contract address=${registryAddress} is not equal to registryContract address=${currentRegistryAddress}`
      );
    }

    const chainId = credentials.membership.chainId;
    const network = await this._contract.registry.provider.getNetwork();
    const currentChainId = network.chainId;
    if (chainId !== currentChainId) {
      throw Error(
        `Failed to verify chain coordinates: credentials chainID=${chainId} is not equal to registryContract chainID=${currentChainId}`
      );
    }
  }

  public createDecoder(
    contentTopic: ContentTopic
  ): RLNDecoder<IDecodedMessage> {
    return createRLNDecoder({
      rlnInstance: this,
      decoder: createDecoder(contentTopic),
    });
  }

  generateIdentityCredentials(): IdentityCredential {
    const memKeys = zerokitRLN.generateExtendedMembershipKey(this.zkRLN); // TODO: rename this function in zerokit rln-wasm
    return IdentityCredential.fromBytes(memKeys);
  }

  generateSeededIdentityCredential(seed: string): IdentityCredential {
    const stringEncoder = new TextEncoder();
    const seedBytes = stringEncoder.encode(seed);
    // TODO: rename this function in zerokit rln-wasm
    const memKeys = zerokitRLN.generateSeededExtendedMembershipKey(
      this.zkRLN,
      seedBytes
    );
    return IdentityCredential.fromBytes(memKeys);
  }

  insertMember(idCommitment: Uint8Array): void {
    zerokitRLN.insertMember(this.zkRLN, idCommitment);
  }

  insertMembers(index: number, ...idCommitments: Array<Uint8Array>): void {
    // serializes a seq of IDCommitments to a byte seq
    // the order of serialization is |id_commitment_len<8>|id_commitment<var>|
    const idCommitmentLen = writeUIntLE(
      new Uint8Array(8),
      idCommitments.length,
      0,
      8
    );
    const idCommitmentBytes = concatenate(idCommitmentLen, ...idCommitments);
    zerokitRLN.setLeavesFrom(this.zkRLN, index, idCommitmentBytes);
  }

  deleteMember(index: number): void {
    zerokitRLN.deleteLeaf(this.zkRLN, index);
  }

  getMerkleRoot(): Uint8Array {
    return zerokitRLN.getRoot(this.zkRLN);
  }

  serializeMessage(
    uint8Msg: Uint8Array,
    memIndex: number,
    epoch: Uint8Array,
    idKey: Uint8Array
  ): Uint8Array {
    // calculate message length
    const msgLen = writeUIntLE(new Uint8Array(8), uint8Msg.length, 0, 8);

    // Converting index to LE bytes
    const memIndexBytes = writeUIntLE(new Uint8Array(8), memIndex, 0, 8);

    // [ id_key<32> | id_index<8> | epoch<32> | signal_len<8> | signal<var> ]
    return concatenate(idKey, memIndexBytes, epoch, msgLen, uint8Msg);
  }

  async generateRLNProof(
    msg: Uint8Array,
    index: number,
    epoch: Uint8Array | Date | undefined,
    idSecretHash: Uint8Array
  ): Promise<IRateLimitProof> {
    if (epoch == undefined) {
      epoch = epochIntToBytes(dateToEpoch(new Date()));
    } else if (epoch instanceof Date) {
      epoch = epochIntToBytes(dateToEpoch(epoch));
    }

    if (epoch.length != 32) throw "invalid epoch";
    if (idSecretHash.length != 32) throw "invalid id secret hash";
    if (index < 0) throw "index must be >= 0";

    const serialized_msg = this.serializeMessage(
      msg,
      index,
      epoch,
      idSecretHash
    );
    const rlnWitness = zerokitRLN.getSerializedRLNWitness(
      this.zkRLN,
      serialized_msg
    );
    const inputs = zerokitRLN.RLNWitnessToJson(this.zkRLN, rlnWitness);
    const calculatedWitness = await this.witnessCalculator.calculateWitness(
      inputs,
      false
    ); // no sanity check being used in zerokit

    const proofBytes = zerokitRLN.generate_rln_proof_with_witness(
      this.zkRLN,
      calculatedWitness,
      rlnWitness
    );

    return new Proof(proofBytes);
  }

  verifyRLNProof(
    proof: IRateLimitProof | Uint8Array,
    msg: Uint8Array
  ): boolean {
    let pBytes: Uint8Array;
    if (proof instanceof Uint8Array) {
      pBytes = proof;
    } else {
      pBytes = proofToBytes(proof);
    }

    // calculate message length
    const msgLen = writeUIntLE(new Uint8Array(8), msg.length, 0, 8);

    return zerokitRLN.verifyRLNProof(
      this.zkRLN,
      concatenate(pBytes, msgLen, msg)
    );
  }

  verifyWithRoots(
    proof: IRateLimitProof | Uint8Array,
    msg: Uint8Array,
    ...roots: Array<Uint8Array>
  ): boolean {
    let pBytes: Uint8Array;
    if (proof instanceof Uint8Array) {
      pBytes = proof;
    } else {
      pBytes = proofToBytes(proof);
    }
    // calculate message length
    const msgLen = writeUIntLE(new Uint8Array(8), msg.length, 0, 8);

    const rootsBytes = concatenate(...roots);

    return zerokitRLN.verifyWithRoots(
      this.zkRLN,
      concatenate(pBytes, msgLen, msg),
      rootsBytes
    );
  }

  verifyWithNoRoot(
    proof: IRateLimitProof | Uint8Array,
    msg: Uint8Array
  ): boolean {
    let pBytes: Uint8Array;
    if (proof instanceof Uint8Array) {
      pBytes = proof;
    } else {
      pBytes = proofToBytes(proof);
    }

    // calculate message length
    const msgLen = writeUIntLE(new Uint8Array(8), msg.length, 0, 8);

    return zerokitRLN.verifyWithRoots(
      this.zkRLN,
      concatenate(pBytes, msgLen, msg),
      new Uint8Array()
    );
  }
}
