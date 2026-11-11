insert into parties (company_id, name, kind, registration_type, gstin, pan, state_code, contact_person, phone, email,
  credit_days, credit_limit, opening_balance)
values (:company_id, :name, :kind, :registration_type, :gstin, :pan, :state_code, :contact_person, :phone, :email,
  :credit_days, :credit_limit::nullable(bigint), :opening_balance::bigint)
returning id
