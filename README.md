# Skyen — Admin Panel

A lightweight, production-ready admin panel for managing sites, blogs, attendance, tasks and users, built with Next.js, Supabase, Cloudinary and Tailwind CSS.

## Key Features

- Multi-tenant site management and settings
- Blog editor with rich text and uploads
- Attendance tracking and reports
- Kanban-style task board
- Supabase-backed auth and realtime data
- Cloudinary image uploads

## Tech Stack

- Frontend: Next.js (React) with TypeScript
- Styling: Tailwind CSS
- Database / Auth: Supabase
- File uploads: Cloudinary
- Process manager: PM2 (optional; `ecosystem.config.cjs` included)

## Requirements

- Node.js 18+
- npm or pnpm
- A Supabase project with API keys
- Cloudinary account for media uploads

## Environment

Create a `.env.local` in the project root (do NOT commit secrets). Example variables used by this project:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CLOUDINARY_CLOUD_NAME=
TURNSTILE_SECRET_KEY=
```

## Setup (Local)

1. Install dependencies

```bash
npm install
```

2. Add your `.env.local` with the variables above.

3. Run the development server

```bash
npm run dev
# or `pnpm dev`
```

Open http://localhost:3000 to view the admin panel.

## Contributing

- Fork the repo and open a pull request.
- Keep secrets out of commits — use `.env.local`.
- Follow existing code style (TypeScript, React hooks, Tailwind).

## Project Structure (high level)

- `components/` — UI and feature components
- `lib/`, `services/`, `supabase/` — helpers, API wrappers, DB logic
- `pages/` — Next.js routes and API endpoints
- `styles/` — global and feature CSS

