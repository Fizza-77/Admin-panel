-- Tag accent colors: red, orange, purple, pink (distinct from Kanban status headers).
alter table public.tags
  add column if not exists color text not null default 'red';

alter table public.tags
  drop constraint if exists tags_color_allowed;

alter table public.tags
  add constraint tags_color_allowed check (
    color in ('red', 'orange', 'purple', 'pink')
  );

comment on column public.tags.color is 'One of 4 accent keys; used for task card fill when tag is applied';
