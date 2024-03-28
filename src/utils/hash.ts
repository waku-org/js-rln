import * as mod from "@noble/curves/abstract/modular";
import { bytesToNumberLE, numberToBytesLE } from "@noble/curves/abstract/utils";
import { bn254 } from "@noble/curves/bn254";
import { keccak_256 } from "@noble/hashes/sha3";
import * as zerokitRLN from "@waku/zerokit-rln-wasm";

import { concatenate, writeUIntLE } from "./bytes.js";

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

export function hashToBN254(data: Uint8Array): Uint8Array {
  // Hash the data using Keccak256
  const hashed = keccak_256(data);

  // Convert hash to a field element (big integer modulo BN254 field order)
  const fieldElement = mod.mod(bytesToNumberLE(hashed), bn254.CURVE.Fp.ORDER);

  // Convert the field element back to bytes, ensuring 32 bytes length
  const fixedLenBytes = numberToBytesLE(fieldElement, 32);

  return fixedLenBytes;
}
