-- The dashboard for one FY, in one row: net sales (finalized invoices less finalized credit notes,
-- before GST) by month, output GST, the work waiting on someone, top customers and recent documents.
-- Amounts are paise. Months run April → March.
with input as (
  select :company_id::integer as company_id, :fy::integer as fy
),
docs as (
  select d.* from input i join documents d on d.company_id = i.company_id and d.fy = i.fy
),
sales as ( -- invoices count up, credit notes down
  select d.date, d.party_id, d.party_name,
    case when d.type = 'credit_note' then -1 else 1 end * d.taxable_total as taxable,
    case when d.type = 'credit_note' then -1 else 1 end * (d.cgst_total + d.sgst_total + d.igst_total) as gst
  from docs d where d.type in ('invoice', 'credit_note') and d.status = 'finalized'
),
months as (
  select m::date as month from input i, generate_series(make_date(i.fy, 4, 1), make_date(i.fy + 1, 3, 1), interval '1 month') m
),
open_orders as ( -- confirmed orders with qty still to deliver / receive (as list.sql)
  select d.type, count(*)::int as n from docs d
  where d.type in ('sales_order', 'purchase_order') and d.status = 'finalized'
    and exists (
      select 1 from document_lines l where l.document_id = d.id and l.qty > coalesce((
        select sum(k.qty) from document_links k
        join document_lines t on t.id = k.to_line_id
        join documents td on td.id = t.document_id
        where k.from_line_id = l.id and td.status <> 'cancelled' and td.note_reason is distinct from 'rate_difference'
      ), 0))
  group by d.type
)
select
  coalesce((select sum(taxable) from sales), 0)::float8 as net_sales,
  coalesce((select sum(gst) from sales), 0)::float8 as output_gst,
  (select count(*) from docs where type = 'invoice' and status = 'finalized')::int as invoice_count,
  (select json_agg(json_build_object(
      'month', to_char(m.month, 'YYYY-MM'),
      'net_sales', coalesce((select sum(s.taxable) from sales s where date_trunc('month', s.date) = m.month), 0)::float8
    ) order by m.month) from months m) as monthly,
  (select count(*) from docs where type = 'invoice' and status = 'draft')::int as draft_invoices,
  (select count(*) from docs where type = 'quotation' and status = 'sent')::int as quotes_awaiting,
  coalesce((select sum(grand_total) from docs where type = 'quotation' and status = 'sent'), 0)::float8 as quotes_awaiting_value,
  coalesce((select n from open_orders where type = 'sales_order'), 0)::int as orders_to_deliver,
  coalesce((select n from open_orders where type = 'purchase_order'), 0)::int as pos_to_receive,
  coalesce((select json_agg(c order by c.net_sales desc) from (
    select party_id, min(party_name) as party_name, sum(taxable)::float8 as net_sales
    from sales group by party_id having sum(taxable) > 0 order by sum(taxable) desc limit 5
  ) c), '[]'::json) as top_customers,
  coalesce((select json_agg(r order by r.date desc, r.id desc) from (
    select id, type, number, date, status, party_name, grand_total::float8 as grand_total
    from docs order by date desc, id desc limit 8
  ) r), '[]'::json) as recent
