begin;

create index if not exists lister_page_events_created_at_idx
  on public.lister_page_events (created_at);
create index if not exists lister_stats_day_idx
  on public.lister_stats (day);

create or replace function public.prune_lister_page_analytics()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_events_deleted integer;
begin
  delete from public.lister_page_events
  where id in (
    select id
    from public.lister_page_events
    where created_at < now() - interval '90 days'
    order by created_at
    limit 10000
  );
  get diagnostics v_events_deleted = row_count;

  delete from public.lister_stats
  where day < (current_date - interval '13 months')::date;

  return v_events_deleted;
end;
$function$;
revoke all on function public.prune_lister_page_analytics() from public, anon, authenticated;
grant execute on function public.prune_lister_page_analytics() to service_role;

commit;
