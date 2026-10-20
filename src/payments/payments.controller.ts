import { Body, Controller, Get, Header, Headers, HttpCode, Param, Post, Query, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser, Public, type AuthUser } from '../common/auth.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** The app calls this when the Squad checkout closes. */
  @HttpCode(200)
  @Post(':reference/verify')
  verify(@Param('reference') reference: string, @CurrentUser() user: AuthUser) {
    return this.payments.verify(reference, user.id);
  }

  @Public()
  @HttpCode(200)
  @Post('webhook')
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-squad-encrypted-body') signature: string | undefined, @Body() body: { Event?: string; TransactionRef?: string }) {
    return this.payments.handleWebhook(req.rawBody, signature, body);
  }

  /** Squad redirects here after checkout; we bounce straight back into the app. */
  @Public()
  @Get('return')
  @Header('Content-Type', 'text/html; charset=utf-8')
  returnPage(@Query('ref') ref = '') {
    const safe = ref.replace(/[^A-Z0-9-]/gi, '');
    const deepLink = `brainbox://payment?ref=${safe}`;
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment received</title>
<style>body{font-family:system-ui,sans-serif;background:#F5F4FB;color:#17133A;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}
a{display:inline-block;margin-top:16px;background:#5B3DF5;color:#fff;padding:14px 22px;border-radius:14px;text-decoration:none;font-weight:700}</style></head>
<body><div><h1>Thanks! Returning to BrainBox…</h1><p>If nothing happens, tap the button.</p><a href="${deepLink}">Back to the app</a></div>
<script>location.href=${JSON.stringify(deepLink)}</script></body></html>`;
  }
}
