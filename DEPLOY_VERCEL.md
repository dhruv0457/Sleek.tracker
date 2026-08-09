# Deploying sleek to Vercel

This guide has two halves:

- **Part A — The “I'm not a developer” path.** Plain-English, no-jargon
  walkthrough. Walks you through clicking buttons on websites, copy-pasting
  values, and shipping your app to the internet for free in ~30 minutes.
- **Part B — The technical reference.** Same content, condensed, with all the
  details a developer needs. Skip here if you already know Prisma + Vercel.

For everyone — Vercel runs the Next.js app on serverless functions. Two
things must change for production vs. local dev:

1. **Database** — SQLite (a file) doesn't work across stateless lambdas.
   Switch to a hosted PostgreSQL (Supabase free tier is recommended).
2. **Cron** — `node-cron` doesn't work serverless. We use Vercel Cron Jobs
   (`vercel.json`) to hit `/api/cron/tick` every 15 minutes with a shared
   secret so users get reminder emails even when the dashboard isn't open.

Everything else (auth, sessions, security headers, NVIDIA NIM, Gmail mailer)
works as-is on Vercel.

---

## A non-techie glossary (read this first if “git” scares you)

| Term | What it actually means |
|---|---|
| **GitHub** | A free website that stores your code online (a public GitHub repo for open-source projects, private by default). Think of it like Google Drive for programmers. |
| **Vercel** | A free website that takes code from GitHub and puts it on the internet (gives you a live `https://your-app.vercel.app` URL) every time you save. |
| **Environment variable** | A setting (like a password or a key) that Vercel keeps hidden. You type it once into a box and the app reads it but never shows it. |
| **API key** | A long ugly string that says "this is me, let me in" — like a VIP passcode. Used for services like NVIDIA (AI) and Gmail (emails). |
| **Database** | Where the app stores user data. Locally we use SQLite (a single file). On the internet we use PostgreSQL running on Supabase (a free service). |
| **Schema / migration** | The "shape" of your database — like the columns in a spreadsheet. Pushing the schema means creating those columns in your new online database. |
| **Cron job** | A repeat alarm clock on the server. We use one to send reminder emails at the right time of day. |
| **Deploy / redeploy** | Shipping a new version. Push your code to GitHub → Vercel builds it automatically → live in ~90 seconds. |
| **Production vs Preview** | "Production" is the live site your users see. "Preview" is a private test link Vercel makes for each pull request. |
| **Secret** | An environment variable whose value you should never commit to code or share with anyone. |

---

# Part A — Plain-English deployment walkthrough

This path assumes: You have the code on your computer, you can use a web
browser, you can copy-paste, and you can use a terminal for **only the 3
commands shown in bold below**. Everything else is clicking buttons on
websites.

**Time estimate:** ~30 minutes if you have your accounts ready.

**Total monthly cost:** $0 on free tiers, until you outgrow them.

### A0. Accounts you'll need — make these first (5 minutes, all free)

1. **A GitHub account** → https://github.com/signup
2. **A Vercel account** → https://vercel.com/signup (sign up **with** your
   GitHub account — they auto-link).
3. **A Supabase account** → https://supabase.com/signup (you can sign in
   with your GitHub account).
4. **A Gmail account** (a brand-new one recommended, e.g.
   `sleek-reminders@gmail.com`) → https://accounts.google.com/signup
5. **An NVIDIA developer account** for the AI verifier →
   https://build.nvidia.com → click "Sign in" → free, no credit card.
6. **A Razorpay account** *only if you want to charge users money* →
   https://razorpay.com → free to create, you only get real keys after
   completing KYC.

You don't need any of these to be set up before each other — make all of
them now and we'll use them in order.

---

### A1. Put your code on GitHub (5 minutes)

If your code is already on GitHub, skip to A2.

1. Open https://github.com/new
2. Repository name: `sleek` (or anything)
3. Set to **Private** (recommended — only you can see it).
4. **Don't** initialize with README/.gitignore — your project already has
   them.
5. Click **Create repository**.
6. GitHub shows you 3 commands that look like this. Copy them into a
   terminal opened inside your project folder (in Windows: open the
   project folder in File Explorer, hold `Shift` and right-click in empty
   space, choose "Open PowerShell window here"):

