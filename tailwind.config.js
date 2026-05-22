/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'blog-post-content',
    'w-full',
    'min-w-full',
    'border-collapse',
    'table-auto',
    'my-5',
    'text-sm',
    'leading-normal',
    'border',
    'border-gray-300',
    'bg-gray-100',
    'bg-white',
    'px-3',
    'py-2',
    'text-left',
    'font-semibold',
    'text-gray-900',
    'text-gray-800',
    'align-top',
    'overflow-x-auto',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
