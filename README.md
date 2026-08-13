# ZentroFlow API

Node.js + Express + MongoDB backend for [ZentroFlow](../zentroverse-buddy) (React frontend).

Full architecture, models, and endpoint contracts: **[../zentroverse-buddy/docs/BACKEND.md](../zentroverse-buddy/docs/BACKEND.md)**

## Run

```bash
cd zentroflow-api
npm install
cp .env.example .env
# Start MongoDB, then:
npm run dev
```

| URL | Purpose |
|-----|---------|
| `http://localhost:8787/health` | Health + DB status (default `PORT` in `.env`) |
| `http://localhost:8787/api/v1` | API base |

## Frontend

```env
VITE_API_URL=http://localhost:8787/api/v1
```

## Lead import flow

1. `GET /api/v1/leads/import/template` — sample Excel
2. `POST /api/v1/leads/import/validate` — multipart `file` **or** JSON `{ "rows": [...] }`
3. `POST /api/v1/leads/import/generate-ids` — same body; adds `leadId`, `customerId`, `opportunityId`
4. `POST /api/v1/leads/import` — commit valid rows (starts at **C0.1**)
5. `GET /api/v1/leads/import/latest` — last import batch summary

## Core routes

| Group | Examples |
|-------|----------|
| Customers | `POST/GET /customers` |
| Opportunities | `GET/POST /opportunities`, `POST .../stage-transition`, `POST .../actions` |
| Leads | Import endpoints above |
| Dashboard / Reports | `/dashboard/summary`, `/reports/pipeline` |
| Engines | `/engines/contact-health`, scoring, SLA |
| Action Engine | `/opportunities/:id/action-context`, `/actions`, `/rules`, `/action-engine/events`, `/action-engine/health` |
| Masters | `/masters/organisations`, branches, products, roles |

### Spec SSOT

- Stage Master (54 stages): `src/constants/stageMaster.js` — regenerate with `node scripts/generate-stage-master.mjs`
- Rule Engine seeds (14 rules): `src/constants/automationRules.js`
- Exit-field gates + golden rule enforced on stage transitions

Use `tests/api.http` with the REST Client extension for quick checks.

## ID format

IDs match the frontend generator: prefix from the **first word** of customer name (e.g. `ABC-LD-2026-…`, `ABC-CU-…`, `ABC-OP-…`).

## Notes

- Stage moves are **sequential** (no skipping micro stages unless `force: true` + `reason`).
- Duplicate import rows: same customer + product + **requirement** within `DUPLICATE_WINDOW_DAYS` (default 30).
