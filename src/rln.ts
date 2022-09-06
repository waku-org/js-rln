import * as resources from "./resources";
import * as wc from "./witness_calculator";
import * as zerokitRLN from "./zerokit/rln_wasm";

/**
 * Convert a base64 string into uint8Array
 * @param base64
 * @returns Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

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

const DEPTH = 20;
const VERIFICATION_KEY = base64ToUint8Array(resources.verification_key);
const ZKEY = base64ToUint8Array(resources.zkey);
const CIRCUIT = base64ToUint8Array(resources.circuit);

zerokitRLN.init_panic_hook();

/**
 * Create an instance of RLN
 * @returns RLNInstance
 */
export async function create(): Promise<RLNInstance> {
  const witnessCalculator = await wc.builder(CIRCUIT, false);
  const zkRLN = zerokitRLN.newRLN(DEPTH, ZKEY, VERIFICATION_KEY);
  return new RLNInstance(zkRLN, witnessCalculator);
}

export class MembershipKey {
  readonly IDKey: Uint8Array;
  readonly IDCommitment: Uint8Array;

  constructor(memKeys: Uint8Array) {
    this.IDKey = memKeys.subarray(0, 32);
    this.IDCommitment = memKeys.subarray(32);
  }
}

export class RLNInstance {
  zkRLN: number;
  witnessCalculator: any;

  constructor(zkRLN: number, wc: any) {
    this.zkRLN = zkRLN;
    this.witnessCalculator = wc;
  }

  generateMembershipKey(): MembershipKey {
    const memKeys = zerokitRLN.generateMembershipKey(this.zkRLN);
    return new MembershipKey(memKeys);
  }

  inserMember(idCommitment: Uint8Array): void {
    zerokitRLN.insertMember(this.zkRLN, idCommitment);
  }

  serializeMessage(
    uint8Msg: Uint8Array,
    memIndex: number,
    epoch: Uint8Array,
    idKey: Uint8Array
  ): Uint8Array {
    if (epoch.length != 32) throw "invalid epoch";
    if (idKey.length != 32) throw "invalid id key";

    // calculate message length
    const msgLen = Buffer.allocUnsafe(8);
    msgLen.writeUIntLE(uint8Msg.length, 0, 8);

    // Converting index to LE bytes
    const memIndexBytes = Buffer.allocUnsafe(8);
    memIndexBytes.writeUIntLE(memIndex, 0, 8);

    // [ id_key<32> | id_index<8> | epoch<32> | signal_len<8> | signal<var> ]
    return concatenate(idKey, memIndexBytes, epoch, msgLen, uint8Msg);
  }

  async generateProof(
    msg: Uint8Array,
    index: number,
    epoch: Uint8Array,
    idKey: Uint8Array
  ): Promise<Uint8Array> {
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

    return zerokitRLN.generate_rln_proof_with_witness(
      this.zkRLN,
      calculatedWitness,
      rlnWitness
    );
  }

  verifyProof(proof: Uint8Array): boolean {
    return zerokitRLN.verifyProof(this.zkRLN, proof);
  }
}
