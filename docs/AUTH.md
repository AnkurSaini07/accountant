# Sign-in and roles

The app stores no passwords. People sign in with a **passkey** through
[Pocket ID](https://pocket-id.org), a small self-hosted sign-in server. Pocket ID also decides each
person's **role**, via its groups. To install it in production, see [OPERATIONS.md](OPERATIONS.md).

## How sign-in works

1. Someone opens the app without a session. The app shows **Sign in with Pocket ID**.
2. Pocket ID asks for their passkey: fingerprint, face or PIN on their phone or laptop.
3. Pocket ID sends them back to the app. The app checks the reply, reads their groups and creates
   its own session for 7 days. The browser never sees Pocket ID's tokens.
4. **Sign out** ends both the app session and the Pocket ID session.

Roles are re-read from Pocket ID **at every sign-in**. A group change applies the next time the person
signs in. To cut someone off **now**, disable them in Pocket ID *and* deactivate them in the app
([Someone leaves](#someone-leaves)). Deactivated users are signed out on their next click.

## Roles = Pocket ID groups

From [REQUIREMENTS.md §2](REQUIREMENTS.md#2-users--roles):

| Pocket ID group (name) | Role in the app | Can do |
|---|---|---|
| `accountant-admin` | admin | Everything, including company settings, cancelling finalized documents and payroll |
| `accountant-accountant` | accountant | All documents, vouchers, reports and payroll; not company settings |
| `accountant-operator` | operator | Create challans and GRNs, view stock; no accounting, reports or payroll |
| `accountant-viewer` | viewer | View documents and reports; never payroll |

- The **group name** must match exactly. The friendly name can be anything.
- In more than one group, a person gets the most powerful role (admin > accountant > operator > viewer).
- In **no** `accountant-*` group, they can sign in to Pocket ID but the app shows **"No access yet"**.

## Everyday admin tasks (Pocket ID admin UI)

All of these are done in Pocket ID (`https://<pocket-id domain>`, signed in as a Pocket ID admin), not in the app.

### Add a staff member
1. **Users → Add user**: username, name, email (the email can be a placeholder if they have none).
2. Open the user → **User groups** → add one `accountant-*` group.
3. Give them a **one-time login code** (next section) so they can register their passkey.

### Staff without a passkey yet: one-time login codes
Someone with a new phone, a lost phone or a first login can't use a passkey yet. Give them a
one-time code:

- **In the UI**: open the user → **Login code**. Share the link or the code. It works once and expires.
- **From the server's command line**:
  ```bash
  docker compose exec pocket-id /app/pocket-id one-time-access-token <username or email>
  ```
  This prints a link. Send it privately (in person or on WhatsApp to that person only). Anyone holding it can sign in as them.

After signing in with the code, they open **My account → Passkeys → Add passkey** in Pocket ID, then
sign in to the app normally. Shared factory PCs: have each person use their **phone's** passkey ("use a
phone or tablet" on the passkey prompt), so nobody's passkey lives on the shared PC.

### Change someone's role
Move them to a different `accountant-*` group. It takes effect at their next sign-in. Have them sign out
and back in if it should apply now.

### Someone leaves
1. Pocket ID: **Users →** the person **→ Disable** (or delete). They can't sign in again.
2. The app: deactivate them, which ends any open session at once. Until the app has a Users screen, run
   this on the server:
   ```bash
   docker compose exec postgres psql -U accountant -c "update users set active = false where email = 'name@example.in'"
   ```

## App configuration

| Variable | Example | What |
|---|---|---|
| `APP_URL` | `https://books.example.in` | Where people open the app. The sign-in return address is `APP_URL/api/auth/callback`. |
| `OIDC_ISSUER` | `https://id.example.in` | Pocket ID's address (https in production) |
| `OIDC_CLIENT_ID` | from Pocket ID | The OIDC client created for the app |
| `OIDC_CLIENT_SECRET` | from Pocket ID | Its secret: treat like a password |
| `COOKIE_SECRET` | `openssl rand -base64 32` | Signs the short-lived sign-in cookie (at least 32 characters) |

For local development, see the README: OrbStack gives Pocket ID its HTTPS address there.
