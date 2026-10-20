import { randomInt } from 'node:crypto';

import type { Prisma } from '@prisma/client';

// No 0/O, 1/I/L, 2/Z, 5/S, 8/B: easy to read off a slip and type at a busy counter.
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';

/** Typed with or without the dash, any case: "ada-k7m2" → "ADAK7M2". */
export const normaliseShopCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** "ADAK7M2" → "ADA-K7M2", the way it is printed and shown. */
export const formatShopCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;

/**
 * Every child's tuck-shop ID: three letters of their first name (so staff can sanity-check it)
 * plus four random characters. Checked against the database so it is unique across BrainBox.
 */
export async function newShopCode(tx: Prisma.TransactionClient, firstName: string) {
  const prefix = `${firstName.toUpperCase().replace(/[^A-Z]/g, '')}XXX`.slice(0, 3);
  for (;;) {
    const code = prefix + Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    if (!(await tx.studentProfile.findUnique({ where: { shopCode: code }, select: { id: true } }))) return code;
  }
}
