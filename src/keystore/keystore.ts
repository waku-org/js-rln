import type {
  ICipherModule,
  IKeystore as IEipKeystore,
  IPbkdf2KdfModule,
} from "@chainsafe/bls-keystore";
import { create as createEipKeystore } from "@chainsafe/bls-keystore";
import { sha256 } from "ethereum-cryptography/sha256";
import { bytesToHex, utf8ToBytes } from "ethereum-cryptography/utils";
import _ from "lodash";
import { v4 as uuidV4 } from "uuid";

import type { IdentityCredential } from "../rln.js";

import { decryptEipKeystore, keccak256Checksum } from "./cipher.js";
import { isCredentialValid, isKeystoreValid } from "./schema_validator.js";
import type {
  Keccak256Hash,
  MembershipHash,
  Password,
  Sha256Hash,
} from "./types.js";

// see reference
// https://github.com/waku-org/nwaku/blob/f05528d4be3d3c876a8b07f9bb7dfaae8aa8ec6e/waku/waku_keystore/protocol_types.nim#L111
type MembershipInfo = {
  chainId: number;
  address: string;
  treeIndex: number;
};

type NwakuCredential = {
  crypto: {
    cipher: ICipherModule["function"];
    cipherparams: ICipherModule["params"];
    ciphertext: ICipherModule["message"];
    kdf: IPbkdf2KdfModule["function"];
    kdfparams: IPbkdf2KdfModule["params"];
    mac: Sha256Hash;
  };
};

// examples from nwaku
// https://github.com/waku-org/nwaku/blob/f05528d4be3d3c876a8b07f9bb7dfaae8aa8ec6e/tests/test_waku_keystore.nim#L43
// https://github.com/waku-org/nwaku/blob/f05528d4be3d3c876a8b07f9bb7dfaae8aa8ec6e/waku/waku_keystore/keystore.nim#L154C35-L154C38
// important: each credential has it's own password
// important: not compatible with https://eips.ethereum.org/EIPS/eip-2335
interface NwakuKeystore {
  application: string;
  version: string;
  appIdentifier: string;
  credentials: {
    [key: MembershipHash]: NwakuCredential;
  };
}

type KeystoreCreateOptions = {
  application?: string;
  version?: string;
  appIdentifier?: string;
};

type CredentialOptions = {
  identity: IdentityCredential;
  membership: MembershipInfo;
};

export class Keystore {
  private data: NwakuKeystore;

  private constructor(options: KeystoreCreateOptions | NwakuKeystore) {
    this.data = Object.assign(
      {
        application: "waku-rln-relay",
        version: "01234567890abcdef",
        appIdentifier: "0.2",
        credentials: {},
      },
      options
    );
  }

  public static create(options: KeystoreCreateOptions): Keystore {
    return new Keystore(options);
  }

  public static fromString(str: string): Keystore | null {
    try {
      const obj = JSON.parse(str);

      if (!Keystore.isValidNwakuStore(obj)) {
        throw Error("Invalid string, does not match Nwaku Keystore format.");
      }

      return new Keystore(obj);
    } catch (err) {
      console.error("Cannot create Keystore from string:", err);
      return null;
    }
  }

  public static fromObject(obj: NwakuKeystore): Keystore {
    if (!Keystore.isValidNwakuStore(obj)) {
      throw Error("Invalid object, does not match Nwaku Keystore format.");
    }

    return new Keystore(obj);
  }

  public async addCredential(
    options: CredentialOptions,
    password: Password
  ): Promise<MembershipHash> {
    const membershipHash: MembershipHash = Keystore.computeMembershipHash(
      options.membership
    );

    if (this.data.credentials[membershipHash]) {
      throw Error("Credential already exists in the store.");
    }

    // these are not important
    const stubPath = "/stub/path";
    const stubPubkey = new Uint8Array([0]);
    const secret = Keystore.computeIdentityToBytes(options);

    const eipKeystore = await createEipKeystore(
      password,
      secret,
      stubPubkey,
      stubPath
    );
    // need to re-compute checksum since nwaku uses keccak256 instead of sha256
    const checksum = await keccak256Checksum(password, eipKeystore);
    const nwakuCredential = Keystore.fromEipToCredential(eipKeystore, checksum);

    this.data.credentials[membershipHash] = nwakuCredential;
    return membershipHash;
  }

