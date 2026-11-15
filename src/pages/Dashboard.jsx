import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Radio, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  Play, 
  Check, 
  X, 
  Pin, 
  Volume2, 
  VolumeX, 
  QrCode, 
  Tv, 
  Search, 
  RefreshCw,
  Sparkles,
  Heart,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { supabase, DEMO_BAND_ID } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { captureStripePayment, cancelStripePayment } from '../lib/stripe';
import SongArtwork from '../components/common/SongArtwork';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { profile, bandId, updateProfile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('live'); // 'live', 'completed', 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [decliningId, setDecliningId] = useState(null);

  const effectiveBandId = bandId || profile?.id || DEMO_BAND_ID;

  // Sound chime synthesizer using Web Audio API
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log('Audio chime error:', e);
    }
  };

  const fetchRequests = async () => {
    if (!effectiveBandId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('band_id', effectiveBandId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
      toast.error('Could not load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Setup Supabase Realtime listener
    const channel = supabase
      .channel(`band_requests_${effectiveBandId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `band_id=eq.${effectiveBandId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRequests((prev) => [payload.new, ...prev]);
            playChime();
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.7 },
            });
            toast.success(`🎵 New request: ${payload.new.song_title} from ${payload.new.fan_name}!`, {
              duration: 5000,
            });
          } else if (payload.eventType === 'UPDATE') {
            setRequests((prev) =>
              prev.map((r) => (r.id === payload.new.id ? payload.new : r))
            );
          } else if (payload.eventType === 'DELETE') {
            setRequests((prev) => prev.filter((r) => r.id === payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveBandId]);

  // Update request status with automatic payment capture on accept and hold cancellation on decline
  const handleUpdateStatus = async (requestId, newStatus) => {
    setUpdatingId(requestId);
    try {
      const targetReq = requests.find((r) => r.id === requestId);
      const updates = { status: newStatus };
      if (newStatus === 'playing') {
        updates.played_at = new Date().toISOString();
      }

      // If accepting (playing or up_next), capture the pre-authorized hold so fan is charged!
      if ((newStatus === 'playing' || newStatus === 'up_next') && targetReq?.payment_status === 'authorized') {
        if (targetReq.stripe_payment_id) {
          await captureStripePayment(targetReq.stripe_payment_id);
        }
        updates.payment_status = 'paid';
      }

      // If declining/rejecting, release authorization hold immediately so fan is NEVER charged!
      if (newStatus === 'declined' && targetReq?.payment_status === 'authorized') {
        if (targetReq.stripe_payment_id) {
          await cancelStripePayment(targetReq.stripe_payment_id);
        }
        updates.payment_status = 'cancelled';
      }

      const { error } = await supabase
        .from('requests')
        .update(updates)
        .eq('id', requestId);

      if (error) throw error;

      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, ...updates } : r))
      );

      if (newStatus === 'playing') {
        toast('🎸 Now Playing!', { icon: '🔥' });
      } else if (newStatus === 'completed') {
        toast.success('Marked as played!');
      } else if (newStatus === 'declined') {
        toast('Request declined. Fan was not charged.', { icon: 'ℹ️' });
      }
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleTogglePin = async (request) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ is_pinned: !request.is_pinned })
        .eq('id', request.id);

      if (error) throw error;

      setRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, is_pinned: !r.is_pinned } : r))
      );
    } catch (err) {
      toast.error('Could not pin request');
    }
  };

  // KPIs
  const paidRequests = requests.filter((r) => r.payment_status === 'paid');
  const totalEarnings = paidRequests.reduce(
    (sum, r) => sum + (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0),
    0
  );
  const queueCount = requests.filter(
    (r) => r.status === 'pending' || r.status === 'up_next' || r.status === 'playing'
  ).length;
  const completedCount = requests.filter((r) => r.status === 'completed').length;

  // Filtered requests
  const filteredRequests = requests.filter((r) => {
    if (activeTab === 'live') {
      return r.status === 'pending' || r.status === 'up_next' || r.status === 'playing';
    }
    if (activeTab === 'completed') {
      return r.status === 'completed';
    }
    return true;
  }).filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.song_title?.toLowerCase().includes(q) ||
      r.fan_name?.toLowerCase().includes(q) ||
      r.fan_message?.toLowerCase().includes(q)
    );
  });

  // Sort pinned first
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className="container" style={{ padding: '2rem 1.25rem 5rem' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1.25rem',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span className="live-pulse" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Live Gig Queue
            </span>
          </div>
          <h1 style={{ fontSize: '2rem' }}>
            {profile?.band_name || 'The Groove Collective'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Live incoming requests update automatically via Supabase Realtime.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="btn btn-outline btn-sm"
            title={soundEnabled ? 'Mute new request chime' : 'Enable new request chime'}
          >
            {soundEnabled ? <Volume2 size={16} color="#10b981" /> : <VolumeX size={16} />}
            <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          <Link to="/stage-mode" className="btn btn-outline btn-sm">
            <Tv size={16} color="#3b82f6" />
            <span>Stage Mode</span>
          </Link>

          <Link to="/qr-code" className="btn btn-primary btn-sm">
            <QrCode size={16} />
            <span>Show QR Sign</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem'
      }}>
        <div className="glass-card" style={{ padding: '1.25rem', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tonight's Net Earnings</span>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.35rem', borderRadius: '8px' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#34d399' }}>
            ${totalEarnings.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            100% net to band (Fan covered Stripe fees)
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Queue</span>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '0.35rem', borderRadius: '8px' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff' }}>
            {queueCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Waiting to be played
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Songs Played</span>
            <div style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', padding: '0.35rem', borderRadius: '8px' }}>
              <CheckCircle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff' }}>
            {completedCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Requests fulfilled tonight
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Requests</span>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.35rem', borderRadius: '8px' }}>
              <Radio size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff' }}>
            {requests.length}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Total gig submissions
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Tabs */}
        <div style={{
          display: 'inline-flex',
          background: 'rgba(255, 255, 255, 0.04)',
          padding: '0.3rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            onClick={() => setActiveTab('live')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'live' ? 'var(--accent-blue)' : 'transparent',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Live Queue ({queueCount})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'completed' ? 'var(--accent-blue)' : 'transparent',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'all' ? 'var(--accent-blue)' : 'transparent',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            All History ({requests.length})
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="text"
            placeholder="Search by song, fan, or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '2.5rem', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Requests Feed */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spin" style={{ marginBottom: '1rem' }} />
          <p>Connecting to live stage queue...</p>
        </div>
      ) : sortedRequests.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Radio size={40} color="#3b82f6" style={{ marginBottom: '1rem', opacity: 0.7 }} />
          <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>No Requests in this View</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', marginInline: 'auto', marginBottom: '1.5rem' }}>
            {activeTab === 'live' 
              ? 'Your live queue is currently empty. Make sure fans can see your stage QR code!'
              : 'No records found matching your filters.'}
          </p>
          <Link to="/qr-code" className="btn btn-primary btn-sm">
            <QrCode size={16} />
            <span>Open Gig QR Code</span>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sortedRequests.map((req) => {
            const isPlaying = req.status === 'playing';
            const isUpNext = req.status === 'up_next';
            const isCompleted = req.status === 'completed';
            const isDeclined = req.status === 'declined';
            const songPrice = Number(req.song_price) || 0;
            const tipAmount = Number(req.tip_amount) || 0;
            const netAmount = songPrice + tipAmount;

            return (
              <div
                key={req.id}
                className="glass-card"
                style={{
                  padding: '1.5rem',
                  borderColor: isPlaying 
                    ? 'rgba(16, 185, 129, 0.6)' 
                    : isUpNext 
                    ? 'rgba(245, 158, 11, 0.5)' 
                    : req.is_pinned 
                    ? 'rgba(59, 130, 246, 0.55)' 
                    : 'var(--border-subtle)',
                  background: isPlaying 
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(18, 20, 30, 0.95))' 
                    : isUpNext
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(18, 20, 30, 0.95))'
                    : 'var(--bg-card)',
                  boxShadow: isPlaying ? '0 0 25px rgba(16, 185, 129, 0.2)' : 'none'
                }}
              >
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  {/* Song Artwork & Fan Details */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: '1 1 300px' }}>
                    <SongArtwork
                      title={req.song_title}
                      artist={req.song_artist}
                      size={54}
                      radius={10}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        {isPlaying && (
                          <span className="badge badge-emerald">
                            <span className="live-pulse" /> NOW PLAYING
                          </span>
                        )}
                        {isUpNext && (
                          <span className="badge badge-amber">
                            <Clock size={12} /> UP NEXT
                          </span>
                        )}
                        {isCompleted && (
                          <span className="badge badge-cyan">
                            <CheckCircle size={12} /> COMPLETED
                          </span>
                        )}
                        {isDeclined && (
                          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                            DECLINED
                          </span>
                        )}
                        {req.is_pinned && (
                          <span className="badge badge-blue">
                            <Pin size={12} /> PINNED
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '0.2rem' }}>
                        {req.song_title}
                      </h3>
                      {req.song_artist && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                          by {req.song_artist}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#60a5fa', fontSize: '0.9rem', fontWeight: 600 }}>
                        <Heart size={14} /> Requested by: {req.fan_name || 'Anonymous Fan'}
                      </div>
                    </div>
                  </div>

                  {/* Financials Pill */}
                  <div style={{
                    textAlign: 'right',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    padding: '0.65rem 1rem',
                    borderRadius: 'var(--radius-md)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Song ${songPrice.toFixed(2)} {tipAmount > 0 ? `+ $${tipAmount.toFixed(2)} Tip` : ''}
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399' }}>
                      +${netAmount.toFixed(2)}
                    </div>
                    {(req.payment_status === 'paid' || req.payment_status === 'cancelled') && (
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem', marginTop: '0.2rem' }}>
                        {req.payment_status === 'cancelled' ? (
                          <span style={{ color: '#f87171' }}>Not Charged ✕</span>
                        ) : req.payment_method === 'apple_pay' ? (
                          <span style={{ color: '#10b981' }}> Apple Pay ✓</span>
                        ) : req.payment_method === 'google_pay' ? (
                          <span style={{ color: '#10b981' }}>G Pay ✓</span>
                        ) : (
                          <span style={{ color: '#10b981' }}>Card Paid ✓</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fan Shoutout Message */}
                {req.fan_message && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    borderLeft: '3px solid #3b82f6',
                    padding: '0.75rem 1rem',
                    borderRadius: '0 8px 8px 0',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem'
                  }}>
                    <MessageSquare size={16} color="#60a5fa" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ fontSize: '0.95rem', color: '#f1f5f9', fontStyle: 'italic', lineHeight: 1.5 }}>
                      "{req.fan_message}"
                    </p>
                  </div>
                )}

                {/* Stage Action Controls: Only Accept or Decline */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Incoming/Pending: Only Accept or Decline */}
                    {(req.status === 'pending' || req.status === 'up_next') && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'playing')}
                          disabled={updatingId === req.id}
                          className="btn btn-emerald btn-sm"
                          style={{ padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.92rem', gap: '0.45rem' }}
                        >
                          <Check size={16} />
                          <span>Accept</span>
                        </button>

                        {decliningId === req.id ? (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.45)',
                            padding: '0.4rem 0.85rem',
                            borderRadius: 'var(--radius-md)',
                            animation: 'fadeIn 0.15s ease-in-out',
                            flexWrap: 'wrap'
                          }}>
                            <span style={{ fontSize: '0.825rem', color: '#fecaca', fontWeight: 600 }}>
                              Are you sure you’d like to reject the request?
                            </span>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                onClick={() => {
                                  setDecliningId(null);
                                  handleUpdateStatus(req.id, 'declined');
                                }}
                                disabled={updatingId === req.id}
                                style={{
                                  background: '#ef4444',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '0.25rem 0.75rem',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDecliningId(null)}
                                style={{
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  color: '#fff',
                                  border: '1px solid rgba(255, 255, 255, 0.2)',
                                  borderRadius: '6px',
                                  padding: '0.25rem 0.75rem',
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                  cursor: 'pointer'
                                }}
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDecliningId(req.id)}
                            disabled={updatingId === req.id}
                            className="btn btn-outline btn-sm"
                            style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171', padding: '0.55rem 1.15rem', fontWeight: 700, fontSize: '0.92rem', gap: '0.45rem' }}
                          >
                            <X size={16} />
                            <span>Decline</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* Once accepted & actively playing */}
                    {req.status === 'playing' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-emerald" style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}>
                          <span className="live-pulse" /> NOW PLAYING ON STAGE
                        </span>
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'completed')}
                          disabled={updatingId === req.id}
                          className="btn btn-outline btn-sm"
                          style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)', fontWeight: 600 }}
                        >
                          <Check size={14} />
                          <span>Mark Played ✓</span>
                        </button>
                      </div>
                    )}

                    {/* Completed */}
                    {req.status === 'completed' && (
                      <span className="badge badge-cyan" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
                        <CheckCircle size={14} /> COMPLETED
                      </span>
                    )}

                    {/* Declined */}
                    {req.status === 'declined' && (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
                        <X size={14} /> DECLINED (NOT CHARGED)
                      </span>
                    )}
                  </div>

                  {req.status !== 'pending' && (
                    <button
                      onClick={() => handleTogglePin(req)}
                      className="btn btn-outline btn-sm"
                      style={{ color: req.is_pinned ? '#3b82f6' : 'var(--text-dim)' }}
                      title={req.is_pinned ? 'Unpin request' : 'Pin to top of stage list'}
                    >
                      <Pin size={14} />
                      <span>{req.is_pinned ? 'Unpin' : 'Pin'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
