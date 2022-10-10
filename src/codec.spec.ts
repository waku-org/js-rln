import { expect } from "chai";
import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey,
} from "js-waku";
import {
  DecoderV0,
  EncoderV0,
  MessageV0,
} from "js-waku/lib/waku_message/version_0";
import {
  AsymDecoder,
  AsymEncoder,
  SymDecoder,
  SymEncoder,
} from "js-waku/lib/waku_message/version_1";

import { RLNDecoder, RLNEncoder } from "./codec.js";
import { epochBytesToInt } from "./epoch.js";
import { RlnMessage } from "./message.js";

import * as rln from "./index.js";

const TestContentTopic = "/test/1/waku-message/utf8";

describe("RLN codec with version 0", () => {
  it("toWire", async function () {
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

  it("toProtoObj", async function () {
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

describe("RLN codec with version 1", () => {
  it("Symmetric, toWire", async function () {
    const rlnInstance = await rln.create();
    const memKeys = rlnInstance.generateMembershipKey();
    const index = 0;
    const payload = new Uint8Array([1, 2, 3, 4, 5]);

    rlnInstance.insertMember(memKeys.IDCommitment);

    const symKey = generateSymmetricKey();

    const rlnEncoder = new RLNEncoder(
      new SymEncoder(TestContentTopic, symKey),
      rlnInstance,
      index,
      memKeys
    );
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      new SymDecoder(TestContentTopic, symKey)
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
    expect(msg.msg.version).to.eq(1);
    expect(msg.payload).to.deep.eq(payload);
    expect(msg.timestamp).to.not.be.undefined;
  });

  it("Symmetric, toProtoObj", async function () {
    const rlnInstance = await rln.create();
    const memKeys = rlnInstance.generateMembershipKey();
    const index = 0;
    const payload = new Uint8Array([1, 2, 3, 4, 5]);

    rlnInstance.insertMember(memKeys.IDCommitment);

    const symKey = generateSymmetricKey();

    const rlnEncoder = new RLNEncoder(
      new SymEncoder(TestContentTopic, symKey),
      rlnInstance,
      index,
      memKeys
    );
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      new SymDecoder(TestContentTopic, symKey)
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
    expect(msg.msg.version).to.eq(1);
    expect(msg.payload).to.deep.eq(payload);
    expect(msg.timestamp).to.not.be.undefined;
  });

  it("Asymmetric, toWire", async function () {
    const rlnInstance = await rln.create();
    const memKeys = rlnInstance.generateMembershipKey();
    const index = 0;
    const payload = new Uint8Array([1, 2, 3, 4, 5]);

    rlnInstance.insertMember(memKeys.IDCommitment);

    const privateKey = generatePrivateKey();
    const publicKey = getPublicKey(privateKey);

    const rlnEncoder = new RLNEncoder(
      new AsymEncoder(TestContentTopic, publicKey),
      rlnInstance,
      index,
      memKeys
    );
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      new AsymDecoder(TestContentTopic, privateKey)
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
    expect(msg.msg.version).to.eq(1);
    expect(msg.payload).to.deep.eq(payload);
    expect(msg.timestamp).to.not.be.undefined;
  });

  it("Asymmetric, toProtoObj", async function () {
    const rlnInstance = await rln.create();
    const memKeys = rlnInstance.generateMembershipKey();
    const index = 0;
    const payload = new Uint8Array([1, 2, 3, 4, 5]);

    rlnInstance.insertMember(memKeys.IDCommitment);

    const privateKey = generatePrivateKey();
    const publicKey = getPublicKey(privateKey);

    const rlnEncoder = new RLNEncoder(
      new AsymEncoder(TestContentTopic, publicKey),
      rlnInstance,
      index,
      memKeys
    );
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      new AsymDecoder(TestContentTopic, privateKey)
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
    expect(msg.msg.version).to.eq(1);
    expect(msg.payload).to.deep.eq(payload);
    expect(msg.timestamp).to.not.be.undefined;
  });
});

describe("RLN Codec - epoch", () => {
  it("toProtoObj", async function () {
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

    const epochBytes = proto!.rateLimitProof!.epoch;
    const epoch = epochBytesToInt(epochBytes);

    expect(msg).to.not.be.undefined;
    expect(msg.rateLimitProof).to.not.be.undefined;

    expect(msg.verify()).to.be.true;
    expect(msg.epoch).to.not.be.undefined;
    expect(msg.epoch!.toString(10).length).to.eq(9);
    expect(msg.epoch).to.eq(epoch);

    expect(msg.contentTopic).to.eq(TestContentTopic);
    expect(msg.msg.version).to.eq(0);
    expect(msg.payload).to.deep.eq(payload);
    expect(msg.timestamp).to.not.be.undefined;
  });
});
