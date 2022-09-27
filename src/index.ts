import type { Proof, RLNInstance } from "./rln.js";
import { MembershipKey } from "./rln.js";

// reexport the create function, dynamically imported from rln.ts
export async function create(): Promise<RLNInstance> {
  // A dependency graph that contains any wasm must all be imported
  // asynchronously. This file does the single async import, so
  // that no one else needs to worry about it again.
  const rlnModule = await import("./rln.js");
  return await rlnModule.create();
}

export { RLNInstance, MembershipKey, Proof };
