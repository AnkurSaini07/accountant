-- :rows is a JSON array of bank accounts, inserted in order (so ids keep the saved order).
insert into company_bank_accounts (company_id, bank_name, account_name, account_number, ifsc, branch, is_default)
select :company_id, e.v ->> 'bank_name', e.v ->> 'account_name', e.v ->> 'account_number', e.v ->> 'ifsc',
  e.v ->> 'branch', (e.v ->> 'is_default')::boolean
from jsonb_array_elements(:rows::jsonb) with ordinality as e(v, n)
order by e.n
