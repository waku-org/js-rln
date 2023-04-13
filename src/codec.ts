import type {
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IMessage,
  IProtoMessage,
  IRateLimitProof,
} from "@waku/interfaces";
import debug from "debug";

import { RlnMessage, toRLNSignal } from "./message.js";
import { MembershipKey, RLNInstance } from "./rln.js";

const log = debug("waku:rln:encoder");

export class RLNEncoder implements IEncoder {
  public contentTopic: string;
  public ephemeral = false;
  private readonly idKey: Uint8Array;

  constructor(
    private encoder: IEncoder,
    private rlnInstance: RLNInstance,
    private index: number,
    membershipKey: MembershipKey
  ) {
    if (index < 0) throw "invalid membership index";
    this.idKey = membershipKey.IDKey;
    this.contentTopic = encoder.contentTopic;
  }

  async toWire(message: IMessage): Promise<Uint8Array | undefined> {
    message.rateLimitProof = await this.generateProof(message);
    log("Proof generated", message.rateLimitProof);
    return this.encoder.toWire(message);
  }

  async toProtoObj(message: IMessage): Promise<IProtoMessage | undefined> {
    const protoMessage = await this.encoder.toProtoObj(message);
    if (!protoMessage) return;

    protoMessage.rateLimitProof = await this.generateProof(message);
    log("Proof generated", protoMessage.rateLimitProof);
    return protoMessage;
  }

  private async generateProof(message: IMessage): Promise<IRateLimitProof> {
    const signal = toRLNSignal(this.contentTopic, message);

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

export class RLNDecoder<T extends IDecodedMessage>
  implements IDecoder<RlnMessage<T>>
{
  constructor(private rlnInstance: RLNInstance, private decoder: IDecoder<T>) {}

  get contentTopic(): string {
    return this.decoder.contentTopic;
  }

  fromWireToProtoObj(bytes: Uint8Array): Promise<IProtoMessage | undefined> {
    const protoMessage = this.decoder.fromWireToProtoObj(bytes);
    log("Message decoded", protoMessage);
    return Promise.resolve(protoMessage);
  }

  async fromProtoObj(
    pubSubTopic: string,
    proto: IProtoMessage
  ): Promise<RlnMessage<T> | undefined> {
    const msg: T | undefined = await this.decoder.fromProtoObj(
      pubSubTopic,
      proto
    );
    if (!msg) return;
    return new RlnMessage(this.rlnInstance, msg, proto.rateLimitProof);
  }
}
