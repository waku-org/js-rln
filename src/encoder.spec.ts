import { expect } from "chai";
import {
  DecoderV0,
  EncoderV0,
  MessageV0,
} from "js-waku/lib/waku_message/version_0";

import { RLNDecoder, RLNEncoder } from "./encoder.js";

import * as rln from "./index.js";

const TestContentTopic = "/test/1/waku-message/utf8";

describe("js-rln: encoder", () => {
  it("should attach a proof to a waku message", async function () {
    const rlnInstance = await rln.create();
    const memKeys = rlnInstance.generateMembershipKey();
    const index = 0;
    const payload = new Uint8Array([1, 2, 3, 4, 5]);

    rlnInstance.insertMember(memKeys.IDCommitment);

    const rlnEncoder = new RLNEncoder(
      new EncoderV0(TestContentTopic),
      rlnInstance,
      index,
      memKeys
    );
    const rlnDecoder = new RLNDecoder(new DecoderV0(TestContentTopic));

    const bytes = await rlnEncoder.encode({ payload });
    const protoResult = await rlnDecoder.decodeProto(bytes!);

    const msg = (await rlnDecoder.decode(protoResult!))!;

    // Validate proof
    const verifResult = rlnInstance.verifyProof(msg.rateLimitProof!);
    expect(verifResult).to.be.true;

    const msgV0 = msg as MessageV0;
    expect(msgV0.contentTopic).to.eq(TestContentTopic);
    expect(msgV0.version).to.eq(0);
    expect(msgV0.payload).to.deep.eq(payload);
    expect(msgV0.timestamp).to.not.be.undefined;
  });
});
