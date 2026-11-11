update companies
set legal_name = :legal_name, trade_name = :trade_name, address = :address, city = :city, pincode = :pincode,
  state_code = :state_code, gstin = :gstin, pan = :pan, phone = :phone, email = :email,
  bank_name = :bank_name, bank_account = :bank_account, bank_ifsc = :bank_ifsc, bank_branch = :bank_branch,
  logo = :logo, signature = :signature, terms = :terms
where id = :id
returning id, legal_name, trade_name, address, city, pincode, state_code, gstin, pan, phone, email,
  bank_name, bank_account, bank_ifsc, bank_branch, logo, signature, terms, updated_at