  public async readCredential(
    membershipHash: MembershipHash,
    password: Password
  ): Promise<null | Uint8Array> {
    const nwakuCredential = this.data.credentials[membershipHash];

    if (!nwakuCredential) {
      return null;
    }

    const eipKeystore = Keystore.fromCredentialToEip(nwakuCredential);
    return decryptEipKeystore(password, eipKeystore);
  }

  public removeCredential(hash: MembershipHash): void {
    if (!this.data.credentials[hash]) {
      return;
    }

    delete this.data.credentials[hash];
  }

  public toString(): string {
    return JSON.stringify(this.data);
  }

  private static isValidNwakuStore(obj: unknown): boolean {
    if (!isKeystoreValid(obj)) {
      return false;
    }

    const areCredentialsValid = Object.values(_.get(obj, "credentials", {}))
      .map((c) => isCredentialValid(c))
      .every((v) => v);

    return areCredentialsValid;
  }

  private static fromCredentialToEip(
    credential: NwakuCredential
  ): IEipKeystore {
    const nwakuCrypto = credential.crypto;
    const eipCrypto: IEipKeystore["crypto"] = {
      kdf: {
        function: nwakuCrypto.kdf,
        params: nwakuCrypto.kdfparams,
        message: "",
      },
      cipher: {
        function: nwakuCrypto.cipher,
        params: nwakuCrypto.cipherparams,
        message: nwakuCrypto.ciphertext,
      },
      checksum: {
        // @chainsafe/bls-keystore supports only sha256
        // but nwaku uses keccak256
        // https://github.com/waku-org/nwaku/blob/25d6e52e3804d15f9b61bc4cc6dd448540c072a1/waku/waku_keystore/keyfile.nim#L367
        function: "sha256",
        params: {},
        message: nwakuCrypto.mac,
      },
    };

    return {
      version: 4,
      uuid: uuidV4(),
      description: undefined,
      path: "safe to ignore, not important for decrypt",
      pubkey: "safe to ignore, not important for decrypt",
      crypto: eipCrypto,
    };
  }

  private static fromEipToCredential(
    eipKeystore: IEipKeystore,
    checksum: Keccak256Hash
  ): NwakuCredential {
    const eipCrypto = eipKeystore.crypto;
    const eipKdf = eipCrypto.kdf as IPbkdf2KdfModule;
    return {
      crypto: {
        cipher: eipCrypto.cipher.function,
        cipherparams: eipCrypto.cipher.params,
        ciphertext: eipCrypto.cipher.message,
        kdf: eipKdf.function,
        kdfparams: eipKdf.params,
        // @chainsafe/bls-keystore generates only sha256
        // but nwaku uses keccak256
        // https://github.com/waku-org/nwaku/blob/25d6e52e3804d15f9b61bc4cc6dd448540c072a1/waku/waku_keystore/keyfile.nim#L367
        mac: checksum,
      },
    };
  }

  // follows nwaku implementation
  // https://github.com/waku-org/nwaku/blob/f05528d4be3d3c876a8b07f9bb7dfaae8aa8ec6e/waku/waku_keystore/protocol_types.nim#L111
  private static computeMembershipHash(info: MembershipInfo): string {
    return bytesToHex(
      sha256(utf8ToBytes(`${info.chainId}${info.address}${info.treeIndex}`))
    ).toUpperCase();
  }

  // follows nwaku implementation
  // https://github.com/waku-org/nwaku/blob/f05528d4be3d3c876a8b07f9bb7dfaae8aa8ec6e/waku/waku_keystore/protocol_types.nim#L98
  private static computeIdentityToBytes(
    options: CredentialOptions
  ): Uint8Array {
    return utf8ToBytes(
      JSON.stringify({
        treeIndex: options.membership.treeIndex,
        identityCredential: {
          idCommitment: options.identity.IDCommitment,
          idNullifier: options.identity.IDNullifier,
          idSecretHash: options.identity.IDSecretHash,
          idTrapdoor: options.identity.IDTrapdoor,
        },
        membershipContract: {
          chainId: options.membership.chainId,
          address: options.membership.address,
        },
      })
    );
  }
}