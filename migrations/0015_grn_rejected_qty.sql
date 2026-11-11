-- GRNs (FR-5.2): a line's qty is what we accepted (it goes to stock and off the PO); rejected_qty
-- is what came in but went back. Received = qty + rejected_qty. Only GRN lines carry it (the
-- document schema checks the type); 0 everywhere else.
alter table document_lines
  add column rejected_qty bigint not null default 0 check (rejected_qty between 0 and 9007199254740991);
