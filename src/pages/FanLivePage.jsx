import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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
import { calculateFeeBreakdown, processStripePayment, getAvailableWallets } from '../lib/stripe';
import SongArtwork from '../components/common/SongArtwork';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

export default function FanLivePage() {
  const { slug } = useParams();
  const effectiveSlug = slug || DEMO_BAND_SLUG;

  const [band, setBand] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');

  // Request modal states
  const [selectedSong, setSelectedSong] = useState(null);
  const [isCustomRequest, setIsCustomRequest] = useState(false);
  const [customSongTitle, setCustomSongTitle] = useState('');
  const [customSongArtist, setCustomSongArtist] = useState('');
  const [tipBoost, setTipBoost] = useState(0);
  const [customTipInput, setCustomTipInput] = useState('');
  const [fanName, setFanName] = useState('');
  const [fanMessage, setFanMessage] = useState('');

  // Payment states
  const [wallets] = useState(() => getAvailableWallets());
  const [processingPayment, setProcessingPayment] = useState(false);
  const [processingMethod, setProcessingMethod] = useState('');
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [activeRequestTrack, setActiveRequestTrack] = useState(null);

  // Direct Tip Modal (without song)
  const [showDirectTipModal, setShowDirectTipModal] = useState(false);
  const [directTipAmount, setDirectTipAmount] = useState(10);

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

  // Realtime subscription for active fan request tracking
  useEffect(() => {
    if (!activeRequestTrack) return;

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
          setActiveRequestTrack(payload.new);
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
    setFanName('');
    setFanMessage('');
  };

  const handleOpenCustomModal = () => {
    setSelectedSong(null);
    setIsCustomRequest(true);
    setCustomSongTitle('');
    setCustomSongArtist('');
    setTipBoost(0);
    setCustomTipInput('');
    setFanName('');
    setFanMessage('');
  };

  // Fee calculation
  const baseSongPrice = isCustomRequest 
    ? (Number(band?.custom_request_price) || 15.00)
    : (Number(selectedSong?.price) || 5.00);

  const effectiveTip = customTipInput ? (parseFloat(customTipInput) || 0) : tipBoost;
  const breakdown = calculateFeeBreakdown(baseSongPrice, effectiveTip);

  // Submit and pay for song request
  const handlePaySongRequest = async (e, chosenMethod = null) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!band) return;

    const method = chosenMethod || (wallets.preferred === 'apple_pay' ? 'apple_pay' : 'google_pay');

    const songTitle = isCustomRequest ? customSongTitle.trim() : selectedSong?.title;
    const songArtist = isCustomRequest ? customSongArtist.trim() : selectedSong?.artist;

    if (!songTitle) {
      toast.error('Please enter the song title');
      return;
    }

    setProcessingPayment(true);
    setProcessingMethod(method);
    try {
      // 1. Process Stripe with transparent breakdown
      const paymentResult = await processStripePayment({
        amount: breakdown.subtotal,
        fanFee: breakdown.fanFee,
        requestlyFee: breakdown.requestlyFee,
        stripeFee: breakdown.stripeFee,
        totalCharged: breakdown.totalCharged,
        bandId: band.id,
        bandStripeAccountId: band.stripe_account_id,
        songTitle,
        fanName: fanName.trim() || 'Anonymous Fan',
        fanMessage: fanMessage.trim(),
        paymentMethod: method,
      });

      // 2. Insert into Supabase requests table
      const { data: newRequest, error: reqError } = await supabase
        .from('requests')
        .insert({
          band_id: band.id,
          song_id: selectedSong?.id || null,
          song_title: songTitle,
          song_artist: songArtist || 'Custom Song',
          fan_name: fanName.trim() || 'Anonymous Fan',
          fan_message: fanMessage.trim(),
          song_price: breakdown.baseAmount,
          tip_amount: breakdown.tipAmount,
          fan_fee: breakdown.fanFee,
          total_paid: breakdown.totalCharged,
          status: 'pending',
          payment_status: 'paid',
          payment_method: method,
          stripe_payment_id: paymentResult.paymentIntentId,
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // Celebrate
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      const label = method === 'apple_pay' ? 'Apple Pay' : method === 'google_pay' ? 'Google Pay' : 'Card';
      toast.success(`${label} payment confirmed! Your request is on the band's screen!`);
      setActiveRequestTrack(newRequest);
      setSelectedSong(null);
      setIsCustomRequest(false);
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Payment failed. Please try again.');
    } finally {
      setProcessingPayment(false);
      setProcessingMethod('');
    }
  };

  // Direct Tip Submission
  const handlePayDirectTip = async (e, chosenMethod = null) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!band) return;

    const method = chosenMethod || (wallets.preferred === 'apple_pay' ? 'apple_pay' : 'google_pay');
    const tipVal = Math.max(1, parseFloat(directTipAmount) || 5);
    const directBreakdown = calculateFeeBreakdown(0, tipVal);

    setProcessingPayment(true);
    setProcessingMethod(method);
    try {
      const paymentResult = await processStripePayment({
        amount: tipVal,
        fanFee: directBreakdown.fanFee,
        requestlyFee: directBreakdown.requestlyFee,
        stripeFee: directBreakdown.stripeFee,
        totalCharged: directBreakdown.totalCharged,
        bandId: band.id,
        bandStripeAccountId: band.stripe_account_id,
        songTitle: 'Direct Musician Tip 💖',
        fanName: fanName.trim() || 'Generous Fan',
        fanMessage: fanMessage.trim(),
        paymentMethod: method,
      });

      await supabase.from('requests').insert({
        band_id: band.id,
        song_title: '💖 Direct Tip to the Band',
        song_artist: 'Thank You!',
        fan_name: fanName.trim() || 'Generous Fan',
        fan_message: fanMessage.trim(),
        song_price: 0,
        tip_amount: tipVal,
        fan_fee: directBreakdown.fanFee,
        total_paid: directBreakdown.totalCharged,
        status: 'completed',
        payment_status: 'paid',
        payment_method: method,
        stripe_payment_id: paymentResult.paymentIntentId,
      });

      confetti({ particleCount: 100, spread: 90, origin: { y: 0.6 } });
      const label = method === 'apple_pay' ? 'Apple Pay' : method === 'google_pay' ? 'Google Pay' : 'Card';
      toast.success(`${label} tip of $${tipVal.toFixed(2)} sent directly to the band!`);
      setShowDirectTipModal(false);
    } catch (err) {
      console.error('Tip payment error:', err);
      toast.error('Payment failed');
    } finally {
      setProcessingPayment(false);
      setProcessingMethod('');
    }
  };

  const isAcceptingRequests = band?.accepting_requests ?? true;

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
          {isAcceptingRequests ? (
            <span className="badge badge-emerald" style={{ padding: '0.35rem 0.85rem' }}>
              <span className="live-pulse" /> ON STAGE • TAKING REQUESTS
            </span>
          ) : (
            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
              ⏸️ SET BREAK • REQUESTS PAUSED
            </span>
          )}
        </div>

        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', marginBottom: '0.25rem' }}>
          {band.band_name}
        </h1>

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
          onClick={() => setShowDirectTipModal(true)}
          className="btn btn-amber btn-lg"
          style={{ width: '100%', fontSize: '1rem', padding: '0.75rem' }}
        >
          <Heart size={18} fill="#fff" />
          <span>Tip the Musicians Directly</span>
        </button>
      </div>

      {/* Active Fan Request Tracker Banner (If fan recently requested a song) */}
      {activeRequestTrack && (
        <div className="glass-card" style={{
          marginBottom: '1.25rem',
          padding: '1.25rem',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(18, 20, 30, 0.95))',
          borderColor: '#10b981',
          boxShadow: '0 0 25px rgba(16, 185, 129, 0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ✓ YOUR REQUEST IS ON STAGE
            </span>
            <button
              onClick={() => setActiveRequestTrack(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          <h3 style={{ fontSize: '1.35rem', color: '#fff', marginBottom: '0.25rem' }}>
            {activeRequestTrack.song_title}
          </h3>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '0.65rem',
            padding: '0.5rem 0.85rem',
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '8px'
          }}>
            <span className="live-pulse" />
            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>
              Status: {activeRequestTrack.status === 'playing' ? '🎸 NOW PLAYING ON STAGE!' : activeRequestTrack.status === 'up_next' ? '⚡ UP NEXT ON STAGE!' : activeRequestTrack.status === 'completed' ? '✅ PLAYED! THANK YOU!' : '⏳ In Band\'s Live Queue'}
            </span>
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

      {/* Song Catalog List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
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
          filteredSongs.map((song) => {
            const price = Number(song.price) || 5;

            return (
              <div
                key={song.id}
                onClick={() => isAcceptingRequests && handleOpenSongModal(song)}
                className="glass-card"
                style={{
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.85rem',
                  cursor: isAcceptingRequests ? 'pointer' : 'not-allowed',
                  opacity: isAcceptingRequests ? 1 : 0.6,
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                  <SongArtwork
                    title={song.title}
                    artist={song.artist}
                    imageUrl={song.image_url}
                    size={48}
                    radius={10}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{
                      fontSize: '1.02rem',
                      color: '#fff',
                      fontWeight: 700,
                      marginBottom: '0.15rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {song.title}
                    </h4>
                    <div style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {song.artist} {song.genre ? `• ${song.genre}` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: '#34d399',
                    background: 'rgba(16, 185, 129, 0.12)',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(16, 185, 129, 0.25)'
                  }}>
                    ${price.toFixed(2)}
                  </span>
                  <div className="btn btn-primary btn-sm" style={{ padding: '0.4rem 0.75rem' }}>
                    <span>Request</span>
                    <ChevronRight size={14} />
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
      )}

      {/* REQUEST & STRIPE CHECKOUT MODAL */}
      {(selectedSong || isCustomRequest) && (
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
                onClick={() => { setSelectedSong(null); setIsCustomRequest(false); }}
                className="btn btn-outline btn-sm"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePaySongRequest}>
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

              {/* Fan Name */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Your Name or Table (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Jessica, Table 4, Birthday Crew"
                  value={fanName}
                  onChange={(e) => setFanName(e.target.value)}
                  className="input-field"
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
                  fontSize: '0.725rem',
                  color: '#94a3b8',
                  marginTop: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  <ShieldCheck size={14} color="#10b981" />
                  <span>100% of song & tip goes to musicians. Fan covers transparent fees.</span>
                </div>
              </div>

              {/* PRIORITY 1-TAP EXPRESS CHECKOUT (APPLE PAY & GOOGLE PAY) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--accent-blue)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: '0.65rem'
                }}>
                  <Zap size={14} fill="currentColor" /> Express 1-Tap Checkout
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {/* Apple Pay Button */}
                  <button
                    type="button"
                    disabled={processingPayment}
                    onClick={(e) => handlePaySongRequest(e, 'apple_pay')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.6rem',
                      width: '100%',
                      background: '#000000',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      padding: '0.85rem 1.25rem',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      cursor: processingPayment ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
                      transition: 'all 0.15s ease',
                      opacity: processingPayment && processingMethod !== 'apple_pay' ? 0.5 : 1,
                    }}
                  >
                    {processingPayment && processingMethod === 'apple_pay' ? (
                      <span>Connecting to Apple Pay...</span>
                    ) : (
                      <>
                        <span style={{ fontSize: '1.35rem', lineHeight: 1 }}></span>
                        <span>Pay with <strong>Apple Pay</strong></span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}>
                          ${breakdown.totalCharged.toFixed(2)}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Google Pay Button */}
                  <button
                    type="button"
                    disabled={processingPayment}
                    onClick={(e) => handlePaySongRequest(e, 'google_pay')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.6rem',
                      width: '100%',
                      background: '#111827',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      padding: '0.85rem 1.25rem',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      cursor: processingPayment ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                      transition: 'all 0.15s ease',
                      opacity: processingPayment && processingMethod !== 'google_pay' ? 0.5 : 1,
                    }}
                  >
                    {processingPayment && processingMethod === 'google_pay' ? (
                      <span>Connecting to Google Pay...</span>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                        </svg>
                        <span>Pay with <strong>Google Pay</strong></span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}>
                          ${breakdown.totalCharged.toFixed(2)}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* OR DIVIDER */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                margin: '1.25rem 0',
                gap: '0.75rem'
              }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  or pay with card
                </span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
              </div>

              {/* Card Form & Pay Button */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  marginBottom: '0.85rem'
                }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      defaultValue="4242 •••• •••• 4242"
                      className="input-field"
                      style={{ fontSize: '0.85rem', letterSpacing: '0.05em', paddingRight: '2.5rem' }}
                      readOnly
                    />
                    <CreditCard size={16} style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input
                      type="text"
                      defaultValue="12 / 28"
                      className="input-field"
                      style={{ fontSize: '0.85rem' }}
                      readOnly
                    />
                    <input
                      type="text"
                      defaultValue="CVC 982"
                      className="input-field"
                      style={{ fontSize: '0.85rem' }}
                      readOnly
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={processingPayment}
                  onClick={(e) => handlePaySongRequest(e, 'card')}
                  className="btn btn-outline btn-lg"
                  style={{
                    width: '100%',
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                    background: 'rgba(255, 255, 255, 0.05)'
                  }}
                >
                  {processingPayment && processingMethod === 'card' ? (
                    <span>Processing Card via Stripe...</span>
                  ) : (
                    <span>Pay ${breakdown.totalCharged.toFixed(2)} with Card</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIRECT TIP MODAL */}
      {showDirectTipModal && (() => {
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

              <form onSubmit={handlePayDirectTip}>
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
                  <label className="label">Your Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="Generous Fan"
                    value={fanName}
                    onChange={(e) => setFanName(e.target.value)}
                    className="input-field"
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

                {/* PRIORITY 1-TAP EXPRESS CHECKOUT FOR TIP */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#f59e0b',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: '0.65rem'
                  }}>
                    <Zap size={14} fill="currentColor" /> Express 1-Tap Tip
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {/* Apple Pay Button */}
                    <button
                      type="button"
                      disabled={processingPayment}
                      onClick={(e) => handlePayDirectTip(e, 'apple_pay')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.6rem',
                        width: '100%',
                        background: '#000000',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '0.85rem 1.25rem',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        cursor: processingPayment ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
                        transition: 'all 0.15s ease',
                        opacity: processingPayment && processingMethod !== 'apple_pay' ? 0.5 : 1,
                      }}
                    >
                      {processingPayment && processingMethod === 'apple_pay' ? (
                        <span>Connecting to Apple Pay...</span>
                      ) : (
                        <>
                          <span style={{ fontSize: '1.35rem', lineHeight: 1 }}></span>
                          <span>Tip with <strong>Apple Pay</strong></span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}>
                            ${liveBreakdown.totalCharged.toFixed(2)}
                          </span>
                        </>
                      )}
                    </button>

                    {/* Google Pay Button */}
                    <button
                      type="button"
                      disabled={processingPayment}
                      onClick={(e) => handlePayDirectTip(e, 'google_pay')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.6rem',
                        width: '100%',
                        background: '#111827',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '0.85rem 1.25rem',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        cursor: processingPayment ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                        transition: 'all 0.15s ease',
                        opacity: processingPayment && processingMethod !== 'google_pay' ? 0.5 : 1,
                      }}
                    >
                      {processingPayment && processingMethod === 'google_pay' ? (
                        <span>Connecting to Google Pay...</span>
                      ) : (
                        <>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                          </svg>
                          <span>Tip with <strong>Google Pay</strong></span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}>
                            ${liveBreakdown.totalCharged.toFixed(2)}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* OR DIVIDER */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '1.25rem 0',
                  gap: '0.75rem'
                }}>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    or tip with card
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
                </div>

                <button
                  type="button"
                  disabled={processingPayment}
                  onClick={(e) => handlePayDirectTip(e, 'card')}
                  className="btn btn-outline btn-lg"
                  style={{
                    width: '100%',
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                    background: 'rgba(255, 255, 255, 0.05)'
                  }}
                >
                  {processingPayment && processingMethod === 'card' ? (
                    <span>Processing Card via Stripe...</span>
                  ) : (
                    <span>Pay ${liveBreakdown.totalCharged.toFixed(2)} with Card</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
