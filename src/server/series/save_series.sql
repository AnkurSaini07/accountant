-- Sets a series' prefix, padding and next number. The `where` refuses to move the next number
-- back below one already handed out (it would reissue numbers); then nothing is returned.
insert into number_series (company_id, doc_type, fy, prefix, padding, next_number)
values (:company_id, :doc_type, :fy, :prefix, :padding, :next_number)
on conflict (company_id, doc_type, fy) do update
set prefix = excluded.prefix, padding = excluded.padding, next_number = excluded.next_number
where excluded.next_number >= number_series.next_number
returning id
