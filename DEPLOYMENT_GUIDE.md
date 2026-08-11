# Complete Deployment & Environment Setup Guide for Sleek Tracker

> **For non-technical users** — This guide covers everything from database setup to all environment variables, secrets, and external service accounts. Follow step by step.

---

## 📋 Quick Overview: What You Need

| Component | Service | Cost | Purpose |
|-----------|---------|------|---------|
| **Database** | Supabase (PostgreSQL) | Free tier | Stores all user data (habits, check-ins, badges, etc.) |
| **Hosting** | Vercel | Free tier | Runs your Next.js app |
| **Auth** | Google Cloud Console | Free | "Sign in with Google" button |
| **AI** | NVIDIA Build | Free tier | AI Camera Verifier & Insights |
| **Email** | Gmail + App Password | Free | Morning/evening reminder emails |
| **Payments** | Razorpay | Free (test) | Optional: subscriptions (Ultra Pro) |
| **Sheets Export** | Google Cloud | Free | Optional: export to Google Sheets |

---

## 🗄️ Part 1: Database Setup (Supabase) — **Required First**

### 1.1 Create Supabase Account
1. Go to https://supabase.com → **Sign up with GitHub**
2. Click **New Project**
3. **Project name**: `sleek-tracker-prod` (or any name)
4. **Database password**: Click **Generate** → **COPY AND SAVE THIS PASSWORD** (Supabase never shows it again!)
5. **Region**: Choose closest to you (e.g., `Mumbai (ap-south-1)` for India)
6. Click **Create project** (wait ~2 minutes)

### 1.2 Get the Connection String
1. In Supabase dashboard → left sidebar → **Settings** (gear icon) → **Database**
2. Scroll to **Connection string** → click **URI** tab
3. Select **Session pooler** (port `6543`) — **NOT "Direct connection"**
4. Click **Copy**
5. **Replace `[YOUR-PASSWORD]`** with the password from step 4
6. Save this full URL — this is your `DATABASE_URL`

**Example format:**
```
postgresql://postgres.abcdefgh:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

### 1.3 Run Database Migration (One-time)
Open terminal in your project folder and run:

**Windows PowerShell:**
```powershell
$env:DATABASE_URL = "postgresql://postgres.abcdefgh:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
npx prisma db push
$env:DATABASE_URL = ""
```

**macOS/Linux:**
```bash
export DATABASE_URL="postgresql://postgres.abcdefgh:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
npx prisma db push
export DATABASE_URL=""
```

When prompted "Are you sure you want to create all tables?" → type `y` and Enter.

**Verify:** Go to Supabase → Table Editor → you should see 15 tables: `User`, `UserSettings`, `Habit`, `CheckIn`, `DailyLog`, `AIVerification`, `Reminder`, `Badge`, `Trophy`, `FocusSession`, `Achievement`, `AiMessage`, `Contact`, `PastUser`, plus Prisma's `_prisma_migrations`.

---

## 🌐 Part 2: Push Code to GitHub

If not already done:

```powershell
git remote add origin https://github.com/dhruv0457/Sleek.tracker.git
git branch -M main
git push -u origin main
```

---

## 🚀 Part 3: Import to Vercel & Set Environment Variables

### 3.1 Import Project
1. Go to https://vercel.com/new
2. Find your `Sleek.tracker` repo → **Import**
3. Framework: **Next.js** (auto-detected) → **Deploy**
4. **First deploy WILL FAIL** — that's expected (missing env vars)
5. Copy your Vercel URL: `https://sleek-tracker.vercel.app` (or whatever it gives you)

### 3.2 Set ALL Environment Variables in Vercel
Go to **Vercel Dashboard → Your Project → Settings → Environment Variables**

**For EACH variable below: click "Add New" → paste Name & Value → select ALL THREE environments (Production, Preview, Development) → Save**

---

### 🔴 CRITICAL — Required for Build & Runtime

| Variable | Value | How to Get |
|----------|-------|------------|
| `DATABASE_URL` | `postgresql://postgres.xxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres` | From **Part 1.2** (Session pooler URL with your password) |
| `SESSION_SECRET` | **64+ random characters** | Run in terminal: `openssl rand -base64 48` OR visit https://generate-secret.vercel.app |
| `NEXT_PUBLIC_APP_URL` | `https://sleek-tracker.vercel.app` | Your actual Vercel URL from 3.1 |

> ⚠️ **SESSION_SECRET must be 32+ chars** or app crashes on boot. Use `openssl rand -base64 48` for a strong 64-char secret.

---

### 🟡 REQUIRED for Core Features

