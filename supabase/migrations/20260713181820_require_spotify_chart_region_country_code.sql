-- PostgreSQL CHECK constraints accept UNKNOWN, so a regex alone does not
-- reject a null country_code. Require it explicitly for country and city rows.

alter table public.spotify_chart_regions
  drop constraint if exists spotify_chart_regions_shape_check;

alter table public.spotify_chart_regions
  add constraint spotify_chart_regions_shape_check
  check (
    (
      type = 'global'
      and country_code is null
      and city_name is null
      and parent_region_key is null
    )
    or
    (
      type = 'country'
      and country_code is not null
      and country_code ~ '^[A-Z]{2}$'
      and city_name is null
      and parent_region_key is null
    )
    or
    (
      type = 'city'
      and country_code is not null
      and country_code ~ '^[A-Z]{2}$'
      and nullif(btrim(city_name), '') is not null
      and parent_region_key is not null
    )
  );
