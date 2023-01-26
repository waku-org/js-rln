import { RLNDecoder, RLNEncoder } from "./codec.js";
import { GOERLI_CONTRACT, RLN_ABI } from "./constants.js";
import { Proof, RLNInstance } from "./rln.js";
import { MembershipKey } from "./rln.js";
import { RLNContract } from "./rln_contract.js";

// reexport the create function, dynamically imported from rln.ts
export async function create(): Promise<RLNInstance> {
  // A dependency graph that contains any wasm must all be imported
  // asynchronously. This file does the single async import, so
  // that no one else needs to worry about it again.
  const rlnModule = await import("./rln.js");
  return await rlnModule.create();
}

export {
  RLNInstance,
  MembershipKey,
  Proof,
  RLNEncoder,
  RLNDecoder,
  RLNContract,
  RLN_ABI,
  GOERLI_CONTRACT,
};
