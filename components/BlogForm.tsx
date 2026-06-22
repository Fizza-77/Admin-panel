import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import ImageUploader from './ImageUploader';

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-gray-50 animate-pulse rounded-xl border border-gray-200" />
});

import { Loader2, Save, Send } from 'lucide-react';
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveIntent, setSaveIntent] = useState<'draft' | 'published'>(
    initialData?.status === 'draft' ? 'draft' : 'published',
  );
  const [slugError, setSlugError] = useState('');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
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

      const selectedCategory = categories.find((c) => c.id === data.category_id);

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
        category_id: data.category_id || null,
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
        if (saveResponse.status === 409) {
          setSlugError(err.message || 'This slug is already in use for this site.');
          setIsSaving(false);
          return;
        }
        throw new Error(err.message || 'Failed to save blog post');
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

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data, 'published'))} className="space-y-6 sm:space-y-8 w-full max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-3 sm:p-4 rounded-xl shadow-sm tracking-wide sticky top-0 z-10 border border-gray-200 border-b">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">{isEdit ? 'Edit Blog Post' : 'Create New Blog'}</h1>
            {siteName && (
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Website: <span className="font-semibold text-gray-800">{siteName}</span>
              </p>
            )}
          </div>
          {initialData?.status === 'draft' && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              Draft
            </span>
          )}
        </div>
        <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => submitWithStatus('draft')}
            className="w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 px-4 sm:px-6 rounded-lg transition disabled:opacity-50"
          >
            {isSaving && saveIntent === 'draft' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving && saveIntent === 'draft' ? 'Saving Draft...' : 'Save Draft'}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => submitWithStatus('published')}
            className="w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 sm:px-6 rounded-lg transition disabled:opacity-50"
          >
            {isSaving && saveIntent === 'published' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {isSaving && saveIntent === 'published' ? 'Publishing...' : isEdit ? 'Update & Publish' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        {/* Main Editor Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Blog title * <span className="text-gray-400 font-normal">(headline / name)</span>
              </label>
              <input
                type="text"
                {...register('title', { required: 'Title is required' })}
                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border"
                placeholder="Enter blog title here..."
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message as string}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
              <Controller
                name="content"
                control={control}
                rules={{ required: 'Content is required' }}
                render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />}
              />
              {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content.message as string}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                {...register('category_id')}
                disabled={!siteId || categoriesLoading}
                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select category</option>
                {(Array.isArray(categories) ? categories : []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {categoriesLoading && (
                <p className="mt-1 text-xs text-gray-500">Loading categories…</p>
              )}
              {categoriesError && (
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-red-600">{categoriesError}</p>
                  {categoriesOrphaned && siteId && (
                    <Link
                      href={setupUnlockHref(`/sites/${siteId}/recover`)}
                      className="inline-flex text-xs font-medium text-cyan-700 hover:text-cyan-800"
                    >
                      Re-connect this site →
                    </Link>
                  )}
                </div>
              )}
              {categoriesWarning && (
                <p className="mt-1 text-xs text-amber-800">{categoriesWarning}</p>
              )}
              {!categoriesLoading && !categoriesError && !categoriesWarning && categories.length === 0 && (
                <p className="mt-1 text-xs text-amber-800">
                  No categories configured for this site.{' '}
                  {siteId && (
                    <Link href={`/sites/${siteId}/categories`} className="font-medium text-cyan-700 hover:text-cyan-800">
                      Add categories
                    </Link>
                  )}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Short description <span className="text-gray-400 font-normal">(schema.org description)</span>
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border"
                placeholder="Brief summary for blog cards and JSON-LD description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                FAQ schema <span className="text-gray-400 font-normal">(schema.org FAQPage)</span>
              </label>
              <textarea
                {...register('faq_schema')}
                rows={8}
                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border font-mono text-xs"
                placeholder='Paste FAQPage JSON-LD for this article only, e.g. { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [...] }'
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional. Unique per blog — saved in <code className="rounded bg-gray-100 px-1">faq_schema</code> and
                fetched on each article page.
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 border-b pb-3 mb-4">Publishing & SEO</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug *</label>
                <input
                  type="text"
                  {...register('slug', { required: 'Slug is required' })}
                  className="block w-full border-gray-300 bg-gray-50 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border font-mono text-sm"
                />
                {slugError && <p className="mt-1 text-sm text-red-600">{slugError}</p>}
                {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug.message as string}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  datePublished <span className="text-gray-400 font-normal">(required)</span>
                </label>
                <input
                  type="date"
                  {...register('date_published', { required: 'datePublished is required' })}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm"
                />
                {errors.date_published && (
                  <p className="mt-1 text-sm text-red-600">{errors.date_published.message as string}</p>
                )}
              </div>

              {isEdit && initialData?.date_modified && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    dateModified <span className="text-gray-400 font-normal">(auto-updated on save)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={new Date(initialData.date_modified).toLocaleString()}
                    className="block w-full border-gray-200 bg-gray-50 rounded-lg py-2.5 px-3 border text-sm text-gray-600"
                    aria-readonly="true"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta title <span className="text-gray-400 font-normal">(alternativeHeadline)</span>
                </label>
                <input
                  type="text"
                  {...register('meta_title')}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm"
                  placeholder="Defaults to title if empty"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta description <span className="text-gray-400 font-normal">(meta / JSON-LD)</span>
                </label>
                <textarea
                  {...register('meta_description')}
                  rows={2}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 border text-sm"
                  placeholder="SEO description..."
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 border-b pb-3 mb-1">Schema.org (BlogPosting)</h3>
            <p className="text-xs text-gray-500 mb-4">
              Maps to JSON-LD <code className="text-xs bg-gray-100 px-1 rounded">BlogPosting</code> /{' '}
              <code className="text-xs bg-gray-100 px-1 rounded">Article</code>. All optional.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Author name <span className="text-gray-400 font-normal">(author)</span>
                </label>
                <input
                  type="text"
                  {...register('author_name')}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords <span className="text-gray-400 font-normal">(keywords)</span>
                </label>
                <input
                  type="text"
                  {...register('keywords')}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm"
                  placeholder="comma, separated, terms"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language <span className="text-gray-400 font-normal">(inLanguage)</span>
                </label>
                <input
                  type="text"
                  {...register('in_language')}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm"
                  placeholder="en-US"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Publisher name <span className="text-gray-400 font-normal">(publisher)</span>
                </label>
                <input
                  type="text"
                  {...register('publisher_name')}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Publisher logo URL <span className="text-gray-400 font-normal">(publisher.logo)</span>
                </label>
                <input
                  type="url"
                  {...register('publisher_logo_url')}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm"
                  placeholder="https://…"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Canonical URL <span className="text-gray-400 font-normal">(url)</span>
                </label>
                <input
                  type="url"
                  {...register('canonical_url')}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm"
                  placeholder="https://yoursite.com/blog/slug"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  mainEntityOfPage <span className="text-gray-400 font-normal">(page @id)</span>
                </label>
                <input
                  type="url"
                  {...register('main_entity_of_page')}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm"
                  placeholder="https://yoursite.com/blog/slug"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
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
  );
}
