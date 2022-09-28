const DefaultEpochUnitSeconds = 10; // the rln-relay epoch length in seconds

export function dateToEpoch(
  timestamp: Date,
  epochUnitSeconds: number = DefaultEpochUnitSeconds
): number {
  const time = timestamp.getTime();
  return Math.floor(time / 1000 / epochUnitSeconds);
}

export function epochIntToBytes(epoch: number): Uint8Array {
  const bytes = new Uint8Array(32);
  const db = new DataView(bytes.buffer);
  db.setUint32(0, epoch, true);
  return bytes;
}

export function epochBytesToInt(bytes: Uint8Array): number {
  const dv = new DataView(bytes.buffer);
  return dv.getUint32(0, true);
}
