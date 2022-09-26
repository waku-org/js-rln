import debug from "debug";
import { proto_message } from "js-waku";
import {
  Decoder,
  Encoder,
  Message,
  ProtoMessage,
} from "js-waku/lib/interfaces";

import { MembershipKey, RLNInstance } from "./rln.js";

const log = debug("waku:message:rln-encoder");

export class RLNEncoder implements Encoder {
  public contentTopic: string;

  private idKey: Uint8Array;

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

  toRLNSignal(msg: Message): Uint8Array {
    const contentTopic = msg.contentTopic ?? "";
    const contentTopicBytes = Uint8Array.from(
      contentTopic.split("").map((x: string) => x.charCodeAt(0))
    );
    return new Uint8Array([...(msg.payload ?? []), ...contentTopicBytes]);
  }

  async encodeProto(message: Message): Promise<ProtoMessage | undefined> {
    const protoMessage = await this.encoder.encodeProto(message);
    if (!protoMessage) return;

    const signal = this.toRLNSignal(message);

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

export class RLNDecoder implements Decoder<Message> {
  public contentTopic: string;

  constructor(private decoder: Decoder<Message>) {
    this.contentTopic = decoder.contentTopic;
  }

  decodeProto(bytes: Uint8Array): Promise<ProtoMessage | undefined> {
    const protoMessage = proto_message.WakuMessage.decode(bytes);
    log("Message decoded", protoMessage);
    return Promise.resolve(protoMessage);
  }

  async decode(proto: ProtoMessage): Promise<Message | undefined> {
    const msg = await this.decoder.decode(proto);
    if (msg) {
      msg.rateLimitProof = proto.rateLimitProof;
    }
    return msg;
  }
}
