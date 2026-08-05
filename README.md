# DMS - AI Document Management System with Subscription-Based RBAC

[![Next.js 16](https://img.shields.io/badge/Next.js-16_App_Router-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_%7C_DB_%7C_Storage_%7C_RLS-3ecf8e?style=flat-square&logo=supabase)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Checkout_%26_Webhooks-635bff?style=flat-square&logo=stripe)](https://stripe.com/)

A modern, full-stack **AI Document Management System (DMS)** built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, **Supabase** (Authentication, Database, Storage & Row Level Security), and **Stripe Checkout**.

The application allows users to register, securely upload, view, edit, search, filter, and manage documents with role-based access control (RBAC) and subscription tier limits.

---

## 🌟 Key Features

### 1. User Registration & Authentication
- **Email & Password Authentication**: Powered by Supabase Auth with custom server actions (`/login`, `/register`).
- **Default Role Assignment**: New accounts are automatically assigned the `'user'` role via a PostgreSQL database trigger.
- **Profile Management**: Profile page ([`/profile`](src/app/profile/page.tsx)) for updating full name and reviewing role permissions.
- **Smart Session Sync**: Auto-redirects logged-in users to `/dashboard` when opening landing/auth pages in new tabs.

### 2. Role-Based Access Control (RBAC)
- **User Role**:
  - Upload documents (Free: 5 max, 10MB limit | Pro: Unlimited, 100MB limit).
  - View own documents inline in a new tab using dedicated **Eye Icon (View)**.
  - Download own documents with exact DB titles using dedicated **Download Icon**.
  - Edit document metadata (Title, Description, Category).
  - Delete own documents.
- **Admin Role**:
  - Full system oversight via **Admin Portal** ([`/admin/dashboard`](src/app/admin/dashboard/page.tsx)).
  - View all registered users and manage user roles (`user` ↔ `admin`).
  - View all uploaded documents system-wide with uploader info.
  - Edit or delete any user document across the entire system.
  - Manually update user subscription tiers (`free` ↔ `pro`).
  - System statistics & plan analytics.

### 3. Subscription Management (Stripe Checkout)
- **Free Plan**: Limited to **5 document uploads** and **10 MB** maximum file size.
- **Pro Plan**: **Unlimited document uploads** and **100 MB** maximum file size ($19/month).
- **Stripe Integration**: Redirects users to Stripe Checkout sessions (`/api/stripe/checkout`).
- **Automated Webhooks**: [`/api/webhooks/stripe`](src/app/api/webhooks/stripe/route.ts) handles `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`.

### 4. Advanced Document Management & Storage
- **Supported Formats**: PDF (`.pdf`), Word (`.docx`, `.doc`), and Images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`).
- **Dedicated Inline Viewing (Eye Icon)**: Generates 60-second Supabase Signed URLs for viewing PDFs and images directly inside a new browser tab (`mode=view`).
- **Exact Title Downloading (Download Icon)**: Downloads files using their exact DB title without unwanted timestamp prefixes (`mode=download`).
- **Metadata Editing (Pencil Icon)**: Update Title, Description, and Category (`General`, `Work`, `Personal`, `Finance`, `Legal`).
- **Server-Side API Search & Category Filtering**: Server-side SQL `.ilike()` search and category filtering via [`/api/documents`](src/app/api/documents/route.ts).
- **10-Item Server Pagination**: 10 items per page with exact range count indicators (`Showing 1-10 of X`) and page controls.

### 5. Security & Row Level Security (RLS)
- **PostgreSQL RLS Policies**: Configured in [`supabase/schema.sql`](supabase/schema.sql).
- **Security Definer Function**: Implements `public.is_admin(user_id uuid)` to prevent PostgreSQL RLS infinite recursion (`42P17`) and guarantee 100% data isolation.
- **Route Guard Middleware**: [`src/middleware.ts`](src/middleware.ts) protects private routes and restricts `/admin/*` strictly to `admin` accounts.
- **Large File Streaming**: Optimized `maxDuration = 60` and `bodySizeLimit: '100mb'` for uploading files up to 100MB without body parser truncation errors.

---

## 📁 Repository Structure

```text
mern-prac/
├── public/
│   ├── assets/              # Framework logos (next.svg, vercel.svg)
│   └── icons/               # SVG & ICO icons (favicon.ico, icon.svg, etc.)
├── src/
│   ├── app/
│   │   ├── (auth)/          # Auth pages (login, register)
│   │   ├── admin/           # Admin dashboard portal
│   │   ├── api/             # API Route Handlers (documents, stripe, webhooks)
│   │   ├── auth/            # Server actions for login/register/logout
│   │   ├── dashboard/       # User dashboard
│   │   ├── profile/         # User profile settings
│   │   ├── layout.tsx       # Root layout with Metadata & Favicon
│   │   └── page.tsx         # Landing page
│   ├── components/
│   │   └── layout/          # Navbar component with smart session sync
│   ├── lib/
│   │   ├── stripe/          # Stripe server SDK client
│   │   ├── supabase/        # Supabase browser, server, admin & config helper
│   │   ├── logger.ts        # Server request & error logger
│   │   └── types.ts         # TypeScript interfaces (Profile, Document)
│   └── middleware.ts        # Next.js App Router middleware
├── supabase/
│   └── schema.sql           # Database schema, triggers, & RLS policies
├── .env.example             # Environment variables template
├── next.config.ts           # Next.js configuration
├── package.json             # NPM dependencies & scripts
└── README.md                # Project documentation
```

---

## 🛠️ Environment Setup (`.env.local`)

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Application Base URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 🚀 Local Execution & Setup Instructions

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/devenvyaas/doc-mgmt-system.git
cd doc-mgmt-system
npm install
```

### 2. Configure Supabase Database & Storage
1. Go to your **[Supabase Dashboard](https://supabase.com/dashboard)** ➔ **SQL Editor**.
2. Copy and execute the complete script from [`supabase/schema.sql`](supabase/schema.sql).
   *(This creates `profiles`, `documents` tables, the `is_admin()` Security Definer function, `on_auth_user_created` trigger, and RLS policies).*

### 3. Setup Stripe Local Webhook Listener
In a separate terminal window, forward Stripe webhook events to your local server:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
Copy the generated `whsec_...` signing secret into your `.env.local` file.

### 4. Run Development Server
```bash
npm run dev
```
Open [`http://localhost:3000`](http://localhost:3000) in your browser.

---

## 🧪 Verification & Build Commands

- **Run TypeScript Typecheck**:
  ```bash
  npx tsc --noEmit
  ```
- **Run ESLint Code Quality Check**:
  ```bash
  npm run lint
  ```
- **Build Production Bundle**:
  ```bash
  npm run build
  ```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
