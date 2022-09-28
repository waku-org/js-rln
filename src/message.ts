import { Message, RateLimitProof } from "js-waku/lib/interfaces";

import { epochBytesToInt } from "./epoch.js";
import { RLNInstance } from "./rln.js";

export class RlnMessage<T extends Message> implements Message {
  constructor(
    public rlnInstance: RLNInstance,
    public msg: T,
    public rateLimitProof?: RateLimitProof
  ) {}

  public verify(): boolean | undefined {
    return this.rateLimitProof
      ? this.rlnInstance.verifyProof(this.rateLimitProof)
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
