# CricBid Platform - Production Deployment Checklist

**Date:** 2026-10-22  
**Target Platform:** Vercel (Edge & Serverless Node.js Runtime)  
**Production URL:** `https://cricbid-platform.vercel.app`  

---

## 1. Environment Variables Configuration

Ensure the following environment variables are configured in the **Vercel Project Settings** (`Settings -> Environment Variables`) for **Production** and **Preview** environments:

| Variable Name | Required | Scope | Purpose |
| :--- | :---: | :---: | :--- |
| `RAZORPAY_KEY_ID` | **Yes** | Server-Only | Razorpay Key ID (`rzp_live_...` or `rzp_test_...`) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | **Yes** | Client/Server | Razorpay Key ID for client modal / payment links |
| `RAZORPAY_KEY_SECRET` | **Yes** | Server-Only | Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | **Yes** | Server-Only | Secret for validating webhook signatures |
| `ADMIN_PASSWORD` | **Yes** | Server-Only | Master password for `/admin` authentication |
| `ADMIN_SESSION_SECRET` | Optional | Server-Only | 32-character random string for signing session cookies |
| `GOOGLE_SHEET_SCRIPT_URL` | Optional | Server-Only | Google Apps Script deployment URL for sheet synchronization |
| `NEXT_PUBLIC_TOURNAMENT_NAME` | Optional | Client/Server | Default platform title |
| `NEXT_PUBLIC_REGISTRATION_FEE` | Optional | Client/Server | Default entry fee fallback |

> [!WARNING]
> **Security Notice:** Never prefix `ADMIN_PASSWORD`, `RAZORPAY_KEY_SECRET`, or `RAZORPAY_WEBHOOK_SECRET` with `NEXT_PUBLIC_`. Variables with `NEXT_PUBLIC_` are bundled directly into the browser's JavaScript.

---

## 2. Administrator Credential Rotation Procedure

Because the previous administrator password was shared in conversation, perform the following rotation:

1. Generate a strong new password (minimum 12 characters, mixing letters, numbers, and symbols).
2. Open **Vercel Dashboard** ➔ Select project `cricbid-platform`.
3. Navigate to **Settings** ➔ **Environment Variables**.
4. Add or update `ADMIN_PASSWORD` with the new value.
5. Save and trigger a redeployment.
6. Delete old session cookies by visiting `/admin` and clicking **"Lock / Exit"**.

---

## 3. Razorpay Webhook Setup

To ensure payments are automatically recorded even if a player closes their browser before redirection completes:

1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Navigate to **Account & Settings** ➔ **Webhooks** ➔ Click **"+ Add New Webhook"**.
3. **Webhook URL:** `https://cricbid-platform.vercel.app/api/razorpay/webhook`
4. **Secret:** Set a secure random string (e.g., `whsec_cricbid_2026_x9k2`) and add it to Vercel as `RAZORPAY_WEBHOOK_SECRET`.
5. **Alert Email:** Set your technical contact email.
6. **Active Events:** Enable:
   - `payment.captured`
   - `payment_link.paid`
7. Click **Save**.

---

## 4. Pre-Deployment Verification Checklist

- [x] TypeScript compilation check: `node ./node_modules/typescript/bin/tsc --noEmit` exits with 0 errors.
- [x] Automated regression suite: `npm test` runs 22 test cases with 0 failures.
- [x] Production build: `npm run build` generates clean output for all 14 routes.
- [x] Unauthenticated administrative mutation blocked (HTTP 401).
- [x] Phone numbers in public `/api/tournaments/[slug]/players` masked.
- [x] Client-side price tampering blocked in `/api/razorpay/create-order` and `/api/register`.
- [x] Uncaptured/fake payment IDs rejected with verification against Razorpay API.
- [x] Stored XSS protection: SVG uploads rejected.
- [x] Duplicate registrations for same tournament phone number blocked with HTTP 409.

---

## 5. Deployment & Rollback Strategy

### Deployment
1. Merge the `audit-fix-hardening` branch into `main`.
2. Push `main` to GitHub: `git push origin main`.
3. Vercel will automatically detect the push and deploy a new immutable production release.

### Rollback (If needed)
1. In Vercel Dashboard ➔ **Deployments**, locate the last known good deployment.
2. Click **Instant Rollback** to redirect traffic immediately.
3. Or via Git:
   ```bash
   git revert HEAD
   git push origin main
   ```
