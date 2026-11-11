-- The items a document's lines name, if they're this company's: their HSN and unit decimals feed the
-- totals. Missing ids are lines to reject.
select i.id, i.hsn, u.decimals as unit_decimals
from items i
join units u on u.id = i.unit_id
where i.company_id = :company_id and i.id = any(:ids::integer[])
