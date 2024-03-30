import { concatBytes, hexToBytes } from "@noble/curves/abstract/utils";
import type { IRateLimitProof } from "@waku/interfaces";
import * as zerokitRLN from "@waku/zerokit-rln-wasm";

import { IdentityCredential } from "./identity.js";
import { Proof, proofToBytes } from "./proof.js";
import { WitnessCalculator } from "./resources/witness_calculator.js";
import { hashToBN254 } from "./utils/hash.js";
import {
  concatenate,
  dateToEpoch,
  epochIntToBytes,
  writeUIntLE
} from "./utils/index.js";

export class Zerokit {
  constructor(
    private zkRLN: number,
    private witnessCalculator: WitnessCalculator
  ) {}

  generateIdentityCredentials(): IdentityCredential {
    const memKeys = zerokitRLN.generateExtendedMembershipKey(this.zkRLN); // TODO: rename this function in zerokit rln-wasm
    return IdentityCredential.fromBytes(memKeys);
  }

  generateSeededIdentityCredential(seed: string): IdentityCredential {
    const stringEncoder = new TextEncoder();
    const seedBytes = stringEncoder.encode(seed);
    // TODO: rename this function in zerokit rln-wasm
    const memKeys = zerokitRLN.generateSeededExtendedMembershipKey(
      this.zkRLN,
      seedBytes
    );
    return IdentityCredential.fromBytes(memKeys);
  }

  insertMember(idCommitment: Uint8Array): void {
    zerokitRLN.insertMember(this.zkRLN, idCommitment);
  }

  insertMembers(index: number, ...idCommitments: Array<Uint8Array>): void {
    // serializes a seq of IDCommitments to a byte seq
    // the order of serialization is |id_commitment_len<8>|id_commitment<var>|
    const idCommitmentLen = writeUIntLE(
      new Uint8Array(8),
      idCommitments.length,
      0,
      8
    );
    const idCommitmentBytes = concatenate(idCommitmentLen, ...idCommitments);
    zerokitRLN.setLeavesFrom(this.zkRLN, index, idCommitmentBytes);
  }

  deleteMember(index: number): void {
    zerokitRLN.deleteLeaf(this.zkRLN, index);
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
    idSecretHash: Uint8Array,
    idCommitment?: bigint,
    fetchMembersFromService: boolean = false
  ): Promise<IRateLimitProof> {
    if (epoch == undefined) {
      epoch = epochIntToBytes(dateToEpoch(new Date()));
    } else if (epoch instanceof Date) {
      epoch = epochIntToBytes(dateToEpoch(epoch));
    }

    if (epoch.length != 32) throw "invalid epoch";
    if (idSecretHash.length != 32) throw "invalid id secret hash";
    if (index < 0) throw "index must be >= 0";

    const serialized_msg = this.serializeMessage(
      msg,
      index,
      epoch,
      idSecretHash
    );

    let rlnWitness;
    if (!fetchMembersFromService) {
      // Assumes merkle tree is maintained locally
      rlnWitness = zerokitRLN.getSerializedRLNWitness(
        this.zkRLN,
        serialized_msg
      );
    } else {
      // Fetch merkle data from a service provider
      if (!idCommitment) {
        throw new Error(
          "Must provide ID commitment if using service to get proof"
        );
      }
      const RLN_IDENTIFIER: Uint8Array = new TextEncoder().encode(
        "zerokit/rln/010203040506070809"
      );

      const fetchUrl = `${process.env.MERKLE_PROOF_SERVICE_URL || "http://localhost:8645/debug/v1/merkleProof"}/${idCommitment}`;
      const response = await fetch(fetchUrl);

      const proofData = await response.json();
      const pathElements: Uint8Array[] = proofData.pathElements.map(hexToBytes);

      // Serialize number of path lements and each hash in path elements to a single Uint8Array
      const pathElementsBytes = new Uint8Array(8 + pathElements.length * 32);
      writeUIntLE(pathElementsBytes, pathElements.length, 0, 8);
      for (let i = 0; i < pathElements.length; i++) {
        pathElementsBytes.set(pathElements[i], 8 + i * 32);
      }
      // Serialize number of path indexes and the indexes themselves to a single Uint8Array
      const pathIndexesBytes = new Uint8Array(8 + proofData.pathIndexes.length);
      writeUIntLE(pathIndexesBytes, proofData.pathIndexes.length, 0, 8);
      for (let i = 0; i < proofData.pathIndexes.length; i++) {
        writeUIntLE(
          pathIndexesBytes,
          parseInt(proofData.pathIndexes[i], 10),
          8 + i,
          1
        );
      }

      const hashToFieldMsg = hashToBN254(serialized_msg);
      const hashToFieldRLNIdentifier = hashToBN254(RLN_IDENTIFIER);
      // Append all Uint8Array elements to a single Uint8Array
      rlnWitness = concatBytes(
        idSecretHash,
        pathElementsBytes,
        pathIndexesBytes,
        hashToFieldMsg,
        epoch,
        hashToFieldRLNIdentifier
      );
    }
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

  verifyRLNProof(
    proof: IRateLimitProof | Uint8Array,
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

    return zerokitRLN.verifyRLNProof(
      this.zkRLN,
      concatenate(pBytes, msgLen, msg)
    );
  }

  verifyWithRoots(
    proof: IRateLimitProof | Uint8Array,
    msg: Uint8Array,
    ...roots: Array<Uint8Array>
  ): boolean {
    let pBytes: Uint8Array;
    if (proof instanceof Uint8Array) {
      pBytes = proof;
    } else {
      pBytes = proofToBytes(proof);
    }
    // calculate message length
    const msgLen = writeUIntLE(new Uint8Array(8), msg.length, 0, 8);

    const rootsBytes = concatenate(...roots);

    return zerokitRLN.verifyWithRoots(
      this.zkRLN,
      concatenate(pBytes, msgLen, msg),
      rootsBytes
    );
  }

  verifyWithNoRoot(
    proof: IRateLimitProof | Uint8Array,
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
