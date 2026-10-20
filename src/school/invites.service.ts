import { Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';

import { esc, layout, MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const INVITE_DAYS = 7;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * New accounts created by a school (staff, parents) get a one-time code to set their own password.
 * It reuses the password-reset table, so "Set password" is the same screen as "Reset password".
 */
@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  async invite(userId: string, opts: { schoolName: string; /** staff: web dashboard. app: the BrainBox phone app (parents, tuck-shop staff). */ role: 'staff' | 'app'; extra?: { text: string; html: string } }) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const identifier = user.email ?? user.phone;
    if (!identifier) return { sent: false };
    const code = String(randomInt(100000, 1000000));
    await this.prisma.passwordReset.create({ data: { userId, tokenHash: sha256(`${userId}:${code}`), expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) } });

    const web = process.env.WEB_APP_URL ?? 'http://localhost:3000';
    const how =
      opts.role === 'staff'
        ? `Go to ${web}/set-password, enter ${identifier} and this code, then choose your password.`
        : 'Install the BrainBox app, tap "Sign in", then "Got a code?", enter your email or phone and this code, then choose your password.';
    if (!user.email) {
      const sent = await this.messaging.whatsApp({ to: identifier, name: process.env.WHATSAPP_CODE_TEMPLATE ?? 'nexus_code', params: [code], code });
      return { sent, code };
    }
    const sent = await this.messaging.email({
      to: user.email,
      subject: `${opts.schoolName} invited you to BrainBox`,
      text: [`Hi ${user.firstName},`, `${opts.schoolName} has set up a BrainBox account for you.`, `Your code: ${code} (valid for ${INVITE_DAYS} days)`, how, opts.extra?.text ?? ''].join('\n\n'),
      html: layout(
        `<p>Hi ${esc(user.firstName)},</p><p><b>${esc(opts.schoolName)}</b> has set up a BrainBox account for you.</p>` +
          `<p>Your code (valid for ${INVITE_DAYS} days):</p><p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:12px 0">${code}</p>` +
          `<p>${esc(how)}</p>${opts.extra?.html ?? ''}`,
      ),
    });
    return { sent, code };
  }
}
