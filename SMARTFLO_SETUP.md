# Smartflo Auto Dialer setup

ZentroFLOW syncs leads into a pre-existing Smartflo campaign/list, receives call webhooks, and lets agents start a **session** so Smartflo auto-dials. ZentroFLOW never dials customer numbers from the browser.

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
SMARTFLO_DIALER_MODE=session
SMARTFLO_WEBHOOK_SECRET=
SMARTFLO_SYNC_BATCH_SIZE=500
```

| Mode | Behaviour |
|------|-----------|
| `session` (recommended) | Autodialer **Agent** tab Start/End Session calls Smartflo `/dialer/session_call`. Smartflo sequences synced leads. |
| `dial_out_each_call` | Session buttons stay disabled; agents use the Smartflo Dialer Panel. |

Do **not** create campaigns, lead lists, or disposition lists from ZentroFLOW APIs — use the env IDs above.

## 3. Find Campaign / Lead List / Disposition IDs

- Campaign settings → numeric id → `SMARTFLO_CAMPAIGN_ID`
- Broadcast list attached to that campaign → `SMARTFLO_LEAD_LIST_ID`
- Dialer disposition list on the campaign → `SMARTFLO_DISPOSITION_LIST_ID`

ZentroFLOW loads disposition **IDs** from Smartflo; never hardcode names as IDs in the UI.

## 4. Lead field mapping (do not remap)

| Smartflo field | ZentroFLOW |
|----------------|------------|
| `field_0` | Customer phone |
| `field_1` | Customer name |
| `field_2` | Email |
| `field_3` | Address |
| `field_4` | Branch |
| `field_5` | `opportunity_id` (webhook match key) |

## 5. Configure the webhook

```
https://YOUR_PRODUCTION_DOMAIN/api/v1/webhooks/smartflo/dialer
```

Alias:

```
https://YOUR_PRODUCTION_DOMAIN/api/v1/integrations/smartflo/webhook
```

If `SMARTFLO_WEBHOOK_SECRET` is set, send `x-smartflo-secret` or `Authorization: Bearer <secret>`.

Enable events: Call Connected to Agent (Dialer), Disposition Status Updated (Dialer), Call hangup (Missed or Answered).

## 6. Key API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/dialer/current-call` | Latest open call + lead for Agent UI |
| GET | `/api/v1/dialer/session/status` | `active`, `startedAt`, mode |
| POST | `/api/v1/dialer/session/start\|end` | Smartflo session (mode=`session`) |
| POST | `/api/v1/dialer/disposition` | Save disposition + CRM fields |
| POST | `/api/v1/dialer/calls/:id/disposition` | Same as above (alias) |
| POST | `/api/v1/dialer/leads/sync` | `{ syncAll }`, `{ leadIds }`, or `{ retryFailed }` |
| GET | `/api/v1/dialer/sync-jobs/:syncId` | Bulk sync job progress |
| GET | `/api/v1/dialer/statistics` | Connection / interest rates |

Smartflo upstream used: `/dialer/session_call`, `/broadcast/leads/{id}`, `/broadcast/batch_status/{id}`, `/dialer/store-disposition`, `/dialer/disposition_list`, campaign GET.

## 7. Agent workflow (session mode)

1. Admin: Autodialer → **Campaign** → Sync All / Sync pending (or Leads → Sync selected).
2. Agent: Autodialer → **Agent** → **Start Session**.
3. Poll current-call: Waiting → Ringing → Connected → Disposition pending.
4. Save disposition (Smartflo ID + priority / feedback / notes / callback).
5. Smartflo advances to the next lead; **End Session** when done.

Admin tabs: Campaign, Leads, Test. Agent focus: Agent + Calls.

## 8. Three-lead manual test

1. Create/import **3** opportunities with valid Indian mobiles.
2. Autodialer → Leads → select all three → **Sync selected** (or Sync All).
3. Confirm `smartflo_sync_status=SYNCED` and remote list shows three rows (`field_5` = opportunity id).
4. Set `SMARTFLO_DIALER_MODE=session`, restart API (`pm2 restart zentroflow-api --update-env`).
5. Agent: Start Session; confirm Smartflo dials (or panel shows session active).
6. Complete one call; webhook creates `DialerCall`; opportunity dial status updates.
7. Agent saves disposition with notes + callback; verify Opportunity `dialer_notes` / `callback_at`.
8. Replay the same webhook payload — still one call row (`event_key` idempotent).

## 9. Production deploy checklist

```bash
# API
git pull
# ensure SMARTFLO_DIALER_MODE=session in .env
pm2 restart zentroflow-api --update-env

# Frontend
# redeploy zentroverse-buddy (Vercel or your host)
```

## 10. Known limits

- No Smartflo `createCampaign` / `createLeadList` / `createDispositionList` from ZentroFLOW.
- No separate `/admin/dialer` or `/agent/dialer` URL trees (dashboard Autodialer module only).
- No custom “Call Next Lead” engine — Smartflo sequences in session mode.
- `field_5` must remain `opportunity_id`.
- Progressive dial method only if present on the remote campaign payload.
- Never log or expose `SMARTFLO_API_TOKEN`.
