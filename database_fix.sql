-- 1. Allow Users to DELETE their own messages
-- ==========================================
-- FULL DATABASE SETUP SCRIPT FOR SME CONNECT
-- ==========================================

-- 0. Enable UUID extension (Required for ID generation)
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE (Stores User Details)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  role text default 'customer',
  business_name text,
  business_type text,
  location text,
  description text,
  verified boolean default false,
  avatar_url text,
  documents_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- 2. PRODUCTS TABLE
create table if not exists public.products (
  id uuid default uuid_generate_v4() primary key,
  seller_id uuid references public.profiles(id),
  name text not null,
  category text,
  price text,
  description text,
  image_url text,
  status text default 'available',
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.products enable row level security;

create policy "Products are viewable by everyone." on products for select using (true);
create policy "Sellers can insert products." on products for insert with check (auth.uid() = seller_id);
create policy "Sellers can update own products." on products for update using (auth.uid() = seller_id);
create policy "Sellers can delete own products." on products for delete using (auth.uid() = seller_id);

-- 3. MESSAGES TABLE
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references auth.users(id),
  receiver_id uuid references auth.users(id),
  product_id uuid references public.products(id) on delete cascade, -- Auto-delete messages if product is deleted
  product_name text,
  content text,
  image_url text,
  is_read boolean default false,
  reply_to_id uuid references public.messages(id),
  reply_to_name text,
  reply_to_content text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.messages enable row level security;

create policy "Users can view their own messages." on messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Users can insert messages." on messages for insert with check (auth.uid() = sender_id);
create policy "Users can delete their own messages" on messages for delete using (auth.uid() = sender_id);
create policy "Receivers can delete messages" on messages for delete using (auth.uid() = receiver_id);

-- Enable Realtime for Messages (Critical for Chat)
alter publication supabase_realtime add table messages;

-- 4. ORDERS TABLE
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  buyer_id uuid references auth.users(id),
  seller_id uuid references public.profiles(id),
  product_id uuid references public.products(id),
  product_name text,
  price text,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.orders enable row level security;

create policy "Users can create orders" on orders for insert with check (auth.uid() = buyer_id);
create policy "Users can view their own orders" on orders for select using (auth.uid() = buyer_id);
create policy "Sellers can view orders for them" on orders for select using (auth.uid() = seller_id);
create policy "Sellers can update order status" on orders for update using (auth.uid() = seller_id);

-- 5. STORAGE BUCKETS SETUP
-- Product Images
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
create policy "Any user can view product images" on storage.objects for select using ( bucket_id = 'product-images' );
create policy "Authenticated users can upload product images" on storage.objects for insert with check ( bucket_id = 'product-images' and auth.role() = 'authenticated' );

-- Chat Images
insert into storage.buckets (id, name, public) values ('chat-images', 'chat-images', true) on conflict (id) do nothing;
create policy "Users can upload chat images" on storage.objects for insert with check ( bucket_id = 'chat-images' and auth.role() = 'authenticated' );
create policy "Anyone can view chat images" on storage.objects for select using ( bucket_id = 'chat-images' );

-- Business Docs
insert into storage.buckets (id, name, public) values ('business-docs', 'business-docs', true) on conflict (id) do nothing;
create policy "Public can upload docs" on storage.objects for insert with check ( bucket_id = 'business-docs' );
create policy "Public can view docs" on storage.objects for select using ( bucket_id = 'business-docs' );

-- Avatars
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
create policy "Public can upload avatars" on storage.objects for insert with check ( bucket_id = 'avatars' );
create policy "Public can view avatars" on storage.objects for select using ( bucket_id = 'avatars' );