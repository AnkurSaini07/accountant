insert into items (company_id, code, name, description, type, hsn, unit_id, gst_rate_id,
  sale_price, purchase_price, opening_qty, opening_value, reorder_level)
values (:company_id, :code, :name, :description, :type, :hsn, :unit_id, :gst_rate_id,
  :sale_price::bigint, :purchase_price::bigint, :opening_qty::bigint, :opening_value::bigint, :reorder_level::nullable(bigint))
returning id
