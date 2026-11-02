import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://szcsiadugzhlfgoirkfw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Y3NpYWR1Z3pobGZnb2lya2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1ODg0NDMsImV4cCI6MjEwOTE2NDQ0M30.44sSbnyZt_7kBIawD8woT_2NKujtqbLo5gt1BMHjwVI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const DEMO_BAND_ID = 'a0000000-0000-0000-0000-000000000001';
export const DEMO_BAND_SLUG = 'groove-collective';
