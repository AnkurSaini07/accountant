-- The ID token from sign-in, sent back to Pocket ID as id_token_hint on logout. Pocket ID only
-- redirects back to the app (post_logout_redirect_uri) when it can tell which client is logging out.
alter table sessions add column id_token text;
