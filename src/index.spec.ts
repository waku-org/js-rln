import * as rln from "./index";

describe("Waku Filter", () => {
  it("test", async function () {
    const rlnInstance = await rln.create();
    console.log(rlnInstance.generateMembershipKey());
    // TODO: write test
  });
});
