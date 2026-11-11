-- v1 has one company (FR-1.2); the first row is it.
select id, legal_name, trade_name, address, city, pincode, state_code, gstin, pan, phone, email,
  bank_name, bank_account, bank_ifsc, bank_branch, logo, signature, terms, updated_at
from companies
order by id
limit 1
