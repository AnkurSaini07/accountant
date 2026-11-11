-- On every login: create the user, or refresh name/email/role from Pocket ID.
insert into users (oidc_sub, email, name, role, last_login_at)
values (:sub, :email, :name, :role, now())
on conflict (oidc_sub) do update
set email = excluded.email, name = excluded.name, role = excluded.role, last_login_at = now()
returning id, oidc_sub, email, name, role, active
