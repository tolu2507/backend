# Nexus API

NestJS + Prisma API that serves the school web app (`../frontend`) and the mobile app (`../mobile`).

> **Status (11 Oct 2026):** the database schema has been redesigned (v2, below), but the
> service code in `src/` still targets the old v1 schema and **does not compile against v2**.
> The rebuild starts with auth and roles. The old schema is kept at `prisma/schema.v1-backup.prisma`.

## Setup

```bash
cp .env.example .env     # fill in DATABASE_URL (Postgres), SQUAD_*, GEMINI_API_KEY
npm install
npx prisma migrate dev   # creates the tables in your Postgres database
npm run start:dev        # http://localhost:3001
```

A free Postgres from Neon or Supabase works, or a local one: `docker run -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres`.

Secrets live only in `.env`, which git ignores. Never put API keys in the database or in code.

## Schema v2 at a glance (`prisma/schema.prisma`)

| Area | Models |
|---|---|
| People & access | `User` (one per person), `Membership` (role per school; one person can hold many), `Guardianship` (parent ↔ child), `Consent` (NDPA 2023 parental consent) |
| Schools & deals | `School`, `SchoolAgreement` (revenue share %, which streams count), `RevenueShareStatement` |
| Academics | `AcademicYear`, `Term`, `Class`, `Subject`, `ClassSubject`, `Enrollment`, `Attendance`, `Assessment` (with topics), `AssessmentResult`, `TeacherNote`, `LessonNote` |
| Parent insights | `WeeklyReport`, `ReportDelivery` |
| Gamification | `LearningActivity`, `ActivityAttempt`, `XpEvent`, `Badge`, `StudentBadge`, `LeagueGroup`, `LeagueEntry` |
| Tutor marketplace | `TutorProfile`, `TutorApplication`, `VettingTest`, `TutorTestAttempt`, `TutorSubject` (only subjects with a passed test are matchable), `TutorAvailability`, `TutorRequest`, `TutorMatch`, `TutorBooking`, `TutorSession`, `TutorReview` |
| Money | `Wallet`, `LedgerEntry` (every movement, tagged by `RevenueStream`), `Payment` (Squad), `FeeInvoice` |
| Operations | `Asset`, `AuditLog` |

Rules baked into the design:
- Money is **kobo in BigInt**, never Float. Serialise BigInt as a string in JSON responses.
- Every money movement is a `LedgerEntry`. Wallet balance updates happen in the same transaction, using a conditional update so a balance can't go negative (no double-spend).
- `TUTORING` revenue is never shared with schools. Revenue share statements sum only the agreement's `sharedStreams`.
- Parents see "Nexus approved" (`TutorProfile.verificationStatus = VERIFIED`), never where a tutor works.

## Endpoints the mobile app expects

See the table in [`../mobile/README.md`](../mobile/README.md#api-endpoints-the-app-expects).
Response shapes are in `../mobile/src/types/api.ts`.

## Messaging setup

Everything works without these keys. Messages are written to the log instead, so you can read
reset codes there during development.

### Email (Resend)
1. Create an account at resend.com and verify your sending domain (DNS records they give you).
2. Put the API key in `RESEND_API_KEY` and a sender on that domain in `EMAIL_FROM`.

Used for password reset codes (when someone signs in with email) and Friday weekly reports.

### WhatsApp (Meta Cloud API, no Termii needed)
1. In Meta for Developers create an app → add **WhatsApp** → add and verify your business phone number.
2. Create a permanent access token (System User in Business Settings) → `WHATSAPP_TOKEN`.
   Copy the phone number ID → `WHATSAPP_PHONE_NUMBER_ID`.
3. In WhatsApp Manager create and get approval for two templates (language English):
   - `nexus_code`: category **Authentication**, "Copy code" button. Used for reset codes to phone numbers.
   - `weekly_report`: category **Utility**, body:
     `Hi {{1}}, {{2}}'s weekly Nexus report is ready: {{3}}. Open the Nexus app to see the full report.`
4. Meta charges per message delivered (roughly ₦10–14 to a Nigerian number in 2026). Weekly reports
   only go by WhatsApp to parents who switch on "Also on WhatsApp" in the app.

### Push notifications
Sent through Expo's free push service to every phone a person is signed in on. Lesson reminders go
out the day before and an hour before (a job runs every 10 minutes). Payment receipts, booking updates
and "report ready" also arrive as pushes. The app needs Firebase set up once; see `mobile/README.md`.
