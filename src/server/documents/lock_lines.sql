-- Locks source lines before their pending qty is checked, so two conversions of the same line queue
-- up: the second counts the first's links (pending.sql runs after this, with a fresh snapshot).
select l.id from document_lines l where l.id = any(:ids::integer[]) order by l.id for update
