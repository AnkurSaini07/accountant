insert into gst_rates (rate, effective_from) values (:rate::numeric, :effective_from::date)
returning id, rate::float8 as rate, effective_from::text as effective_from, active
