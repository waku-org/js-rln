import * as rln from "@waku/rln";

rln.create().then(async rlnInstance => {
    const credentials = rlnInstance.generateIdentityCredentials();

    //peer's index in the Merkle Tree
    const index = 5

    // Create a Merkle tree with random members
    for (let i = 0; i < 10; i++) {
        if (i == index) {
            // insert the current peer's pk
            rlnInstance.insertMember(credentials.IDCommitment);
        } else {
            // create a new key pair
            const credentials = rlnInstance.generateIdentityCredentials(); // TODO: handle error
            rlnInstance.insertMember(credentials.IDCommitment);

        }
    }

    // prepare the message
    const uint8Msg = Uint8Array.from("Hello World".split("").map(x => x.charCodeAt()));

    // setting up the epoch
    const epoch = new Date();

    console.log("Generating proof...");
    console.time("proof_gen_timer");
    let proof = await rlnInstance.generateRLNProof(uint8Msg, index, epoch, credentials.IDSecretHash)
    console.timeEnd("proof_gen_timer");
    console.log("Proof", proof)

    try {
        // verify the proof
        let verifResult = rlnInstance.verifyRLNProof(proof, uint8Msg);
        console.log("Is proof verified?", verifResult ? "yes" : "no");
    } catch (err) {
        console.log("Invalid proof")
    }

    const provider = new ethers.providers.Web3Provider(
        window.ethereum,
        "any"
    );

    const DEFAULT_SIGNATURE_MESSAGE =
        "The signature of this message will be used to generate your RLN credentials. Anyone accessing it may send messages on your behalf, please only share with the RLN dApp";  

    const signer = provider.getSigner();
    const signature = await signer.signMessage(DEFAULT_SIGNATURE_MESSAGE);
    console.log(`Got signature: ${signature}`);

    const contract = await rln.RLNContract.init(rlnInstance, {address: rln.GOERLI_CONTRACT.address, provider: signer });

    const event = await contract.registerMember(rlnInstance, signature);
    console.log(`Registered as member with ${event}`);
});
