-- Takes the next number of a series, creating the series (starting at 1) on first use. One
-- statement, so concurrent callers queue on the row lock; inside the caller's transaction, so a
-- rolled-back document gives its number back (no gaps).
insert into number_series (company_id, doc_type, fy, prefix, next_number)
values (:company_id, :doc_type, :fy, :default_prefix, 2)
on conflict (company_id, doc_type, fy) do update set next_number = number_series.next_number + 1
returning prefix, padding, next_number - 1 as number
