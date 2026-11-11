update items
set code = :code, name = :name, description = :description, type = :type, hsn = :hsn, unit_id = :unit_id,
  gst_rate_id = :gst_rate_id, sale_price = :sale_price::bigint, purchase_price = :purchase_price::bigint,
  opening_qty = :opening_qty::bigint, opening_value = :opening_value::bigint, reorder_level = :reorder_level::nullable(bigint)
where id = :id and company_id = :company_id
returning id
