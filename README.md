# CreditBook — store credit ledger

A multi-store credit ledger for local shops. Store owners add customers and purchases on credit; customers sign in with email OTP, claim their store record using a one-time access code, see itemised balances, and pay online through Razorpay.

> This is a production-minded MVP codebase, not a certification or a substitute for a security review. Configure the external services, run the migration and tests, and complete the launch checklist before accepting real payments.

## Free preview deployment (Netlify + Supabase)

This package is prepared for an initial CreditBook preview deployment. Netlify supports this Next.js App Router application; `netlify.toml` selects Node.js 22.

1. Create a Supabase project. For a fresh database, run `supabase/migrations/0001_initial_schema.sql` in the SQL Editor. If you already ran the old phone-based `0001_initial_schema.sql`, run only `supabase/migrations/0002_customer_email_otp.sql` to upgrade it.
2. Configure Supabase Auth. Store owners use email/password. Customers use email OTP; no SMS provider is required for customer verification. Configure the Magic Link email template to include `{{ .Token }}` so Supabase sends a numeric OTP instead of a magic link.
3. Push this `creditbook` folder to a GitHub repository.
4. In Netlify, import the repository. Leave the base directory blank if the repository root is this folder. Use `npm run build` as the build command; Netlify detects Next.js automatically.
5. Add these Netlify environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `CLAIM_CODE_SECRET`.
6. Deploy, then add the Netlify site URL to Supabase Auth's allowed redirect URLs and redeploy if you change environment variables.

### Online payments intentionally disabled

Online payments and the Razorpay webhook placeholder are deliberately disabled in this preview. The previous single-platform Razorpay flow must not be used for CreditBook's chosen per-store settlement model. Implement and obtain approval for the merchant-specific partner onboarding and payment flow before accepting online payments. Do not create a Razorpay webhook for this preview.

The Netlify Free plan has monthly usage limits. Supabase Free projects may pause after a week of low activity and do not include automatic database backups. This deployment is for prototyping and controlled testing, not a financial-record production launch.

---

## Included

- Store-owner email/password sign-up and sign-in (one store per owner account in this starter).
- Customer email OTP sign-in (Supabase Auth email provider and SMTP delivery).
- Store-issued one-time customer access codes, stored only as keyed hashes.
- Multi-tenant data model with PostgreSQL Row Level Security.
- Immutable credit entries with item/description and amount.
- Customer balance and itemised ledger.
- Cash, UPI and bank-transfer payment recording by the store.
- Online payments intentionally disabled in this preview pending per-store merchant onboarding.
- Payment API and webhook placeholders return HTTP 503 until per-store merchant payments are implemented.
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
- A Razorpay Partner approval before implementing per-store online payments (not needed for this preview)
- Supabase Auth email delivery configured; use custom SMTP for reliable production delivery

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
3. In the Supabase SQL Editor, run the appropriate migration: `0001_initial_schema.sql` for a fresh database, or `0002_customer_email_otp.sql` if your database already has the previous phone-based schema.
4. In Supabase Authentication settings, enable Email/Password for store owners.
5. Enable Email authentication. Under Authentication → Email Templates → Magic Link, use `{{ .Token }}` in the template body to send a numeric email OTP. Configure SMTP for reliable delivery, and set OTP expiry/rate limits.
6. Configure allowed redirect URLs for your local and production domains. Email confirmation can remain enabled for store-owner sign-up; the store record is created by a database trigger when the auth user is created.
7. For production, configure SMTP for reliable owner verification emails and review Supabase Auth rate limits / CAPTCHA settings.

### Customer access-code flow

A store adds a customer using an email address and an E.164 phone number, such as `+919876543210`. Email is the customer login and verification identity; the phone number is retained as contact information. The store receives an eight-digit, one-time access code after creating the record and must share it privately with the customer. The customer signs in using email OTP, then enters the code in the customer portal. The code expires after seven days and is stored as an HMAC digest, not plaintext. Failed claims are throttled by email (10 attempts trigger a one-hour lock). A store owner can update contact details and issue a fresh code from the customer detail page if needed.

This extra claim step means an email OTP alone is not enough to link an unclaimed store record. The customer must also know the one-time code supplied by the store.

## 4. Razorpay (not enabled in this preview)

Do not add Razorpay API keys or configure a webhook for this deployment. The payment endpoints are intentionally disabled. After CreditBook receives the appropriate Razorpay Partner approval, implement account-specific onboarding, merchant authorization, payment creation, verification, and the correct partner/payment webhook subscriptions.

## 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

- Create a store-owner account from **Store owner** sign-up.
- Sign in as a customer from **Customer** and complete email OTP.
- Add the customer in the store dashboard using the email address and phone number. Verify that email OTP matches the registered email.
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
- [ ] Configure Supabase Auth email OTP with production SMTP, rate limits and abuse protection.
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
