import init, * as zerokitRLN from "@waku/zerokit-rln-wasm";
import { RateLimitProof } from "js-waku/lib/interfaces";

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

// Adapted from https://github.com/feross/buffer

function checkInt(
  buf: Uint8Array,
  value: number,
  offset: number,
  ext: number,
  max: number,
  min: number
): void {
  if (value > max || value < min)
    throw new RangeError('"value" argument is out of bounds');
  if (offset + ext > buf.length) throw new RangeError("Index out of range");
}

const writeUIntLE = function writeUIntLE(
  buf: Uint8Array,
  value: number,
  offset: number,
  byteLength: number,
  noAssert?: boolean
): Uint8Array {
  value = +value;
  offset = offset >>> 0;
  byteLength = byteLength >>> 0;
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(buf, value, offset, byteLength, maxBytes, 0);
  }

  let mul = 1;
  let i = 0;
  buf[offset] = value & 0xff;
  while (++i < byteLength && (mul *= 0x100)) {
    buf[offset + i] = (value / mul) & 0xff;
  }

  return buf;
};

const DefaultEpochUnitSeconds = 10; // the rln-relay epoch length in seconds

export function toEpoch(
  timestamp: Date,
  epochUnitSeconds: number = DefaultEpochUnitSeconds
): Uint8Array {
  const unix = Math.floor(timestamp.getTime() / 1000 / epochUnitSeconds);
  return writeUIntLE(new Uint8Array(32), unix, 0, 8);
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

function proofToBytes(p: RateLimitProof): Uint8Array {
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

  insertMember(idCommitment: Uint8Array): void {
    zerokitRLN.insertMember(this.zkRLN, idCommitment);
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

  async generateProof(
    msg: Uint8Array,
    index: number,
    epoch: Uint8Array | Date | undefined,
    idKey: Uint8Array
  ): Promise<RateLimitProof> {
    if (epoch == undefined) {
      epoch = toEpoch(new Date());
    } else if (epoch instanceof Date) {
      epoch = toEpoch(epoch);
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

  verifyProof(proof: RateLimitProof | Uint8Array): boolean {
    let pBytes: Uint8Array;
    if (proof instanceof Uint8Array) {
      pBytes = proof;
    } else {
      pBytes = proofToBytes(proof);
    }
    return zerokitRLN.verifyProof(this.zkRLN, pBytes);
  }
}
