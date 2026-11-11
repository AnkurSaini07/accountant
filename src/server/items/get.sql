-- One item, with its unit and GST rate (so forms and documents needn't look them up).
select i.id, i.code, i.name, i.description, i.type, i.hsn,
  i.unit_id, u.code as unit, u.decimals as unit_decimals,
  i.gst_rate_id, g.rate::float8 as gst_rate,
  i.sale_price::float8 as sale_price, i.purchase_price::float8 as purchase_price,
  i.opening_qty::float8 as opening_qty, i.opening_value::float8 as opening_value,
  i.reorder_level::float8 as reorder_level, i.active, i.updated_at
from items i
join units u on u.id = i.unit_id
join gst_rates g on g.id = i.gst_rate_id
where i.id = :id and i.company_id = :company_id
