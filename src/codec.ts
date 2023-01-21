import debug from "debug";
import {
  Decoder,
  Encoder,
  Message,
  ProtoMessage,
  RateLimitProof,
} from "js-waku/lib/interfaces";

import { RlnMessage, toRLNSignal } from "./message";
import { MembershipKey, RLNInstance } from "./rln";

const log = debug("waku:rln:encoder");

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

  async toWire(message: Partial<Message>): Promise<Uint8Array | undefined> {
    message.contentTopic = this.contentTopic;
    message.rateLimitProof = await this.generateProof(message);
    log("Proof generated", message.rateLimitProof);
    return this.encoder.toWire(message);
  }

  async toProtoObj(
    message: Partial<Message>
  ): Promise<ProtoMessage | undefined> {
    message.contentTopic = this.contentTopic;
    const protoMessage = await this.encoder.toProtoObj(message);
    if (!protoMessage) return;

    protoMessage.rateLimitProof = await this.generateProof(message);
    log("Proof generated", protoMessage.rateLimitProof);
    return protoMessage;
  }

  private async generateProof(
    message: Partial<Message>
  ): Promise<RateLimitProof> {
    const signal = toRLNSignal(message);

    console.time("proof_gen_timer");
    const proof = await this.rlnInstance.generateRLNProof(
      signal,
      this.index,
      message.timestamp,
      this.idKey
    );
    console.timeEnd("proof_gen_timer");
    return proof;
  }
}

export class RLNDecoder<T extends Message> implements Decoder<RlnMessage<T>> {
  constructor(private rlnInstance: RLNInstance, private decoder: Decoder<T>) {}

  get contentTopic(): string {
    return this.decoder.contentTopic;
  }

  fromWireToProtoObj(bytes: Uint8Array): Promise<ProtoMessage | undefined> {
    const protoMessage = this.decoder.fromWireToProtoObj(bytes);
    log("Message decoded", protoMessage);
    return Promise.resolve(protoMessage);
  }

  async fromProtoObj(proto: ProtoMessage): Promise<RlnMessage<T> | undefined> {
    const msg: T | undefined = await this.decoder.fromProtoObj(proto);
    if (!msg) return;
    return new RlnMessage(this.rlnInstance, msg, proto.rateLimitProof);
  }
}
