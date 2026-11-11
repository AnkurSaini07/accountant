-- Deactivate (or reactivate) instead of deleting: vouchers keep pointing at the ledger (FR-3.5).
update ledgers set active = :active where id = :id and company_id = :company_id
returning id
