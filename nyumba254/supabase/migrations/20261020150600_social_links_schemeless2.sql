-- Accept scheme-less pasted links such as "instagram.com/name" or "linkedin.com/company/x".
-- Rollback: re-run the nk_parse_social_link definition from 20261020150000_lister_social_links.sql.
do $patch$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.nk_parse_social_link(text,text)'::regprocedure);
  if position('schemeless' in v_def) = 0 then
    v_def := replace(v_def,
      'a bare handle or a pasted URL.',
      E'a bare handle or a pasted URL.\n  if v ~* ''^(www\\.)?[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}/'' then v := ''https://'' || v; end if; -- schemeless');
    execute v_def;
  end if;
end;
$patch$;
