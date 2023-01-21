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

import { RLNDecoder, RLNEncoder } from "./codec";
import { epochBytesToInt } from "./epoch";
import { RlnMessage } from "./message";

import * as rln from "./index";

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

    expect(bytes).toBeDefined();
    const protoResult = await rlnDecoder.fromWireToProtoObj(bytes!);
    expect(protoResult).toBeDefined();
    const msg = (await rlnDecoder.fromProtoObj(protoResult!))!;

    expect(msg.rateLimitProof).toBeDefined();
    expect(msg.verify()).toBe(true);
    expect(msg.verifyNoRoot()).toBe(true);
    expect(msg.epoch).toBeDefined();
    expect(msg.epoch).toBeGreaterThan(0);

    expect(msg.contentTopic).toBe(TestContentTopic);
    expect(msg.msg.version).toBe(0);
    expect(msg.payload).toEqual(payload);
    expect(msg.timestamp).toBeDefined();
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

    expect(proto).toBeDefined();
    const msg = (await rlnDecoder.fromProtoObj(
      proto!
    )) as RlnMessage<MessageV0>;

    expect(msg).toBeDefined();
    expect(msg.rateLimitProof).toBeDefined();

    expect(msg.verify()).toBe(true);
    expect(msg.verifyNoRoot()).toBe(true);
    expect(msg.epoch).toBeDefined();
    expect(msg.epoch).toBeGreaterThan(0);

    expect(msg.contentTopic).toBe(TestContentTopic);
    expect(msg.msg.version).toBe(0);
    expect(msg.payload).toEqual(payload);
    expect(msg.timestamp).toBeDefined();
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

    expect(bytes).toBeDefined();
    const protoResult = await rlnDecoder.fromWireToProtoObj(bytes!);

    expect(protoResult).toBeDefined();
    const msg = (await rlnDecoder.fromProtoObj(protoResult!))!;

    expect(msg.rateLimitProof).toBeDefined();
    expect(msg.verify()).toBe(true);
    expect(msg.verifyNoRoot()).toBe(true);
    expect(msg.epoch).toBeDefined();
    expect(msg.epoch).toBeGreaterThan(0);

    expect(msg.contentTopic).toBe(TestContentTopic);
    expect(msg.msg.version).toBe(1);
    expect(msg.payload).toEqual(payload);
    expect(msg.timestamp).toBeDefined();
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

    expect(proto).toBeDefined();
    const msg = (await rlnDecoder.fromProtoObj(
      proto!
    )) as RlnMessage<MessageV0>;

    expect(msg).toBeDefined();
    expect(msg.rateLimitProof).toBeDefined();

    expect(msg.verify()).toBe(true);
    expect(msg.verifyNoRoot()).toBe(true);
    expect(msg.epoch).toBeDefined();
    expect(msg.epoch).toBeGreaterThan(0);

    expect(msg.contentTopic).toBe(TestContentTopic);
    expect(msg.msg.version).toBe(1);
    expect(msg.payload).toEqual(payload);
    expect(msg.timestamp).toBeDefined();
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

    expect(bytes).toBeDefined();
    const protoResult = await rlnDecoder.fromWireToProtoObj(bytes!);

    expect(protoResult).toBeDefined();
    const msg = (await rlnDecoder.fromProtoObj(protoResult!))!;

    expect(msg.rateLimitProof).toBeDefined();
    expect(msg.verify()).toBe(true);
    expect(msg.verifyNoRoot()).toBe(true);
    expect(msg.epoch).toBeDefined();
    expect(msg.epoch).toBeGreaterThan(0);

    expect(msg.contentTopic).toBe(TestContentTopic);
    expect(msg.msg.version).toBe(1);
    expect(msg.payload).toEqual(payload);
    expect(msg.timestamp).toBeDefined();
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

    expect(proto).toBeDefined();
    const msg = (await rlnDecoder.fromProtoObj(
      proto!
    )) as RlnMessage<MessageV0>;

    expect(msg).toBeDefined();
    expect(msg.rateLimitProof).toBeDefined();

    expect(msg.verify()).toBe(true);
    expect(msg.verifyNoRoot()).toBe(true);
    expect(msg.epoch).toBeDefined();
    expect(msg.epoch).toBeGreaterThan(0);

    expect(msg.contentTopic).toBe(TestContentTopic);
    expect(msg.msg.version).toBe(1);
    expect(msg.payload).toEqual(payload);
    expect(msg.timestamp).toBeDefined();
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

    expect(proto).toBeDefined();
    const msg = (await rlnDecoder.fromProtoObj(
      proto!
    )) as RlnMessage<MessageV0>;

    const epochBytes = proto!.rateLimitProof!.epoch;
    const epoch = epochBytesToInt(epochBytes);

    expect(msg).toBeDefined();
    expect(msg.rateLimitProof).toBeDefined();

    expect(msg.verify()).toBe(true);
    expect(msg.verifyNoRoot()).toBe(true);
    expect(msg.epoch).toBeDefined();
    expect(msg.epoch!.toString(10).length).toBe(9);
    expect(msg.epoch).toBe(epoch);

    expect(msg.contentTopic).toBe(TestContentTopic);
    expect(msg.msg.version).toBe(0);
    expect(msg.payload).toEqual(payload);
    expect(msg.timestamp).toBeDefined();
  });
});
