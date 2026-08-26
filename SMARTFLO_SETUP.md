# Smartflo Auto Dialer setup

ZentroFLOW does **not** originate Autodialer customer calls. Smartflo Dial Out (Each Call) remains the dialer engine. ZentroFLOW syncs leads, stores call/disposition state, and shows campaign status.

## 1. Generate a Smartflo API token

In the Tata Smartflo / CloudPhone portal, create an API token with broadcast + dialer access. Put it only in the **API** `.env` as `SMARTFLO_API_TOKEN`. Never put it in `VITE_*` or commit it.

## 2. Backend environment

Copy placeholders from `.env.example`:

```env
SMARTFLO_API_BASE_URL=https://api-smartflo.tatateleservices.com/v1
SMARTFLO_API_TOKEN=
SMARTFLO_CAMPAIGN_ID=
SMARTFLO_LEAD_LIST_ID=
SMARTFLO_DISPOSITION_LIST_ID=
SMARTFLO_CALLER_ID=
SMARTFLO_DIALER_MODE=dial_out_each_call
SMARTFLO_WEBHOOK_SECRET=
```

`SMARTFLO_DIALER_MODE=dial_out_each_call` is required for the production campaign. Session start/end APIs return `409 SMARTFLO_SESSION_DISABLED` until you switch to `session`.

## 3. Find Campaign ID

Smartflo campaign settings → campaign used by ZentroFLOW Auto Dialer → numeric campaign id → `SMARTFLO_CAMPAIGN_ID`.

Do **not** create a second campaign from ZentroFLOW.

## 4. Find Lead List ID

Broadcast / lead list attached to that campaign → `SMARTFLO_LEAD_LIST_ID`.

## 5. Find Disposition List ID

Dialer disposition list configured on the campaign → `SMARTFLO_DISPOSITION_LIST_ID`. ZentroFLOW loads status **IDs** from Smartflo; do not hardcode them in the UI.

## 6. Configure the webhook

In Smartflo webhook settings, point to your public API:

```
https://YOUR_PRODUCTION_DOMAIN/api/v1/webhooks/smartflo/dialer
```

Alias (same handler):

```
https://YOUR_PRODUCTION_DOMAIN/api/v1/integrations/smartflo/webhook
```

If you set `SMARTFLO_WEBHOOK_SECRET`, send it as header `x-smartflo-secret` or `Authorization: Bearer <secret>`.

## 7. Enable these Smartflo events

- Call Connected to Agent (Dialer)
- Disposition Status Updated (Dialer)
- Call hangup (Missed or Answered)

## 8. One-lead live test

1. Sign in to ZentroFLOW as admin.
2. Open **Autodialer → Test**.
3. Select one opportunity.
4. **Sync to Smartflo** (`POST /api/v1/dialer/test/sync-lead`).
5. **Check Smartflo status** — local + remote should match, remote status **New**.
6. Agent logs into the **Smartflo Dialer Panel** (not the ZentroFLOW session buttons, unless mode is `session`).
7. Complete one test call and set a disposition in Smartflo.
8. Confirm webhook `POST` hits `/api/v1/webhooks/smartflo/dialer`.
9. Confirm Mongo `dialercalls` has one row and the opportunity `smartflo_disposition` updated.
10. Autodialer **Calls** tab shows the call.

Replay the same webhook — still **one** call row.

## 9. Verify webhook delivery

- API logs: `{ "service": "smartflo", "operation": "smartflo.webhook", ... }` (no token).
- Autodialer → Campaign → Last webhook.
- Collection `smartflowebhookevents` (`event_key` unique).

## 10. Known limits

- Dial Out (Each Call): agents use the Smartflo panel.
- No in-app WebSocket; Calls tab polls every 10s.
- Click-to-call IVR/agent endpoints are unchanged and separate from Autodialer.
