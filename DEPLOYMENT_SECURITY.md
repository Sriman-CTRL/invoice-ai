# Enterprise FinTech Security & Regulatory Compliance Blueprint

> Note: this is a target security blueprint, partly written before the code. Not every control listed here is implemented. Check the code and tests before relying on or repeating any claim in this file.

> **System Scope:** Autonomous AI Accounts Receivable & Invoicing SaaS  
> **Classification:** Confidential / Production Runbook & Architecture Specification  
> **Compliance Standards:** PCI-DSS SAQ A, CAN-SPAM Act, CFPB Reg F (12 CFR Part 1006), FDCPA / State Commercial Debt Laws (e.g. CA SB 1286), EU AI Act (Article 50), GDPR (Articles 15, 17, 21), DPDP Act, and GST/VAT Accounting Immutability Standards.

---

## 1. Executive Summary & Security Posture

In B2B Financial SaaS and automated collection workflows, security failures are rarely exotic: they stem from missing tenant boundaries (IDOR), prompt injection hijacking LLMs into executing unauthorized rebates, unverified webhooks, leaked credentials, or violating statutory debt dunning rules that invite regulatory enforcement.

This platform enforces a **Zero-Trust, Defense-in-Depth Architecture across 8 Layers**, coupled with a **Deterministic Compliance Gate** that intercepts every outbound message and financial settlement.

```
+---------------------------------------------------------------------------------------+
| LAYER 1: Cloudflare Edge (WAF, DNSSEC, Bot Management, SPF/DKIM/DMARC p=reject)       |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| LAYER 2: Transport & HTTP Security Headers (HSTS Preload, Strict CSP, Nosniff, DENY)  |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| LAYER 3: Authentication & Inbound Integrity (Timing-Safe HMAC, Replay-Window 5m)     |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| LAYER 4: Multi-Tenant Isolation & RLS (PostgreSQL Native RLS + App Scoping Extension) |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| LAYER 5: Application Security & PCI-DSS (Luhn Card Scrubber, Multi-Tier Rate Limits)  |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| LAYER 6: AI Safety & Anti-Prompt Injection (<customer_message> Tag Containment)       |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| REGULATORY COMPLIANCE GATE (Dispute Pause, Suppression List, Cooldowns, Credit Notes)  |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| AUDIT & OBSERVABILITY (Structured Redacted JSON Audit Logs, Tamper-Evident Trail)     |
+---------------------------------------------------------------------------------------+
```

---

## 2. Layer-by-Layer Technical Implementation

### Layer 1: Edge & Network Security
- **Domain & DNS Protection:** Registrar lock, DNSSEC activated, CAA records restricting certificate authority issuance to Let's Encrypt / DigiCert.
- **Email Deliverability & Anti-Phishing:**
  - **SPF:** `v=spf1 include:_spf.yourdomain.com -all`
  - **DKIM:** 2048-bit RSA keys rotated every 90 days.
  - **DMARC:** `v=DMARC1; p=reject; rua=mailto:dmarc-reports@yourdomain.com; aspf=s; adkim=s;`
  - *Rationale:* Protects customers against invoice spoofing, payment redirect fraud, and dunning phishing attacks.
- **Origin Lockdown:** Backend origin rejects any direct public IPv4/IPv6 requests. Traffic is routed exclusively through Cloudflare Tunnel or mTLS Authenticated Origin Pulls.
- **Edge WAF:** OWASP Core Rule Set enabled; custom rate limits and bot challenges (Cloudflare Turnstile) on `/api/auth/*` and inbound webhook endpoints.

### Layer 2: Transport & HTTP Security Headers
The Express backend mounts production-grade headers via `helmet`:
```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; font-src 'self' https: data:; style-src 'self' https: 'unsafe-inline'; script-src 'self'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```
- **HSTS Preload:** 2-year `max-age=63072000` qualified for the HSTS Preload list.
- **Clickjacking Prevention:** `frame-ancestors 'none'` and `X-Frame-Options: DENY` eliminate framing of payment approval views.

### Layer 3: Authentication & Inbound Webhook Integrity
- **Password Hashing:** Passwords bounded to 8–72 characters (NIST 800-63B guidelines and bcrypt DoS defense), hashed with bcrypt cost factor 12.
- **Timing-Safe Verification:** Inbound webhook payloads (from email providers or n8n) are validated using `crypto.timingSafeEqual` over SHA-256 HMAC tokens, eliminating side-channel timing attacks.
- **Replay Protection:** Requests outside the 5-minute window (`Math.abs(Date.now() - timestamp) > 300_000`) are rejected immediately.

