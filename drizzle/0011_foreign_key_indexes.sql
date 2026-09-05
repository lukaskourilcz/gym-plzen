-- Cover foreign keys used by joins and parent-row updates/deletes. These are
-- intentionally single-column indexes because every referenced constraint is
-- single-column and no existing index has the foreign key as its leading key.

create index if not exists blocked_slot_created_by_admin_idx
  on public.blocked_slot (created_by_admin_id);

create index if not exists content_block_media_idx
  on public.content_block (media_id);

create index if not exists content_block_updated_by_admin_idx
  on public.content_block (updated_by_admin_id);

create index if not exists entry_log_access_code_idx
  on public.entry_log (access_code_id);

create index if not exists entry_log_user_idx
  on public.entry_log (user_id);

create index if not exists marketing_campaign_created_by_admin_idx
  on public.marketing_campaign (created_by_admin_id);

create index if not exists media_asset_uploaded_by_admin_idx
  on public.media_asset (uploaded_by_admin_id);

create index if not exists membership_plan_idx
  on public.membership (plan_id);

create index if not exists message_delivery_user_idx
  on public.message_delivery (user_id);

create index if not exists page_updated_by_admin_idx
  on public.page (updated_by_admin_id);

create index if not exists payment_membership_idx
  on public.payment (membership_id);

create index if not exists reservation_created_by_admin_idx
  on public.reservation (created_by_admin_id);

create index if not exists reservation_reschedule_user_idx
  on public.reservation_reschedule (user_id);

create index if not exists site_setting_updated_by_admin_idx
  on public.site_setting (updated_by_admin_id);

create index if not exists voucher_created_by_admin_idx
  on public.voucher (created_by_admin_id);
