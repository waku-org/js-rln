import chai from "chai";
import spies from "chai-spies";
import * as ethers from "ethers";

import * as rln from "./index.js";

chai.use(spies);

describe("RLN Contract abstraction", () => {
  it("should be able to fetch members from events and store to rln instance", async () => {
    const rlnInstance = await rln.create();

    chai.spy.on(rlnInstance, "insertMember");

    const voidSigner = new ethers.VoidSigner(rln.GOERLI_CONTRACT.address);
    const rlnContract = new rln.RLNContract({
      address: rln.GOERLI_CONTRACT.address,
      provider: voidSigner,
    });

    chai.spy.on(rlnContract, "contract.queryFilter", () =>
      Promise.resolve([mockEvent()])
    );

    await rlnContract.fetchMembers(rlnInstance);

    chai.expect(rlnInstance.insertMember).to.have.been.called();
  });

  it("should register a member by signature", async () => {
    const mockSignature =
      "0xdeb8a6b00a8e404deb1f52d3aa72ed7f60a2ff4484c737eedaef18a0aacb2dfb4d5d74ac39bb71fa358cf2eb390565a35b026cc6272f2010d4351e17670311c21c";

    const rlnInstance = await rln.create();
    const voidSigner = new ethers.VoidSigner(rln.GOERLI_CONTRACT.address);
    const rlnContract = new rln.RLNContract({
      address: rln.GOERLI_CONTRACT.address,
      provider: voidSigner,
    });

    chai.spy.on(rlnContract, "contract.MEMBERSHIP_DEPOSIT", () =>
      Promise.resolve(1)
    );
    const contractSpy = chai.spy.on(rlnContract, "contract.register");

    await rlnContract.registerMember(rlnInstance, mockSignature);

    chai.expect(contractSpy).to.have.been.called();
  });
});

function mockEvent(): ethers.Event {
  return {
    args: {
      pubkey:
        "C4qAaeoqKlLv4Df910gnyuCfKLk7uhIhLZgcQfOMncYJpfZqW+Pdlv3ie6hm4WkGLaS5UIO2QPbyhN4EGx73c8vkTqjv5gK49w/pGIDi+ILMjYqYKexSwJPmPOMn0XM0FDbQ5wwXmZ4SIauYiQM8faZLDk8ltkAsIX/TKA6Dgw0=",
      index: 1,
    },
  } as unknown as ethers.Event;
}
