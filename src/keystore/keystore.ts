import type {
  ICipherModule,
  IKeystore as IEipKeystore,
  IPbkdf2KdfModule,
} from "@chainsafe/bls-keystore";
import {
  create as createEipKeystore,
  decrypt as decryptEipKeystore,
} from "@chainsafe/bls-keystore";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import _ from "lodash";
import { v4 as uuidV4 } from "uuid";

import { sha256 } from "../rln.js";
import type { IdentityCredential } from "../rln.js";

import { isCredentialValid, isKeystoreValid } from "./schema_validator.js";

// on side of nwaku computed like this
// https://github.com/waku-org/nwaku/blob/f05528d4be3d3c876a8b07f9bb7dfaae8aa8ec6e/waku/waku_keystore/protocol_types.nim#L111C90-L111C99
type MembershipHash = string;
type Sha256Hash = string;
type Password = string | Uint8Array;

// needed to compute MembershipHash
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
  application: string;
  version: string;
  appIdentifier: string;
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
    return new Keystore(obj);
  }

  public async addCredential(
    identity: IdentityCredential,
    membershipInfo: MembershipInfo,
    password: Password
  ): Promise<void> {
    const membershipHash: MembershipHash =
      Keystore.computeMembershipHash(membershipInfo);

    if (this.data.credentials[membershipHash]) {
      throw Error("Credential already exists in the store.");
    }

    // these are not important
    const stubPath = "/stub/path";
    const stubPubkey = new Uint8Array([0]);
    const secret = Keystore.computeIdentityToBytes(identity, membershipInfo);

    const eipKeystore = await createEipKeystore(
      password,
      secret,
      stubPubkey,
      stubPath
    );
    const nwakuCredential = Keystore.fromEipToCredential(eipKeystore);

    this.data.credentials[membershipHash] = nwakuCredential;
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
    return decryptEipKeystore(eipKeystore, password);
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
    eipKeystore: IEipKeystore
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
        mac: eipCrypto.checksum.message,
      },
    };
  }

  // follows nwaku implementation
  // https://github.com/waku-org/nwaku/blob/f05528d4be3d3c876a8b07f9bb7dfaae8aa8ec6e/waku/waku_keystore/protocol_types.nim#L111
  private static computeMembershipHash(info: MembershipInfo): string {
    return bytesToUtf8(
      sha256(utf8ToBytes(`${info.chainId}${info.address}${info.treeIndex}`))
    );
  }

  // follows nwaku implementation
  // https://github.com/waku-org/nwaku/blob/f05528d4be3d3c876a8b07f9bb7dfaae8aa8ec6e/waku/waku_keystore/protocol_types.nim#L98
  private static computeIdentityToBytes(
    identity: IdentityCredential,
    membershipInfo: MembershipInfo
  ): Uint8Array {
    // TODO: fix implementation once clarified
    const str = `${JSON.stringify(identity)}=${JSON.stringify(
      membershipInfo
    )}}`;
    return utf8ToBytes(str);
  }
}
