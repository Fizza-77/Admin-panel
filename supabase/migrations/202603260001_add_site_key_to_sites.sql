-- Add stable tenant identifier for each website.
alter table public.sites
add column if not exists site_key text;

-- Normalize existing values first in case the column already existed.
update public.sites
set site_key = lower(trim(site_key))
where site_key is not null;

-- Backfill missing rows with normalized values from name/domain/id.
with normalized as (
  select
    id,
    trim(
      both '-'
      from lower(
        regexp_replace(
          coalesce(nullif(name, ''), nullif(domain, ''), id::text),
          '[^a-zA-Z0-9]+',
          '-',
          'g'
        )
      )
    ) as base_key
  from public.sites
),
ranked as (
  select
    id,
    base_key,
    row_number() over (partition by base_key order by id) as key_rank
  from normalized
)
update public.sites as s
set site_key = case
  when r.key_rank = 1 then r.base_key
  else r.base_key || '-' || r.key_rank::text
end
from ranked r
where s.id = r.id
  and (s.site_key is null or s.site_key = '');

-- Enforce valid format at the database level.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sites_site_key_format_check'
  ) then
    alter table public.sites
    add constraint sites_site_key_format_check
    check (site_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  end if;
end $$;

-- Ensure site_key is required and unique for tenant-safe lookups.
alter table public.sites
alter column site_key set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sites_site_key_unique'
  ) then
    alter table public.sites
    add constraint sites_site_key_unique unique (site_key);
  end if;
end $$;
