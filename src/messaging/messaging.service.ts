import { Injectable, Logger } from '@nestjs/common';

import { DEFAULT_PREFS, type NotificationPrefs } from './prefs.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** `url` is an app route opened when the notification is tapped, e.g. "/parent". */
export type Push = { title: string; body: string; url?: string };
type Email = { to: string; subject: string; html: string; text: string };
type Template = { to: string; name: string; params: string[]; /** Copy-code button for one-time codes. */ code?: string };

const GRAPH = 'https://graph.facebook.com/v25.0';

/** Nigerian numbers in the international format WhatsApp wants: 08031234567 → 2348031234567. */
export function toWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  return digits;
}

/**
 * Email (Resend) and WhatsApp (Meta Cloud API). Each channel switches on when its keys are in .env;
 * until then messages are written to the log so development still works.
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Push to the users who left this kind of notification switched on. Fire-and-forget from request
   * handlers: it never throws, so a notification problem can't break the action that caused it.
   */
  notify(userIds: string[], kind: keyof NotificationPrefs, msg: Push) {
    void (async () => {
      const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, notificationPrefs: true } });
      const wanted = users.filter((u) => ({ ...DEFAULT_PREFS, ...(u.notificationPrefs as Partial<NotificationPrefs> | null) })[kind]).map((u) => u.id);
      if (wanted.length) await this.push(wanted, msg);
    })().catch((e: Error) => this.logger.error(`Notify failed: ${e.message}`));
  }

  /** Push to every phone these users are signed in on (Expo push service, free). Never throws. */
  async push(userIds: string[], msg: Push): Promise<number> {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId: { in: userIds } } });
    if (!tokens.length) return 0;
    let sent = 0;
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100);
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch.map((t) => ({ to: t.token, title: msg.title, body: msg.body, sound: 'default', channelId: 'default', data: { url: msg.url } }))),
      }).catch((e: Error) => e);
      if (res instanceof Error || !res.ok) {
        this.logger.error(`Push failed: ${res instanceof Error ? res.message : `${res.status} ${await res.text()}`}`);
        continue;
      }
      const tickets = ((await res.json()) as { data?: { status: string; details?: { error?: string } }[] }).data ?? [];
      const dead = batch.filter((_, j) => tickets[j]?.details?.error === 'DeviceNotRegistered').map((t) => t.token);
      if (dead.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
      sent += tickets.filter((t) => t.status === 'ok').length;
    }
    return sent;
  }

  get emailReady() {
    return !!process.env.RESEND_API_KEY;
  }
  get whatsAppReady() {
    return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  }

  async email({ to, subject, html, text }: Email): Promise<boolean> {
    if (!this.emailReady) {
      this.logger.warn(`[email not configured] to ${to}: ${subject}\n${text}`);
      return false;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'BrainBox <onboarding@resend.dev>', to: [to], subject, html, text }),
    }).catch((e: Error) => e);
    if (res instanceof Error || !res.ok) {
      this.logger.error(`Email to ${to} failed: ${res instanceof Error ? res.message : `${res.status} ${await res.text()}`}`);
      return false;
    }
    return true;
  }

  async whatsApp({ to, name, params, code }: Template): Promise<boolean> {
    const number = toWhatsAppNumber(to);
    if (!this.whatsAppReady) {
      this.logger.warn(`[WhatsApp not configured] template ${name} to ${number}: ${params.join(' | ')}`);
      return false;
    }
    const components: object[] = [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }];
    if (code) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] });
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: number,
        type: 'template',
        template: { name, language: { code: process.env.WHATSAPP_LANGUAGE ?? 'en' }, components },
      }),
    }).catch((e: Error) => e);
    if (res instanceof Error || !res.ok) {
      this.logger.error(`WhatsApp to ${number} failed: ${res instanceof Error ? res.message : `${res.status} ${await res.text()}`}`);
      return false;
    }
    return true;
  }

  /** A one-time code to whichever address the person signed in with: email, or WhatsApp for a phone number. */
  async sendCode(identifier: string, code: string, purpose: string): Promise<boolean> {
    if (identifier.includes('@')) {
      return this.email({
        to: identifier,
        subject: `Your BrainBox code: ${code}`,
        text: `Your code to ${purpose} is ${code}. It expires in 30 minutes. If you didn't ask for this, ignore this email.`,
        html: layout(`<p>Your code to ${purpose} is:</p><p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:16px 0">${code}</p><p>It expires in 30 minutes. If you didn't ask for this, you can ignore this email.</p>`),
      });
    }
    return this.whatsApp({ to: identifier, name: process.env.WHATSAPP_CODE_TEMPLATE ?? 'nexus_code', params: [code], code });
  }
}

/** Escape text before putting it in email HTML. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Minimal branded email wrapper that renders well in Gmail and Outlook. */
export function layout(body: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#17133A;line-height:1.5">
<div style="font-size:22px;font-weight:800;color:#5B3DF5;margin-bottom:16px">BrainBox</div>${body}
<p style="color:#8A85B0;font-size:12px;margin-top:32px">You're getting this because you have a BrainBox account.</p></div>`;
}
