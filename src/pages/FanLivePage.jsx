import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  Music,
  Search,
  Heart,
  DollarSign,
  Sparkles,
  CheckCircle,
  Clock,
  CreditCard,
  Smartphone,
  Radio,
  X,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Zap,
  Lock
} from 'lucide-react';
import { supabase, DEMO_BAND_ID, DEMO_BAND_SLUG } from '../lib/supabase';
import { calculateFeeBreakdown, processStripePayment, getAvailableWallets, createStripeCheckoutRedirect } from '../lib/stripe';
import SongArtwork from '../components/common/SongArtwork';
import SongGenreBadge from '../components/common/SongGenreBadge';
import AlphabetFastScroll from '../components/common/AlphabetFastScroll';
import StripeEmbeddedCheckout from '../components/checkout/StripeEmbeddedCheckout';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

export default function FanLivePage() {
  const { slug } = useParams();
  const effectiveSlug = slug || DEMO_BAND_SLUG;
  const [searchParams] = useSearchParams();

  const [band, setBand] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');

  // Handle Stripe real-money redirect return
  useEffect(() => {
    const isSuccess = searchParams.get('payment_success');
    const songName = searchParams.get('song');
    const isCancelled = searchParams.get('payment_cancelled');
    const reqId = searchParams.get('req_id');
    const sessionId = searchParams.get('session_id');
    const isTip = searchParams.get('is_tip');

    if (isSuccess === 'true') {
      confetti({ particleCount: 120, spread: 85, origin: { y: 0.6 } });
      if (reqId) {
        supabase
          .from('requests')
          .update({
            payment_status: isTip === 'true' ? 'paid' : 'authorized',
            status: isTip === 'true' ? 'completed' : 'pending',
            stripe_payment_id: sessionId || undefined,
          })
          .eq('id', reqId)
          .then(() => {
            if (isTip !== 'true') {
              supabase.from('requests').select('*').eq('id', reqId).maybeSingle().then(({ data: r }) => {
                if (r) updateActiveRequestTrack(r);
              });
            }
          });
      }
      toast.success(
        songName
          ? `🎉 Real Payment Authorized! "${decodeURIComponent(songName)}" is on the band's stage screen!`
          : isTip === 'true'
            ? '🎉 Real Payment Succeeded! Your direct tip was sent to the band!'
            : '🎉 Real Payment Authorized! Your request is on the stage screen!'
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (isCancelled === 'true') {
      if (reqId) {
        supabase.from('requests').delete().eq('id', reqId).then(() => { });
      }
      toast('Payment checkout was cancelled ($0 charged)', { icon: 'ℹ️' });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  // Recent song requests tracking (to prevent accidental duplicate requests within minutes)
  const RECENT_REQUESTS_KEY = `requestly_recent_fan_songs_${effectiveSlug}`;

  const getRecentSongRequest = (title) => {
    if (!title) return null;
    try {
      const raw = localStorage.getItem(RECENT_REQUESTS_KEY);
      if (!raw) return null;
      const list = JSON.parse(raw);
      const now = Date.now();
      const normalized = title.trim().toLowerCase();
      // Look for match within last 3 minutes (180,000 ms)
      return list.find(
        (item) => item.title?.toLowerCase() === normalized && (now - item.timestamp) < 3 * 60 * 1000
      ) || null;
    } catch (e) {
      return null;
    }
  };

  const recordSongRequestSuccess = (title) => {
    if (!title) return;
    try {
      const raw = localStorage.getItem(RECENT_REQUESTS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      const updated = [
        { title: title.trim(), timestamp: now },
        ...list.filter((item) => (now - item.timestamp) < 15 * 60 * 1000),
      ];
      localStorage.setItem(RECENT_REQUESTS_KEY, JSON.stringify(updated.slice(0, 20)));
    } catch (e) {
      // Ignore
    }
  };

  // Request modal states
  const [selectedSong, setSelectedSong] = useState(null);
  const [isCustomRequest, setIsCustomRequest] = useState(false);
  const [customSongTitle, setCustomSongTitle] = useState('');
  const [customSongArtist, setCustomSongArtist] = useState('');
  const [tipBoost, setTipBoost] = useState(0);
  const [customTipInput, setCustomTipInput] = useState('');
  const [fanName, setFanName] = useState(() => {
    try {
      return localStorage.getItem('requestly_fan_name') || '';
    } catch (e) {
      return '';
    }
  });
  const [fanMessage, setFanMessage] = useState('');
  const [requestIdempotencyKey, setRequestIdempotencyKey] = useState('');
  const [repeatWarningSong, setRepeatWarningSong] = useState(null);
  const [nameError, setNameError] = useState(false);

  // Payment states & persistent fan request tracker
  const [wallets] = useState(() => getAvailableWallets());
  const storageKey = `requestly_fan_active_req_${effectiveSlug}`;
  const [activeRequestTrack, setActiveRequestTrack] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const updateActiveRequestTrack = (req) => {
    setActiveRequestTrack(req);
    try {
      if (req) {
        localStorage.setItem(storageKey, JSON.stringify(req));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (e) {
      // Ignore
    }
  };

  // Direct Tip Modal (without song)
  const [showDirectTipModal, setShowDirectTipModal] = useState(false);
  const [directTipAmount, setDirectTipAmount] = useState(10);
  const [activeEvent, setActiveEvent] = useState(null);

  // Fetch band profile & active songs
  const fetchBandData = async () => {
    setLoading(true);
    try {
      // 1. Get band by slug
      let { data: bandData } = await supabase
        .from('profiles')
        .select('*')
        .eq('slug', effectiveSlug)
        .maybeSingle();

      if (!bandData) {
        // Fallback to demo band if slug is 'demo' or matches demo
        const { data: demoBand } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', DEMO_BAND_ID)
          .maybeSingle();
        bandData = demoBand;
      }

      setBand(bandData);

      if (bandData) {
        // Fetch active event
        const { data: eventData } = await supabase
          .from('events')
          .select('*')
          .eq('band_id', bandData.id)
          .eq('status', 'live')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setActiveEvent(eventData || null);

        // 2. Fetch band's active songs
        const { data: songsData } = await supabase
          .from('songs')
          .select('*')
          .eq('band_id', bandData.id)
          .eq('is_active', true)
          .order('title', { ascending: true });

        setSongs(songsData || []);
      }
    } catch (err) {
      console.error('Error loading band:', err);
      toast.error('Could not load band information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBandData();
  }, [effectiveSlug]);

  // Realtime subscription for live events & profile status changes
  useEffect(() => {
    if (!band?.id) return;

    const eventChannel = supabase
      .channel(`fan_events_${band.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `band_id=eq.${band.id}`,
        },
        async () => {
          const { data: ev } = await supabase
            .from('events')
            .select('*')
            .eq('band_id', band.id)
            .eq('status', 'live')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          setActiveEvent(ev || null);
        }
      )
      .subscribe();

    const profileChannel = supabase
      .channel(`fan_profile_${band.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${band.id}`,
        },
        (payload) => {
          setBand((prev) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [band?.id]);

  // Persistent fan request tracking across page refreshes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.id) {
          // Re-fetch latest status from Supabase so refresh always has fresh live data
          supabase
            .from('requests')
            .select('*')
            .eq('id', parsed.id)
            .maybeSingle()
            .then(({ data: freshReq }) => {
              if (freshReq) {
                updateActiveRequestTrack(freshReq);
              }
            });
        }
      }
    } catch (e) {
      // Ignore
    }
  }, [storageKey]);

  // Realtime subscription for active fan request tracking
  useEffect(() => {
    if (!activeRequestTrack?.id) return;

    const channel = supabase
      .channel(`fan_track_${activeRequestTrack.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'requests',
          filter: `id=eq.${activeRequestTrack.id}`,
        },
        (payload) => {
          updateActiveRequestTrack(payload.new);
          if (payload.new.status === 'playing') {
            confetti({ particleCount: 70, spread: 80, origin: { y: 0.5 } });
            toast('🎸 The band is now playing your request!', { icon: '🔥', duration: 6000 });
          } else if (payload.new.status === 'completed') {
            toast.success('Your song request was completed! Thank you!');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRequestTrack?.id]);

  const handleOpenSongModal = (song) => {
    setSelectedSong(song);
    setIsCustomRequest(false);
    setTipBoost(0);
    setCustomTipInput('');
    setNameError(false);
    try {
      const saved = localStorage.getItem('requestly_fan_name');
      if (saved) setFanName(saved);
    } catch (e) {}
    setFanMessage('');
    // New idempotency key for this fresh modal session
    setRequestIdempotencyKey(`${band?.id || 'band'}_song_${song?.id || 'song'}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  };

  const handleOpenCustomModal = () => {
    setSelectedSong(null);
    setIsCustomRequest(true);
    setCustomSongTitle('');
    setCustomSongArtist('');
    setTipBoost(0);
    setCustomTipInput('');
    setNameError(false);
    try {
      const saved = localStorage.getItem('requestly_fan_name');
      if (saved) setFanName(saved);
    } catch (e) {}
    setFanMessage('');
    setRequestIdempotencyKey(`${band?.id || 'band'}_custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  };

  const handleOpenDirectTipModal = () => {
    try {
      const saved = localStorage.getItem('requestly_fan_name');
      if (saved) setFanName(saved);
    } catch (e) {}
    setNameError(false);
    setRequestIdempotencyKey(`${band?.id || 'band'}_tip_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
    setShowDirectTipModal(true);
  };

  // Fee calculation
  const baseSongPrice = isCustomRequest
    ? (Number(band?.custom_request_price) || 15.00)
    : (Number(selectedSong?.price) || 5.00);

  const effectiveTip = customTipInput ? (parseFloat(customTipInput) || 0) : tipBoost;
  const breakdown = calculateFeeBreakdown(baseSongPrice, effectiveTip);

  // Live Event Gating: Fans can only send song requests when a live gig session is active!
  const isLiveEvent = Boolean(activeEvent && band?.accepting_requests !== false);
  const isAcceptingRequests = isLiveEvent;

  const handleSongClick = (song) => {
    if (!isLiveEvent) {
      toast('Live song requests are paused while the band is off-stage. Requests will open when the live set begins!', { icon: 'ℹ️' });
      return;
    }
    // Check if the same fan requested this exact song within the last 3 minutes
    const recent = getRecentSongRequest(song.title);
    if (recent) {
      const minutesAgo = Math.max(1, Math.round((Date.now() - recent.timestamp) / 60000));
      setRepeatWarningSong({
        song,
        title: song.title,
        minutesAgo,
      });
      return;
    }
    handleOpenSongModal(song);
  };

  // Filter songs
  const genres = ['all', ...Array.from(new Set(songs.map((s) => s.genre).filter(Boolean)))];
  const filteredSongs = songs
    .filter((s) => selectedGenre === 'all' || s.genre === selectedGenre)
    .filter((s) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
    });

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <Radio size={32} color="#8b5cf6" style={{ marginBottom: '1rem', animation: 'spin 2s linear infinite' }} />
          <p>Connecting to live stage...</p>
        </div>
      </div>
    );
  }

  if (!band) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '5rem 1rem' }}>
        <h2>Band Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          We couldn't find a live band at <code>/live/{effectiveSlug}</code>.
        </p>
        <Link to="/" className="btn btn-primary">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem 1rem 6rem' }}>
      {/* Band Profile Hero */}
      <div className="glass-card" style={{
        padding: '1.75rem 1.5rem',
        marginBottom: '1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, rgba(23, 26, 38, 0.85) 0%, rgba(15, 17, 26, 0.98) 100%)',
        borderColor: 'rgba(59, 130, 246, 0.35)',
        boxShadow: '0 12px 35px rgba(0,0,0,0.5)',
        position: 'relative'
      }}>
        {/* Band Avatar / Photo */}
        <div style={{
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          margin: '0 auto 1rem',
          overflow: 'hidden',
          border: '3px solid #3b82f6',
          boxShadow: '0 0 20px rgba(59, 130, 246, 0.45)',
          background: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {band.avatar_url ? (
            <img src={band.avatar_url} alt={band.band_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Music size={40} color="#60a5fa" />
          )}
        </div>

        {/* Live Status Pill */}
        <div style={{ marginBottom: '0.65rem' }}>
          {isLiveEvent ? (
            <span className="badge badge-emerald" style={{ padding: '0.35rem 0.85rem' }}>
              <span className="live-pulse" /> ON STAGE • TAKING REQUESTS
            </span>
          ) : (
            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '0.35rem 0.85rem' }}>
              ⏸️ BAND IS OFF-STAGE / BETWEEN SETS
            </span>
          )}
        </div>

        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', marginBottom: '0.25rem' }}>
          {band.band_name}
        </h1>

        {activeEvent && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: '20px',
            padding: '0.3rem 0.85rem',
            color: '#60a5fa',
            fontSize: '0.85rem',
            fontWeight: 700,
            marginBottom: '0.65rem',
          }}>
            <span className="live-pulse" />
            <span>LIVE SET: {activeEvent.title} {activeEvent.venue ? `• ${activeEvent.venue}` : ''}</span>
          </div>
        )}

        {!isLiveEvent && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '0.6rem 0.85rem',
            fontSize: '0.82rem',
            color: '#fca5a5',
            marginTop: '0.4rem',
            marginBottom: '0.75rem',
            textAlign: 'center',
            lineHeight: 1.4,
          }}>
            <span>The band is currently between sets. Song requests will unlock once the live set begins!</span>
          </div>
        )}

        {band.genre && (
          <p style={{ fontSize: '0.875rem', color: '#60a5fa', fontWeight: 600, marginBottom: '0.75rem' }}>
            {band.genre}
          </p>
        )}

        {band.bio && (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
            {band.bio}
          </p>
        )}

        {/* Announcement Banner */}
        {band.announcement_banner && (
          <div style={{
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 0.85rem',
            fontSize: '0.85rem',
            color: '#e2e8f0',
            marginBottom: '1.25rem'
          }}>
            {band.announcement_banner}
          </div>
        )}

        {/* Quick Action: Direct Tip Button */}
        <button
          onClick={handleOpenDirectTipModal}
          className="btn btn-amber btn-lg"
          style={{ width: '100%', fontSize: '1rem', padding: '0.75rem' }}
        >
          <Heart size={18} fill="#fff" />
          <span>Tip the Musicians Directly</span>
        </button>
      </div>

      {/* Active Fan Request Tracker Banner (Persists across page refresh via localStorage) */}
      {activeRequestTrack && (
        <div className="glass-card" style={{
          marginBottom: '1.25rem',
          padding: '1.25rem',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(18, 20, 30, 0.98))',
          borderColor: '#10b981',
          borderWidth: '1.5px',
          boxShadow: '0 0 25px rgba(16, 185, 129, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              ✓ THE BAND HAS GOT YOUR REQUEST!
            </span>
            <button
              onClick={() => updateActiveRequestTrack(null)}
              title="Dismiss tracking"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.2rem' }}
            >
              <X size={18} />
            </button>
          </div>

          <h3 style={{ fontSize: '1.35rem', color: '#fff', marginBottom: '0.2rem', fontWeight: 700 }}>
            {activeRequestTrack.song_title}
          </h3>
          {activeRequestTrack.song_artist && activeRequestTrack.song_artist !== 'Custom Song' && activeRequestTrack.song_artist !== 'Thank You!' && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.45rem' }}>
              by {activeRequestTrack.song_artist}
            </p>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            marginTop: '0.65rem',
            padding: '0.55rem 0.85rem',
            background: 'rgba(0, 0, 0, 0.45)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="live-pulse" />
              <span style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 700 }}>
                Status: {activeRequestTrack.status === 'playing' ? '🎸 NOW PLAYING ON STAGE!' : activeRequestTrack.status === 'up_next' ? '⚡ UP NEXT ON STAGE!' : activeRequestTrack.status === 'completed' ? '✅ PLAYED! THANK YOU!' : '⏳ In Band\'s Live Queue'}
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.45rem' }}>
            💡 Your request stays visible here even if you refresh this page. Status updates live as the band plays!
          </div>
        </div>
      )}

      {/* Setlist Search & Filters */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="text"
            placeholder="Search songs or artists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '2.5rem', fontSize: '0.9rem' }}
          />
        </div>

        {/* Genre Chips */}
        {genres.length > 2 && (
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGenre(g)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid',
                  borderColor: selectedGenre === g ? 'var(--accent-blue)' : 'var(--border-subtle)',
                  background: selectedGenre === g ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                  color: selectedGenre === g ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  textTransform: 'capitalize'
                }}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Song Catalog List with Alphabet Fast Scroll */}
      <div
        id="song-list-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          marginBottom: '1.5rem',
          position: 'relative',
          paddingLeft: filteredSongs.length >= 6 ? '1.35rem' : '0',
          transition: 'padding-left 0.2s ease',
        }}
      >
        {/* Fast Alphabetical Cursor on Left Side (Active only while viewing songs) */}
        <AlphabetFastScroll
          songs={filteredSongs}
          side="left"
          offset={110}
          containerId="song-list-container"
        />

        {filteredSongs.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              No matching songs found in the live setlist.
            </p>
            {band.allow_custom_song_requests && (
              <button onClick={handleOpenCustomModal} className="btn btn-primary btn-sm">
                Request a Custom Song
              </button>
            )}
          </div>
        ) : (
          filteredSongs.map((song, index) => {
            const price = Number(song.price) || 5;
            const letter = (song.title || '').trim().charAt(0).toUpperCase();
            const groupLetter = /[A-Z]/.test(letter) ? letter : '#';
            const prevSong = index > 0 ? filteredSongs[index - 1] : null;
            const prevLetter = prevSong ? (prevSong.title || '').trim().charAt(0).toUpperCase() : '';
            const prevGroup = /[A-Z]/.test(prevLetter) ? prevLetter : '#';
            const isFirstOfGroup = index === 0 || groupLetter !== prevGroup;

            return (
              <div key={song.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {/* Alphabetical Section Divider */}
                {isFirstOfGroup && (
                  <div
                    id={`letter-anchor-${groupLetter}`}
                    data-letter-group={groupLetter}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.65rem 0.25rem 0.15rem',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: '#60a5fa',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '6px',
                      padding: '0.1rem 0.5rem',
                      fontSize: '0.75rem',
                      lineHeight: 1.2
                    }}>
                      {groupLetter}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(59, 130, 246, 0.25)' }} />
                  </div>
                )}

                <div
                  onClick={() => handleSongClick(song)}
                  className="glass-card"
                  style={{
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.85rem',
                    cursor: isLiveEvent ? 'pointer' : 'default',
                    opacity: isLiveEvent ? 1 : 0.75,
                    transition: 'transform 0.15s ease, border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <SongArtwork
                      title={song.title}
                      artist={song.artist}
                      imageUrl={song.image_url}
                      size={48}
                      radius={10}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{
                        fontSize: '0.98rem',
                        color: '#fff',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                        lineHeight: 1.3,
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                      }}>
                        {song.title}
                      </h4>
                      <div style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.35rem',
                        rowGap: '0.15rem',
                        lineHeight: 1.3,
                      }}>
                        <span style={{ fontWeight: 500 }}>{song.artist}</span>
                        <SongGenreBadge genre={song.genre} title={song.title} artist={song.artist} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, marginLeft: '0.35rem' }}>
                    <div
                      className={isLiveEvent ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
                      style={{
                        padding: '0.45rem 0.75rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        whiteSpace: 'nowrap',
                        borderRadius: '8px',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        boxShadow: isLiveEvent ? '0 2px 8px rgba(59, 130, 246, 0.35)' : 'none',
                        color: isLiveEvent ? '#fff' : 'var(--text-muted)',
                        borderColor: isLiveEvent ? 'transparent' : 'rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      <span>${price.toFixed(2)}</span>
                      <span style={{ opacity: 0.75, fontSize: '0.75rem', fontWeight: 600 }}>
                        {isLiveEvent ? '• Request' : '• Off-Stage'}
                      </span>
                      <ChevronRight size={13} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Custom Song Request Option (If band allows) */}
      {band.allow_custom_song_requests && isAcceptingRequests && (
        <div
          onClick={handleOpenCustomModal}
          className="glass-card"
          style={{
            padding: '1.25rem',
            textAlign: 'center',
            border: '1px dashed var(--accent-blue)',
            background: 'rgba(59, 130, 246, 0.05)',
            cursor: 'pointer'
          }}
        >
          <Sparkles size={20} color="#60a5fa" style={{ marginBottom: '0.35rem' }} />
          <h4 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.2rem' }}>
            Can't find your song in the list?
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
            Request any custom song for the band to play or jam!
          </p>
          <span className="badge badge-blue">
            Custom Request • ${(Number(band.custom_request_price) || 15).toFixed(2)}
          </span>
        </div>
      )
      }

      {/* REPEAT REQUEST WARNING MODAL ("You just requested this, send again?") */}
      {repeatWarningSong && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '420px', textAlign: 'center', padding: '1.75rem 1.5rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.1rem'
            }}>
              <Clock size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 800 }}>
              You Just Requested This Song
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              You requested <strong style={{ color: '#fff' }}>"{repeatWarningSong.title}"</strong> {repeatWarningSong.minutesAgo === 1 ? 'about a minute' : `${repeatWarningSong.minutesAgo} minutes`} ago. Would you like to request it again?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setRepeatWarningSong(null)}
                className="btn btn-outline"
                style={{ width: '100%', padding: '0.75rem', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = repeatWarningSong.song;
                  setRepeatWarningSong(null);
                  handleOpenSongModal(s);
                }}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontWeight: 700 }}
              >
                Yes, Send Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST & STRIPE CHECKOUT MODAL */}
      {
        (selectedSong || isCustomRequest) && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                  {!isCustomRequest && (
                    <SongArtwork
                      title={selectedSong.title}
                      artist={selectedSong.artist}
                      imageUrl={selectedSong.image_url}
                      size={56}
                      radius={12}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="badge badge-blue" style={{ marginBottom: '0.35rem' }}>
                      {isCustomRequest ? 'CUSTOM SONG REQUEST' : 'SONG REQUEST'}
                    </span>
                    <h3 style={{ fontSize: '1.35rem', lineHeight: 1.2, wordBreak: 'break-word' }}>
                      {isCustomRequest ? 'Request Any Song' : selectedSong.title}
                    </h3>
                    {!isCustomRequest && selectedSong.artist && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                        by {selectedSong.artist}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedSong(null); setIsCustomRequest(false); setRequestIdempotencyKey(''); }}
                  className="btn btn-outline btn-sm"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={(e) => e.preventDefault()}>
                {/* If custom request, input fields for title & artist */}
                {isCustomRequest && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label className="label">Song Title *</label>
                    <input
                      type="text"
                      placeholder="Enter song title..."
                      value={customSongTitle}
                      onChange={(e) => setCustomSongTitle(e.target.value)}
                      className="input-field"
                      required
                    />
                    {customSongTitle.trim() && getRecentSongRequest(customSongTitle) && (
                      <div style={{
                        fontSize: '0.8rem',
                        color: '#f59e0b',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '6px',
                        padding: '0.45rem 0.65rem',
                        marginTop: '0.4rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}>
                        <Clock size={14} />
                        <span>You just requested "{customSongTitle.trim()}" a couple of minutes ago.</span>
                      </div>
                    )}
                    <label className="label" style={{ marginTop: '0.5rem' }}>Artist / Band</label>
                    <input
                      type="text"
                      placeholder="e.g. Journey, Beatles..."
                      value={customSongArtist}
                      onChange={(e) => setCustomSongArtist(e.target.value)}
                      className="input-field"
                    />
                  </div>
                )}

                {/* Tip Boost Selector */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Add an Extra Tip for the Band (Optional)</span>
                    <span style={{ color: '#10b981' }}>+${effectiveTip.toFixed(2)}</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {[0, 3, 5, 10].map((amount) => (
                      <button
                        type="button"
                        key={amount}
                        onClick={() => { setTipBoost(amount); setCustomTipInput(''); }}
                        style={{
                          padding: '0.55rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid',
                          borderColor: (!customTipInput && tipBoost === amount) ? 'var(--accent-blue)' : 'var(--border-subtle)',
                          background: (!customTipInput && tipBoost === amount) ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        {amount === 0 ? '$0' : `+$${amount}`}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    placeholder="Or enter custom tip amount..."
                    value={customTipInput}
                    onChange={(e) => setCustomTipInput(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.85rem' }}
                    min="0"
                  />
                </div>

                {/* Fan Name - REQUIRED */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="label" style={{ marginBottom: 0 }}>
                      Your Name or Table <span style={{ color: nameError && !fanName.trim() ? '#ef4444' : 'var(--text-muted)', fontWeight: nameError && !fanName.trim() ? 700 : 400, transition: 'color 0.15s ease' }}>(Required)</span>
                    </label>
                    {nameError && !fanName.trim() && (
                      <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                        Please enter your name or table
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Jessica, Table 4, Birthday Crew"
                    value={fanName}
                    onChange={(e) => {
                      setFanName(e.target.value);
                      if (nameError) setNameError(false);
                      try {
                        localStorage.setItem('requestly_fan_name', e.target.value);
                      } catch (err) {}
                    }}
                    className="input-field"
                    style={{
                      borderColor: nameError && !fanName.trim() ? '#ef4444' : undefined,
                      background: nameError && !fanName.trim() ? 'rgba(239, 68, 68, 0.05)' : undefined,
                    }}
                    required
                  />
                </div>

                {/* Shoutout Message */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="label">Shoutout Message / Dedication (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Tell the band who this is for or send love..."
                    value={fanMessage}
                    onChange={(e) => setFanMessage(e.target.value)}
                    className="input-field"
                    style={{ resize: 'none' }}
                  />
                </div>

                {/* Transparent Fee Breakdown with Requestly Fee & Stripe Fee */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    <span>Song Request:</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>${breakdown.baseAmount.toFixed(2)}</span>
                  </div>
                  {breakdown.tipAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      <span>Extra Musician Tip:</span>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>+${breakdown.tipAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {breakdown.requestlyFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        Requestly Platform Fee ({breakdown.subtotal > 20 ? '10%' : '$2 flat'}):
                      </span>
                      <span style={{ color: '#60a5fa', fontWeight: 600 }}>+${breakdown.requestlyFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Stripe Card Processing:
                    </span>
                    <span style={{ color: 'var(--text-dim)' }}>+${breakdown.stripeFee.toFixed(2)}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    paddingTop: '0.5rem',
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    color: '#fff'
                  }}>
                    <span>Total Charged:</span>
                    <span style={{ color: '#34d399' }}>${breakdown.totalCharged.toFixed(2)}</span>
                  </div>

                  <div style={{
                    fontSize: '0.74rem',
                    color: '#93c5fd',
                    marginTop: '0.75rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.45rem',
                    background: 'rgba(59, 130, 246, 0.1)',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    lineHeight: 1.4
                  }}>
                    <ShieldCheck size={16} color="#60a5fa" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span><strong>Direct Musician Payout:</strong> 100% of your song request & tip goes directly to the performers. If the band cannot play your request, your payment is refunded immediately.</span>
                  </div>
                </div>

                {/* EMBEDDED STRIPE CHECKOUT: NATIVE APPLE PAY, GOOGLE PAY & CARDS */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <StripeEmbeddedCheckout
                    amount={breakdown.totalCharged}
                    artistNet={breakdown.subtotal}
                    requestlyFee={breakdown.requestlyFee}
                    fanFee={breakdown.fanFee}
                    stripeFee={breakdown.stripeFee}
                    tipAmount={breakdown.tipAmount}
                    songPrice={breakdown.baseAmount}
                    songTitle={isCustomRequest ? customSongTitle.trim() : (selectedSong?.title || 'Song Request')}
                    songArtist={isCustomRequest ? customSongArtist.trim() : (selectedSong?.artist || '')}
                    fanName={fanName.trim()}
                    fanMessage={fanMessage.trim()}
                    bandId={band.id}
                    bandStripeAccountId={band.stripe_account_id}
                    slug={effectiveSlug}
                    isDirectTip={false}
                    eventId={activeEvent?.id || null}
                    idempotencyKey={requestIdempotencyKey}
                    onNameValidationError={() => setNameError(true)}
                    onSuccess={(createdRequest) => {
                      const completedTitle = isCustomRequest ? customSongTitle.trim() : (selectedSong?.title || '');
                      if (completedTitle) recordSongRequestSuccess(completedTitle);
                      setSelectedSong(null);
                      setIsCustomRequest(false);
                      setFanMessage('');
                      setRequestIdempotencyKey('');
                      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
                      toast.success('🎉 Song request submitted with Apple Pay / Card!');
                      if (createdRequest) {
                        updateActiveRequestTrack(createdRequest);
                      }
                    }}
                    onCancel={() => {
                      setSelectedSong(null);
                      setIsCustomRequest(false);
                      setRequestIdempotencyKey('');
                    }}
                  />
                </div>
              </form>
            </div >
          </div >
        )
      }

      {/* DIRECT TIP MODAL */}
      {
        showDirectTipModal && (() => {
          const liveTipVal = Math.max(1, parseFloat(directTipAmount) || 5);
          const liveBreakdown = calculateFeeBreakdown(0, liveTipVal);

          return (
            <div className="modal-overlay">
              <div className="modal-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <span className="badge badge-amber" style={{ marginBottom: '0.35rem' }}>
                      DIRECT MUSICIAN TIP
                    </span>
                    <h3 style={{ fontSize: '1.4rem' }}>Tip {band.band_name}</h3>
                  </div>
                  <button onClick={() => setShowDirectTipModal(false)} className="btn btn-outline btn-sm">
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={(e) => e.preventDefault()}>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="label">Choose Tip Amount ($)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      {[5, 10, 20, 50].map((val) => (
                        <button
                          type="button"
                          key={val}
                          onClick={() => setDirectTipAmount(val)}
                          style={{
                            padding: '0.65rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid',
                            borderColor: directTipAmount === val ? '#f59e0b' : 'var(--border-subtle)',
                            background: directTipAmount === val ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: '1rem',
                            cursor: 'pointer'
                          }}
                        >
                          ${val}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      placeholder="Or enter custom amount..."
                      value={directTipAmount}
                      onChange={(e) => setDirectTipAmount(e.target.value)}
                      className="input-field"
                      min="1"
                    />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label className="label" style={{ marginBottom: 0 }}>
                        Your Name <span style={{ color: nameError && !fanName.trim() ? '#ef4444' : 'var(--text-muted)', fontWeight: nameError && !fanName.trim() ? 700 : 400, transition: 'color 0.15s ease' }}>(Required)</span>
                      </label>
                      {nameError && !fanName.trim() && (
                        <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                          Please enter your name
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Jessica, Table 4, Generous Fan"
                      value={fanName}
                      onChange={(e) => {
                        setFanName(e.target.value);
                        if (nameError) setNameError(false);
                        try {
                          localStorage.setItem('requestly_fan_name', e.target.value);
                        } catch (err) {}
                      }}
                      className="input-field"
                      style={{
                        borderColor: nameError && !fanName.trim() ? '#ef4444' : undefined,
                        background: nameError && !fanName.trim() ? 'rgba(239, 68, 68, 0.05)' : undefined,
                      }}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="label">Message to the Band (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="You guys rock!"
                      value={fanMessage}
                      onChange={(e) => setFanMessage(e.target.value)}
                      className="input-field"
                      style={{ resize: 'none' }}
                    />
                  </div>

                  {/* Transparent Fee Breakdown */}
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    marginBottom: '1.25rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      <span>Musician Tip:</span>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>${liveBreakdown.tipAmount.toFixed(2)}</span>
                    </div>
                    {liveBreakdown.requestlyFee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        <span>Requestly Platform Fee ({liveBreakdown.subtotal > 20 ? '10%' : '$2 flat'}):</span>
                        <span style={{ color: '#60a5fa', fontWeight: 600 }}>+${liveBreakdown.requestlyFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      <span>Stripe Card Processing:</span>
                      <span style={{ color: 'var(--text-dim)' }}>+${liveBreakdown.stripeFee.toFixed(2)}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                      paddingTop: '0.5rem',
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: '#fff'
                    }}>
                      <span>Total Charged:</span>
                      <span style={{ color: '#34d399' }}>${liveBreakdown.totalCharged.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* EMBEDDED STRIPE CHECKOUT FOR TIP */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <StripeEmbeddedCheckout
                      amount={liveBreakdown.totalCharged}
                      artistNet={liveTipVal}
                      requestlyFee={liveBreakdown.requestlyFee}
                      fanFee={liveBreakdown.fanFee}
                      stripeFee={liveBreakdown.stripeFee}
                      tipAmount={liveTipVal}
                      songPrice={0}
                      songTitle="💖 Direct Tip to the Band"
                      songArtist="Thank You!"
                      fanName={fanName.trim()}
                      fanMessage={fanMessage.trim()}
                      bandId={band.id}
                      bandStripeAccountId={band.stripe_account_id}
                      slug={effectiveSlug}
                      isDirectTip={true}
                      eventId={activeEvent?.id || null}
                      idempotencyKey={requestIdempotencyKey}
                      onNameValidationError={() => setNameError(true)}
                      onSuccess={(tipReq) => {
                        setShowDirectTipModal(false);
                        setFanMessage('');
                        setRequestIdempotencyKey('');
                        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
                        toast.success('🎉 Tip sent directly to the band! Thank you!');
                        if (tipReq) {
                          updateActiveRequestTrack(tipReq);
                        }
                      }}
                      onCancel={() => {
                        setShowDirectTipModal(false);
                        setRequestIdempotencyKey('');
                      }}
                    />
                  </div>
                </form>
              </div>
            </div>
          );
        })()
      }
    </div >
  );
}
