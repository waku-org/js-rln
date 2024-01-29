import type { IdentityCredential } from "../rln.js";

export type MembershipHash = string;
export type Sha256Hash = string;
export type Keccak256Hash = string;
export type Password = string | Uint8Array;

// see reference
// https://github.com/waku-org/nwaku/blob/f05528d4be3d3c876a8b07f9bb7dfaae8aa8ec6e/waku/waku_keystore/protocol_types.nim#L111
export type MembershipInfo = {
  chainId: number;
  address: string;
  treeIndex: number;
};

export type KeystoreEntity = {
  identity: IdentityCredential;
  membership: MembershipInfo;
};
