
# Geo-Waste Reporter

**Live Demo:** [https://elaborate-vacherin-5eb943.netlify.app/](https://elaborate-vacherin-5eb943.netlify.app/)

A GeoAI-powered platform for reporting and monitoring illegal waste dumping.

## About the Project

Geo-Waste Reporter aims to help citizens report illegal waste dumping through photographs and automatic GPS location detection.

The platform stores submitted reports and their associated location information, allowing administrators to monitor and manage waste incidents.

## Current Features

- Citizen waste reporting without registration or login.
- Photograph upload and preview.
- Automatic GPS location detection.
- Unique report ID generation.
- Secure image storage using Supabase Storage.
- Report metadata storage using Supabase PostgreSQL.

## Technology Stack

- Frontend: React.js
- Build Tool: Vite
- Styling: Tailwind CSS
- Backend Services: Supabase
- Database: PostgreSQL
- Storage: Supabase Storage

## Getting Started

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd GEO-WASTE-REPORTER
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

### 4. Start the development server

```bash
npm run dev
```

## Project Status

Citizen reporting and Supabase integration are implemented.

Admin dashboard, incident management, interactive mapping, and GeoAI features are planned for subsequent development.

## Security

Never commit `.env.local`, Supabase secret keys, or service role keys to the repository.
