-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Profiles Table (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Documents Table
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'General',
  file_path text not null,
  file_type text not null,
  file_size bigint not null,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Automatic Profile Creation Trigger on Signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, subscription_tier)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'user',
    'free'
  );
  return new;
end;
$$;

-- Drop trigger if already exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.documents enable row level security;

-- 5. Profiles RLS Policies
create policy "Users can view own profile or admins view all"
  on public.profiles for select
  using (
    auth.uid() = id or 
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can update own profile or admins update any"
  on public.profiles for update
  using (
    auth.uid() = id or 
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- 6. Documents RLS Policies
create policy "Users can view own documents or admins view all"
  on public.documents for select
  using (
    uploaded_by = auth.uid() or 
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can insert own documents"
  on public.documents for insert
  with check (
    uploaded_by = auth.uid()
  );

create policy "Users can update own documents or admins update any"
  on public.documents for update
  using (
    uploaded_by = auth.uid() or 
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can delete own documents or admins delete any"
  on public.documents for delete
  using (
    uploaded_by = auth.uid() or 
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- 7. Supabase Storage Bucket Setup
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage RLS Policies
create policy "Authenticated users can upload documents to storage"
  on storage.objects for insert
  with check (
    bucket_id = 'documents' and 
    auth.role() = 'authenticated'
  );

create policy "Users can read own storage objects or admins read all"
  on storage.objects for select
  using (
    bucket_id = 'documents' and (
      (storage.foldername(name))[1] = auth.uid()::text or
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
  );

create policy "Users can delete own storage objects or admins delete any"
  on storage.objects for delete
  using (
    bucket_id = 'documents' and (
      (storage.foldername(name))[1] = auth.uid()::text or
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
  );
