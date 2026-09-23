# Lumora

A calm workspace for clearer decisions, built with **Next.js 16, React 19, TypeScript, and Tailwind CSS 4**. Lumora brings guided conversations, specialized decision areas, and comparison tools into an ivory and forest-green interface, with English, Persian, and Arabic translations.

**Try the interface without a backend:** enable demo mode and sign in with the credentials below. This repository contains the frontend; AI responses and live research require a compatible backend.

## Quick start

Requires **Node.js 24**, **pnpm 10**, and access to this repository.

```sh
git clone git@github.com:Shiva-Br/lumora.git
cd lumora
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

If you already have `.env.local`, keep your existing values and set `NEXT_PUBLIC_AUTH_MODE=demo` instead of copying over it.

## Demo login

| Field            | Value                        |
| ---------------- | ---------------------------- |
| Username         | `demo`                       |
| Password         | `Lumora123!`                 |
| Required setting | `NEXT_PUBLIC_AUTH_MODE=demo` |

The example environment file enables demo mode. These are public test credentials checked in the browser, not a real backend account.

In demo mode you can explore the home screen, Decision Worlds, navigation, and settings. The session survives refreshes in the same tab; signing out clears it. Preferences are temporary and reset on a full reload.

Chat displays a message explaining that a backend is required. Live research, saved backend history, and exports are unavailable. Demo mode blocks backend API requests, even if the browser has a session cookie from a previous real login. It creates no backend user or authentication cookie.

## Authentication modes

| `NEXT_PUBLIC_AUTH_MODE` | Sign-in                                            | Backend requirements                            |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------- |
| `demo`                  | Public test credentials above, checked client-side | None; backend API access is disabled            |
| `local`                 | Username and password issued by your backend       | Compatible backend at `LUMORA_API_URL`          |
| `supabase`              | Hosted email/OAuth authentication                  | Supabase configuration and a compatible backend |

If the mode is unset, the application uses `local`. Test credentials work only in `demo` mode.

After changing the mode, restart `pnpm dev`. For a deployed build, rebuild and redeploy: `NEXT_PUBLIC_*` values are compiled into the browser bundle.

## Connect a real backend

The API contract is in [openapi/lumora-api.json](openapi/lumora-api.json). The backend service is not included in this repository.

For username/password authentication, configure `.env.local`:

```dotenv
NEXT_PUBLIC_AUTH_MODE=local
LUMORA_API_URL=http://localhost:8000
LUMORA_SITE_URL=http://localhost:3000
```

Replace the backend URL with your running service. Create accounts through that backend; the frontend does not create local-auth users. Real login, chat, research, history, and exports depend on that service.

For Supabase authentication:

```dotenv
NEXT_PUBLIC_AUTH_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
LUMORA_API_URL=http://localhost:8000
LUMORA_SITE_URL=http://localhost:3000
```

Configure your site's `/auth/callback` URL in Supabase. This mode allows guest browsing and requests sign-in when a prompt is submitted.

Keep `.env.local` out of Git. Only the Supabase publishable key belongs in the frontend; service-role keys and backend secrets do not belong in `NEXT_PUBLIC_*` variables.

## Build and run

```sh
pnpm build
pnpm start
```

Set `LUMORA_SITE_URL` to your deployed website origin so social preview links resolve correctly.

The Dockerfile defaults to `local` authentication. To build a demo image explicitly:

```sh
docker build --build-arg NEXT_PUBLIC_AUTH_MODE=demo -t lumora:demo .
docker run --rm -p 3000:3000 lumora:demo
```

## Troubleshooting

- **Demo credentials are rejected:** check that `.env.local` contains `NEXT_PUBLIC_AUTH_MODE=demo`, then restart development or rebuild the deployment.
- **“The Lumora backend is not configured”:** you are using real authentication without a backend URL. Configure `LUMORA_API_URL`, or switch to `demo` for UI testing.
- **Chat does not return AI responses:** this is expected in demo mode. Switch to a real authentication mode and connect a compatible backend.

## Development checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The test suite includes demo credential validation, session clearing, and rejection of backend API traffic in demo mode.

## Project structure

| Path                      | Purpose                                               |
| ------------------------- | ----------------------------------------------------- |
| `app/`                    | App Router pages, API proxy routes, and theme styles  |
| `components/lumora/`      | Product interface and decision workspace              |
| `lib/auth/`               | Authentication providers and client-only demo session |
| `lib/i18n/`               | English, Persian, and Arabic translations             |
| `public/lumora-*.svg`     | Vector logo and wordmark                              |
| `openapi/lumora-api.json` | Compatible backend API contract                       |
