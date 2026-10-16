begin;

drop trigger if exists enforce_listing_video_limit on public.listing_videos;

do $$
declare
  v_setting record;
  v_definition text;
begin
  if exists (select 1 from public.risk_signals) then
    raise exception 'RISK_SIGNALS_NOT_EMPTY: export or review signal rows before rollback';
  end if;

  select b.definition
    into v_definition
  from migration_rollback.function_definitions b
  where b.migration_id = '20261017160000'
    and b.function_signature = 'public.enforce_listing_limit()';
  if v_definition is not null then
    execute v_definition;
  end if;

  for v_setting in
    select b.setting_key, b.previous_value, b.existed
    from migration_rollback.platform_settings b
    where b.migration_id = '20261017160000'
  loop
    if v_setting.existed then
      update public.platform_settings
      set value = v_setting.previous_value
      where key = v_setting.setting_key;
    else
      delete from public.platform_settings
      where key = v_setting.setting_key;
    end if;
  end loop;
end;
$$;

drop policy if exists risk_signals_admin_read on public.risk_signals;
drop table if exists public.risk_signals;
drop function if exists public.enforce_listing_video_limit();

delete from migration_rollback.function_definitions
where migration_id = '20261017160000';
delete from migration_rollback.platform_settings
where migration_id = '20261017160000';

commit;
