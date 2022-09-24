import { assert, expect } from "chai";

import * as rln from "./index";

describe("js-rln", () => {
  it("should verify a proof", async function () {
    const rlnInstance = await rln.create();

    const memKeys = rlnInstance.generateMembershipKey();

    //peer's index in the Merkle Tree
    const index = 5;

    // Create a Merkle tree with random members
    for (let i = 0; i < 10; i++) {
      if (i == index) {
        // insert the current peer's pk
        rlnInstance.insertMember(memKeys.IDCommitment);
      } else {
        // create a new key pair
        rlnInstance.insertMember(
          rlnInstance.generateMembershipKey().IDCommitment
        );
      }
    }

    // prepare the message
    const uint8Msg = Uint8Array.from(
      "Hello World".split("").map((x) => x.charCodeAt(0))
    );

    // setting up the epoch
    const epoch = new Date();

    // generating proof
    const proof = await rlnInstance.generateProof(
      uint8Msg,
      index,
      epoch,
      memKeys.IDKey
    );

    try {
      // verify the proof
      const verifResult = rlnInstance.verifyProof(proof);
      expect(verifResult).to.be.true;
    } catch (err) {
      assert.fail(0, 1, "should not have failed proof verification");
    }

    try {
      // Modifying the proof so it's invalid
      const proofBytes = proof.toBytes();
      proofBytes[7] = Math.floor(Math.random() * 256) % 255;

      // verify the proof
      const verifResult = rlnInstance.verifyProof(proofBytes);
      expect(verifResult).to.be.false;
    } catch (err) {
      //
    }
  });
});
