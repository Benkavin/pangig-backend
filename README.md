# Pangig Backend API

Secure Node.js backend for the Pangig contractor marketplace.

---

## What This Does
- Secure admin login (server-side, password never exposed)
- User signup & login with encrypted passwords
- JWT authentication
- Job posting and lead unlocking
- Stripe payments (USA, Canada, UK, global)
- Paystack payments (Nigeria, Ghana, Kenya)
- Admin dashboard API (users, jobs, transactions, pricing)
- Invoice management

---

## Setup Instructions

### Step 1 — Create a Supabase Database (Free)
1. Go to https://supabase.com and create a free account
2. Click "New Project" — name it `pangig`
3. Go to the **SQL Editor** tab
4. Copy and paste the entire contents of `database-schema.sql` and click Run
5. Go to **Settings → API** and copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `service_role` secret key → this is your `SUPABASE_SERVICE_KEY`

### Step 2 — Create a Stripe Account (Global Payments)
1. Go to https://stripe.com and create a free account
2. Go to **Developers → API Keys**
3. Copy your **Secret key** (starts with `sk_live_...`)
4. Go to **Developers → Webhooks → Add endpoint**
   - URL: `https://your-backend-url.railway.app/api/payments/stripe/webhook`
   - Events to listen for: `checkout.session.completed`
5. Copy the **Webhook signing secret** (starts with `whsec_...`)

### Step 3 — Create a Paystack Account (Africa/Nigeria)
1. Go to https://paystack.com and create a free account
2. Go to **Settings → API Keys & Webhooks**
3. Copy your **Secret Key** (starts with `sk_live_...`)
4. Set webhook URL to: `https://your-backend-url.railway.app/api/payments/paystack/webhook`

### Step 4 — Deploy to Railway (Free)
1. Go to https://railway.app and sign up with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Upload this entire `pangig-backend` folder as a new GitHub repo first, then connect it
4. Once deployed, go to **Variables** and add ALL the environment variables below

### Step 5 — Set Environment Variables on Railway
Copy your `.env.example` file and fill in all the values:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=make-this-a-long-random-string-at-least-32-characters
ADMIN_EMAIL=admin@pangig.com
ADMIN_PASSWORD=Connectcaller431@
STRIPE_SECRET_KEY=sk_live_your-key
STRIPE_WEBHOOK_SECRET=whsec_your-secret
PAYSTACK_SECRET_KEY=sk_live_your-key
FRONTEND_URL=https://www.pangig.com
NODE_ENV=production
PORT=3000
```

### Step 6 — Update Your Frontend
Once the backend is live, update `pangig.html` to point API calls to your Railway URL instead of using local data.

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/signup | Create new account |
| POST | /api/auth/login | Login (returns JWT token) |
| GET  | /api/auth/me | Get current user |
| GET  | /api/jobs | Get all jobs |
| POST | /api/jobs | Post a new job |
| POST | /api/jobs/:id/unlock | Unlock a lead (costs credits) |
| GET  | /api/payments/packages | Get credit packages |
| POST | /api/payments/stripe/create-checkout | Start Stripe payment |
| POST | /api/payments/paystack/initialize | Start Paystack payment |
| GET  | /api/admin/overview | Admin stats |
| GET  | /api/admin/users | All users |
| GET  | /api/admin/transactions | All transactions |
| PUT  | /api/admin/pricing/:id | Update lead pricing |
| POST | /api/invoices | Create invoice |
| GET  | /api/invoices | Get invoices |

---

## Admin Login
- Email: admin@pangig.com
- Password: (set in your environment variables)
- The admin password is NEVER stored in the database or frontend code
