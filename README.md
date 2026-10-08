# InselTrack

InselTrack is a Next.js + Supabase project tracker for internal agency work and client-specific weekly reporting.

## Included

- Sign up and sign in with Supabase Auth
- Protected app routes
- Dashboard
- Project creation
- Project editing and deletion
- Client records
- Client recipients
- Project activity logging
- Client-specific report preview
- Server-side client isolation checks
- Resend email route
- Weekly report history table
- InselTrack branding and the approved lime / olive / black visual direction

## Setup

1. Install Node.js 20+.
2. Open this folder in VS Code.
3. Run:

```bash
npm install
```

4. Create a Supabase project.
5. In Supabase SQL Editor, run `supabase/schema.sql`.
6. Copy `.env.example` to `.env.local`.
7. Add your Supabase URL and publishable key.
8. Add your Supabase service role key.
9. Create a Resend account and add the API key.
10. Add a verified sender email to `REPORT_FROM_EMAIL`.
11. Run:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Important security note

Client reports are queried by one `client_id` at a time. The preview and send routes both validate that every project and recipient belongs to that same client. If a mismatch is detected, the report is blocked.

## Recommended next steps

- Add admin-only user approval and invitations
- Add UI for creating/editing clients and recipients
- Replace free-text `assigned_to` with profile IDs
- Add internal report generation
- Add Vercel Cron for scheduled Friday sends after manual testing
- Add audit logs for report sends
