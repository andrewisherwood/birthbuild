# BirthBuild

AI-powered static website builder for birth workers. Chat your way to a professional website in minutes, not weeks.

## What is it?

BirthBuild replaces drag-and-drop website builders with a guided conversation. A chatbot gathers your preferences and content, then builds and deploys a fully responsive, accessible, SEO-optimised static site to your own subdomain.

Built for doulas. Designed to scale to any solo practitioner profession.

## Architecture

- **Frontend:** React + Vite + Tailwind (PWA)
- **Backend:** Supabase (Postgres, Auth, Edge Functions, Storage)
- **AI:** Claude API (content generation, chatbot)
- **Build:** MAI pipeline (static site generation from structured spec)
- **Hosting:** Netlify (auto-provisioned subdomains)

## Features

- Magic link authentication (no passwords)
- Guided chatbot onboarding or form-based dashboard
- AI-generated content (bios, taglines, FAQs, service descriptions)
- 4 curated colour palettes + custom option
- WCAG 2.1 AA compliant output
- Multi-tenant instructor model (workshop-ready)
- Edit and rebuild via chat or dashboard

## Getting Started

```bash
cp .env.example .env
# Fill in your API keys (see .env.example for required vars)
npm install
npm run dev
```

## Licence

Proprietary — Dopamine Labs. All rights reserved.