| Variable | Value | How to Get |
|----------|-------|------------|
| `NVIDIA_API_KEY` | `nvapi-xxxxxxxxxxxxx` | 1. Go to https://build.nvidia.com → Sign in<br>2. Click avatar (top right) → **Get API Key** → **Generate Key**<br>3. Copy the key starting with `nvapi-` |
| `GMAIL_USER` | `your-email@gmail.com` | Create a **dedicated Gmail** (e.g., `sleek-tracker-reminders@gmail.com`) |
| `GMAIL_APP_PASSWORD` | `xxxx xxxx xxxx xxxx` (16 chars, no spaces) | 1. Enable 2-Step Verification on that Gmail: https://myaccount.google.com/security<br>2. Go to https://myaccount.google.com/apppasswords<br>3. Select "Mail" + "Other" → name it "sleek"<br>4. Copy the **16-char password** (remove spaces) |
| `CRON_SECRET` | **64+ random chars** | Same as SESSION_SECRET: `openssl rand -base64 48` |
| `OWNER_EMAIL` | `your-personal-email@example.com` | Where contact form messages go |

---

### 🟢 REQUIRED for Google OAuth ("Sign in with Google")

| Variable | Value | How to Get |
|----------|-------|------------|
| `GOOGLE_CLIENT_ID` | `123456789-abcdefgh.apps.googleusercontent.com` | See **Part 4** below |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxxxxxxxxx` | See **Part 4** below |
| `GOOGLE_REDIRECT_URI` | `https://sleek-tracker.vercel.app/api/auth/callback` | **Must match exactly** what you put in Google Cloud Console |

---

### 🔵 OPTIONAL — Only if Using These Features

| Variable | Feature | Required? |
|----------|---------|-----------|
| `RAZORPAY_KEY_ID` | Payments (Ultra Pro) | Only if charging users |
| `RAZORPAY_KEY_SECRET` | Payments (Ultra Pro) | Only if charging users |
| `NEXT_PUBLIC_SUPABASE_URL` | Not used in current code | **Not needed** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Not used in current code | **Not needed** |

---

## 🔐 Part 4: Google OAuth Setup (Google Cloud Console)

### 4.1 Create/Select Project
1. Go to https://console.cloud.google.com
2. Create new project or select existing → name it "Sleek Tracker"

### 4.2 Enable APIs
1. Left menu → **APIs & Services** → **Library**
2. Search and enable: **Google Identity** (or "Google Sign-In")

### 4.3 Configure OAuth Consent Screen
1. **APIs & Services** → **OAuth consent screen**
2. **User Type**: External → **Create**
3. **App name**: `Sleek Tracker`
4. **User support email**: your email
5. **Developer contact**: your email
6. **Scopes**: Add `.../auth/userinfo.email` and `.../auth/userinfo.profile`
7. **Test users**: Add your email (for testing while unpublished)
8. Save → Continue through all steps

### 4.4 Create OAuth Credentials
1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
2. **Application type**: Web application
3. **Name**: `Sleek Tracker Web`
4. **Authorized JavaScript origins**: 
   - `https://sleek-tracker.vercel.app`
   - `http://localhost:3000` (for local dev)
5. **Authorized redirect URIs** (MUST BE EXACT):
   - `https://sleek-tracker.vercel.app/api/auth/callback`
   - `http://localhost:3000/api/auth/callback`
6. Click **Create**
7. **COPY** the **Client ID** and **Client Secret** → paste into Vercel env vars

---

## 📧 Part 5: Gmail App Password Setup (Detailed)

> **Critical:** Regular Gmail password WON'T work. You MUST use an App Password.

1. **Enable 2-Step Verification** on the Gmail account:
   - https://myaccount.google.com/security → **2-Step Verification** → Turn ON

2. **Create App Password**:
   - https://myaccount.google.com/apppasswords
   - Select app: **Mail**
   - Select device: **Other (Custom name)** → type `sleek`
   - Click **Generate**
   - **Copy the 16-character code** (looks like `abcd efgh ijkl mnop`)
   - **Remove spaces** → `abcdefghijklmnop`
   - Paste into Vercel `GMAIL_APP_PASSWORD`

3. **Test**: In Vercel Functions log, trigger cron manually:
   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://sleek-tracker.vercel.app/api/cron/tick
   ```
   Should return `{"ok":true,"mode":"cron","users":N,"sent":M}`

---

## 💳 Part 6: Razorpay (Optional — Payments)

Only if you want to charge for Ultra Pro tier:

1. Go to https://razorpay.com → Sign up → Complete KYC
2. Dashboard → **Settings** → **API Keys** → **Generate Key**
3. **Test mode**: Keys start with `rzp_test_` — use these first
4. **Live mode**: After KYC approval, keys start with `rzp_live_`
5. Add both `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to Vercel

---

## 📊 Part 7: Google Sheets Export (Optional — Ultra Pro)

