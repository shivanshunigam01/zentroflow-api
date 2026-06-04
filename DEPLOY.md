# Fix 502 Bad Gateway (nginx)

A **502** means nginx is up but **Node is not responding** (crashed, wrong port, or not started).

## On the server (SSH)

```bash
cd /var/www/zentroflow-api

# 1. Install deps (required after auth/bcrypt changes)
npm install

# 2. Check .env exists and PORT matches nginx proxy_pass
grep PORT .env
# Should match nginx, e.g. PORT=8787

# 3. Test start manually (see errors in terminal)
node server.js
# Ctrl+C after you see "ZentroFlow API running..."

# 4. Restart PM2
pm2 restart zentroflow-api --update-env
# or first time:
# pm2 start ecosystem.config.cjs
# pm2 save

# 5. Logs (most important)
pm2 logs zentroflow-api --lines 80
```

## Test locally on the server

```bash
curl -i http://127.0.0.1:8787/health
curl -i http://127.0.0.1:8787/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buddy@zentroverse.com","password":"Zentroflow@2026"}'
```

If `curl` works on the server but `https://flow.zentroverse.com` returns 502, fix **nginx** `proxy_pass` port:

```nginx
location / {
    proxy_pass http://127.0.0.1:8787;  # must match PORT in .env
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then: `sudo nginx -t && sudo systemctl reload nginx`

## CORS duplicate headers (browser blocks API)

If you see **two** `Access-Control-Allow-Origin` values (e.g. your Vercel URL **and** `*`), nginx is adding CORS **and** Express is too.

**Remove CORS from nginx** — let Node handle it only:

```nginx
# DELETE lines like these from your site config:
# add_header Access-Control-Allow-Origin *;
# add_header Access-Control-Allow-Methods ...;
# add_header Access-Control-Allow-Headers ...;
```

Reload nginx after editing.

Verify one header only:

```bash
curl -I -X OPTIONS "https://flow.zentroverse.com/api/v1/auth/login" \
  -H "Origin: https://zentroverse-automation.vercel.app" \
  -H "Access-Control-Request-Method: POST"
```

Expect a **single** `Access-Control-Allow-Origin: *`

## Common crash causes

| Error in `pm2 logs` | Fix |
|---------------------|-----|
| `Cannot find module 'bcryptjs'` | Run `npm install` in project folder |
| MongoDB / `ECONNREFUSED` | Check `MONGODB_URI` in `.env`, Atlas IP whitelist |
| `EADDRINUSE` | Another process uses PORT; change PORT or kill old process |
| Wrong folder | PM2 `cwd` must be `/var/www/zentroflow-api` with `server.js` |

## Login after API is healthy

- `buddy@zentroverse.com` / `Zentroflow@2026` (auto-created if DB had no users)
- Or use **Register** on the frontend
