import { Encoder, Message, ProtoMessage } from "js-waku/lib/interfaces";
import * as proto from "js-waku/src/proto/message";

import { RLNInstance } from "./rln.js";

export class RLNEncoder implements Encoder {
  constructor(
    public contentTopic: string,
    private encoder: Encoder,
    private rlnInstance: RLNInstance,
    private index: number,
    private idKey: Uint8Array
  ) {
    if (idKey.length != 32) throw "invalid id key"; // TODO: use proper err message
    if (index < 0) throw "invalid membership index";
  }

  async encode(message: Message): Promise<Uint8Array | undefined> {
    const protoMessage = await this.encodeProto(message);
    if (!protoMessage) return;

    return proto.WakuMessage.encode(protoMessage);
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
