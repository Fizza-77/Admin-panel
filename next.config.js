/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/attendance/employees',
        destination: '/employees',
        permanent: true,
      },
      {
        source: '/attendance/employees/:userId',
        destination: '/employees/:userId',
        permanent: true,
      },
    ];
  },
  transpilePackages: [
    "@tiptap/react",
    "@tiptap/starter-kit",
    "@tiptap/extension-image",
    "@tiptap/extension-link",
    "@tiptap/extension-text-align",
    "@tiptap/extension-underline",
    "@tiptap/extension-table",
    "@tiptap/extension-table-row",
    "@tiptap/extension-table-cell",
    "@tiptap/extension-table-header",
    "@tiptap/pm",
  ],
};

module.exports = nextConfig;