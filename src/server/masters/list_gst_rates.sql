-- rate as float8: a percent with at most 2 decimals, for display and percentOf().
select id, rate::float8 as rate, effective_from::text as effective_from, active
from gst_rates
order by rate, effective_from
