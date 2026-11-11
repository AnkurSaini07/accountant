-- Credit and debit notes (FR-4.6, 5.4) say why: goods came back (return: credits qty and value) or
-- the price changed (rate_difference: credits value only, the goods stay sold). Only notes have one.
alter table documents
  add column note_reason text check (note_reason in ('return', 'rate_difference')),
  add check ((note_reason is not null) = (type in ('credit_note', 'debit_note')));
