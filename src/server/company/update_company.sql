update companies
set legal_name = :legal_name, trade_name = :trade_name, state_code = :state_code, gstin = :gstin, pan = :pan,
  phone = :phone, email = :email, logo = :logo, signature = :signature, terms = :terms
where id = :id
