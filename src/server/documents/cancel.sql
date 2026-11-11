-- Cancels a document that's in one of :from (e.g. draft or finalized), recording who and why. No row
-- when it isn't (any longer), so two cancels racing can't both happen.
update documents set status = 'cancelled', cancel_reason = :reason, cancelled_by = :user_id, cancelled_at = now()
where id = :id and company_id = :company_id and type = :type and status = any(:from::text[])
returning id
