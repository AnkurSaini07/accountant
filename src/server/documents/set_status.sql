-- Moves a document from one status to the next. No row when it isn't (any longer) in :from, so two
-- clicks racing can't both move it.
update documents set status = :status
where id = :id and company_id = :company_id and type = :type and status = :from
returning id
