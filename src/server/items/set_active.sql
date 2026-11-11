-- Deactivate (or reactivate) instead of deleting: documents keep pointing at the item (FR-3.5).
update items set active = :active where id = :id and company_id = :company_id
returning id
