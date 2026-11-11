-- The number series a company has used or configured in one FY (others are still at their defaults).
select doc_type, prefix, padding, next_number
from number_series
where company_id = :company_id and fy = :fy
order by doc_type
