begin;

select plan(5);

select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'risk_signals'
      and c.relrowsecurity
  ),
  'risk_signals exists with row-level security enabled'
);

select is(
  (
    select count(*)
    from public.platform_settings
    where key in (
      'new_plans_enabled',
      'sale_pack_enabled',
      'agent_plans_enabled',
      'boost_enabled',
      'stk_billing_enabled',
      'currency_toggle_enabled',
      'title_check_enabled',
      'virtual_viewing_enabled',
      'lead_inbox_enabled'
    )
      and value = 'false'::jsonb
  ),
  9::bigint,
  'all Phase 4 dark-launch flags are disabled'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.listing_videos'::regclass
      and t.tgname = 'enforce_listing_video_limit'
      and not t.tgisinternal
  ),
  'listing video writes are guarded by a server-side trigger'
);

select ok(
  position(
    'unverified_listing_limit'
    in pg_get_functiondef('public.enforce_listing_limit()'::regprocedure)
  ) > 0,
  'the active unverified listing limit comes from platform_settings'
);

select ok(
  position(
    'VIDEO_LIMIT_REACHED'
    in pg_get_functiondef('public.enforce_listing_video_limit()'::regprocedure)
  ) > 0
  and position(
    'video_walkthrough_blocked'
    in pg_get_functiondef('public.enforce_listing_video_limit()'::regprocedure)
  ) > 0
  and position(
    'effective_seller_id'
    in pg_get_functiondef('public.enforce_listing_video_limit()'::regprocedure)
  ) > 0,
  'video limits, account blocks, and owner access are enforced server-side'
);

select * from finish();

rollback;
