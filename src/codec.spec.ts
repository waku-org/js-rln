import { expect } from "chai";
import {
  DecoderV0,
  EncoderV0,
  MessageV0,
} from "js-waku/lib/waku_message/version_0";

import { RLNDecoder, RLNEncoder } from "./codec.js";
import { RlnMessage } from "./message.js";

import * as rln from "./index.js";

const TestContentTopic = "/test/1/waku-message/utf8";

describe("js-rln: encoder", () => {
  it("should attach a proof to a waku message when using toWire", async function () {
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
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      new DecoderV0(TestContentTopic)
    );

    const bytes = await rlnEncoder.toWire({ payload });

    expect(bytes).to.not.be.undefined;
    const protoResult = await rlnDecoder.fromWireToProtoObj(bytes!);

    expect(protoResult).to.not.be.undefined;
    const msg = (await rlnDecoder.fromProtoObj(protoResult!))!;

    expect(msg.rateLimitProof).to.not.be.undefined;
    expect(msg.verify()).to.be.true;
    expect(msg.epoch).to.not.be.undefined;
    expect(msg.epoch).to.be.gt(0);

    expect(msg.contentTopic).to.eq(TestContentTopic);
    expect(msg.msg.version).to.eq(0);
    expect(msg.payload).to.deep.eq(payload);
    expect(msg.timestamp).to.not.be.undefined;
  });

  it("should attach a proof to a waku message when using toProtoObj", async function () {
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
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      new DecoderV0(TestContentTopic)
    );

    const proto = await rlnEncoder.toProtoObj({ payload });

    expect(proto).to.not.be.undefined;
    const msg = (await rlnDecoder.fromProtoObj(
      proto!
    )) as RlnMessage<MessageV0>;

    expect(msg).to.not.be.undefined;
    expect(msg.rateLimitProof).to.not.be.undefined;

    expect(msg.verify()).to.be.true;
    expect(msg.epoch).to.not.be.undefined;
    expect(msg.epoch).to.be.gt(0);

    expect(msg.contentTopic).to.eq(TestContentTopic);
    expect(msg.msg.version).to.eq(0);
    expect(msg.payload).to.deep.eq(payload);
    expect(msg.timestamp).to.not.be.undefined;
  });
});
