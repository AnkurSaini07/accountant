-- Credit / debit notes (not cancelled) made against this document: while one stands, the document
-- can't be cancelled (the note would credit a cancelled invoice).
select distinct coalesce(td.number, 'a draft') as number, td.type
from document_lines l
join document_links k on k.from_line_id = l.id
join document_lines t on t.id = k.to_line_id
join documents td on td.id = t.document_id
where l.document_id = :id and td.status <> 'cancelled' and td.type in ('credit_note', 'debit_note')
order by 1
