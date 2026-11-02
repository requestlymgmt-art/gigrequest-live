import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, DEMO_BAND_ID } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Profile fetch exception:', err);
      return null;
    }
  };

  const fetchDemoProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', DEMO_BAND_ID)
        .maybeSingle();

      if (data) {
        setProfile(data);
        setIsDemoMode(true);
      }
    } catch (err) {
      console.error('Demo profile fetch error:', err);
    }
  };

  useEffect(() => {
    // Check initial Supabase session
    const initAuth = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          const prof = await fetchProfile(session.user.id);
          setProfile(prof);
          setIsDemoMode(false);
        } else {
          // Check if user previously activated demo mode in local storage
          const savedDemo = localStorage.getItem('gigrequest_demo_active');
          if (savedDemo === 'true') {
            await fetchDemoProfile();
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          setIsDemoMode(false);
          localStorage.removeItem('gigrequest_demo_active');
          const prof = await fetchProfile(session.user.id);
          setProfile(prof);
        } else if (!isDemoMode) {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    setIsDemoMode(false);
    localStorage.removeItem('gigrequest_demo_active');
    if (data.user) {
      const prof = await fetchProfile(data.user.id);
      setProfile(prof);
    }
    return data;
  };

  const signUp = async (email, password, bandName, slug) => {
    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          band_name: bandName,
          slug: cleanSlug,
        },
      },
    });
    if (error) throw error;

    if (data.user) {
      // Create profile row in Supabase
      const { data: newProfile, error: profError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          band_name: bandName,
          slug: cleanSlug,
          bio: 'Live band taking song requests & tips.',
          genre: 'Live Music',
          accepting_requests: true,
          default_min_tip: 5.00,
          allow_custom_song_requests: true,
          custom_request_price: 10.00,
        })
        .select()
        .single();

      if (profError) {
        console.error('Error creating profile row:', profError);
      } else {
        setProfile(newProfile);
      }
    }
    return data;
  };

  const signOut = async () => {
    localStorage.removeItem('gigrequest_demo_active');
    setIsDemoMode(false);
    setUser(null);
    setProfile(null);
    await supabase.auth.signOut();
  };

  const enterDemoMode = async () => {
    localStorage.setItem('gigrequest_demo_active', 'true');
    await fetchDemoProfile();
  };

  const updateProfile = async (updates) => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
      .select()
      .single();

    if (error) throw error;
    setProfile(data);
    return data;
  };

  const refreshProfile = async () => {
    if (user) {
      const prof = await fetchProfile(user.id);
      setProfile(prof);
    } else if (isDemoMode) {
      await fetchDemoProfile();
    }
  };

  const activeBandId = profile?.id || (isDemoMode ? DEMO_BAND_ID : null);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        bandId: activeBandId,
        loading,
        isDemoMode,
        signIn,
        signUp,
        signOut,
        enterDemoMode,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
