/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@tiptap/react",
    "@tiptap/starter-kit",
    "@tiptap/extension-image",
    "@tiptap/extension-link",
    "@tiptap/extension-text-align",
    "@tiptap/extension-underline",
    "@tiptap/pm"
  ],
};

module.exports = nextConfig;