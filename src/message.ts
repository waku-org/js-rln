import { utils } from "js-waku";
import { Message, RateLimitProof } from "js-waku/lib/interfaces";

import { epochBytesToInt } from "./epoch";
import { RLNInstance } from "./rln";

export function toRLNSignal(msg: Partial<Message>): Uint8Array {
  const contentTopicBytes = utils.utf8ToBytes(msg.contentTopic ?? "");
  return new Uint8Array([...(msg.payload ?? []), ...contentTopicBytes]);
}

export class RlnMessage<T extends Message> implements Message {
  constructor(
    public rlnInstance: RLNInstance,
    public msg: T,
    public rateLimitProof: RateLimitProof | undefined
  ) {}

  public verify(): boolean | undefined {
    return this.rateLimitProof
      ? this.rlnInstance.verifyWithRoots(this.rateLimitProof, toRLNSignal(this)) // this.rlnInstance.verifyRLNProof once issue status-im/nwaku#1248 is fixed
      : undefined;
  }

  public verifyNoRoot(): boolean | undefined {
    return this.rateLimitProof
      ? this.rlnInstance.verifyWithNoRoot(
          this.rateLimitProof,
          toRLNSignal(this)
        ) // this.rlnInstance.verifyRLNProof once issue status-im/nwaku#1248 is fixed
      : undefined;
  }

  get payload(): Uint8Array | undefined {
    return this.msg.payload;
  }

  get contentTopic(): string | undefined {
    return this.msg.contentTopic;
  }

  get timestamp(): Date | undefined {
    return this.msg.timestamp;
  }

  get epoch(): number | undefined {
    const bytes = this.msg.rateLimitProof?.epoch;
    if (!bytes) return;

    return epochBytesToInt(bytes);
  }
}