```bat
git remote add origin https://github.com/YOUR-USERNAME/sleek.git
git branch -M main
git push -u origin main
```

If Windows asks you to log into GitHub, do it. Your code is now on
GitHub. (Refresh the GitHub page to see your files.) If you ever change
your code later, just run `git push` to send the new version up.

---

### A2. Make your online database (Supabase) — 8 minutes

1. Sign in to https://supabase.com → click **New project**.
2. Project name: `sleek-prod` (anything)
3. Database password: click **Generate** → write it down somewhere safe
   (Supabase won't show it again).
4. Region: pick the one closest to you (e.g. `Mumbai (ap-south-1)` for
   India).
5. **Create project** (≈2 min wait while Supabase spins things up).
6. When ready, left sidebar → **Project Settings** (the gear icon at the
   bottom) → **Database** → scroll to **Connection string** → choose the
   **URI** tab → choose **Session pooler** (port `6543`).
7. Click the **Copy** button. You now have a string that looks like:

   ```
   postgresql://postgres.XXXXXX:YOUR-PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
   ```
   If the password part is `[YOUR-PASSWORD]`, replace it with the database
   password you wrote down in step 3. Save this URL somewhere — you'll
   paste it into Vercel in step A4.

   > Tip: Use **Session pooler**, not "Direct connection". The pooler lets
   > Vercel serve hundreds of users from a small number of database
   > connections. Pre-loading the free Postgres pooler avoids the
   > "too many connections" error.

---

### A3. Create the database tables (3 commands, 3 minutes)

You only have to do this **once** when deploying for the first time. This
creates all 14 tables the app needs (User, Habit, CheckIn, FocusSession,
Badge, Trophy, etc.).

1. Open a terminal inside your project folder (the same one as A1 step 6).
2. Paste these three commands **one at a time**, pressing Enter after each
   (replace the long URL with **your** Supabase URL from A2):

```bat
REM 1. Tell Prisma to use Postgres for this push (only the windows session will see it)
set DATABASE_URL=postgresql://postgres.XXXXXX:YOUR-PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres

REM 2. Push the schema (creates the tables) — wait ~20 seconds
npx prisma db push

REM 3. Clear the temporary variable so local dev goes back to SQLite
set DATABASE_URL=
```

> macOS / Linux users, use `export DATABASE_URL=...` instead of `set ...`.

If the second command asks "Are you sure you want to create all the
tables?" type `y` and Enter. When it finishes you'll see
`Your database is now in sync with your Prisma schema.` Done. Go back to
Supabase → left sidebar → **Table Editor** and you should now see tables
like `User`, `Habit`, `CheckIn`, etc.

---

### A4. Import your app to Vercel (5 minutes)

1. Go to https://vercel.com/new
2. Find your `sleek` repo in the list (the one you pushed in A1) → click
   **Import**.
3. Vercel auto-detects this is a Next.js project — leave everything on the
   defaults.
4. **Don't click Deploy yet.** Click **Environment Variables** (or do it
   after deploy — both work). You'll paste the values from the next step.
5. Click **Deploy**. ~90 seconds later you'll get a "Congratulations"
   screen with your live URL like `sleek-abc123.vercel.app`. **Save this URL.**

> The first deploy will fail because we haven't set the environment
> variables yet. That's expected — we fix it in A5. Nothing you do in A5
> needs the codebase; we'll only paste values into the Vercel dashboard.

---

### A5. Set your environment variables in Vercel (10 minutes)

Go to Vercel → your `sleek` project → **Settings** tab → **Environment
Variables**. For each row below, click **Add New**, type the Variable name,
paste the Value, leave Environments = Production (also tick Preview and
Development if you want those to work too — recommended for testing), and
click **Save**.

