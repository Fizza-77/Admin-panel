import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import ImageUploader from './ImageUploader';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { useRouteNavigation } from '@/lib/ui/routeNavigation';

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  ssr: false,
  loading: () => <div className="blog-editor-rte-skeleton" aria-hidden />,
});

import { Save, Send, ArrowLeft } from 'lucide-react';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import { reportError } from '@/lib/monitoring';
import { setupUnlockHref } from '@/lib/setup';
import { faqSchemaToInput } from '@/lib/blogs/faqSchema';

type CategoryOption = { id: string; name: string };

interface BlogFormProps {
  initialData?: any;
  isEdit?: boolean;
  siteId: string;
  siteName?: string;
}

const getTodayDateInputValue = () => new Date().toISOString().split('T')[0];

function toSafeDateInputValue(value: unknown): string {
  if (!value) return getTodayDateInputValue();
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    return getTodayDateInputValue();
  }
  return date.toISOString().split('T')[0];
}

export default function BlogForm({
  initialData = null,
  isEdit = false,
  siteId,
  siteName,
}: BlogFormProps) {
  const router = useRouter();
  const { isNavigating } = useRouteNavigation();
  const [isSaving, setIsSaving] = useState(false);
  const [saveIntent, setSaveIntent] = useState<'draft' | 'published'>(
    initialData?.status === 'draft' ? 'draft' : 'published',
  );
  const [slugError, setSlugError] = useState('');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesOrphaned, setCategoriesOrphaned] = useState(false);
  const [categoriesWarning, setCategoriesWarning] = useState<string | null>(null);
  const prevSiteIdRef = useRef<string | null>(null);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      title: initialData?.title || '',
      slug: initialData?.slug || '',
      meta_title: initialData?.meta_title || '',
      description: initialData?.description || '',
      meta_description: initialData?.meta_description || '',
      date_published: toSafeDateInputValue(initialData?.date_published ?? initialData?.display_date),
      main_entity_of_page: initialData?.main_entity_of_page || '',
      cover_image_url: initialData?.cover_image_url || '',
      content: initialData?.content || '',
      author_name: initialData?.author_name || '',
      keywords: initialData?.keywords ?? initialData?.tags ?? '',
      in_language: initialData?.in_language || '',
      publisher_name: initialData?.publisher_name || '',
      publisher_logo_url: initialData?.publisher_logo_url || '',
      canonical_url: initialData?.canonical_url || '',
      category_id: initialData?.category_id || '',
      faq_schema: faqSchemaToInput(initialData?.faq_schema),
    },
  });

  const titleWatcher = watch('title');
  const slugWatcher = watch('slug');
  const categoryIdWatcher = watch('category_id');

  useEffect(() => {
    const fromBlog = initialData?.category_id;
    if (typeof fromBlog !== 'string' || !fromBlog.trim()) {
      return;
    }
    if (categories.some((c) => c.id === fromBlog)) {
      setValue('category_id', fromBlog, { shouldDirty: false });
    }
  }, [categories, initialData?.category_id, setValue]);

  useEffect(() => {
    if (prevSiteIdRef.current !== null && prevSiteIdRef.current !== siteId) {
      setValue('category_id', '');
    }
    prevSiteIdRef.current = siteId;
  }, [siteId, setValue]);

  useEffect(() => {
    let cancelled = false;
    if (!siteId) {
      setCategories([]);
      setCategoriesLoading(false);
      return;
    }
    setCategoriesLoading(true);
    setCategoriesError(null);
    setCategoriesOrphaned(false);
    setCategoriesWarning(null);
    (async () => {
      try {
        const response = await fetch(`/api/sites/${siteId}/blog-categories`, {
          credentials: 'include',
        });
        if (cancelled) return;
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          const msg = errBody?.message || `Failed to load categories (${response.status})`;
          setCategoriesError(msg);
          setCategoriesOrphaned(Boolean(errBody?.orphaned));
          setCategoriesWarning(null);
          setCategories([]);
          reportError(new Error(msg), { source: 'BlogForm.loadCategories.http', siteId, status: response.status });
          return;
        }
        const body = await response.json().catch(() => ({}));
        const list = Array.isArray(body?.categories) ? body.categories : [];
        setCategoriesWarning(typeof body?.warning === 'string' ? body.warning : null);
        setCategories(
          list
            .filter((c: any) => c && typeof c.id === 'string' && typeof c.name === 'string')
            .map((c: { id: string; name: string }) => ({
              id: c.id,
              name: c.name,
            })),
        );
      } catch (error) {
        reportError(error, { source: 'BlogForm.loadCategories', siteId });
        if (!cancelled) {
          setCategoriesError(error instanceof Error ? error.message : 'Failed to load categories');
          setCategories([]);
        }
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!isEdit && titleWatcher && !slugWatcher) {
      const generatedSlug = titleWatcher
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setValue('slug', generatedSlug, { shouldValidate: true });
    }
  }, [titleWatcher, isEdit, slugWatcher, setValue]);

  const checkSlugUnique = async (slug: string) => {
    if (!siteId) {
      throw new Error('Missing site context for slug validation');
    }

    const params = new URLSearchParams({ slug });
    if (isEdit && initialData?.id) {
      params.set('excludeId', initialData.id);
    }
    const response = await fetch(`/api/sites/${siteId}/blogs?${params}`, {
      credentials: 'include',
    });
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to validate slug');
    }
    const result = await response.json().catch(() => null);
    if (!result || typeof result.available !== 'boolean') {
      throw new Error('Invalid slug validation response');
    }
    return result.available === true;
  };

  const onSubmit = async (data: any, status: 'draft' | 'published' = saveIntent) => {
    setSaveIntent(status);
    setIsSaving(true);
    setSlugError('');

    try {
      if (!siteId) {
        throw new Error('Missing site id');
      }
      if (!data?.title || !data?.slug || !data?.date_published) {
        throw new Error('Title, slug, and date published are required');
      }

      const isUnique = await checkSlugUnique(data.slug);
      if (!isUnique) {
        setSlugError('This slug is already in use for this site.');
        setIsSaving(false);
        return;
      }

      const categoryId =
        (typeof data.category_id === 'string' && data.category_id.trim()) ||
        (typeof categoryIdWatcher === 'string' && categoryIdWatcher.trim()) ||
        '';
      const resolvedCategoryId = categoryId.trim() || null;
      const selectedCategory = resolvedCategoryId
        ? categories.find((c) => c.id === resolvedCategoryId)
        : undefined;

      const body = {
        status,
        title: data.title,
        slug: data.slug,
        meta_title: data.meta_title,
        description: data.description,
        meta_description: data.meta_description,
        date_published: data.date_published,
        main_entity_of_page: data.main_entity_of_page || null,
        cover_image_url: data.cover_image_url,
        content: data.content,
        author_name: data.author_name || null,
        keywords: data.keywords || null,
        article_section: selectedCategory?.name ?? null,
        in_language: data.in_language || null,
        publisher_name: data.publisher_name || null,
        publisher_logo_url: data.publisher_logo_url || null,
        canonical_url: data.canonical_url || null,
        category_id: resolvedCategoryId,
        faq_schema: data.faq_schema || null,
      };

      const saveResponse = await fetch(
        isEdit ? `/api/sites/${siteId}/blogs/${initialData.id}` : `/api/sites/${siteId}/blogs`,
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        },
      );

      if (!saveResponse.ok) {
        const err = await saveResponse.json().catch(() => ({}));
        const errMessage = typeof err?.message === 'string' ? err.message : 'Failed to save blog post';
        console.error('Blog save failed:', saveResponse.status, errMessage);
        if (saveResponse.status === 409) {
          setSlugError(err.message || 'This slug is already in use for this site.');
          setIsSaving(false);
          return;
        }
        throw new Error(errMessage);
      }

      await router.push(`/sites/${siteId}/blogs`);
    } catch (error: any) {
      reportError(error, {
        source: 'BlogForm.onSubmit',
        siteId,
        isEdit,
        blogId: initialData?.id ?? null,
      });
      alert(error.message || 'Failed to save blog post');
    } finally {
      setIsSaving(false);
    }
  };

  const submitWithStatus = (status: 'draft' | 'published') => {
    setSaveIntent(status);
    handleSubmit((data) => onSubmit(data, status))();
  };

  const overlayMessages = isSaving
    ? [
        saveIntent === 'draft' ? 'Saving draft…' : 'Publishing…',
        'Syncing with the database…',
        'Almost done…',
      ]
    : !isNavigating && categoriesLoading
      ? ['Loading categories…', 'Fetching site categories…', 'Almost ready…']
      : null;

  return (
    <>
      {overlayMessages && <LoadingOverlay messages={overlayMessages} rotateIntervalMs={3000} />}
    <form onSubmit={handleSubmit((data) => onSubmit(data, 'published'))} className="blog-editor-root space-y-6 sm:space-y-8 w-full max-w-5xl">
      <div className="blog-editor-toolbar">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href={`/sites/${siteId}/blogs`}
            className="blog-editor-back"
            aria-label="Back to blogs"
            title="Back to blogs"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div>
            <h1 className="blog-editor-toolbar-title">{isEdit ? 'Edit Blog Post' : 'Create New Blog'}</h1>
            {siteName && (
              <p className="blog-editor-toolbar-meta">
                Website: <strong>{siteName}</strong>
              </p>
            )}
          </div>
          {initialData?.status === 'draft' && (
            <span className="blog-editor-badge blog-editor-badge--draft">Draft</span>
          )}
        </div>
        <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
          <OutlineFillButtonAction
            type="button"
            disabled={isSaving || categoriesLoading}
            onClick={() => submitWithStatus('draft')}
            className="!w-full sm:!w-auto"
            icon={<Save className="h-[15px] w-[15px]" aria-hidden />}
          >
            {isSaving && saveIntent === 'draft' ? 'Saving Draft...' : 'Save Draft'}
          </OutlineFillButtonAction>
          <OutlineFillButtonAction
            type="button"
            disabled={isSaving || categoriesLoading}
            onClick={() => submitWithStatus('published')}
            className="!w-full sm:!w-auto"
            icon={<Send className="h-[15px] w-[15px]" aria-hidden />}
          >
            {isSaving && saveIntent === 'published' ? 'Publishing...' : isEdit ? 'Update & Publish' : 'Publish'}
          </OutlineFillButtonAction>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        {/* Main Editor Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="blog-editor-panel blog-editor-panel--primary space-y-4">
            <div className="blog-editor-field">
              <label className="blog-editor-label">
                Blog title * <span className="blog-editor-label-hint">(headline / name)</span>
              </label>
              <input
                type="text"
                {...register('title', { required: 'Title is required' })}
                className="blog-editor-input blog-editor-input--title"
                placeholder="Enter blog title here..."
              />
              {errors.title && <p className="blog-editor-error">{errors.title.message as string}</p>}
            </div>

            <div className="blog-editor-field">
              <label className="blog-editor-label">Content *</label>
              <Controller
                name="content"
                control={control}
                rules={{ required: 'Content is required' }}
                render={({ field }) => (
                  <RichTextEditor value={field.value} onChange={field.onChange} />
                )}
              />
              {errors.content && <p className="blog-editor-error">{errors.content.message as string}</p>}
            </div>

            <div className="blog-editor-field">
              <label className="blog-editor-label">
                Category <span className="blog-editor-label-hint">(optional)</span>
              </label>
              <Controller
                name="category_id"
                control={control}
                render={({ field }) => (
                  <select
                    id="category_id"
                    name={field.name}
                    ref={field.ref}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    aria-busy={categoriesLoading}
                    disabled={categoriesLoading}
                    className={`blog-editor-select ${categoriesLoading ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    <option value="">Select category</option>
                    {(Array.isArray(categories) ? categories : []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {categoriesError && (
                <div className="mt-1 space-y-1">
                  <p className="blog-editor-error">{categoriesError}</p>
                  {categoriesOrphaned && siteId && (
                    <Link
                      href={setupUnlockHref(`/sites/${siteId}/recover`)}
                      className="blog-editor-link"
                    >
                      Re-connect this site →
                    </Link>
                  )}
                </div>
              )}
              {categoriesWarning && (
                <p className="blog-editor-warn">{categoriesWarning}</p>
              )}
              {!categoriesLoading && !categoriesError && !categoriesWarning && categories.length === 0 && (
                <p className="blog-editor-warn">
                  No categories configured for this site.{' '}
                  {siteId && (
                    <Link href={`/sites/${siteId}/categories`} className="blog-editor-link">
                      Add categories
                    </Link>
                  )}
                </p>
              )}
            </div>
            
            <div className="blog-editor-field">
              <label className="blog-editor-label">
                Short description <span className="blog-editor-label-hint">(schema.org description)</span>
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="blog-editor-textarea"
                placeholder="Brief summary for blog cards and JSON-LD description..."
              />
            </div>

            <div className="blog-editor-field">
              <label className="blog-editor-label">
                FAQ schema <span className="blog-editor-label-hint">(schema.org FAQPage)</span>
              </label>
              <textarea
                {...register('faq_schema')}
                rows={8}
                className="blog-editor-textarea blog-editor-textarea--mono"
                placeholder='Paste FAQPage JSON-LD for this article only, e.g. { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [...] }'
              />
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="blog-editor-panel">
            <h3 className="blog-editor-panel-title">Publishing & SEO</h3>
            
            <div className="space-y-4">
              <div className="blog-editor-field">
                <label className="blog-editor-label">URL Slug *</label>
                <input
                  type="text"
                  {...register('slug', { required: 'Slug is required' })}
                  className="blog-editor-input blog-editor-input--mono"
                />
                {slugError && <p className="blog-editor-error">{slugError}</p>}
                {errors.slug && <p className="blog-editor-error">{errors.slug.message as string}</p>}
              </div>

              <div className="blog-editor-field">
                <label className="blog-editor-label">
                  datePublished <span className="blog-editor-label-hint">(required)</span>
                </label>
                <input
                  type="date"
                  {...register('date_published', { required: 'datePublished is required' })}
                  className="blog-editor-input"
                />
                {errors.date_published && (
                  <p className="blog-editor-error">{errors.date_published.message as string}</p>
                )}
              </div>

              {isEdit && initialData?.date_modified && (
                <div className="blog-editor-field">
                  <label className="blog-editor-label">
                    dateModified <span className="blog-editor-label-hint">(auto-updated on save)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={new Date(initialData.date_modified).toLocaleString()}
                    className="blog-editor-input blog-editor-input--readonly"
                    aria-readonly="true"
                  />
                </div>
              )}

              <div className="blog-editor-field">
                <label className="blog-editor-label">
                  Meta title <span className="blog-editor-label-hint">(alternativeHeadline)</span>
                </label>
                <input
                  type="text"
                  {...register('meta_title')}
                  className="blog-editor-input"
                  placeholder="Defaults to title if empty"
                />
              </div>

              <div className="blog-editor-field">
                <label className="blog-editor-label">
                  Meta description <span className="blog-editor-label-hint">(meta / JSON-LD)</span>
                </label>
                <textarea
                  {...register('meta_description')}
                  rows={2}
                  className="blog-editor-textarea"
                  placeholder="SEO description..."
                />
              </div>
            </div>
          </div>

          <div className="blog-editor-panel">
            <h3 className="blog-editor-panel-title">Schema.org (BlogPosting)</h3>
            <p className="blog-editor-panel-hint">
              Maps to JSON-LD <code>BlogPosting</code> / <code>Article</code>. All optional.
            </p>

            <div className="space-y-4">
              <div className="blog-editor-field">
                <label className="blog-editor-label">
                  Author name <span className="blog-editor-label-hint">(author)</span>
                </label>
                <input
                  type="text"
                  {...register('author_name')}
                  className="blog-editor-input"
                  placeholder="Jane Doe"
                />
              </div>

              <div className="blog-editor-field">
                <label className="blog-editor-label">
                  Keywords <span className="blog-editor-label-hint">(keywords)</span>
                </label>
                <input
                  type="text"
                  {...register('keywords')}
                  className="blog-editor-input"
                  placeholder="comma, separated, terms"
                />
              </div>

              <div className="blog-editor-field">
                <label className="blog-editor-label">
                  Language <span className="blog-editor-label-hint">(inLanguage)</span>
                </label>
                <input
                  type="text"
                  {...register('in_language')}
                  className="blog-editor-input"
                  placeholder="en-US"
                />
              </div>

              <div className="blog-editor-field">
                <label className="blog-editor-label">
                  Publisher name <span className="blog-editor-label-hint">(publisher)</span>
                </label>
                <input
                  type="text"
                  {...register('publisher_name')}
                  className="blog-editor-input"
                />
              </div>

              <div className="blog-editor-field">
                <label className="blog-editor-label">
                  Publisher logo URL <span className="blog-editor-label-hint">(publisher.logo)</span>
                </label>
                <input
                  type="url"
                  {...register('publisher_logo_url')}
                  className="blog-editor-input"
                  placeholder="https://…"
                />
              </div>

              <div className="blog-editor-field">
                <label className="blog-editor-label">
                  Canonical URL <span className="blog-editor-label-hint">(url)</span>
                </label>
                <input
                  type="url"
                  {...register('canonical_url')}
                  className="blog-editor-input"
                  placeholder="https://yoursite.com/blog/slug"
                />
              </div>

              <div className="blog-editor-field">
                <label className="blog-editor-label">
                  mainEntityOfPage <span className="blog-editor-label-hint">(page @id)</span>
                </label>
                <input
                  type="url"
                  {...register('main_entity_of_page')}
                  className="blog-editor-input"
                  placeholder="https://yoursite.com/blog/slug"
                />
              </div>
            </div>
          </div>

          <div className="blog-editor-panel">
             <Controller
              name="cover_image_url"
              control={control}
              render={({ field }) => (
                <ImageUploader
                  value={field.value}
                  onChange={field.onChange}
                  label="Cover image (image / og:image)"
                />
              )}
            />
          </div>
        </div>
      </div>
    </form>
    </>
  );
}
