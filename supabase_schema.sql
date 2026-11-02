-- Supabase Schema for Live Music Song Request & Tipping Platform

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  band_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  bio TEXT DEFAULT '',
  genre TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  currency TEXT DEFAULT 'USD',
  default_min_tip NUMERIC(10,2) DEFAULT 5.00,
  allow_custom_song_requests BOOLEAN DEFAULT TRUE,
  custom_request_price NUMERIC(10,2) DEFAULT 10.00,
  accepting_requests BOOLEAN DEFAULT TRUE,
  stripe_publishable_key TEXT DEFAULT '',
  stripe_account_id TEXT DEFAULT '',
  stripe_connected BOOLEAN DEFAULT FALSE,
  venmo_handle TEXT DEFAULT '',
  cashapp_handle TEXT DEFAULT '',
  instagram_handle TEXT DEFAULT '',
  announcement_banner TEXT DEFAULT '🎵 Welcome! Scan, choose a song from our live setlist, and make a request with your message!',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  genre TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  is_active BOOLEAN DEFAULT TRUE,
  note TEXT DEFAULT '',
  times_requested INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  song_title TEXT NOT NULL,
  song_artist TEXT DEFAULT '',
  fan_name TEXT DEFAULT 'Anonymous Fan',
  fan_message TEXT DEFAULT '',
  song_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  fan_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'paid',
  payment_method TEXT DEFAULT 'stripe',
  stripe_payment_id TEXT DEFAULT '',
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  played_at TIMESTAMPTZ
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public profiles are viewable by everyone') THEN
    CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Active songs are viewable by everyone') THEN
    CREATE POLICY "Active songs are viewable by everyone" ON public.songs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Band owners can insert their own songs') THEN
    CREATE POLICY "Band owners can insert their own songs" ON public.songs FOR INSERT WITH CHECK (auth.uid() = band_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Band owners can update their own songs') THEN
    CREATE POLICY "Band owners can update their own songs" ON public.songs FOR UPDATE USING (auth.uid() = band_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Band owners can delete their own songs') THEN
    CREATE POLICY "Band owners can delete their own songs" ON public.songs FOR DELETE USING (auth.uid() = band_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Band owners and fans can view requests') THEN
    CREATE POLICY "Band owners and fans can view requests" ON public.requests FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can insert requests') THEN
    CREATE POLICY "Anyone can insert requests" ON public.requests FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Band owners can update requests') THEN
    CREATE POLICY "Band owners can update requests" ON public.requests FOR UPDATE USING (auth.uid() = band_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Band owners can delete requests') THEN
    CREATE POLICY "Band owners can delete requests" ON public.requests FOR DELETE USING (auth.uid() = band_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