| Variable | Where to get the Value |
|---|---|
| `DATABASE_URL` | The Supabase URL from A2. |
| `SESSION_SECRET` | Open a new browser tab → https://generate-secret.vercel.app (or run `openssl rand -base64 32` in a terminal). Copy the random string. Min 32 chars. **Required** — without it the app refuses to boot. |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL from A4 (e.g. `https://sleek-abc123.vercel.app`). |
| `NVIDIA_API_KEY` | Sign in to https://build.nvidia.com → top-right click your avatar → **Get API Key** → Click **Generate Key**. Starts with `nvapi-`. |
| `GMAIL_USER` | The Gmail address you made in A0 (e.g. `sleek-reminders@gmail.com`). |
| `GMAIL_APP_PASSWORD` | Sign in to https://myaccount.google.com/apppasswords (you must have 2-Step Verification on first). Type a name like `sleek`, click **Create**, copy the 16-char password shown. |
| `CRON_SECRET` | Generate like SESSION_SECRET above (or `openssl rand -hex 32`). Vercel sends this with each cron call so only Vercel can fire your cron. |
| `OWNER_EMAIL` | Where you want contact form messages to land. Probably your personal email. |
| `RAZORPAY_KEY_ID` | Only if collecting payments. Razorpay Dashboard → Settings → API Keys → generate. Test keys start with `rzp_test_`, live keys with `rzp_live_`. Otherwise skip this row. |
| `RAZORPAY_KEY_SECRET` | Same place as the Key ID. Skip if not collecting payments. |
| `GOOGLE_CLIENT_ID` | *Optional — only for the export-to-Google-Sheets feature (Ultra Pro).* https://console.cloud.google.com → create a project → enable **Google Sheets API** + **Google Docs API** → Credentials → **Create credentials** → **OAuth Client ID** → Application type: Web → authorized redirect: `https://YOUR-VERCEL-URL/api/gworkspace/callback`. The ID looks like `xxxxx.apps.googleusercontent.com`. |
| `GOOGLE_CLIENT_SECRET` | Same screen — looks like `GOCSPX-xxxxx`. |
| `GOOGLE_REDIRECT_URI` | `https://YOUR-VERCEL-URL/api/gworkspace/callback` (exactly the redirect you put in Google Cloud). |

After adding all rows: Vercel → your project → **Deployments** tab → most
recent build → `⋯` menu → **Redeploy**. ~90 seconds later visit your URL
in a browser. You should see the login page.

---

### A6. Turn on the timed reminders (Vercel Cron) — 2 minutes

`vercel.json` (in your repo) already declares a cron that hits
`/api/cron/tick` every 15 minutes. Nothing to do on Vercel Pro/Enterprise.
On the free **Hobby tier**, cron is limited to **once per day** (~midnight
UTC). That's fine, because users who log in each day still get their
morning/evening emails via the dashboard's own 60-second client poll
(`/api/cron/tick` fires every minute while a user has a tab open). So
Hobby is good enough if your users open the app daily. Upgrade to Pro
($20/mo) only when you need accurate off-server reminders without users
having the dashboard open.

To test that cron is wired correctly, paste this in a terminal (replacing
the placeholders):

```bat
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-VERCEL-URL/api/cron/tick
```

You should see `{"ok":true,"mode":"cron","users":N,"sent":M}`.

---

### A7. Verify (3 minutes)

1. Visit `https://YOUR-VERCEL-URL` → register a user → confirm dashboard
   loads and you can create a habit.
2. Settings → set your timezone → enable "Morning agenda email" and
   "Evening summary email".
3. Watch the dashboard for a few minutes — the green "streak" line should
   update after a check-in.
4. Try the AI Camera Verifier (premium feature, free for trial users).
5. Drive cron manually (the curl above) → check Vercel → Functions tab →
   `/api/cron/tick` logs show the morning/evening emails being sent.

If all 5 worked, the deployment is live and complete.

---

### A8. Daily Workflow (how to update your live app)

After making changes on your computer:
1. `git push` from your project folder.
2. Wait ~90 seconds. Vercel auto-builds and swaps in the new version.
3. Visit your Vercel URL — your changes are live. No restart needed.

For config changes (env vars, build settings): save them on the Vercel
dashboard, then **Deployments** → ⋯ → **Redeploy**.

---

## Troubleshooting (plain-English symptoms)

