# Running in production

One Linux server (a PC at the factory or a small cloud VM) runs everything:

| Piece | Runs as | Address |
|---|---|---|
| **Caddy**: HTTPS for both domains, certificates renewed automatically | Docker | ports 80, 443 |
| **Pocket ID**: sign-in with passkeys ([AUTH.md](AUTH.md)) | Docker | `https://id.example.in` → `127.0.0.1:1411` |
| **Postgres**: the app's data | Docker | `127.0.0.1:5432` (not reachable from outside) |
| **The app** (Bun) | systemd service | `https://books.example.in` → `127.0.0.1:3000` |

Replace `id.example.in` / `books.example.in` with your own two subdomains throughout.

> **Pick the Pocket ID domain once.** Passkeys are tied to the exact domain. If `id.example.in` ever
> changes, every staff member has to register a new passkey (using a [one-time login code](AUTH.md#staff-without-a-passkey-yet-one-time-login-codes)).

## 1. Prepare the server

- Docker with the compose plugin; [Bun](https://bun.sh) 1.4.4 or newer; git.
- DNS: point both subdomains (A records) at the server. Open ports 80 and 443 only.
  - Server not reachable from the internet (factory LAN only)? Caddy can't get a certificate the
    usual way. Use Caddy's DNS challenge for your DNS provider, or a Cloudflare Tunnel. Passkeys
    need real HTTPS either way.

```bash
sudo mkdir -p /opt/accountant && sudo chown $USER /opt/accountant && cd /opt/accountant
git clone https://github.com/AnkurSaini07/accountant.git app
mkdir -p services backups
```

## 2. Services: Caddy, Pocket ID, Postgres

`/opt/accountant/services/compose.yaml`:

```yaml
services:
  caddy:
    image: caddy:2
    restart: unless-stopped
    network_mode: host # reaches the app and Pocket ID on 127.0.0.1
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy:/data

  pocket-id:
    image: ghcr.io/pocket-id/pocket-id:v2.19.2 # pin; see "Upgrades"
    restart: unless-stopped
    ports: ["127.0.0.1:1411:1411"]
    environment:
      APP_URL: https://id.example.in
      ENCRYPTION_KEY: ${POCKET_ID_ENCRYPTION_KEY:?}
      TRUST_PROXY: "true" # behind Caddy
    volumes:
      - pocket-id:/app/data
    healthcheck:
      test: ["CMD", "/app/pocket-id", "healthcheck"]
      interval: 30s

  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    ports: ["127.0.0.1:5432:5432"]
    environment:
      POSTGRES_USER: accountant
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?}
      POSTGRES_DB: accountant
    volumes:
      - postgres:/var/lib/postgresql

volumes:
  caddy:
  pocket-id:
  postgres:
```

`/opt/accountant/services/Caddyfile`:

```
id.example.in {
	reverse_proxy 127.0.0.1:1411
}

books.example.in {
	reverse_proxy 127.0.0.1:3000
}
```

`/opt/accountant/services/.env`: generate each value once, then **store a copy somewhere safe off the
server** (a password manager):

```bash
POCKET_ID_ENCRYPTION_KEY=   # openssl rand -base64 32. Without it, Pocket ID backups can't be read.
POSTGRES_PASSWORD=          # openssl rand -hex 24
```

```bash
cd /opt/accountant/services && chmod 600 .env && docker compose up -d --wait
```

## 3. Set up Pocket ID

1. Open `https://id.example.in/setup` and register the **owner's passkey**. This first account is
   the Pocket ID admin.
2. **User groups → Add group**, four times, with these exact names:
   `accountant-admin`, `accountant-accountant`, `accountant-operator`, `accountant-viewer`.
   Add yourself to `accountant-admin`.
3. **OIDC clients → Add client**:
   - Name: `Accountant`
   - Callback URL: `https://books.example.in/api/auth/callback`
   - Logout callback URL: `https://books.example.in/`
   - Leave **Public client** off: the app keeps a client secret.
   - Save, then copy the **client ID** and **client secret** for the next step.
   - Under **Allowed user groups**, select the four `accountant-*` groups. People outside them are
     then refused by Pocket ID itself.
4. Add staff: see [AUTH.md → Add a staff member](AUTH.md#add-a-staff-member).

## 4. The app

`/opt/accountant/app/.env` (`chmod 600`; Bun reads it automatically):

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://accountant:<POSTGRES_PASSWORD>@127.0.0.1:5432/accountant
APP_URL=https://books.example.in
OIDC_ISSUER=https://id.example.in
OIDC_CLIENT_ID=<from step 3>
OIDC_CLIENT_SECRET=<from step 3>
COOKIE_SECRET=<openssl rand -base64 32>
```

In production the app refuses a plain-http `OIDC_ISSUER` and marks its session cookie `Secure`.

```bash
cd /opt/accountant/app
bun install --frozen-lockfile
bun run migrate
```

`/etc/systemd/system/accountant.service` (replace `deploy` with the user that owns `/opt/accountant`):

```ini
[Unit]
Description=Accountant
After=docker.service
Requires=docker.service

[Service]
User=deploy
WorkingDirectory=/opt/accountant/app
ExecStart=/usr/local/bin/bun src/server/index.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now accountant
curl -s https://books.example.in/api/health   # {"ok":true}
```

Run `which bun` to get the path for `ExecStart`.

**Check it end to end:** open `https://books.example.in`, click **Sign in with Pocket ID**, use your
passkey, and you should land on the dashboard with your name in the header. Seeing **"No access yet"**
means your Pocket ID user isn't in an `accountant-*` group.

## 5. Backups

Back up **both** databases every night and keep copies **off the server**: a USB drive taken home, or
cloud storage. A backup on the same disk doesn't survive a dead disk or theft.

`/opt/accountant/backup.sh`:

```bash
#!/bin/sh
set -eu
cd /opt/accountant/services
day=$(date +%F)
docker compose exec -T postgres pg_dump -U accountant -Fc accountant > ../backups/accountant-$day.dump
docker compose exec -T pocket-id /app/pocket-id export --path - > ../backups/pocket-id-$day.zip
find ../backups -type f -mtime +30 -delete   # keep 30 days here; copy elsewhere for longer
```

```bash
chmod +x /opt/accountant/backup.sh
(crontab -l 2>/dev/null; echo "30 1 * * * /opt/accountant/backup.sh") | crontab -
```

Both commands are safe while everything is running. The Pocket ID file holds its users, passkeys, groups
and clients, encrypted with `POCKET_ID_ENCRYPTION_KEY`: keep that key with your backups, but not in
the same place.

### Restore (on a fresh server, after steps 1–2, before step 3)

```bash
cd /opt/accountant/services
docker compose stop pocket-id
docker compose run --rm -T pocket-id /app/pocket-id import --path - --yes < ../backups/pocket-id-<day>.zip
docker compose start pocket-id
docker compose exec -T postgres pg_restore -U accountant -d accountant --clean --if-exists < ../backups/accountant-<day>.dump
```

Skip step 3 (Pocket ID is restored with its groups and client), then do step 4 with the **same**
`OIDC_CLIENT_ID`/`OIDC_CLIENT_SECRET` as before. Passkeys keep working only if the Pocket ID domain is
the same.

**Test a restore once** on a spare machine, before you need it.

## 6. Upgrades

Always take a backup first (`/opt/accountant/backup.sh`).

**The app**:
```bash
cd /opt/accountant/app
git pull
bun install --frozen-lockfile
bun run migrate          # forward-only. To go back, restore the backup.
sudo systemctl restart accountant
```

**Pocket ID**: read the [release notes](https://github.com/pocket-id/pocket-id/releases) for every
version between yours and the new one (look for breaking changes). Then:
```bash
cd /opt/accountant/services
# edit compose.yaml: image: ghcr.io/pocket-id/pocket-id:vX.Y.Z
docker compose pull pocket-id && docker compose up -d --wait pocket-id
docker compose exec pocket-id /app/pocket-id version
```
Then sign in to the app once to confirm. If it's broken, put the old tag back, then restore the
Pocket ID backup as above.

**Postgres**: minor versions (18.x) come with `docker compose pull postgres && docker compose up -d postgres`.
A major version (18 → 19) needs a dump and restore. Use the backup and restore commands above with
the new image.
