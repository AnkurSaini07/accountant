-- :rows is a JSON array of addresses, inserted in order (so ids keep the saved order).
insert into company_addresses (company_id, label, address, city, pincode, is_primary)
select :company_id, e.v ->> 'label', e.v ->> 'address', e.v ->> 'city', e.v ->> 'pincode', (e.v ->> 'is_primary')::boolean
from jsonb_array_elements(:rows::jsonb) with ordinality as e(v, n)
order by e.n
