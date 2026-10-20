import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { firstValueFrom } from 'rxjs';

export type VendResult = { outcome: 'SUCCESS' | 'PENDING' | 'FAILED' | 'UNKNOWN'; reference?: string; raw?: unknown; error?: string };
export type DataPlan = { planCode: string; name: string; priceKobo: bigint };

/** Thin client for Squad (GTBank) payments. Sandbox keys start with "sandbox_". */
@Injectable()
export class SquadService {
  private readonly logger = new Logger(SquadService.name);
  private readonly secret = process.env.SQUAD_SECRET_KEY ?? '';
  private readonly baseUrl = this.secret.startsWith('sandbox_') ? 'https://sandbox-api-d.squadco.com' : 'https://api-d.squadco.com';

  constructor(private readonly http: HttpService) {}

  private headers() {
    if (!this.secret) throw new ServiceUnavailableException('Payments are not set up yet. Add SQUAD_SECRET_KEY to the API .env file.');
    // Never charge real cards from a developer machine by accident.
    if (!this.secret.startsWith('sandbox_') && process.env.NODE_ENV !== 'production' && process.env.SQUAD_ALLOW_LIVE !== 'true') {
      throw new ServiceUnavailableException('A LIVE Squad key is set outside production. Use a sandbox_ key for development, or set SQUAD_ALLOW_LIVE=true.');
    }
    return { Authorization: `Bearer ${this.secret}` };
  }

