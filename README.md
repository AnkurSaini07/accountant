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

## Local auth server (Pocket ID)

```bash
bun run auth:dev   # downloads a pinned Pocket ID binary into .pocket-id/ (checksum-verified) and serves http://localhost:1411
```

First run: open http://localhost:1411/setup and register the admin passkey. Then in the Pocket ID admin:
1. Create the groups `accountant-admin`, `accountant-accountant`, `accountant-operator`, `accountant-viewer`, and add yourself to `accountant-admin`.
2. Create an OIDC client "Accountant" with callback URL `http://localhost:3000/api/auth/callback`, and allow the `accountant-*` groups.
3. Put the client ID and secret into `.env` (`OIDC_ISSUER=http://localhost:1411`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`).
