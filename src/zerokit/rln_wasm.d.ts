/* tslint:disable */
/* eslint-disable */
/**
*/
export function init_panic_hook(): void;
/**
* @param {number} tree_height
* @param {Uint8Array} zkey
* @param {Uint8Array} vk
* @returns {number}
*/
export function newRLN(tree_height: number, zkey: Uint8Array, vk: Uint8Array): number;
/**
* @param {number} ctx
* @param {Uint8Array} input
* @returns {Uint8Array}
*/
export function getSerializedRLNWitness(ctx: number, input: Uint8Array): Uint8Array;
/**
* @param {number} ctx
* @param {Uint8Array} input
*/
export function insertMember(ctx: number, input: Uint8Array): void;
/**
* @param {number} ctx
* @param {Uint8Array} serialized_witness
* @returns {object}
*/
export function RLNWitnessToJson(ctx: number, serialized_witness: Uint8Array): object;
/**
* @param {number} ctx
* @param {(bigint)[]} calculated_witness
* @param {Uint8Array} serialized_witness
* @returns {Uint8Array}
*/
export function generate_rln_proof_with_witness(ctx: number, calculated_witness: (bigint)[], serialized_witness: Uint8Array): Uint8Array;
/**
* @param {number} ctx
* @returns {Uint8Array}
*/
export function generateMembershipKey(ctx: number): Uint8Array;
/**
* @param {number} ctx
* @param {Uint8Array} proof
* @returns {boolean}
*/
export function verifyProof(ctx: number, proof: Uint8Array): boolean;
/**
*/
export class RLN {
  free(): void;
}
/**
* A struct representing an aborted instruction execution, with a message
* indicating the cause.
*/
export class WasmerRuntimeError {
  free(): void;
}
