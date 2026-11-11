-- :rows is a JSON array of addresses, inserted in order.
insert into party_addresses (party_id, kind, label, address, city, pincode, state_code)
select :party_id, e.v ->> 'kind', e.v ->> 'label', e.v ->> 'address', e.v ->> 'city', e.v ->> 'pincode', e.v ->> 'state_code'
from jsonb_array_elements(:rows::jsonb) with ordinality as e(v, n)
order by e.n
