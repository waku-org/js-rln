import { createDecoder, createEncoder } from "@waku/core";
import type {
  ContentTopic,
  IDecodedMessage,
  IRateLimitProof,
  EncoderOptions as WakuEncoderOptions,
} from "@waku/interfaces";
import init from "@waku/zerokit-rln-wasm";
import * as zerokitRLN from "@waku/zerokit-rln-wasm";
import { ethers } from "ethers";

import {
  createRLNDecoder,
  createRLNEncoder,
  type RLNDecoder,
  type RLNEncoder,
} from "./codec.js";
import { RLNContract, SEPOLIA_CONTRACT } from "./contract/index.js";
import { IdentityCredential } from "./identity.js";
import { Keystore } from "./keystore/index.js";
import type {
  DecryptedCredentials,
  EncryptedCredentials,
} from "./keystore/index.js";
import { KeystoreEntity, Password } from "./keystore/types.js";
import { Proof, proofToBytes } from "./proof.js";
import verificationKey from "./resources/verification_key.js";
import * as wc from "./resources/witness_calculator.js";
import { WitnessCalculator } from "./resources/witness_calculator.js";
import {
  concatenate,
  dateToEpoch,
  epochIntToBytes,
  extractMetaMaskSigner,
  writeUIntLE,
} from "./utils/index.js";

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
