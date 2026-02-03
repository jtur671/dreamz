-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  reading_count integer default 0,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'premium')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Dreams table
create table if not exists dreams (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  dream_text text not null,
  mood text,
  emotions text[],
  reading jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone
);

-- Create index for faster queries
create index if not exists dreams_user_id_idx on dreams(user_id);
create index if not exists dreams_created_at_idx on dreams(created_at desc);

-- Row Level Security
alter table profiles enable row level security;
alter table dreams enable row level security;

-- Profiles policies: users can only see/edit their own profile
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Dreams policies: users can only access their own dreams
create policy "Users can view own dreams"
  on dreams for select
  using (auth.uid() = user_id);

create policy "Users can insert own dreams"
  on dreams for insert
  with check (auth.uid() = user_id);

create policy "Users can update own dreams"
  on dreams for update
  using (auth.uid() = user_id);

create policy "Users can delete own dreams"
  on dreams for delete
  using (auth.uid() = user_id);

-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to auto-create profile
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at_column();

create trigger update_dreams_updated_at
  before update on dreams
  for each row execute procedure update_updated_at_column();