If you want the "Export to Google Sheets" feature:

1. In **same Google Cloud project** as OAuth (Part 4):
2. **APIs & Services** → **Library** → Enable:
   - **Google Sheets API**
   - **Google Docs API**
3. **Credentials** → Use the **same OAuth Client ID** from Part 4.4
4. Add redirect URI: `https://sleek-tracker.vercel.app/api/gworkspace/callback`
5. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (for gworkspace) to Vercel
   - Note: This uses a **different redirect URI** than the main auth!

---

## ✅ Part 8: Verify Everything Works

After setting ALL env vars in Vercel:

1. **Vercel Dashboard** → **Deployments** → latest → `⋯` → **Redeploy**
2. Wait ~90 seconds
3. Visit `https://sleek-tracker.vercel.app`
4. **Test checklist:**
   - [ ] Landing page loads
   - [ ] Click "Sign in with Google" → redirects to Google → returns to dashboard
   - [ ] Create a habit → appears on dashboard
   - [ ] Settings → set timezone → enable morning/evening emails
   - [ ] Trigger cron manually (see Part 5) → check emails arrive
   - [ ] AI Camera Verifier (trial) → take photo → verification works
   - [ ] Leaderboard / Stats pages load

---

## 🔧 Part 9: Daily Workflow (After Deployment)

### To update your live app:
```powershell
git add -A
git commit -m "Your change description"
git push
```
Vercel auto-deploys in ~90 seconds.

### To change config (env vars):
1. Vercel Dashboard → Settings → Environment Variables → edit
2. **Deployments** → latest → `⋯` → **Redeploy**

---

## 🆘 Troubleshooting Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Build fails "DATABASE_URL not set" | Missing in Vercel **Development** env | Add to all 3 environments in Vercel |
| "SESSION_SECRET must be 32+ chars" | Too short or missing | Generate with `openssl rand -base64 48` |
| Google login redirects to localhost | Wrong `NEXT_PUBLIC_APP_URL` or redirect URI | Set to `https://sleek-tracker.vercel.app` |
| "Invalid code verifier" | Cookie domain mismatch | Already fixed in code (no domain set) |
| Emails not sending | Gmail App Password wrong or 2FA off | Re-create App Password (Part 5) |
| "Too many connections" | Using Direct connection (port 5432) | Use **Session pooler** (port 6543) |
| Cron not firing | Vercel Hobby = once/day max | Check Vercel → Cron Jobs tab; or upgrade to Pro |
| AI features fail | Missing `NVIDIA_API_KEY` | Add to Vercel env vars |

---

## 📁 Your Local `.env` File (For Local Development Only)

Create `.env.local` in project root (never commit this!):

```env
# Database (use Supabase local dev or same production URL)
DATABASE_URL="postgresql://postgres.xxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres"

# Auth
SESSION_SECRET="your-64-char-secret-from-openssl"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Google OAuth (local)
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback"

# AI
NVIDIA_API_KEY="nvapi-xxxxx"

# Email (use same Gmail App Password)
GMAIL_USER="your-gmail@gmail.com"
GMAIL_APP_PASSWORD="your-16-char-app-password"

# Cron
CRON_SECRET="another-64-char-secret"
OWNER_EMAIL="your-email@example.com"
```

For local dev, also add `http://localhost:3000/api/auth/callback` to Google Cloud Console redirect URIs.

---

## 🎯 Summary: Minimum Viable Env Vars for Production

**Copy-paste this checklist into Vercel:**

```
✅ DATABASE_URL           (Supabase Session Pooler URL)
✅ SESSION_SECRET         (openssl rand -base64 48)
✅ NEXT_PUBLIC_APP_URL    (https://sleek-tracker.vercel.app)
✅ NVIDIA_API_KEY         (from build.nvidia.com)
✅ GMAIL_USER             (dedicated Gmail address)
✅ GMAIL_APP_PASSWORD     (16-char App Password, no spaces)
✅ CRON_SECRET            (openssl rand -base64 48)
✅ OWNER_EMAIL            (your email)
✅ GOOGLE_CLIENT_ID       (from Google Cloud Console)
✅ GOOGLE_CLIENT_SECRET   (from Google Cloud Console)
✅ GOOGLE_REDIRECT_URI    (https://sleek-tracker.vercel.app/api/auth/callback)
```

**Optional (only if using):**
```
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
```

---

## 📞 Need Help?

- **Vercel Logs**: Dashboard → Functions → click any function → see real-time logs
- **Supabase Logs**: Dashboard → Logs → Database / API
- **Google Cloud Logs**: Console → Logging → Logs Explorer

---

*Generated from your codebase analysis. Covers all 15 database tables, all API routes, auth flows, cron jobs, and external integrations.*