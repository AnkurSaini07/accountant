update parties
set name = :name, kind = :kind, registration_type = :registration_type, gstin = :gstin, pan = :pan,
  state_code = :state_code, contact_person = :contact_person, phone = :phone, email = :email,
  credit_days = :credit_days, credit_limit = :credit_limit::nullable(bigint), opening_balance = :opening_balance::bigint
where id = :id and company_id = :company_id
returning id
