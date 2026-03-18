import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase/client';
import ImageUploader from './ImageUploader';

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-gray-50 animate-pulse rounded-xl border border-gray-200" />
});

import { Loader2, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface BlogFormProps {
  initialData?: any;
  isEdit?: boolean;
  siteId: string;
}

export default function BlogForm({ initialData = null, isEdit = false, siteId }: BlogFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [slugError, setSlugError] = useState('');

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
      tags: initialData?.tags || '' // For simplicity, comma separated string
    }
  });

  const titleWatcher = watch('title');
  const slugWatcher = watch('slug');

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
    let query = supabase.from('blogs').select('id').eq('site_id', siteId).eq('slug', slug);
    if (isEdit && initialData?.id) {
      query = query.neq('id', initialData.id);
    }
    const { data } = await query.single();
    return !data; // Return true if unique (not found)
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

      const payload = {
        site_id: siteId,
        title: data.title,
        slug: data.slug,
        meta_title: data.meta_title,
        description: data.description,
        meta_description: data.meta_description,
        display_date: new Date(data.display_date).toISOString(),
        cover_image_url: data.cover_image_url,
        content: data.content,
        updated_at: new Date().toISOString()
      };

      if (isEdit) {
        const { error } = await supabase.from('blogs').update(payload).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('blogs').insert([payload]);
        if (error) throw error;
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
          <Link href={`/sites/${siteId}/blogs`} className="text-gray-500 hover:text-gray-900 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Blog Title *</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
              <textarea
                {...register('description')}
                rows={3}
                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border"
                placeholder="Brief summary for blog cards..."
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Date *</label>
                <input
                  type="date"
                  {...register('display_date', { required: 'Date is required' })}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
                <input
                  type="text"
                  {...register('meta_title')}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 border text-sm"
                  placeholder="Defaults to title if empty"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                <textarea
                  {...register('meta_description')}
                  rows={2}
                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2px px-3 border text-sm"
                  placeholder="SEO description..."
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
                  label="Cover Image" 
                />
              )}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
