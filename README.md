# DayBloom — Full Source (Local MVP)

A full-stack TickTick-inspired personal study planner. **Desktop-first, soft pink and blue, no decorative emojis.**

## Included

- Username + four-box PIN signup/sign-in (development-only), session-based dashboard, logout
- Account-personalized dashboard and task counts
- Add, edit, delete subjects: **name, code, color**
- Add, edit, delete tasks: **title, notes, subject, priority, status, due date/time**
- To Do / In Progress / Done board with drag-and-drop
- Search and filter tasks by subject, status, priority
- Monthly calendar automatically reflecting saved task due dates
- Upcoming deadlines / overdue count
- Supabase-backed persistence (the same tasks appear across all views)

## Install into your EXISTING DayBloom folder

1. **Back up your existing `daybloom` folder** first (copy to `daybloom-backup`). Keep `.env.local` secure. Do not share it.
2. Stop `npm run dev` using Ctrl+C.
3. Extract **the contents** of this ZIP **into your existing `daybloom` folder** (the one containing `package.json`). Allow overwrite of existing source files. This ZIP intentionally **does not include `.env.local`, account data, or secret keys**.
4. Check your `.env.local` still contains:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_SECRET_KEY=...
   DAYBLOOM_PIN_PEPPER=...
   ```

   Reuse your original PIN pepper! Changing it prevents verification of previously created PINs.
5. In VS Code terminal from the `daybloom` folder:

   ```powershell
   npm install
   npm run dev
   ```

6. Open http://localhost:3000/login and sign in with your **existing username and PIN**. Your old data stays in Supabase.

**Do not paste values of `.env.local` into chats/screenshots/Git.** Do not change the name of the `daybloom` folder if you want to keep your current setup.

## Existing Supabase schema required

This matches the tables created in the previous steps. No destructive migration is included.

- `accounts`: `id`, `display_name`, `username`, `created_at`
- `pin_credentials`: `user_id`, `pin_hash`, `failed_attempts`, `locked_until`, `created_at`
- `sessions`: `token_hash`, `user_id`, `expires_at`, `created_at`
- `subjects`: `id`, `user_id`, `name`, **`code`**, `color`, `created_at`
- `tasks`: `id`, `user_id`, `subject_id`, `title`, `notes`, `status`, `priority`, `due_date`, `due_time`, `created_at`, `updated_at`

Keep Row Level Security enabled; the admin client is used only in server routes. The tasks foreign key was previously created with `(user_id, subject_id)` and `ON DELETE SET NULL (subject_id)` so deleting a subject unassigns its tasks.

If an older `subjects` table does **not** yet have the `code` column, run the SQL in `supabase/add-subject-code-if-needed.sql`. If you already added `code` with the earlier ChatGPT instruction, do NOT run it again; existing schema is ready.

## Troubleshooting

- **"Please sign in" / login redirect**: sign in on `/login` using your previous account. If you switch between `localhost` and `127.0.0.1`, cookies are separate.
- **"Unable to load tasks"**: verify the tables in Supabase and check terminal output. Ensure `.env.local` has the original secret key.
- **"Unable to sign in"**: check `DAYBLOOM_PIN_PEPPER` is unchanged from when the account was created.
- **Old sample tasks still showing**: replace the `app/page.tsx` file from the ZIP; this version has no hardcoded tasks.
- **Port 3000 occupied**: stop your old `npm run dev` terminal before restarting.
- **Next.js Cache Components error**: the included `next.config.ts` disables `cacheComponents` for this project (session-based pages use request-time data); restart `npm run dev` after extraction.

## Important security limitation

**Local development only. Do not deploy the username + 4-digit PIN build to Vercel or any public server.** A four-digit PIN has only 10,000 possibilities. Basic per-account failed-attempt handling here is not enough to protect against distributed/concurrent guessing or abuse, and there is no safe account recovery method yet. API endpoints are disabled when `NODE_ENV` is `production`. For public deployment, switch to a stronger authentication factor (passkey, longer password, or a trusted external identity provider) and add hardened rate limiting/recovery, then re-review all privileged routes.

## What's intentionally left for later?

External Google Calendar sync, push notifications, mobile app, recurrence, attachments, and advanced productivity charts. **DayBloom's built-in task-to-calendar synchronization is included now.**
