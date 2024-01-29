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

import { buildBigIntFromUint8Array, writeUIntLE } from "./byte_utils.js";
import type { RLNDecoder, RLNEncoder } from "./codec.js";
import { createRLNDecoder, createRLNEncoder } from "./codec.js";
import { SEPOLIA_CONTRACT } from "./constants.js";
import { dateToEpoch, epochIntToBytes } from "./epoch.js";
import type { KeystoreEntity } from "./keystore/index.js";
import { extractMetaMaskSigner } from "./metamask.js";
import verificationKey from "./resources/verification_key.js";
import { RLNContract } from "./rln_contract.js";
import * as wc from "./witness_calculator.js";
import { WitnessCalculator } from "./witness_calculator.js";

/**
 * Concatenate Uint8Arrays
 * @param input
 * @returns concatenation of all Uint8Array received as input
 */
function concatenate(...input: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of input) {
    totalLength += arr.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of input) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

const stringEncoder = new TextEncoder();

const DEPTH = 20;

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
  const vkey = stringEncoder.encode(JSON.stringify(verificationKey));
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

export function poseidonHash(...input: Array<Uint8Array>): Uint8Array {
  const inputLen = writeUIntLE(new Uint8Array(8), input.length, 0, 8);
  const lenPrefixedData = concatenate(inputLen, ...input);
  return zerokitRLN.poseidonHash(lenPrefixedData);
}

export function sha256(input: Uint8Array): Uint8Array {
  const inputLen = writeUIntLE(new Uint8Array(8), input.length, 0, 8);
  const lenPrefixedData = concatenate(inputLen, input);
  return zerokitRLN.hash(lenPrefixedData);
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
  credentials?: KeystoreEntity;
};

type RegisterMembershipOptions =
  | { signature: string }
  | { identity: IdentityCredential };

export class RLNInstance {
  private started = false;
  private starting = false;

  private _contract: undefined | RLNContract;
  private _signer: undefined | ethers.Signer;
  private _credentials: undefined | KeystoreEntity;

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
      const { signer, credentials, registryAddress } =
        await this.determineStartOptions(options);

      this._signer = signer!;
      this._credentials = credentials;
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
    options: StartRLNOptions
  ): Promise<StartRLNOptions> {
    let chainId = options.credentials?.membership.chainId;
    const registryAddress =
      options.credentials?.membership.address ||
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
      credentials: options.credentials,
    };
  }

  public async registerMembership(
    options: RegisterMembershipOptions
  ): Promise<undefined | KeystoreEntity> {
    if (!this.contract) {
      throw Error("RLN Contract is not initialized.");
    }

    if (!options.identity || !options.signature) {
      throw Error("Missing signature or identity to register membership.");
    }

    let identity = options.identity;

    if (options.signature) {
      identity = await this.generateSeededIdentityCredential(signature);
    }

    return this.contract.registerWithIdentity(identity);
  }

  public createEncoder(options: WakuEncoderOptions): RLNEncoder {
    if (!this._credentials) {
      throw Error(
        "Failed to create Encoder: missing RLN credentials. Use createRLNEncoder directly."
      );
    }

    return createRLNEncoder({
      encoder: createEncoder(options),
      rlnInstance: this,
      index: this._credentials.membership.treeIndex,
      credential: this._credentials.identity,
    });
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
