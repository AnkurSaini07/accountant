update documents
set taxable_total = :taxable_total::bigint, cgst_total = :cgst_total::bigint, sgst_total = :sgst_total::bigint,
  igst_total = :igst_total::bigint, round_off = :round_off::bigint, grand_total = :grand_total::bigint
where id = :id
