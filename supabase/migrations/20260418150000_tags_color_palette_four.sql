-- If a prior 7-color migration ran, remap legacy keys and enforce the 4-color palette.
alter table public.tags drop constraint if exists tags_color_allowed;

update public.tags
set color = case color
  when 'rose' then 'pink'
  when 'orange' then 'orange'
  when 'violet' then 'purple'
  when 'fuchsia' then 'pink'
  when 'cyan' then 'purple'
  when 'indigo' then 'purple'
  when 'red' then 'red'
  when 'purple' then 'purple'
  when 'pink' then 'pink'
  else 'red'
end;

alter table public.tags
  add constraint tags_color_allowed check (
    color in ('red', 'orange', 'purple', 'pink')
  );

alter table public.tags alter column color set default 'red';