  async initiate(input: { amountKobo: bigint; email: string; reference: string; callbackUrl: string; metadata?: Record<string, string> }) {
    try {
      const res = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/transaction/initiate`,
          {
            amount: Number(input.amountKobo), // Squad takes kobo
            email: input.email,
            currency: 'NGN',
            initiate_type: 'inline',
            transaction_ref: input.reference,
            callback_url: input.callbackUrl,
            metadata: input.metadata,
          },
          { headers: this.headers() },
        ),
      );
      return res.data.data.checkout_url as string;
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown }; message?: string };
      this.logger.error(`Squad initiate failed: ${JSON.stringify(err.response?.data ?? err.message)}`);
      throw new ServiceUnavailableException("We couldn't start the payment. Please try again in a moment.");
    }
  }

  /** Returns true only when Squad confirms the payment succeeded for the expected amount. */
  async verify(reference: string, expectedKobo: bigint) {
    try {
      const res = await firstValueFrom(this.http.get(`${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, { headers: this.headers() }));
      const data = res.data?.data ?? {};
      const status = String(data.transaction_status ?? '').toLowerCase();
      const amount = Number(data.transaction_amount);
      const amountOk = amount === Number(expectedKobo);
      if (status === 'success' && !amountOk) this.logger.error(`Amount mismatch for ${reference}: got ${amount}, expected ${expectedKobo}`);
      return { success: status === 'success' && amountOk, status, raw: data };
    } catch (e: unknown) {
      const err = e as { response?: { status?: number }; message?: string };
      if (err.response?.status === 400 || err.response?.status === 404) return { success: false, status: 'pending', raw: null };
      this.logger.error(`Squad verify failed: ${err.message}`);
      throw new ServiceUnavailableException("We couldn't check the payment just now. Please try again.");
    }
  }

  /** Full refund back to the card or account the parent paid with. Squad settles it asynchronously. */
  async refund(input: { transactionRef: string; gatewayRef: string; reason: string }) {
    try {
      const res = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/transaction/refund`,
          { gateway_transaction_ref: input.gatewayRef, transaction_ref: input.transactionRef, refund_type: 'Full', reason_for_refund: input.reason },
          { headers: this.headers() },
        ),
      );
      return { refundReference: String(res.data?.data?.refund_reference ?? ''), status: String(res.data?.data?.gateway_refund_status ?? 'pending') };
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown }; message?: string };
      this.logger.error(`Squad refund failed for ${input.transactionRef}: ${JSON.stringify(err.response?.data ?? err.message)}`);
      throw new ServiceUnavailableException('Squad did not accept the refund. Try again, or refund it from the Squad dashboard.');
    }
  }

  /** Throws the same friendly error as any call would when Squad isn't set up, before we touch anyone's money. */
  assertReady() {
    this.headers();
  }

  /**
   * Sends airtime or data from our Squad balance. Squad takes no reference of ours, so a send must never be retried blindly:
   * UNKNOWN means we don't know whether it went, and someone has to check the Squad dashboard.
   */
  async vend(input: { kind: 'AIRTIME' | 'DATA'; phone: string; amountKobo: bigint; planCode?: string }): Promise<VendResult> {
    const naira = Number(input.amountKobo / 100n);
    const path = input.kind === 'AIRTIME' ? '/vending/purchase/airtime' : '/vending/purchase/data';
    const body = input.kind === 'AIRTIME' ? { phone_number: input.phone, amount: naira } : { phone_number: input.phone, amount: naira, plan_code: input.planCode };
    try {
      const res = await firstValueFrom(this.http.post(`${this.baseUrl}${path}`, body, { headers: this.headers(), timeout: 30_000 }));
      const data = res.data?.data ?? {};
      const status = String(data.status ?? '').toLowerCase();
      const outcome = status === 'success' ? 'SUCCESS' : status === 'failed' ? 'FAILED' : res.data?.success === false ? 'FAILED' : 'PENDING';
      return { outcome, reference: data.reference ? String(data.reference) : undefined, raw: res.data };
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = err.response?.status;
      // Squad answered and said no (bad number, no balance, bad key): nothing was sent.
      if (status && status >= 400 && status < 500) {
        this.logger.warn(`Squad refused a ${input.kind} send: ${status} ${JSON.stringify(err.response?.data)}`);
        return { outcome: 'FAILED', error: err.response?.data?.message || `Squad refused it (${status})`, raw: err.response?.data };
      }
      this.logger.error(`Squad ${input.kind} send had no clear answer: ${status ?? ''} ${err.message}`);
      return { outcome: 'UNKNOWN', error: status ? `Squad error ${status}` : (err.message ?? 'No answer from Squad') };
    }
  }

  /** Data plans Squad sells on a network, cheapest first. */
  async dataBundles(network: string): Promise<DataPlan[]> {
    try {
      const res = await firstValueFrom(this.http.get(`${this.baseUrl}/vending/data-bundles`, { params: { network }, headers: this.headers() }));
      const rows = (res.data?.data ?? []) as { plan_code: string; bundle_value: string; bundle_validity: string; bundle_price: string }[];
      return rows
        .map((r) => ({ planCode: String(r.plan_code), name: `${r.bundle_value.trim()}, ${r.bundle_validity.trim()}`, priceKobo: BigInt(Math.round(Number(r.bundle_price) * 100)) }))
        .filter((r) => r.priceKobo > 0n)
        .sort((a, b) => (a.priceKobo < b.priceKobo ? -1 : 1));
    } catch (e: unknown) {
      this.logger.error(`Squad data bundles for ${network} failed: ${(e as Error).message}`);
      throw new ServiceUnavailableException("We couldn't load data plans just now. Please try again.");
    }
  }

  /** Where a send stands now, looked up by the reference Squad gave us. null when Squad doesn't know it (yet). */
  async vendStatus(reference: string): Promise<'success' | 'pending' | 'failed' | null> {
    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}/vending/transactions`, { params: { page: 1, perPage: 5, action: 'debit', reference }, headers: this.headers() }),
    );
    const row = ((res.data?.data?.rows ?? []) as { reference: string; status: string }[]).find((r) => r.reference === reference);
    const status = row?.status?.toLowerCase();
    return status === 'success' || status === 'pending' || status === 'failed' ? status : null;
  }

  /** Webhook signature: HMAC-SHA512 of the raw body with the secret key, in x-squad-encrypted-body. */
  isValidSignature(rawBody: Buffer, signature: string | undefined) {
    if (!signature || !this.secret) return false;
    const expected = createHmac('sha512', this.secret).update(rawBody).digest('hex').toUpperCase();
    const given = signature.toUpperCase();
    return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given));
  }
}
