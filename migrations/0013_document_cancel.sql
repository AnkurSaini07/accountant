-- Cancelling an issued document (FR-4.5): who, when and why. The number stays used (it's on the row).
alter table documents
  add column cancel_reason text check (char_length(cancel_reason) between 1 and 500),
  add column cancelled_by integer references users (id),
  add column cancelled_at timestamptz,
  add check ((status = 'cancelled') or (cancel_reason is null and cancelled_by is null and cancelled_at is null));
