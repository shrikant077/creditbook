# CreditBook — store credit ledger

A multi-store credit ledger for local shops. Store owners add customers and purchases on credit; customers sign in with phone OTP, claim their store record using a one-time access code, see itemised balances, and pay online through Razorpay.

> This is a production-minded MVP codebase, not a certification or a substitute for a security review. Configure the external services, run the migration and tests, and complete the launch checklist before accepting real payments.

## Included

- Store-owner email/password sign-up and sign-in (one store per owner account in this starter).
- Customer phone OTP sign-in (Supabase Auth SMS provider required).
- Store-issued one-time customer access codes, stored only as keyed hashes.
- Multi-tenant data model with PostgreSQL Row Level Security.
- Immutable credit entries with item/description and amount.
- Customer balance and itemised ledger.
- Cash, UPI and bank-transfer payment recording by the store.
- Full or partial customer payments through Razorpay Checkout.
- Server-side Checkout signature verification, payment status fetch, signed webhook verification and webhook-event deduplication.
- SQL functions that lock customer rows when reserving payments or recording offline payments.
- INR amounts stored as integer paise.

## Stack

- Next.js App Router + React + TypeScript
- Supabase Auth + PostgreSQL + RLS
- Razorpay Standard Checkout
- Plain CSS (no UI framework required)

## 1. Prerequisites

- Node.js 20.9+ (Node 22 LTS recommended)
- npm
- A Supabase project
- A Razorpay account (start in Test Mode)
- A Supabase-supported SMS provider configured for phone OTP (for example, Twilio)

## 2. Install

```bash
npm install
cp .env.example .env.local
```

Fill in the environment variables. Keep `SUPABASE_SECRET_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `CLAIM_CODE_SECRET` server-side only. Do not prefix them with `NEXT_PUBLIC_`.

Generate a strong claim-code secret, for example:

```bash
openssl rand -base64 48
```

## 3. Set up Supabase

1. Create a Supabase project and copy its Project URL and publishable key into `.env.local`.
2. Copy the server-side secret key into `SUPABASE_SECRET_KEY`.
3. In the Supabase SQL Editor, run `supabase/migrations/0001_initial_schema.sql` in full.
4. In Supabase Authentication settings, enable Email/Password for store owners.
5. Enable Phone authentication and configure an SMS provider. Configure OTP length and expiry in line with your risk requirements.
6. Set the phone OTP length to 6 digits (or update the customer OTP input validation if you choose a different length). Configure allowed redirect URLs for your local and production domains. Email confirmation can remain enabled for store-owner sign-up; the store record is created by a database trigger when the auth user is created.
7. For production, configure SMTP for reliable owner verification emails and review Supabase Auth rate limits / CAPTCHA settings.

### Customer access-code flow

A store adds a customer using an E.164 phone number, such as `+919876543210`. The store receives an eight-digit, one-time access code after creating the record and must share it privately with the customer. The customer signs in using OTP on that same number, then enters the code in the customer portal. The code expires after seven days and is stored as an HMAC digest, not plaintext. Failed claims are throttled by phone number (10 attempts trigger a one-hour lock). A store owner can issue a fresh code from the customer detail page if needed.

This extra claim step means an initial phone OTP alone is not enough to link an unclaimed store record. It does not fully solve phone-number recycling after an account has been linked; before a broad production launch, add a customer PIN/passkey or a verified account-recovery policy for that risk.

## 4. Set up Razorpay

1. Use Test Mode API keys first and add them to `.env.local`.
2. In Razorpay Dashboard, configure a webhook URL:
   - Local development: use a secure public tunnel that Razorpay accepts, or test against a deployed staging URL.
   - Production: `https://YOUR_DOMAIN/api/webhooks/razorpay`
3. Subscribe to `payment.captured`. The endpoint also safely records other valid event types for deduplication, but only `payment.captured` changes a credit balance.
4. Copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET`.
5. Enable automatic capture in the Razorpay Dashboard. The verification route deliberately refuses to mark an `authorized`-only payment as paid.
6. Complete test payments and verify both the Checkout return path and webhook path before switching to live keys.

Razorpay Checkout is opened only with an order created by this server. The Key Secret is never sent to the browser. The browser's success callback is not trusted by itself: the server verifies the signature and fetches the payment from Razorpay; the webhook is independently verified against the raw request body.

## 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

- Create a store-owner account from **Store owner** sign-up.
- Sign in as a customer from **Customer** and complete SMS OTP.
- Add the customer in the store dashboard using the verified phone number.
- Share the generated access code with that customer.
- Claim the store record in `/account` and test the ledger and payments.

## 6. Useful routes

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/login` | Store and customer authentication |
| `/dashboard` | Store dashboard and customer list |
| `/dashboard/customers/[customerId]` | Customer ledger, add credit, record offline payment, issue access code |
| `/account` | Customer's linked stores and balances |
| `/account/[customerId]` | Customer's itemised ledger and online payment |
| `/api/payments/create-order` | Authenticated payment-order creation |
| `/api/payments/verify` | Checkout signature and payment-status verification |
| `/api/webhooks/razorpay` | Signed Razorpay webhook receiver |

## 7. Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The included automated tests cover money conversion and formatting. Before launch, add integration tests for RLS and payment lifecycle cases using a separate Supabase test project.

## 8. Production launch checklist

- [ ] Run the SQL migration in the intended production Supabase project.
- [ ] Configure Supabase Auth phone OTP with a real SMS provider, rate limits and abuse protection.
- [ ] Configure email confirmation / SMTP for store owners.
- [ ] Configure Razorpay live credentials and the production webhook secret.
- [ ] Enable automatic capture and test captured, failed, abandoned, duplicate and delayed webhook cases. Confirm how your store will handle abandoned pending orders before enabling online payments.
- [ ] Confirm webhook delivery logs and alerting; add application error monitoring.
- [ ] Add a custom domain and HTTPS; configure Supabase redirect URLs.
- [ ] Review privacy policy, terms, refund/dispute process, data-retention policy and applicable Indian legal/tax requirements.
- [ ] Decide whether stores are the merchant of record and ensure each store's Razorpay account/settlement arrangement is correct. This starter uses one platform Razorpay account; it does **not** implement marketplace split settlements or connected merchant accounts.
- [ ] Back up the database and test restore procedures.
- [ ] Run an independent security review and test cross-store access denial.

## Important product / payment note

This implementation charges the platform's configured Razorpay merchant account. If each shop must receive money directly into its own bank account, you need a merchant onboarding / Razorpay Route or another approved marketplace settlement design. Do not collect money on behalf of unrelated stores until your payment-provider agreement and legal setup explicitly permit that model.

## Currency and ledger rules

All amounts are stored as integer paise. Credit entries are append-only. Payments are separate ledger records. A customer's outstanding amount is the sum of credit entries minus captured payments, floored at zero for display. The SQL reservation function allows one active online payment per customer/store record to reduce double-payment races. Razorpay Orders do not have a general expiry field, so the same pending order is reused; offline payment recording is blocked while that online order remains pending. A store should ask the customer to complete the pending order rather than recording a second payment.
