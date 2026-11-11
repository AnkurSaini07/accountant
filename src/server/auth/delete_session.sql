delete from sessions where token_hash = :token_hash
returning id_token
