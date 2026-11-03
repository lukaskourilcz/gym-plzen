# Customer profiles from the administrative calendar

Reservations link to `/admin/members/<user_id>` using their existing owner ID.
Pending replacement events use the same owner. A guest reservation without an
account opens its own reservation detail; it is never matched to an account
by name or email. Block applications keep their existing blocking links.
Block-selection mode removes event URLs and prevents navigation. Note buttons
keep their independent tooltip interaction.

The member header opens the existing administrative dialog pattern with name,
email and phone fields. Preferences and roles remain separate. Both the page
and the write action require a real administrator; demo sessions cannot save.
The schema discards roles, verification flags, notes and consent fields.

Email correction uses Supabase Auth Admin `updateUserById` for the same user ID.
It never creates or merges accounts and does not update passwords, Auth phone,
metadata, roles or email-confirmation flags. Application phone numbers remain
normalized to E.164. A changed phone loses its verification flag; an unchanged
phone preserves the current flag. Existing phone exemptions remain valid.

The operation checks duplicate emails and stale contact snapshots before
writing. Per-member locks serialize administrative contact corrections. Auth
errors with uncertain results are reconciled by reading the same account.
The subsequent short database transaction saves the profile and audit row
together. If Auth succeeded but that transaction failed, the interface explains
the partial result and the same submitted values safely finish the operation
on retry. A fully completed save can also be retried without duplicate writes.
It never rolls back an email after another process may have changed it.

Session mirroring rechecks Auth under the same lock when the verified request
snapshot disagrees with the profile. A delayed session or registration callback
cannot restore an old address after an administrator corrected it.

Reservations, order contacts, payments, invoices, credits, existing message
outboxes and access codes are not rewritten. In particular, contact snapshots
on existing reservations keep their old address; the dialog makes that scope
explicit. No confirmation, access code, invite or password-reset delivery is
requested. Supabase's independently configured security notifications remain
governed by the project's Auth settings when an administrator later saves a
real email correction.

No migration or production-data repair is needed. Verification uses only local
Postgres, loopback Auth and replacement providers, including duplicate/stale
submissions, provider rejection, partial database failure, login with the new
address, unauthorized replay and byte comparisons of bookings and codes.
