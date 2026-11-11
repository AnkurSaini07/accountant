-- Replaces a draft's header (type, FY and number stay). The trigger re-copies the party; a null
-- place of supply is worked out again (through `input`, as in insert.sql). The service has locked it
-- and checked it's a draft (lock.sql).
with input as (select :place_of_supply::nullable(text) as place_of_supply)
update documents
set date = :date::date, party_id = :party_id, shipping_address = :shipping_address::nullable(jsonb),
  place_of_supply = input.place_of_supply, reverse_charge = :reverse_charge, party_ref = :party_ref::nullable(text),
  party_ref_date = :party_ref_date::nullable(date), due_date = :due_date::nullable(date), challan_type = :challan_type::nullable(text),
  vehicle_no = :vehicle_no::nullable(text), transporter = :transporter::nullable(text), eway_bill_no = :eway_bill_no::nullable(text),
  notes = :notes, terms = :terms
from input
where id = :id and company_id = :company_id
returning documents.id, documents.party_state_code, documents.place_of_supply, (select c.state_code from companies c where c.id = documents.company_id) as company_state
