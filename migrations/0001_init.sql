-- Shared helpers for every later table.

-- Keeps an `updated_at timestamptz` column current. Use on a table with:
--   create trigger set_updated_at before update on <table>
--   for each row execute function set_updated_at();
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
