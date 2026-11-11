-- Lines of this company's documents with how much is still to convert: qty − what links out to
-- lines of documents that aren't cancelled (drafts count, so two drafts can't take the same qty).
-- Pass the source documents (:document_ids) or the lines (:line_ids); the other as an empty array.
select l.id, l.document_id, d.type, d.status, d.number, d.party_id, d.party_name, d.party_gstin, d.party_state_code,
  d.billing_address ->> 'city' as party_city, l.position, l.item_id, i.code as item_code, l.item_name, l.hsn, l.description,
  l.unit, l.unit_decimals, l.qty::float8 as qty, l.rate::float8 as rate, l.discount_bp, l.gst_rate::float8 as gst_rate,
  coalesce(l.qty - coalesce((
    select sum(k.qty) from document_links k
    join document_lines t on t.id = k.to_line_id
    join documents td on td.id = t.document_id
    where k.from_line_id = l.id and td.status <> 'cancelled'
  ), 0), 0)::float8 as pending
from document_lines l
join documents d on d.id = l.document_id
join items i on i.id = l.item_id
where d.company_id = :company_id and (l.document_id = any(:document_ids::integer[]) or l.id = any(:line_ids::integer[]))
order by d.date, d.id, l.position
