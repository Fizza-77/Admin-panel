import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

type Site = {
  id: string;
  name: string | null;
  domain: string;
};

interface SitesListProps {
  sites: Site[];
}

export default function SitesList({ sites }: SitesListProps) {
  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Websites</h1>
          <p className="text-gray-500 mt-1">Choose a website to manage its blog posts.</p>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 border-dashed py-16 px-6 text-center">
          <p className="text-gray-600 mb-2 font-medium">No sites configured yet</p>
          <p className="text-gray-400 text-sm">
            Create site records in your Supabase <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">sites</code>{' '}
            table to see them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map((site) => (
            <div
              key={site.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {site.name || site.domain}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">{site.domain}</p>
                </div>
              </div>

              <div className="mt-auto flex gap-3 pt-4 border-t border-gray-100">
                <Link
                  href={`/sites/${site.id}/blogs`}
                  className="flex-1 text-center bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg border border-gray-200 transition text-sm"
                >
                  View blogs
                </Link>
                <Link
                  href={`/sites/${site.id}/blogs/create`}
                  className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition text-sm"
                >
                  New blog
                </Link>
              </div>

              <div className="mt-3 text-xs text-gray-400 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                <span>Public blog URLs are handled by the site frontend.</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
