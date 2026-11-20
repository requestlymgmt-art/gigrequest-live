import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  AlertCircle,
  Calendar,
  BarChart3
} from 'lucide-react';
import { supabase, DEMO_BAND_ID } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { captureStripePayment, cancelStripePayment } from '../lib/stripe';
import SongArtwork from '../components/common/SongArtwork';
import StartEventModal from '../components/events/StartEventModal';
import EventSummaryModal from '../components/events/EventSummaryModal';
import { useEventTimer } from '../hooks/useEventTimer';
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

  // Live Event state
  const [searchParams] = useSearchParams();
  const [activeEvent, setActiveEvent] = useState(null);
  const [showStartEventModal, setShowStartEventModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryEvent, setSummaryEvent] = useState(null);
  const [summaryRequests, setSummaryRequests] = useState([]);
  const [endingEvent, setEndingEvent] = useState(false);

  // Trigger Start Event modal from navbar navigation or custom event
  useEffect(() => {
    if (searchParams.get('create_event') === '1' || searchParams.get('start_event') === 'true') {
      setShowStartEventModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleOpenModal = () => {
      setShowStartEventModal(true);
    };
    window.addEventListener('open-start-event-modal', handleOpenModal);
    return () => {
      window.removeEventListener('open-start-event-modal', handleOpenModal);
    };
  }, []);

  const effectiveBandId = bandId || profile?.id || DEMO_BAND_ID;
  const timerElapsed = useEventTimer(activeEvent?.started_at);

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
        .in('payment_status', ['authorized', 'paid'])
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

  const fetchActiveEvent = async () => {
    if (!effectiveBandId) return;
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('band_id', effectiveBandId)
        .eq('status', 'live')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setActiveEvent(data);
      } else {
        setActiveEvent(null);
      }
    } catch (err) {
      console.error('Error fetching active event:', err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchActiveEvent();

    // Setup Supabase Realtime listener for requests
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
            // ONLY show and chime if the payment or authorization hold is confirmed!
            if (payload.new.payment_status === 'authorized' || payload.new.payment_status === 'paid') {
              setRequests((prev) => {
                if (prev.some((r) => r.id === payload.new.id)) return prev;
                return [payload.new, ...prev];
              });
              playChime();
              confetti({
                particleCount: 50,
                spread: 60,
                origin: { y: 0.7 },
              });
              toast.success(`🎵 New request: ${payload.new.song_title} from ${payload.new.fan_name}!`, {
                duration: 5000,
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            setRequests((prev) => {
              const exists = prev.some((r) => r.id === payload.new.id);

              // If payment just got confirmed (via webhook or client confirm), add and chime!
              if (!exists && (payload.new.payment_status === 'authorized' || payload.new.payment_status === 'paid')) {
                playChime();
                confetti({
                  particleCount: 50,
                  spread: 60,
                  origin: { y: 0.7 },
                });
                toast.success(`🎵 New request: ${payload.new.song_title} from ${payload.new.fan_name}!`, {
                  duration: 5000,
                });
                return [payload.new, ...prev];
              }

              // If payment failed or was cancelled, remove from view so performer never sees it
              if (payload.new.payment_status === 'failed' || payload.new.payment_status === 'cancelled') {
                return prev.filter((r) => r.id !== payload.new.id);
              }

              return prev.map((r) => (r.id === payload.new.id ? payload.new : r));
            });
          } else if (payload.eventType === 'DELETE') {
            setRequests((prev) => prev.filter((r) => r.id === payload.old.id));
          }
        }
      )
      .subscribe();

    // Listen to events changes
    const eventChannel = supabase
      .channel(`band_events_${effectiveBandId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `band_id=eq.${effectiveBandId}`,
        },
        () => {
          fetchActiveEvent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(eventChannel);
    };
  }, [effectiveBandId]);

  // Start Live Event handler
  const handleStartEvent = async ({ title, venue }) => {
    try {
      const { data: newEv, error } = await supabase
        .from('events')
        .insert({
          band_id: effectiveBandId,
          title: title || 'Live Set',
          venue: venue || '',
          status: 'live',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('profiles')
        .update({ active_event_id: newEv.id, accepting_requests: true })
        .eq('id', effectiveBandId);

      setActiveEvent(newEv);
      setShowStartEventModal(false);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      toast.success(`🎉 Live Event "${newEv.title}" is now LIVE! Fans can now send requests.`);
    } catch (err) {
      console.error('Error starting event:', err);
      toast.error('Could not start event: ' + err.message);
    }
  };

  // End Live Event handler
  const handleEndEvent = async () => {
    if (!activeEvent) return;
    if (!window.confirm(`Are you sure you want to end "${activeEvent.title}"? This will close live requests and show your gig earnings summary.`)) {
      return;
    }

    setEndingEvent(true);
    try {
      const endedAt = new Date().toISOString();
      const { data: updatedEv, error } = await supabase
        .from('events')
        .update({ status: 'ended', ended_at: endedAt })
        .eq('id', activeEvent.id)
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('profiles')
        .update({ active_event_id: null, accepting_requests: false })
        .eq('id', effectiveBandId);

      // Collect requests belonging to this event
      const eventReqs = requests.filter((r) => {
        if (r.event_id && r.event_id === activeEvent.id) return true;
        if (!r.event_id && new Date(r.created_at) >= new Date(activeEvent.started_at)) return true;
        return false;
      });

      setSummaryEvent(updatedEv);
      setSummaryRequests(eventReqs);
      setActiveEvent(null);
      setShowSummaryModal(true);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      toast.success('Live event ended! Here is your gig summary.');
    } catch (err) {
      console.error('Error ending event:', err);
      toast.error('Failed to end event: ' + err.message);
    } finally {
      setEndingEvent(false);
    }
  };

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

      // If declining/rejecting, release authorization hold OR issue full refund so fan is NOT charged!
      if (newStatus === 'declined') {
        if (targetReq?.stripe_payment_id) {
          await cancelStripePayment(targetReq.stripe_payment_id);
        }
        updates.payment_status = 'refunded';
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
        toast('Request declined & payment refunded to fan.', { icon: 'ℹ️' });
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

  // Current Event Requests (empty if no active event, eliminating fake test numbers)
  const currentEventRequests = activeEvent
    ? requests.filter((r) => {
      if (r.event_id && r.event_id === activeEvent.id) return true;
      if (!r.event_id && new Date(r.created_at) >= new Date(activeEvent.started_at)) return true;
      return false;
    })
    : [];

  // KPIs scoped strictly to current event (or $0 if no active event, excluding declined/refunded)
  const capturedRequests = currentEventRequests.filter(
    (r) => r.status !== 'declined' && r.payment_status !== 'refunded' && r.payment_status !== 'cancelled' && r.payment_status === 'paid'
  );
  const heldRequests = currentEventRequests.filter(
    (r) => r.status !== 'declined' && r.payment_status !== 'refunded' && r.payment_status !== 'cancelled' && r.payment_status === 'authorized'
  );

  const capturedEarnings = capturedRequests.reduce(
    (sum, r) => sum + (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0),
    0
  );
  const heldEarnings = heldRequests.reduce(
    (sum, r) => sum + (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0),
    0
  );
  const totalEarnings = capturedEarnings + heldEarnings;

  const queueCount = currentEventRequests.filter(
    (r) => r.status === 'pending' || r.status === 'up_next' || r.status === 'playing'
  ).length;
  const completedCount = currentEventRequests.filter((r) => r.status === 'completed').length;

  // Scoped requests:
  // 'live' and 'completed' tabs strictly scope to current event.
  // 'all' tab shows complete history across events.
  const targetScopeRequests = activeTab === 'all' ? requests : currentEventRequests;

  // Filtered requests
  const filteredRequests = targetScopeRequests.filter((r) => {
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

  // Helper to format date headers for dividing song requests by date
  const formatDateDivider = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const diffDays = Math.round((today - targetDate) / (1000 * 60 * 60 * 24));

    const formattedDateStr = dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });

    if (diffDays === 0) {
      return `Today • ${formattedDateStr}`;
    } else if (diffDays === 1) {
      return `Yesterday • ${formattedDateStr}`;
    } else {
      return formattedDateStr;
    }
  };

  // Sort pinned first in live queue; in history and completed tabs sort by date descending
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (activeTab === 'live') {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
    }
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
        marginBottom: '1.5rem',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span className={activeEvent ? 'live-pulse' : ''} style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeEvent ? '#10b981' : '#64748b' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: activeEvent ? 'var(--accent-emerald)' : 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {activeEvent ? 'Live Gig Queue Active' : 'Gig Queue (Off-Stage)'}
            </span>
          </div>
          <h1 style={{ fontSize: '2rem' }}>
            {profile?.band_name || 'The Groove Collective'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {activeEvent
              ? `Currently taking requests for "${activeEvent.title}"`
              : 'Stage is currently idle. Start a live event to take fan requests.'}
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

          <Link to="/analytics" className="btn btn-outline btn-sm" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399' }}>
            <BarChart3 size={16} />
            <span>Analytics</span>
          </Link>

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
      ) : (!activeEvent && activeTab === 'live') ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', marginBottom: '2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#60a5fa',
            marginBottom: '1rem'
          }}>
            <Radio size={32} />
          </div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.4rem', color: '#fff' }}>
            Stage Is Currently Idle
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
            Fans cannot send song requests while you are off-stage. Start a live event to unlock your setlist, take live requests, and track your gig earnings in real time.
          </p>
          <button
            onClick={() => setShowStartEventModal(true)}
            className="btn btn-primary btn-lg"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              fontWeight: 800,
              padding: '0.85rem 1.75rem',
              gap: '0.55rem',
              boxShadow: '0 4px 20px rgba(6, 182, 212, 0.4)'
            }}
          >
            <Play size={18} fill="currentColor" />
            <span>Start Live Event</span>
          </button>
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
          {sortedRequests.map((req, index) => {
            const isPlaying = req.status === 'playing';
            const isUpNext = req.status === 'up_next';
            const isCompleted = req.status === 'completed';
            const isDeclined = req.status === 'declined';
            const songPrice = Number(req.song_price) || 0;
            const tipAmount = Number(req.tip_amount) || 0;
            const netAmount = songPrice + tipAmount;

            // Check if this request begins a new calendar date
            const reqDate = req.created_at ? new Date(req.created_at) : null;
            const prevReq = index > 0 ? sortedRequests[index - 1] : null;
            const prevReqDate = prevReq?.created_at ? new Date(prevReq.created_at) : null;

            const isNewDateGroup =
              !prevReqDate ||
              !reqDate ||
              reqDate.toDateString() !== prevReqDate.toDateString();

            return (
              <div key={req.id}>
                {/* Visual Date Divider between different calendar days */}
                {isNewDateGroup && reqDate && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    margin: index === 0 ? '0.25rem 0 0.85rem 0' : '1.75rem 0 0.85rem 0'
                  }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.35rem 0.85rem',
                      background: 'rgba(59, 130, 246, 0.14)',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      borderRadius: '9999px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: '#93c5fd',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase'
                    }}>
                      <Calendar size={13} />
                      <span>{formatDateDivider(reqDate)}</span>
                    </div>
                    <div style={{
                      flex: 1,
                      height: '1px',
                      background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.35), rgba(255, 255, 255, 0.05))'
                    }} />
                  </div>
                )}

                <div
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
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                            {new Date(req.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                          <X size={14} /> DECLINED (REFUNDED)
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
              </div>
            );
          })}
        </div>
      )}

      {/* Live Event Control Bar */}
      <div style={{
        background: activeEvent
          ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%)'
          : 'rgba(255, 255, 255, 0.03)',
        border: activeEvent
          ? '1px solid rgba(6, 182, 212, 0.45)'
          : '1px dashed rgba(255, 255, 255, 0.18)',
        borderRadius: '18px',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1.25rem',
        boxShadow: activeEvent ? '0 8px 30px rgba(6, 182, 212, 0.15)' : 'none'
      }}>
        {activeEvent ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34d399',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)'
              }}>
                <Radio size={22} className="live-pulse" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-emerald" style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}>
                    <span className="live-pulse" /> LIVE EVENT ACTIVE
                  </span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fcd34d', fontFamily: 'JetBrains Mono, monospace' }}>
                    ⏱ {timerElapsed}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  {activeEvent.title} {activeEvent.venue ? <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.9rem' }}>• {activeEvent.venue}</span> : ''}
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleEndEvent}
                disabled={endingEvent}
                className="btn btn-outline"
                style={{
                  borderColor: 'rgba(239, 68, 68, 0.5)',
                  color: '#f87171',
                  background: 'rgba(239, 68, 68, 0.1)',
                  fontWeight: 700,
                  padding: '0.65rem 1.25rem',
                  gap: '0.5rem',
                }}
              >
                <X size={16} />
                <span>{endingEvent ? 'Ending Event...' : 'End Event & Get Summary'}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa'
              }}>
                <Play size={20} fill="currentColor" />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                  Stage Is Currently Idle
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  Start a Live Event to begin taking paid requests & tracking gig earnings
                </h3>
              </div>
            </div>

            <button
              onClick={() => setShowStartEventModal(true)}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                fontWeight: 800,
                fontSize: '0.95rem',
                padding: '0.75rem 1.4rem',
                gap: '0.5rem',
                boxShadow: '0 4px 18px rgba(6, 182, 212, 0.35)',
              }}
            >
              <Play size={16} fill="currentColor" />
              <span>Start Live Event</span>
            </button>
          </>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem'
      }}>
        <div className="glass-card" style={{ padding: '1.25rem', borderColor: activeEvent ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Event Confirmed Earnings</span>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.35rem', borderRadius: '8px' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#34d399' }}>
            ${totalEarnings.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {activeEvent
              ? `$${capturedEarnings.toFixed(2)} Captured • $${heldEarnings.toFixed(2)} Held`
              : '$0.00 — Start event to take requests'}
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
            Fulfilled during set
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Gig Duration</span>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.35rem', borderRadius: '8px' }}>
              <Radio size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
            {activeEvent ? timerElapsed : '00:00:00'}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {activeEvent ? `${currentEventRequests.length} requests received` : 'Stage idle'}
          </span>
        </div>
      </div>

      {/* Start Live Event Modal */}
      <StartEventModal
        isOpen={showStartEventModal}
        onClose={() => setShowStartEventModal(false)}
        onStart={handleStartEvent}
      />

      {/* Event Summary Modal */}
      {showSummaryModal && summaryEvent && (
        <EventSummaryModal
          event={summaryEvent}
          requests={summaryRequests}
          onClose={() => {
            setShowSummaryModal(false);
            setSummaryEvent(null);
            fetchRequests();
          }}
          onStartNextEvent={() => {
            setShowSummaryModal(false);
            setSummaryEvent(null);
            setShowStartEventModal(true);
          }}
        />
      )}
    </div>
  );
}
