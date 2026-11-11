-- The signed-in user for a session, if the session is unexpired and the user still active.
select u.id, u.email, u.name, u.role, s.expires_at
from sessions s
join users u on u.id = s.user_id
where s.token_hash = :token_hash and s.expires_at > now() and u.active
