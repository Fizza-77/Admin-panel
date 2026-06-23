-- Blog writes via SECURITY DEFINER (bypasses RLS — same pattern as app_profiles).
-- Run this entire file in Supabase SQL Editor if blog save returns 503.

CREATE OR REPLACE FUNCTION public.svc_update_blog(
  p_blog_id uuid,
  p_site_id uuid,
  p_row jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_row_site_id uuid;
  v_category_text text;
  v_category_uuid uuid;
BEGIN
  SELECT id, site_id INTO v_id, v_row_site_id
  FROM public.blogs
  WHERE id = p_blog_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'BLOG_UPDATE_NO_MATCH'
      USING ERRCODE = 'P0002',
            HINT = 'No blog row with this id';
  END IF;

  IF v_row_site_id IS DISTINCT FROM p_site_id THEN
    RAISE EXCEPTION 'BLOG_SITE_MISMATCH'
      USING ERRCODE = 'P0002',
            HINT = 'Blog belongs to a different site than the URL';
  END IF;

  v_category_text := nullif(trim(p_row->>'category_id'), '');
  v_category_uuid := NULL;
  IF v_category_text IS NOT NULL THEN
    BEGIN
      v_category_uuid := v_category_text::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Invalid category_id: %', v_category_text
          USING ERRCODE = '22023';
    END;
  END IF;

  BEGIN
    UPDATE public.blogs
    SET
      title = coalesce(p_row->>'title', title),
      slug = coalesce(p_row->>'slug', slug),
      status = coalesce(p_row->>'status', status),
      meta_title = coalesce(p_row->>'meta_title', meta_title),
      description = coalesce(p_row->>'description', description),
      meta_description = coalesce(p_row->>'meta_description', meta_description),
      date_published = coalesce((p_row->>'date_published')::timestamptz, date_published),
      cover_image_url = coalesce(p_row->>'cover_image_url', cover_image_url),
      content = coalesce(p_row->>'content', content),
      author_name = CASE WHEN p_row ? 'author_name' THEN nullif(p_row->>'author_name', '') ELSE author_name END,
      keywords = CASE WHEN p_row ? 'keywords' THEN nullif(p_row->>'keywords', '') ELSE keywords END,
      article_section = CASE WHEN p_row ? 'article_section' THEN nullif(p_row->>'article_section', '') ELSE article_section END,
      in_language = CASE WHEN p_row ? 'in_language' THEN nullif(p_row->>'in_language', '') ELSE in_language END,
      publisher_name = CASE WHEN p_row ? 'publisher_name' THEN nullif(p_row->>'publisher_name', '') ELSE publisher_name END,
      publisher_logo_url = CASE WHEN p_row ? 'publisher_logo_url' THEN nullif(p_row->>'publisher_logo_url', '') ELSE publisher_logo_url END,
      canonical_url = CASE WHEN p_row ? 'canonical_url' THEN nullif(p_row->>'canonical_url', '') ELSE canonical_url END,
      category_id = CASE
        WHEN p_row ? 'category_id' AND v_category_uuid IS NOT NULL THEN v_category_uuid
        WHEN p_row ? 'category_id' THEN NULL
        ELSE category_id
      END,
      updated_at = coalesce((p_row->>'updated_at')::timestamptz, now())
    WHERE id = p_blog_id;
  EXCEPTION
    WHEN undefined_column THEN
      UPDATE public.blogs
      SET
        title = coalesce(p_row->>'title', title),
        slug = coalesce(p_row->>'slug', slug),
        status = coalesce(p_row->>'status', status),
        meta_title = coalesce(p_row->>'meta_title', meta_title),
        description = coalesce(p_row->>'description', description),
        meta_description = coalesce(p_row->>'meta_description', meta_description),
        date_published = coalesce((p_row->>'date_published')::timestamptz, date_published),
        cover_image_url = coalesce(p_row->>'cover_image_url', cover_image_url),
        content = coalesce(p_row->>'content', content),
        category_id = CASE
          WHEN p_row ? 'category_id' AND v_category_uuid IS NOT NULL THEN v_category_uuid
          WHEN p_row ? 'category_id' THEN NULL
          ELSE category_id
        END
      WHERE id = p_blog_id;
  END;

  BEGIN
    UPDATE public.blogs
    SET
      date_modified = coalesce((p_row->>'date_modified')::timestamptz, date_modified, now()),
      main_entity_of_page = CASE
        WHEN p_row ? 'main_entity_of_page' THEN nullif(p_row->>'main_entity_of_page', '')
        ELSE main_entity_of_page
      END
    WHERE id = p_blog_id;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

  BEGIN
    IF p_row ? 'faq_schema' THEN
      UPDATE public.blogs
      SET faq_schema = CASE
        WHEN p_row->'faq_schema' IS NULL OR p_row->'faq_schema' = 'null'::jsonb THEN NULL
        ELSE p_row->'faq_schema'
      END
      WHERE id = p_blog_id;
    END IF;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

  RETURN p_blog_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.svc_insert_blog(
  p_row jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_category_text text;
  v_category_uuid uuid;
BEGIN
  v_category_text := nullif(trim(p_row->>'category_id'), '');
  v_category_uuid := NULL;
  IF v_category_text IS NOT NULL THEN
    BEGIN
      v_category_uuid := v_category_text::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Invalid category_id: %', v_category_text
          USING ERRCODE = '22023';
    END;
  END IF;

  BEGIN
    INSERT INTO public.blogs (
      site_id,
      title,
      slug,
      status,
      meta_title,
      description,
      meta_description,
      date_published,
      cover_image_url,
      content,
      author_name,
      keywords,
      article_section,
      in_language,
      publisher_name,
      publisher_logo_url,
      canonical_url,
      category_id,
      updated_at
    )
    VALUES (
      (p_row->>'site_id')::uuid,
      p_row->>'title',
      p_row->>'slug',
      coalesce(p_row->>'status', 'published'),
      coalesce(p_row->>'meta_title', ''),
      coalesce(p_row->>'description', ''),
      coalesce(p_row->>'meta_description', ''),
      (p_row->>'date_published')::timestamptz,
      coalesce(p_row->>'cover_image_url', ''),
      coalesce(p_row->>'content', ''),
      nullif(p_row->>'author_name', ''),
      nullif(p_row->>'keywords', ''),
      nullif(p_row->>'article_section', ''),
      nullif(p_row->>'in_language', ''),
      nullif(p_row->>'publisher_name', ''),
      nullif(p_row->>'publisher_logo_url', ''),
      nullif(p_row->>'canonical_url', ''),
      v_category_uuid,
      coalesce((p_row->>'updated_at')::timestamptz, now())
    )
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN undefined_column THEN
      INSERT INTO public.blogs (
        site_id,
        title,
        slug,
        status,
        meta_title,
        description,
        meta_description,
        date_published,
        cover_image_url,
        content,
        category_id
      )
      VALUES (
        (p_row->>'site_id')::uuid,
        p_row->>'title',
        p_row->>'slug',
        coalesce(p_row->>'status', 'published'),
        coalesce(p_row->>'meta_title', ''),
        coalesce(p_row->>'description', ''),
        coalesce(p_row->>'meta_description', ''),
        (p_row->>'date_published')::timestamptz,
        coalesce(p_row->>'cover_image_url', ''),
        coalesce(p_row->>'content', ''),
        v_category_uuid
      )
      RETURNING id INTO v_id;
  END;

  BEGIN
    UPDATE public.blogs
    SET
      date_modified = coalesce((p_row->>'date_modified')::timestamptz, now()),
      main_entity_of_page = nullif(p_row->>'main_entity_of_page', '')
    WHERE id = v_id;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

  BEGIN
    IF p_row ? 'faq_schema' AND p_row->'faq_schema' IS NOT NULL AND p_row->'faq_schema' <> 'null'::jsonb THEN
      UPDATE public.blogs
      SET faq_schema = p_row->'faq_schema'
      WHERE id = v_id;
    END IF;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.svc_delete_blog(
  p_blog_id uuid,
  p_site_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_row_site_id uuid;
BEGIN
  SELECT id, site_id INTO v_id, v_row_site_id
  FROM public.blogs
  WHERE id = p_blog_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'BLOG_DELETE_NO_MATCH'
      USING ERRCODE = 'P0002',
            HINT = 'No blog row with this id';
  END IF;

  IF v_row_site_id IS DISTINCT FROM p_site_id THEN
    RAISE EXCEPTION 'BLOG_SITE_MISMATCH'
      USING ERRCODE = 'P0002',
            HINT = 'Blog belongs to a different site than the URL';
  END IF;

  DELETE FROM public.blogs WHERE id = p_blog_id;
  RETURN p_blog_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.svc_probe_blog_write()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sample record;
  v_id uuid;
BEGIN
  SELECT id, site_id INTO v_sample
  FROM public.blogs
  ORDER BY id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'blog_id', null, 'message', 'no blogs to probe');
  END IF;

  BEGIN
    UPDATE public.blogs
    SET date_modified = now()
    WHERE id = v_sample.id
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN undefined_column THEN
      BEGIN
        UPDATE public.blogs
        SET updated_at = now()
        WHERE id = v_sample.id
        RETURNING id INTO v_id;
      EXCEPTION
        WHEN undefined_column THEN
          UPDATE public.blogs
          SET title = title
          WHERE id = v_sample.id
          RETURNING id INTO v_id;
      END;
  END;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'blog_id', v_sample.id,
      'message', 'probe update matched 0 rows'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'blog_id', v_id, 'message', null);
END;
$$;

REVOKE ALL ON FUNCTION public.svc_update_blog(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.svc_insert_blog(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.svc_delete_blog(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.svc_probe_blog_write() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.svc_update_blog(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.svc_insert_blog(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.svc_delete_blog(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.svc_probe_blog_write() TO service_role;

-- Verify (should return {"ok": true, ...})
-- SELECT public.svc_probe_blog_write();

NOTIFY pgrst, 'reload schema';
