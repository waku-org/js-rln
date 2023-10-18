import chai from "chai";
import spies from "chai-spies";
import * as ethers from "ethers";

import * as rln from "./index.js";

chai.use(spies);

describe("RLN Contract abstraction", () => {
  it("should be able to fetch members from events and store to rln instance", async () => {
    const rlnInstance = await rln.create();

    rlnInstance.insertMember = () => undefined;
    const insertMemberSpy = chai.spy.on(rlnInstance, "insertMember");

    const voidSigner = new ethers.VoidSigner(rln.SEPOLIA_CONTRACT.address);
    const rlnContract = new rln.RLNContract(rlnInstance, {
      registryAddress: rln.SEPOLIA_CONTRACT.address,
      provider: voidSigner,
    });

    rlnContract["storageContract"] = {
      queryFilter: () => Promise.resolve([mockEvent()]),
    } as unknown as ethers.Contract;
    rlnContract["_membersFilter"] = {
      address: "",
      topics: [],
    } as unknown as ethers.EventFilter;

    await rlnContract.fetchMembers(rlnInstance);

    chai.expect(insertMemberSpy).to.have.been.called();
  });

  it("should register a member by signature", async () => {
    const mockSignature =
      "0xdeb8a6b00a8e404deb1f52d3aa72ed7f60a2ff4484c737eedaef18a0aacb2dfb4d5d74ac39bb71fa358cf2eb390565a35b026cc6272f2010d4351e17670311c21c";

    const rlnInstance = await rln.create();
    const voidSigner = new ethers.VoidSigner(rln.SEPOLIA_CONTRACT.address);
    const rlnContract = new rln.RLNContract(rlnInstance, {
      registryAddress: rln.SEPOLIA_CONTRACT.address,
      provider: voidSigner,
    });

    rlnContract["storageIndex"] = 1;
    rlnContract["_membersFilter"] = {
      address: "",
      topics: [],
    } as unknown as ethers.EventFilter;
    rlnContract["registryContract"] = {
      register: () =>
        Promise.resolve({ wait: () => Promise.resolve(undefined) }),
    } as unknown as ethers.Contract;
    const contractSpy = chai.spy.on(
      rlnContract["registryContract"],
      "register(uint16,uint256)"
    );

    await rlnContract.registerWithSignature(rlnInstance, mockSignature);

    chai.expect(contractSpy).to.have.been.called();
  });
});

function mockEvent(): ethers.Event {
  return {
    args: {
      idCommitment: "0x9e7d3f8f8c7a1d2bef96a2e8dbb8e7c1ea9a9ab78d6b3c6c3c",
      index: 1,
    },
  } as unknown as ethers.Event;
}
