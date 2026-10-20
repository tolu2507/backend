# BrainBox API

NestJS + Prisma (Postgres) API behind the BrainBox mobile app (`../mobile`, also served on the web) and the
website, school dashboard and Overwatch (`../frontend`).

BrainBox is exam prep for Nigerian children (Nursery to SS3: WAEC, NECO, JAMB, BECE, Common Entrance), sold to
parents. Children practise topic by topic, sit a free timed mock every Friday, collect stickers, and earn coins that
become airtime or data for their parents. Parents see progress and a weekly report.

## Setup

```bash
cp .env.example .env        # fill in DATABASE_URL and JWT_ACCESS_SECRET at least
pnpm install
pnpm prisma migrate dev     # creates the tables
pnpm db:seed                # platform wallets, starter content
pnpm start:dev              # http://localhost:3001
```

Secrets live only in `.env`, which git ignores. Never put keys in code or in the database.

### Environment

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Postgres. Production is Neon (Frankfurt). |
| `JWT_ACCESS_SECRET` | Signs sign-in tokens. Long and random. |
| `SQUAD_SECRET_KEY`, `SQUAD_PUBLIC_KEY` | Squad (GTBank): parent payments, and airtime/data for rewards. `sandbox_` keys for development; a live key is refused outside production unless `SQUAD_ALLOW_LIVE=true`. |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_MONTHLY_BUDGET_USD` | Weekly parent reports (and AI-written questions). Without a key the plain, non-AI versions are used. The budget is a hard monthly ceiling. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email. Set `EMAIL_FROM="BrainBox <hello@your-domain>"`. |
| `WHATSAPP_*` | Optional WhatsApp messages (see Messaging). |
| `EXPO_ACCESS_TOKEN` | Only if Expo push "enhanced security" is on. |
| `APP_PUBLIC_URL`, `PORT`, `PLATFORM_FEE_BP` | Public address, port, tutoring fee (tutoring is switched off for now). |

Prices, the trial, coins and the rewards budget are **not** environment variables: they are Overwatch settings (below).

## Tests

```bash
pnpm test        # unit tests (question templates)
pnpm test:e2e    # the real API against a real database, nexus_test
pnpm lint
```

The end-to-end tests need a separate database: `createdb nexus_test`, then
`DATABASE_URL=postgresql://…/nexus_test pnpm prisma migrate deploy`. Only Squad is replaced by a stub. Each test file
deletes the rows it makes.

## How the product works (and where the code is)

### Plans: `src/plan`, `src/payments`
- **Free plan:** the Friday mock and a few practice questions a day per child; stickers, but no reports and no rewards.
- **Paid plan:** one price for a set number of days, for all of a parent's children, paid through Squad. No automatic
  renewal: parents pay again when they're ready, and paying early adds the days on top of what's left.
- **Free trial:** new parents get the paid plan free for a number of days, starting the first time we see a child on
  their account.
- Reminders go out at 9am Lagos time, 3 days before access ends and on the day it ends.
- **Children are never asked to pay.** On the free plan a child only hears "come back tomorrow"; every upgrade prompt
  goes to the parent (Google Play's rules for children's apps).

### Stickers and coins: `src/gamification`
- 40 stickers in four rarities, defined in `src/gamification/stickers.ts` (synced to the `Badge` table at start-up).
  They are judged on the child's real activity, and locked ones report progress. Mock-rank and league stickers are
  given when results are final (mock release; Monday 00:10 league close).
- `GET /me/student/badges/:id/stats`: how many children own a sticker, the child's unlock order, and their place on
  the collectors' leaderboard. Counts only, never other children's names.
- **Coins** (trial and paid plan only): for each new question right (with a daily limit), each Friday mock, and each
  sticker by rarity.

### Rewards: `src/rewards`
- A full bar of coins becomes money in the parent's **rewards wallet** (a `REWARDS` ledger wallet).
- Parents collect it as airtime or data through Squad's vending API, on the **paid plan only**, so free trials can't
  be farmed.
- The month's payouts stop at the rewards budget; the parent's balance stays safe.
- Squad keeps no reference of ours, so a send is **never retried**:
  - Squad says no → the money goes straight back to the parent.
  - No answer → status `CHECK`, settled by hand in Overwatch → Rewards.
  - `PENDING` sends are checked every 10 minutes.

