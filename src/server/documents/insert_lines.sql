-- :rows is a JSON array of lines with their amounts, numbered 1, 2, … in order. The snapshot_item
-- trigger copies each item's name, HSN and unit.
insert into document_lines (document_id, position, item_id, description, qty, rejected_qty, rate, discount_bp, gst_rate, taxable, cgst, sgst, igst)
select :document_id, e.n, (e.v ->> 'item_id')::integer, e.v ->> 'description', (e.v ->> 'qty')::bigint, coalesce((e.v ->> 'rejected_qty')::bigint, 0), (e.v ->> 'rate')::bigint,
  (e.v ->> 'discount_bp')::integer, (e.v ->> 'gst_rate')::numeric, (e.v ->> 'taxable')::bigint, (e.v ->> 'cgst')::bigint,
  (e.v ->> 'sgst')::bigint, (e.v ->> 'igst')::bigint
from jsonb_array_elements(:rows::jsonb) with ordinality as e(v, n)
returning id, position
