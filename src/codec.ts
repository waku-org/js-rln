import type {
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IMessage,
  IProtoMessage,
  IRateLimitProof
} from "@waku/interfaces";
import debug from "debug";

import type { IdentityCredential } from "./identity.js";
import { RlnMessage, toRLNSignal } from "./message.js";
import { RLNInstance } from "./rln.js";

const log = debug("waku:rln:encoder");

export class RLNEncoder implements IEncoder {
  private readonly idSecretHash: Uint8Array;
  private readonly idCommitment: bigint;

  constructor(
    private encoder: IEncoder,
    private rlnInstance: RLNInstance,
    private index: number,
    identityCredential: IdentityCredential,
    private readonly fetchMembersFromService: boolean = false
  ) {
    if (index < 0) throw "invalid membership index";
    this.idSecretHash = identityCredential.IDSecretHash;
    this.idCommitment = identityCredential.IDCommitmentBigInt;
  }

  async toWire(message: IMessage): Promise<Uint8Array | undefined> {
    message.rateLimitProof = await this.generateProof(message);
    log("Proof generated", message.rateLimitProof);
    return this.encoder.toWire(message);
  }

  async toProtoObj(message: IMessage): Promise<IProtoMessage | undefined> {
    const protoMessage = await this.encoder.toProtoObj(message);
    if (!protoMessage) return;

    protoMessage.contentTopic = this.contentTopic;
    protoMessage.rateLimitProof = await this.generateProof(message);
    log("Proof generated", protoMessage.rateLimitProof);
    return protoMessage;
  }

  private async generateProof(message: IMessage): Promise<IRateLimitProof> {
    const signal = toRLNSignal(this.contentTopic, message);
    const proof = await this.rlnInstance.zerokit.generateRLNProof(
      signal,
      this.index,
      message.timestamp,
      this.idSecretHash,
      this.idCommitment,
      this.fetchMembersFromService
    );
    return proof;
  }

  get pubsubTopic(): string {
    return this.encoder.pubsubTopic;
  }

  get contentTopic(): string {
    return this.encoder.contentTopic;
  }

  get ephemeral(): boolean {
    return this.encoder.ephemeral;
  }
}

type RLNEncoderOptions = {
  encoder: IEncoder;
  rlnInstance: RLNInstance;
  index: number;
  credential: IdentityCredential;
  fetchMembersFromService: boolean;
};

export const createRLNEncoder = (options: RLNEncoderOptions): RLNEncoder => {
  return new RLNEncoder(
    options.encoder,
    options.rlnInstance,
    options.index,
    options.credential,
    options.fetchMembersFromService
  );
};

export class RLNDecoder<T extends IDecodedMessage>
  implements IDecoder<RlnMessage<T>>
{
  constructor(
    private rlnInstance: RLNInstance,
    private decoder: IDecoder<T>
  ) {}

  get pubsubTopic(): string {
    return this.decoder.pubsubTopic;
  }

  get contentTopic(): string {
    return this.decoder.contentTopic;
  }

  fromWireToProtoObj(bytes: Uint8Array): Promise<IProtoMessage | undefined> {
    const protoMessage = this.decoder.fromWireToProtoObj(bytes);
    log("Message decoded", protoMessage);
    return Promise.resolve(protoMessage);
  }

  async fromProtoObj(
    pubsubTopic: string,
    proto: IProtoMessage
  ): Promise<RlnMessage<T> | undefined> {
    const msg: T | undefined = await this.decoder.fromProtoObj(
      pubsubTopic,
      proto
    );
    if (!msg) return;
    return new RlnMessage(this.rlnInstance, msg, proto.rateLimitProof);
  }
}

type RLNDecoderOptions<T extends IDecodedMessage> = {
  decoder: IDecoder<T>;
  rlnInstance: RLNInstance;
};

export const createRLNDecoder = <T extends IDecodedMessage>(
  options: RLNDecoderOptions<T>
): RLNDecoder<T> => {
  return new RLNDecoder(options.rlnInstance, options.decoder);
};
