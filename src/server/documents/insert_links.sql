-- :rows is a JSON array of {from_line_id, to_line_id, qty}: how much of each source line a new line took.
insert into document_links (from_line_id, to_line_id, qty)
select (e.v ->> 'from_line_id')::integer, (e.v ->> 'to_line_id')::integer, (e.v ->> 'qty')::bigint
from jsonb_array_elements(:rows::jsonb) as e(v)