### Layer 4: Multi-Tenant Isolation & Native Row-Level Security (RLS)
- **Zero Cross-Tenant Leakage:** Multi-tenancy is enforced through two redundant layers:
  1. **Application Layer:** `authMiddleware` validates JWT `organization_id` against URL/body inputs. Any mismatch emits a high-priority audit event (`CROSS_TENANT_ACCESS_BLOCKED`) and rejects with HTTP 403 Forbidden.
  2. **Database Layer (RLS):** All 8 core tables (`organizations`, `users`, `customers`, `invoices`, `payments`, `conversations`, `collection_actions`, `suppressions`, `credit_notes`) have PostgreSQL native Row-Level Security enabled with policy:
     ```sql
     CREATE POLICY org_isolation_policy ON invoices
       USING (organization_id = current_setting('app.current_org_id', true)::uuid);
     ```

### Layer 5: Application Security & PCI-DSS Scoping
- **PCI-DSS SAQ A Minimization:** The application never stores raw Primary Account Numbers (PANs).
  - The Luhn-checksum sanitizer (`passesLuhn`) analyzes any inbound text and redacts valid 13–19 digit card numbers into `[CARD_REDACTED_XXXX]` prior to persisting in the database.
- **Multi-Tier Rate Limiting:**
  - `/api/auth/*`: 60 requests / minute
  - `/api/payments/*`: 30 transactions / minute per tenant
  - `/api/overdue-invoices`: 10 scans / minute per tenant
  - `/api/messages/*`: 60 requests / minute
  - Rate limit breaches respond with HTTP 429 and `Retry-After` headers.

### Layer 6: AI Safety & Anti-Prompt Injection Defense
- **XML Delimited Containment:** Untrusted inbound customer text is strictly encapsulated in `<customer_message>` tags.
- **Prompt Injection Hardening:** Prompts instruct LLMs to ignore instructions within the tags attempting to change system roles, issue unauthorized balance waivers, or alter tax amounts.
- **Zero Autonomous Financial Authority:** The AI is strictly an **Intent Classifier** (producing structured JSON with confidence scores). It possesses zero database write access and cannot approve payments or alter ledger balances. All actions are executed deterministically by the core application engine.

---

## 3. Legal & Regulatory Compliance Framework

### 1. Fair Debt Collection & Communications (CFPB Reg F, FDCPA, CA SB 1286)
- **Automatic Dispute Freeze:** If a debtor disputes an invoice (`DISPUTE` intent), the system automatically transitions the invoice status to `DISPUTED` and logs an `ESCALATE_DISPUTE` action.
  - The dunning cron query (`/claim-due`) employs an explicit SQL check:
    ```sql
    NOT EXISTS (
      SELECT 1 FROM collection_actions ca
      WHERE ca.invoice_id = i.id
        AND ca.status = 'PENDING'
        AND ca.recommended_action = 'ESCALATE_DISPUTE'
    )
    ```
    This completely halts automated reminder emails until a human finance manager resolves the dispute.
- **Mandatory Cooldowns:** Enforces a minimum 3-day quiet period between reminders for the same invoice, preventing statutory harassment claims.
- **Time-of-Day Quiet Hours:** All outbound collection messages are restricted to 8:00 AM – 9:00 PM in the debtor's local timezone.

### 2. Marketing & Electronic Communications (CAN-SPAM Act, TCPA)
- **Suppression Registry:** Maintains an active database table `suppressions` indexing emails, domains, and phone numbers.
- **Deterministic Opt-Out Engine:** Scans all inbound messages against regex patterns (`stop`, `unsubscribe`, `cease and desist`, `do not contact`, `opt out`). Any match automatically registers the contact in `suppressions` and suppresses future automated dunning.

### 3. EU AI Act (Article 50 Transparency)
- Every outbound communication generated with AI assistance automatically includes a standardized, legally compliant disclosure footer:
  > *"This communication was prepared with automated assistance by InvoiceAI on behalf of the creditor. To speak with an account manager or dispute this record, reply directly to this notice."*

