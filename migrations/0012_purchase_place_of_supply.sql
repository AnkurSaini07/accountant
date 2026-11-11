-- Fix (#39): on purchase documents the goods come to us, so the place of supply defaults to the
-- company's own state, not the supplier's. 0011 defaulted every type to the ship-to/party state,
-- which would charge CGST+SGST on an out-of-state purchase that should carry IGST.
-- Same function as 0011 apart from the place-of-supply line.
create or replace function snapshot_party() returns trigger language plpgsql as $$
declare p parties;
begin
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    return new;
  end if;
  select * into p from parties where id = new.party_id and company_id = new.company_id;
  if not found then
    raise exception 'party % is not one of this company''s parties', new.party_id
      using errcode = 'foreign_key_violation', constraint = 'documents_party_id_fkey';
  end if;
  new.party_name := p.name;
  new.party_gstin := p.gstin;
  new.party_state_code := p.state_code;
  new.billing_address := (
    select jsonb_build_object('label', a.label, 'address', a.address, 'city', a.city, 'pincode', a.pincode, 'state_code', a.state_code)
    from party_addresses a where a.party_id = p.id and a.kind = 'billing'
  );
  new.place_of_supply := coalesce(new.place_of_supply, case
    when new.type in ('purchase_order', 'grn', 'purchase_bill', 'debit_note') then (select state_code from companies where id = new.company_id)
    else coalesce(new.shipping_address ->> 'state_code', p.state_code)
  end);
  return new;
end $$;
