import * as rln from "@waku/rln";

rln.create().then(async rlnInstance => {
    let memKeys = rlnInstance.generateMembershipKey();

    //peer's index in the Merkle Tree
    const index = 5

    // Create a Merkle tree with random members
    for (let i = 0; i < 10; i++) {
        if (i == index) {
            // insert the current peer's pk
            rlnInstance.insertMember(memKeys.IDCommitment);
        } else {
            // create a new key pair
            let memKeys = rlnInstance.generateMembershipKey(); // TODO: handle error
            rlnInstance.insertMember(memKeys.IDCommitment);

        }
    }

    // prepare the message
    const uint8Msg = Uint8Array.from("Hello World".split("").map(x => x.charCodeAt()));

    // setting up the epoch
    const epoch = new Date();

    console.log("Generating proof...");
    console.time("proof_gen_timer");
    let proof = await rlnInstance.generateRLNProof(uint8Msg, index, epoch, memKeys.IDKey)
    console.timeEnd("proof_gen_timer");
    console.log("Proof", proof)

    try {
        // verify the proof
        let verifResult = rlnInstance.verifyRLNProof(proof, uint8Msg);
        console.log("Is proof verified?", verifResult ? "yes" : "no");
    } catch (err) {
        console.log("Invalid proof")
    }
});