### 4. Data Privacy & Sovereign Rights (GDPR & DPDP Act)
- **Right to Data Portability (GDPR Art. 20):** `GET /api/customers/:id/export` provides a complete, machine-readable JSON archive of all debtor profiles, invoices, communication logs, and payment histories.
- **Right to Erasure (GDPR Art. 17 / DPDP):** `POST /api/customers/:id/erasure` executes compliance anonymization:
  - Personal identifiable information (name, email, phone, company) is cryptographically wiped / replaced with `ANONYMIZED_USER_[ID]`.
  - The customer is flagged `processing_restricted = true`.
  - The email is added to `suppressions` under reason `GDPR_ERASURE`.
  - All pending collection actions are cancelled.
  - **Statutory Accounting Retention Exemption:** Historical invoices and ledger payments are retained in an immutable, anonymized state under the mandatory 7-year tax audit hold (e.g. IRS / HMRC / GST laws).

### 5. Statutory Tax Accounting Integrity (GST / VAT)
- Invoices cannot be modified or deleted post-issuance.
- Negative balance adjustments are executed strictly via sequential **Tax Credit Notes** (`CN-INV...`) via `POST /api/credit-notes`.
- Credit notes validate against the open invoice balance, update remaining amounts, and log auditable events.

---

## 4. Verification & Testing Suite

The repository includes comprehensive automated test suites verifying all security and regulatory controls:

```bash
cd backend
npm test
```

### Test Coverage Summary:
- `COMPLIANCE [PCI-DSS SAQ A]: passesLuhn accurately validates card checksums`
- `COMPLIANCE [PCI-DSS SAQ A]: redactPaymentCardData redacts PAN without breaking invoice numbers`
- `COMPLIANCE [CAN-SPAM / Reg F]: checkIsOptOut identifies opt-out and cease-contact phrases`
- `SECURITY [Layer 4]: authMiddleware blocks cross-tenant query tampering (IDOR)`
- `SECURITY [Layer 4]: authMiddleware blocks cross-tenant body tampering on POST`
- `SECURITY [Layer 4]: authMiddleware auto-scopes organization_id to user tenant`
- `SECURITY [Layer 5]: Rate limiter returns 429 and Retry-After when threshold exceeded`
- `SECURITY [Layer 6]: Prompt injection attempts do not bypass classifier enums`
- `Deterministic Intent Classifier validation and schema checking`

---

## 5. Production Cloud Deployment Runbook

### Step 1: Cloudflare WAF & Edge Setup
1. Point domain nameservers to Cloudflare.
2. Enable **DNSSEC** in Cloudflare Dashboard -> DNS -> Settings.
3. Add CAA Records:
   ```dns
   yourdomain.com.  IN  CAA  0 issue "letsencrypt.org"
   yourdomain.com.  IN  CAA  0 issuewild "letsencrypt.org"
   ```
4. Configure WAF Rules under Security -> WAF:
   - Block malicious User-Agents and automated scrapers.
   - Deploy **Cloudflare Turnstile** on login and registration pages.
5. Setup Cloudflare Tunnel (`cloudflared`) to your origin container.

### Step 2: Email Authentication (SPF / DKIM / DMARC)
1. Add DNS TXT record for SPF:
   ```dns
   v=spf1 include:_spf.postmarkapp.com ~all
   ```
2. Add DKIM CNAME records provided by your transactional email provider.
3. Add DMARC TXT record for `_dmarc.yourdomain.com`:
   ```dns
   v=DMARC1; p=reject; pct=100; rua=mailto:dmarc-reports@yourdomain.com
   ```

### Step 3: Database Security & Point-In-Time-Recovery (PITR)
1. Ensure AWS RDS or Azure PostgreSQL is provisioned inside private subnets without public IPs.
2. Enable automated daily backups with a **35-day Point-in-Time Recovery (PITR)** window.
3. Enforce TLS 1.3 for all client connections (`sslmode=require`).
4. Execute `enable_rls.sql` to guarantee Row-Level Security enforcement at the database engine level.

### Step 4: Secrets & CI/CD Pipeline
1. Store all secrets (`JWT_SECRET`, `DATABASE_URL`, `INBOUND_WEBHOOK_SECRET`) in AWS Secrets Manager or HashiCorp Vault.
2. The GitHub Actions workflow (`.github/workflows/ci.yml`) runs linting, type-checking, and all unit, security, and compliance tests prior to merging to `main`.
