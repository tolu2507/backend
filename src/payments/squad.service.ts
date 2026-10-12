import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { firstValueFrom } from 'rxjs';

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

  /** Webhook signature: HMAC-SHA512 of the raw body with the secret key, in x-squad-encrypted-body. */
  isValidSignature(rawBody: Buffer, signature: string | undefined) {
    if (!signature || !this.secret) return false;
    const expected = createHmac('sha512', this.secret).update(rawBody).digest('hex').toUpperCase();
    const given = signature.toUpperCase();
    return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given));
  }
}
