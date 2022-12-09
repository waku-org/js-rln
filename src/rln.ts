import init, * as zerokitRLN from "@waku/zerokit-rln-wasm";
import { RateLimitProof } from "js-waku/lib/interfaces";

import { writeUIntLE } from "./byte_utils.js";
import { dateToEpoch, epochIntToBytes } from "./epoch.js";
import verificationKey from "./resources/verification_key.js";
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
  await init();
  zerokitRLN.init_panic_hook();
  const witnessCalculator = await loadWitnessCalculator();
  const zkey = await loadZkey();
  const vkey = stringEncoder.encode(JSON.stringify(verificationKey));
  const zkRLN = zerokitRLN.newRLN(DEPTH, zkey, vkey);
  return new RLNInstance(zkRLN, witnessCalculator);
}

export class MembershipKey {
  constructor(
    public readonly IDKey: Uint8Array,
    public readonly IDCommitment: Uint8Array
  ) {}

  static fromBytes(memKeys: Uint8Array): MembershipKey {
    const idKey = memKeys.subarray(0, 32);
    const idCommitment = memKeys.subarray(32);
    return new MembershipKey(idKey, idCommitment);
  }
}

const proofOffset = 128;
const rootOffset = proofOffset + 32;
const epochOffset = rootOffset + 32;
const shareXOffset = epochOffset + 32;
const shareYOffset = shareXOffset + 32;
const nullifierOffset = shareYOffset + 32;
const rlnIdentifierOffset = nullifierOffset + 32;

export class Proof implements RateLimitProof {
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
}

export function proofToBytes(p: RateLimitProof): Uint8Array {
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

export class RLNInstance {
  constructor(
    private zkRLN: number,
    private witnessCalculator: WitnessCalculator
  ) {}

  generateMembershipKey(): MembershipKey {
    const memKeys = zerokitRLN.generateMembershipKey(this.zkRLN);
    return MembershipKey.fromBytes(memKeys);
  }

  generateSeededMembershipKey(seed: string): MembershipKey {
    const seedBytes = stringEncoder.encode(seed);
    const memKeys = zerokitRLN.generateSeededMembershipKey(
      this.zkRLN,
      seedBytes
    );
    return MembershipKey.fromBytes(memKeys);
  }

  insertMember(idCommitment: Uint8Array): void {
    zerokitRLN.insertMember(this.zkRLN, idCommitment);
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
    idKey: Uint8Array
  ): Promise<RateLimitProof> {
    if (epoch == undefined) {
      epoch = epochIntToBytes(dateToEpoch(new Date()));
    } else if (epoch instanceof Date) {
      epoch = epochIntToBytes(dateToEpoch(epoch));
    }

    if (epoch.length != 32) throw "invalid epoch";
    if (idKey.length != 32) throw "invalid id key";
    if (index < 0) throw "index must be >= 0";

    const serialized_msg = this.serializeMessage(msg, index, epoch, idKey);
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

  verifyRLNProof(proof: RateLimitProof | Uint8Array, msg: Uint8Array): boolean {
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
    proof: RateLimitProof | Uint8Array,
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

    // obtain root
    const root = zerokitRLN.getRoot(this.zkRLN);

    return zerokitRLN.verifyWithRoots(
      this.zkRLN,
      concatenate(pBytes, msgLen, msg),
      root
    );
  }

  verifyWithNoRoot(
    proof: RateLimitProof | Uint8Array,
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