### Overwatch settings: `src/settings`
Every number above lives in `src/settings/settings.ts` with its default, limits and help text, and can be changed in
Overwatch → Settings (`GET/PUT /admin/settings`):

- plan price, days per payment, free trial days
- free questions a day
- coins per answer, daily coin limit, coins per mock, sticker coins by rarity
- coins per reward, value of a reward, monthly rewards budget, rewards on/off

Changes apply within 30 seconds, are checked against the limits (a bad batch saves nothing), and are written to the
activity log with the old values. A price change affects new payments only: each payment stores its own price and
days. The trial length applies to every trial at once: each parent's trial start is stored, and their end date is the
start plus the current setting (recalculated when it changes and when the API starts).

### Deleting accounts and privacy requests: `src/admin/accounts.service.ts`
- **Child:** the profile and all learning data are deleted, then the login. Refused while they have tuck-shop money
  or school fee bills.
- **Parent:** the login and personal details are deleted. Optionally their children go too, but only children with no
  other parent on BrainBox.
- Payments, airtime sends and consents must be kept, so a parent who has any is turned into an anonymous
  "Deleted user" row instead of being removed.
- Overwatch sees a preview first. The activity log records the deletion without names.
- Privacy requests from the app (`DataRequest`) are listed for Overwatch. "Send me my data" is answered with
  `GET /admin/people/:userId/export`.

### Also here
`src/question-bank` (practice and the question bank), `src/mocks` (Friday mocks and national rankings),
`src/reports` (weekly parent reports), `src/progress` (the parent's view), `src/exams` (exam catalogue),
`src/school` and `src/tuckshop` (the school side), `src/support`, and `src/admin` (Overwatch).

## Rules baked into the design
- Money is **kobo in BigInt**, never Float, sent as strings in JSON.
- Every money movement is a `LedgerEntry`, written in the same transaction as the wallet balance change, with a
  conditional update so a balance can't go negative.
- Revenue is tagged by `RevenueStream`. School revenue share is calculated from the streams in each agreement, and is
  confidential: it never appears in marketing.
- Tutoring is switched off for now.

## Scheduled jobs (Lagos time)

| When | What |
|---|---|
| Monday 00:05 | Create this and next week's Friday mocks |
| Monday 00:10 | Close last week's leagues, give league stickers |
| Every 5 minutes | Mark finished mocks; release results and mock stickers when a window closes |
| Friday 16:00 | Weekly parent reports (trial and paid families only) |
| Daily 09:00 | Plan reminders; tutor payouts (tutoring is off) |
| Every 10 minutes | Follow up airtime/data still being delivered; lesson reminders |

## Deploying

Railway runs `pnpm build` then `pnpm start:prod`. Run `pnpm prisma migrate deploy` against Neon before or as part of
each release. Migrations are in `prisma/migrations`.

## Messaging setup

Everything works without these keys: messages are written to the log instead, so you can read reset codes there in
development.

### Email (Resend)
1. Create an account at resend.com and verify your sending domain (DNS records they give you).
2. Put the API key in `RESEND_API_KEY` and a sender on that domain in `EMAIL_FROM`.

Used for password reset codes, Friday weekly reports and staff invites.

### WhatsApp (Meta Cloud API)
1. In Meta for Developers create an app → add **WhatsApp** → add and verify your business phone number.
2. Create a permanent access token (System User in Business Settings) → `WHATSAPP_TOKEN`. Copy the phone number ID →
   `WHATSAPP_PHONE_NUMBER_ID`.
3. In WhatsApp Manager create and get approval for two templates (English):
   - `nexus_code`: category **Authentication**, "Copy code" button. Used for reset codes to phone numbers. (The name
     predates the rename; keep it, since changing it means a new approval.)
   - `weekly_report`: category **Utility**, body:
     `Hi {{1}}, {{2}}'s weekly BrainBox report is ready: {{3}}. Open the BrainBox app to see the full report.`
4. Meta charges per message delivered (roughly ₦10–14 to a Nigerian number in 2026). Weekly reports only go by
   WhatsApp to parents who switch on "Also on WhatsApp" in the app.

### Push notifications
Sent through Expo's free push service to every phone a person is signed in on: plan reminders, rewards, payment
receipts, mock results and "report ready". The app needs Firebase set up once; see `../mobile/README.md`.
