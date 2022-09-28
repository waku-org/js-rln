import { writeUIntLE } from "./byte_utils.js";

const DefaultEpochUnitSeconds = 10; // the rln-relay epoch length in seconds

export function dateToEpoch(
  timestamp: Date,
  epochUnitSeconds: number = DefaultEpochUnitSeconds
): Uint8Array {
  const unix = Math.floor(timestamp.getTime() / 1000 / epochUnitSeconds);
  return writeUIntLE(new Uint8Array(32), unix, 0, 8);
}
