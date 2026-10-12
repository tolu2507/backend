/** Money is kobo in BigInt everywhere. JSON can't hold BigInt, so it's sent as a string. */
declare global {
  interface BigInt {
    toJSON(): string;
  }
}
BigInt.prototype.toJSON = function toJSON(this: bigint) {
  return this.toString();
};

export const kobo = (value: string | number | bigint) => BigInt(value);

/** basis points: 1500 = 15% */
export const applyBp = (amount: bigint, bp: number) => (amount * BigInt(bp)) / 10_000n;

export const formatNaira = (k: bigint) => `₦${(Number(k) / 100).toLocaleString('en-NG')}`;
