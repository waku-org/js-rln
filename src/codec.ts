import debug from "debug";
import { proto_message, utils } from "js-waku";
import {
  Decoder,
  Encoder,
  Message,
  ProtoMessage,
} from "js-waku/lib/interfaces";

import { RlnMessage } from "./message.js";
import { MembershipKey, RLNInstance } from "./rln.js";

const log = debug("waku:message:rln-encoder");

export class RLNEncoder implements Encoder {
  public contentTopic: string;
  private readonly idKey: Uint8Array;

  constructor(
    private encoder: Encoder,
    private rlnInstance: RLNInstance,
    private index: number,
    membershipKey: MembershipKey
  ) {
    if (index < 0) throw "invalid membership index";
    this.idKey = membershipKey.IDKey;
    this.contentTopic = encoder.contentTopic;
  }

  async encode(message: Message): Promise<Uint8Array | undefined> {
    const protoMessage = await this.encodeProto(message);
    if (!protoMessage) return;
    return proto_message.WakuMessage.encode(protoMessage);
  }

  async encodeProto(message: Message): Promise<ProtoMessage | undefined> {
    const protoMessage = await this.encoder.encodeProto(message);
    if (!protoMessage) return;

    const signal = toRLNSignal(message);

    console.time("proof_gen_timer");
    const proof = await this.rlnInstance.generateProof(
      signal,
      this.index,
      message.timestamp,
      this.idKey
    );
    console.timeEnd("proof_gen_timer");

    protoMessage.rateLimitProof = proof;

    return protoMessage;
  }
}

export class RLNDecoder<T extends Message> implements Decoder<RlnMessage<T>> {
  constructor(private rlnInstance: RLNInstance, private decoder: Decoder<T>) {}

  get contentTopic(): string {
    return this.decoder.contentTopic;
  }

  decodeProto(bytes: Uint8Array): Promise<ProtoMessage | undefined> {
    const protoMessage = proto_message.WakuMessage.decode(bytes);
    log("Message decoded", protoMessage);
    return Promise.resolve(protoMessage);
  }

  async decode(proto: ProtoMessage): Promise<RlnMessage<T> | undefined> {
    const msg: T | undefined = await this.decoder.decode(proto);
    if (!msg) return;
    return new RlnMessage(this.rlnInstance, msg, proto.rateLimitProof);
  }
}

function toRLNSignal(msg: Message): Uint8Array {
  const contentTopicBytes = utils.utf8ToBytes(msg.contentTopic ?? "");
  return new Uint8Array([...(msg.payload ?? []), ...contentTopicBytes]);
}
