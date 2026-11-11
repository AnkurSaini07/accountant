-- Converting a sent quotation (to an order or invoice) means the customer accepted it (FR-4.1).
-- Only quotations are ever 'sent', so the status alone picks them.
update documents q set status = 'accepted'
where q.status = 'sent' and q.id in (
  select s.document_id from document_lines s where s.id = any(:line_ids::integer[])
)
