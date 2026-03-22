-- 1. Allow Users to DELETE their own messages
create policy "Users can delete their own messages"
on public.messages for delete
using ( auth.uid() = sender_id );

-- 2. Allow Sellers (receivers) to DELETE messages in their inbox
create policy "Receivers can delete messages"
on public.messages for delete
using ( auth.uid() = receiver_id );

-- 3. Fix Product Deletion (Cascade Delete)
-- This automatically deletes related messages when a product is deleted
-- preventing the "Foreign Key Constraint" error.

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_product_id_fkey;

ALTER TABLE public.messages
ADD CONSTRAINT messages_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES public.products(id)
    ON DELETE CASCADE;

-- Now, when you delete a product, all inquiries for it vanish automatically.

-- 4. Create Orders Table for Shopping Cart
create table public.orders (
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

-- 5. Enable Realtime for Messages (Critical for WhatsApp-like chat)
alter publication supabase_realtime add table messages;

-- 6. Add Read Receipts (Track delivered/read status)
alter table public.messages add column is_read boolean default false;

-- 7. Add Image Support to Messages
alter table public.messages add column image_url text;

-- 8. Create Storage Bucket for Chat Images (Run this in SQL Editor or create via Dashboard)
-- insert into storage.buckets (id, name, public) values ('chat-images', 'chat-images', true);

-- Policy to allow authenticated users to upload chat images
-- create policy "Users can upload chat images" on storage.objects for insert with check ( bucket_id = 'chat-images' and auth.role() = 'authenticated' );