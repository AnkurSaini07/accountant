-- One document with its lines in order.
select d.id, d.type, d.fy, d.number, d.date, d.status, d.party_id, d.party_name, d.party_gstin, d.party_state_code,
  d.billing_address, d.shipping_address, d.place_of_supply, d.reverse_charge, d.party_ref, d.party_ref_date, d.due_date,
  d.challan_type, d.vehicle_no, d.transporter, d.eway_bill_no,
  d.taxable_total::float8 as taxable_total, d.cgst_total::float8 as cgst_total, d.sgst_total::float8 as sgst_total,
  d.igst_total::float8 as igst_total, d.round_off::float8 as round_off, d.grand_total::float8 as grand_total,
  d.notes, d.terms, d.created_by, d.created_at, d.updated_at,
  coalesce((
    select json_agg(json_build_object('id', l.id, 'position', l.position, 'item_id', l.item_id, 'item_name', l.item_name,
      'description', l.description, 'hsn', l.hsn, 'unit', l.unit, 'unit_decimals', l.unit_decimals, 'qty', l.qty,
      'rate', l.rate, 'discount_bp', l.discount_bp, 'gst_rate', l.gst_rate::float8, 'taxable', l.taxable,
      'cgst', l.cgst, 'sgst', l.sgst, 'igst', l.igst) order by l.position)
    from document_lines l where l.document_id = d.id
  ), '[]'::json) as lines
from documents d
where d.id = :id and d.company_id = :company_id
