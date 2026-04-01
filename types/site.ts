export type Site = {
  id: string;
  name: string | null;
  domain: string;
  site_key: string;
  /** Public blog index page title (HTML title tag) */
  blog_page_meta_title?: string | null;
  blog_page_meta_description?: string | null;
  blog_page_headline?: string | null;
  blog_page_subheadline?: string | null;
  blog_empty_state_message?: string | null;
};