| Symptom | What it likely means / how to fix |
|---|---|
| The site loads but says "Internal Server Error" | Something blew up in a serverless function. Go to Vercel → Project → **Logs** tab → click the most recent error. The error message will say which env var is missing. |
| `SESSION_SECRET must be at least 32 characters` | You didn't set `SESSION_SECRET` or it's too short. Go to Vercel Settings → Environment Variables, regenerate it, save, redeploy. |
| Login button does nothing | Probably `DATABASE_URL` is missing or wrong. Verify it's the **Session pooler** URL with port `6543`. |
| Reminder emails never arrive | (1) `GMAIL_USER` and `GMAIL_APP_PASSWORD` not set correctly, or (2) you're on Hobby tier and didn't visit the dashboard today (cron only fires daily). First check is Vercel → Functions → `/api/cron/tick` logs for `[mailer]` warnings. App Passwords only work if 2-Step Verification is ON for that Gmail account. |
| AI Insights / Camera Verifier says "NVIDIA_API_KEY not set" | Add `NVIDIA_API_KEY` to Vercel env and redeploy. |
| Google login button redirects to `localhost:3000` | Set `NEXT_PUBLIC_APP_URL` and `GOOGLE_REDIRECT_URI` (and Google Console's authorized redirect) to your Vercel URL. |
| "Too many connections" / 429 from Supabase | Switch from the **Direct connection** URL to the **Session pooler** URL (different port — `6543` not `5432`). |
| Cookie not sticking on Safari | `sameSite:"lax"` + `secure:production` already handles this. Make sure `NEXT_PUBLIC_APP_URL` is `https://`. |
| Cron never fires (Hobby tier) | Vercel Hobby limits to once-daily. Check Vercel → Project → **Cron Jobs** tab for last-run status. |
| Vercel build fails with "error in next build" | Verify the GitHub repo has the latest commits. Watch the Vercel build logs — the offending module will be named. |
| Performance feels slow on first load | Vercel serverless functions cold-start in ~1-2s; subsequent requests within the same warm function are fast. Consider Pro for warmer pools. |

---

# Part B — Technical reference

## Step 1 — Provision a PostgreSQL DB

**Supabase (recommended, free tier):**
1. Create a project at https://supabase.com
2. Project Settings → Database → Connection string → URI tab → copy the
   **Session pooler** URL (port `6543`). This is the pooled connection — it
   lets serverless functions reuse a small number of DB connections.
3. The URL looks something like:
   ```
   postgresql://postgres.<project>:<password>@aws-0-<region>.pooler.supabex.com:6543/postgres
   ```

Alternatives: Neon (https://neon.tech), Vercel Postgres, Railway.

## Step 2 — Run the schema migration against Postgres

From a machine with `prisma` configured (local repo):

```bash
# 1. Point Prisma at Postgres temporarily
#    Edit prisma/schema.prisma to set provider = "postgresql" (Prisma CLI
#    does not auto-detect from a driver adapter yet).
# 2. Set the production DATABASE_URL in your shell:
#    Windows PowerShell:
$env:DATABASE_URL = "postgresql://postgres...@aws-0-...pooler.supabase.com:6543/postgres"
#    macOS/Linux:
export DATABASE_URL="postgresql://postgres...@aws-0-...pooler.supabase.com:6543/postgres"

# 3. Push the schema
npx prisma db push

# 4. (Optional) Generate a SQL diff you can run in Supabase's SQL editor:
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script

# 5. Restore provider = "sqlite" in prisma/schema.prisma for local dev.
```

The runtime adapter in `src/lib/prisma.ts` reads `DATABASE_URL` and picks the
SQLite or PostgreSQL adapter automatically based on the URL scheme — no code
change is needed at deploy time.

## Step 3 — Push to GitHub and import to Vercel

1. `git push` to your GitHub repo.
2. Vercel dashboard → Add New → Project → import your repo.
3. Framework preset: **Next.js** (auto-detected).
4. Build command: `next build` (default).`npm install` is automatic.
5. Output dir: `.next` (default).

## Step 4 — Set environment variables in Vercel

Project → Settings → Environment Variables → add all of these for the
**Production** environment (and Preview if you want it tested):

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://…` | Supabase session-pooler URL from Step 1. |
| `SESSION_SECRET` | 32+ random chars | `openssl rand -base64 32`. **Required** — server refuses to boot without it. |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Your Vercel domain (after first deploy you'll know it). |
| `NVIDIA_API_KEY` | `nvapi-…` | From https://build.nvidia.com → Get API Key. |
| `GMAIL_USER` | `sleek-reminders@gmail.com` | Dedicated Gmail account. |
| `GMAIL_APP_PASSWORD` | `xxxx xxxx xxxx xxxx` | 16-char App Password from https://myaccount.google.com/apppasswords. |
| `CRON_SECRET` | random hex | `openssl rand -hex 32`. Vercel sends this with each cron call. |
| `OWNER_EMAIL` | `you@example.com` | Where the contact form lands. |
| `RAZORPAY_KEY_ID` | `rzp_test_…` / `rzp_live_…` | Only if collecting payments. |
| `RAZORPAY_KEY_SECRET` | `…` | Same as above. |
| `GOOGLE_CLIENT_ID` | `….apps.googleusercontent.com` | Only for the Sheets/Docs export feature (Ultra Pro). |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-…` | Same as above. |
| `GOOGLE_REDIRECT_URI` | `https://your-app.vercel.app/api/gworkspace/callback` | Same as above. |

Redeploy after adding env vars (Deployments → ⋯ → Redeploy).

## Step 5 — Enable Vercel Cron (Hobby vs. Pro)

`vercel.json` declares an every-15-minute cron that hits `/api/cron/tick`
with the `Authorization: Bearer <CRON_SECRET>` header.

- **Vercel Pro / Enterprise:** Cron supports sub-daily schedules — works out of the box.
- **Vercel Hobby (free):** Cron is limited to **once per day**. The cron will
  run once daily (~midnight UTC); for users online during the day the
  existing client-poll path (`Dashboard.tsx` fires `/api/cron/tick` every
  60s) handles their morning/evening emails at the right local hour — so
  Hobby is fine if your users log in at least once per day.

To force a manual cron test from your laptop:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/tick
```

Should return `{"ok":true,"mode":"cron","users":N,"sent":M}`.

## Step 6 — Verify

1. Visit `https://your-app.vercel.app` → register a user → confirm dashboard
   loads and habits can be created.
2. Sign in → Settings → set your timezone → enable "Emails: morning + evening".
3. Wait until 06:00 local (or temporarily flip hour checks) → you should
   receive the morning agenda email.
4. Drive cron manually to confirm Vercel Secrets are wired:
   `curl -H "Authorization: Bearer $CRON_SECRET" <app-url>/api/cron/tick`

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `SESSION_SECRET must be at least 32 characters` on boot | Generate and set it in Vercel env. |
| `DATABASE_URL must start with 'file:' or 'postgres'` | Check the URL prefix. Supabase pooler URLs sometimes start with `postgresql://` — that's fine. |
| `too many connections` / 429 from Supabase | Lower `PG_POOL_MAX` (default 5) or use the Session pooler instead of the direct connection. |
| No reminder emails arrive | Check `GMAIL_USER` / `GMAIL_APP_PASSWORD`. Logs in Vercel → Functions → `/api/cron/tick` show `[mailer]` warnings. |
| AI Insights returns "NVIDIA_API_KEY not set" | Add `NVIDIA_API_KEY` to Vercel env and redeploy. |
| Cron never fires | Hobby plan limits to 1/day — check Vercel → Project → Cron Jobs tab for last-run status. |
| Google OAuth redirects to `localhost:3000` | Set `NEXT_PUBLIC_APP_URL` and `GOOGLE_REDIRECT_URI` to your Vercel domain. |
| Cookie not sticking on Safari | Already handled via `sameSite: "lax"` + `secure: production`. If issues, ensure `NEXT_PUBLIC_APP_URL` is https. |

---

## Differences vs. local dev

| Aspect | Local | Vercel |
|---|---|---|
| Database | SQLite file (`prisma/dev.db`) | PostgreSQL (Supabase) |
| Cron | Client-driven poll every 60s | Vercel Cron every 15 min (Pro) or once-daily (Hobby) + client poll |
| File writes | Anywhere (`/tmp`, project dir) | Lambda filesystem is read-only except `/tmp` |
| Long-running | Forever is fine | Single lambda capped at 60s (Hobby) / 300s (Pro) |
| Build | `next dev` (Turbopack, no bundle) | `next build` (production bundle, tree-shaken) |

That's it — push, import, set env vars, deploy.
