-- A document about to be saved, locked so two saves of the same draft queue rather than interleave.
select type, fy, status from documents where id = :id and company_id = :company_id for update
