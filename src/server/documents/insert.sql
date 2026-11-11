-- A new document header. The snapshot_party trigger fills the party's name, GSTIN, state, billing
-- address and (when null) the place of supply, so :place_of_supply goes through `input`: a null
-- there is filled by the trigger, which reylo can't see. Returns what the totals need.
with input as (select :place_of_supply::nullable(text) as place_of_supply)
insert into documents (company_id, type, fy, number, date, party_id, shipping_address, place_of_supply, reverse_charge,
  party_ref, party_ref_date, due_date, challan_type, vehicle_no, transporter, eway_bill_no, notes, terms, created_by)
select :company_id, :type, :fy, :number, :date::date, :party_id, :shipping_address::nullable(jsonb), input.place_of_supply,
  :reverse_charge, :party_ref::nullable(text), :party_ref_date::nullable(date), :due_date::nullable(date),
  :challan_type::nullable(text), :vehicle_no::nullable(text), :transporter::nullable(text), :eway_bill_no::nullable(text),
  :notes, :terms, :created_by::nullable(integer)
from input
returning id, party_state_code, place_of_supply, (select c.state_code from companies c where c.id = documents.company_id) as company_state
