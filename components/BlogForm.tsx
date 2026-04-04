import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import ImageUploader from './ImageUploader';

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-gray-50 animate-pulse rounded-xl border border-gray-200" />
});

import { Loader2, Save } from 'lucide-react';

type CategoryOption = { id: string; name: string };

interface BlogFormProps {
  initialData?: any;
  isEdit?: boolean;
  siteId: string;
}

export default function BlogForm({
  initialData = null,
  isEdit = false,
  siteId,
}: BlogFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const prevSiteIdRef = useRef<string | null>(null);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      title: initialData?.title || '',
      slug: initialData?.slug || '',
      meta_title: initialData?.meta_title || '',
      description: initialData?.description || '',
      meta_description: initialData?.meta_description || '',
      display_date: initialData?.display_date ? new Date(initialData.display_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      cover_image_url: initialData?.cover_image_url || '',
      content: initialData?.content || '',
      author_name: initialData?.author_name || '',
      keywords: initialData?.keywords ?? initialData?.tags ?? '',
      in_language: initialData?.in_language || '',
      publisher_name: initialData?.publisher_name || '',
      publisher_logo_url: initialData?.publisher_logo_url || '',
      canonical_url: initialData?.canonical_url || '',
      category_id: initialData?.category_id || '',
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
    (async () => {
      const response = await fetch(`/api/sites/${siteId}/blog-categories`, {
        credentials: 'include',
      });
      if (cancelled) return;
      setCategoriesLoading(false);
      if (!response.ok) {
        setCategories([]);
        return;
      }
      const body = await response.json().catch(() => ({}));
      const list = (body.categories ?? []) as { id: string; name: string }[];
      setCategories(
        list.map((c) => ({
          id: c.id,
          name: c.name,
        })),
      );
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
    const result = await response.json();
    return result.available === true;
  };

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    setSlugError('');

    try {
      const isUnique = await checkSlugUnique(data.slug);
      if (!isUnique) {
        setSlugError('This slug is already in use for this site.');
        setIsSaving(false);
        return;
      }

      const selectedCategory = categories.find((c) => c.id === data.category_id);

      const body = {
        title: data.title,
        slug: data.slug,
        meta_title: data.meta_title,
        description: data.description,
        meta_description: data.meta_description,
        display_date: data.display_date,
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

      router.push(`/sites/${siteId}/blogs`);
    } catch (error: any) {
      console.error('Save error:', error);
      alert(error.message || 'Failed to save blog post');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-5xl">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm tracking-wide sticky top-0 z-10 border border-gray-200 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Blog Post' : 'Create New Blog'}</h1>
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isSaving ? 'Saving...' : 'Save Post'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Editor Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
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
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {categoriesLoading && (
                <p className="mt-1 text-xs text-gray-500">Loading categories…</p>
              )}
              {!categoriesLoading && categories.length === 0 && (
                <p className="mt-1 text-xs text-amber-800">
                  No categories configured for this site.
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
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
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
                  Display date * <span className="text-gray-400 font-normal">(datePublished)</span>
                </label>
                <input
                  type="date"
                  {...register('display_date', { required: 'Date is required' })}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm"
                />
              </div>

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

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
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
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
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
