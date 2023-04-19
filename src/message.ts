import type {
  IDecodedMessage,
  IMessage,
  IRateLimitProof,
} from "@waku/interfaces";
import * as utils from "@waku/utils/bytes";

import { epochBytesToInt } from "./epoch.js";
import { RLNInstance } from "./rln.js";

export function toRLNSignal(contentTopic: string, msg: IMessage): Uint8Array {
  const contentTopicBytes = utils.utf8ToBytes(contentTopic ?? "");
  return new Uint8Array([...(msg.payload ?? []), ...contentTopicBytes]);
}

export class RlnMessage<T extends IDecodedMessage> implements IDecodedMessage {
  public pubSubTopic = "";

  constructor(
    public rlnInstance: RLNInstance,
    public msg: T,
    public rateLimitProof: IRateLimitProof | undefined
  ) {}

  public verify(): boolean | undefined {
    return this.rateLimitProof
      ? this.rlnInstance.verifyWithRoots(
          this.rateLimitProof,
          toRLNSignal(this.msg.contentTopic, this.msg)
        ) // this.rlnInstance.verifyRLNProof once issue status-im/nwaku#1248 is fixed
      : undefined;
  }

  public verifyNoRoot(): boolean | undefined {
    return this.rateLimitProof
      ? this.rlnInstance.verifyWithNoRoot(
          this.rateLimitProof,
          toRLNSignal(this.msg.contentTopic, this.msg)
        ) // this.rlnInstance.verifyRLNProof once issue status-im/nwaku#1248 is fixed
      : undefined;
  }

  get payload(): Uint8Array {
    return this.msg.payload;
  }

  get contentTopic(): string {
    return this.msg.contentTopic;
  }

  get timestamp(): Date | undefined {
    return this.msg.timestamp;
  }

  get ephemeral(): boolean | undefined {
    return this.msg.ephemeral;
  }

  get epoch(): number | undefined {
    const bytes = this.msg.rateLimitProof?.epoch;
    if (!bytes) return;

    return epochBytesToInt(bytes);
  }
}
