-- Lines of this company's documents with how much is still to convert: qty − what links out to
-- lines of documents that aren't cancelled (drafts count, so two drafts can't take the same qty).
-- A rate-difference note takes no qty (the goods stay sold); `credited` is the taxable value live
-- credit / debit notes already take from the line (a note can't credit more than was invoiced).
-- Pass the source documents (:document_ids) or the lines (:line_ids); the other as an empty array.
select l.id, l.document_id, d.type, d.status, d.number, d.date, d.party_id, d.party_name, d.party_gstin, d.party_state_code,
  d.billing_address ->> 'city' as party_city, d.shipping_address, d.place_of_supply, l.position, l.item_id, i.code as item_code, l.item_name, l.hsn, l.description,
  l.unit, l.unit_decimals, l.qty::float8 as qty, l.rate::float8 as rate, l.discount_bp, l.gst_rate::float8 as gst_rate, l.taxable::float8 as taxable,
  coalesce(l.qty - coalesce((
    select sum(k.qty) from document_links k
    join document_lines t on t.id = k.to_line_id
    join documents td on td.id = t.document_id
    where k.from_line_id = l.id and td.status <> 'cancelled' and td.note_reason is distinct from 'rate_difference'
  ), 0), 0)::float8 as pending,
  coalesce((
    select sum(t.taxable) from document_links k
    join document_lines t on t.id = k.to_line_id
    join documents td on td.id = t.document_id
    where k.from_line_id = l.id and td.status <> 'cancelled' and td.type in ('credit_note', 'debit_note')
  ), 0)::float8 as credited
from document_lines l
join documents d on d.id = l.document_id
join items i on i.id = l.item_id
where d.company_id = :company_id and (l.document_id = any(:document_ids::integer[]) or l.id = any(:line_ids::integer[]))
order by d.date, d.id, l.position
