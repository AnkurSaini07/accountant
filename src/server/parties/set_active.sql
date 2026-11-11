-- Deactivate (or reactivate) instead of deleting: documents keep pointing at the party (FR-3.5).
update parties set active = :active where id = :id and company_id = :company_id
returning id
