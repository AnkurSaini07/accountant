-- Connectivity check: which database we're on and its Postgres version.
select current_database() as database, no_such_column, current_setting('server_version') as version
