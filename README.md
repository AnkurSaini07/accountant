# accountant

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

To type check:

```bash
bun check
```

Run `bun lint` to find problems in the code and `bun fmt` to format it.

This project was created using `bun init` in bun v1.4.4. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Docs

- [Requirements](docs/REQUIREMENTS.md)
- Task board: GitHub Project "Accountant" (issues in this repo)

## Dev services (Postgres + Pocket ID)

Needs [OrbStack](https://orbstack.dev), which gives each container an HTTPS `*.orb.local` domain.

```bash
cp .env.example .env                       # then set POCKET_ID_ENCRYPTION_KEY=$(openssl rand -base64 32)
bun run services:up    # Pocket ID: https://pocket-id.accountant.orb.local  Postgres: postgres.accountant.orb.local:5432
```

Run Bun with `--use-system-ca` whenever it calls Pocket ID, so it trusts OrbStack's local HTTPS certificate (a `NODE_USE_SYSTEM_CA` entry in `.env` is read too late).

First run of Pocket ID: open https://pocket-id.accountant.orb.local/setup and register the admin passkey. Then in the Pocket ID admin:
1. Create the groups `accountant-admin`, `accountant-accountant`, `accountant-operator`, `accountant-viewer`, and add yourself to `accountant-admin`.
2. Create an OIDC client "Accountant" with callback URL `http://localhost:3000/api/auth/callback`, and allow the `accountant-*` groups.
3. Put the client ID and secret into `.env` (`OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`).
