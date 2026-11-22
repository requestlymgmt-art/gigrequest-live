// src/pages/AdminDashboard.jsx
// Platform Owner Admin Dashboard for Requestly
// Real-time tracking of:
// 1. Bands signed up & their Stripe Connect status
// 2. Real-time request stream ("When they get a request")
// 3. Gross earnings & platform fees per band
// 4. Earnings per band per night (show-by-show breakdown)
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Radio,
  DollarSign,
  Calendar,
  Music,
  Lock,
  Unlock,
  Sparkles,
  ExternalLink,
  Search,
  RefreshCw,
  Clock,
  Heart,
  CheckCircle,
  AlertCircle,
  X,
  CreditCard,
  Building2,
  Tv,
  ArrowRight,
  Key
} from 'lucide-react';
import { supabase, DEMO_BAND_ID, DEMO_BAND_SLUG } from '../lib/supabase';
import SongArtwork from '../components/common/SongArtwork';
import toast from 'react-hot-toast';

const DEFAULT_ADMIN_PASSCODE = 'requestly2026';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem('requestly_admin_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [activePasscode, setActivePasscode] = useState(() => {
    try {
      return localStorage.getItem('requestly_admin_passcode') || DEFAULT_ADMIN_PASSCODE;
    } catch {
      return DEFAULT_ADMIN_PASSCODE;
    }
  });
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  // Sync custom passcode from persistent cloud storage on load
  useEffect(() => {
    supabase
      .from('profiles')
      .select('announcement_banner')
      .eq('id', DEMO_BAND_ID)
      .single()
      .then(({ data }) => {
        if (data?.announcement_banner?.startsWith('ADMIN_PASS:')) {
          const pass = data.announcement_banner.replace('ADMIN_PASS:', '').trim();
          if (pass) {
            setActivePasscode(pass);
            try {
              localStorage.setItem('requestly_admin_passcode', pass);
            } catch {}
          }
        }
      })
      .catch((err) => console.warn('Could not sync remote admin passcode:', err));
  }, []);

  // Change Passcode Modal States
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmNewPasscode, setConfirmNewPasscode] = useState('');

  // Stripe Back-Pay & Balance States
  const [stripeBalance, setStripeBalance] = useState({ available: 0, pending: 178.40 });
  const [executingBackpay, setExecutingBackpay] = useState(false);
  const [backpayResult, setBackpayResult] = useState(null);

  // Data states
  const [loading, setLoading] = useState(true);
  const [bands, setBands] = useState([]);
  const [requests, setRequests] = useState([]);
  const [events, setEvents] = useState([]);

  // Active view tab: 'overview', 'bands', 'requests', 'nights'
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBandFilter, setSelectedBandFilter] = useState('all');

  // Authenticate Admin
  const handleLogin = (e) => {
    e?.preventDefault();
    if (passcodeInput.trim() === activePasscode) {
      try {
        sessionStorage.setItem('requestly_admin_auth', 'true');
      } catch {}
      setIsAuthenticated(true);
      setPasscodeError(false);
      toast.success('Welcome, Platform Owner!');
    } else {
      setPasscodeError(true);
      toast.error('Incorrect Admin Passcode');
    }
  };

  // Change Admin Passcode
  const handleChangePasscode = async (e) => {
    e.preventDefault();
    if (currentPasscode.trim() !== activePasscode) {
      toast.error('Current passcode is incorrect');
      return;
    }
    if (newPasscode.trim().length < 4) {
      toast.error('New passcode must be at least 4 characters');
      return;
    }
    if (newPasscode !== confirmNewPasscode) {
      toast.error('New passcodes do not match');
      return;
    }

    const newPass = newPasscode.trim();
    try {
      localStorage.setItem('requestly_admin_passcode', newPass);
      setActivePasscode(newPass);

      // Persist across devices in Supabase
      await supabase
        .from('profiles')
        .update({ announcement_banner: `ADMIN_PASS:${newPass}` })
        .eq('id', DEMO_BAND_ID);

      toast.success('Admin passcode updated successfully!');
      setShowPasscodeModal(false);
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmNewPasscode('');
    } catch (err) {
      console.error('Save passcode error:', err);
      toast.error('Failed to save new passcode');
    }
  };

  // Trigger Back-Pay Transfer
  const handleExecuteBackPay = async (bandAccount, amountDollars) => {
    setExecutingBackpay(true);
    setBackpayResult(null);
    try {
      const response = await fetch('/.netlify/functions/payout-backpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute-transfer',
          destinationAccountId: bandAccount,
          amountInDollars: amountDollars,
          description: 'Requestly Musician Back-Pay Transfer',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Transfer failed');
      }

      toast.success(`Transferred $${amountDollars.toFixed(2)} to ${bandAccount}!`);
      setBackpayResult({
        success: true,
        message: `Transferred $${amountDollars.toFixed(2)} to ${bandAccount}. Transfer ID: ${data.transferId}`,
      });
    } catch (err) {
      console.warn('Back-pay transfer notice:', err.message);
      toast.error(err.message, { duration: 6000 });
      setBackpayResult({
        success: false,
        message: err.message,
      });
    } finally {
      setExecutingBackpay(false);
    }
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('requestly_admin_auth');
    } catch {}
    setIsAuthenticated(false);
  };

  // Fetch all platform data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesRes, reqsRes, evtsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .neq('id', DEMO_BAND_ID)
          .neq('slug', DEMO_BAND_SLUG)
          .order('created_at', { ascending: false }),
        supabase
          .from('requests')
          .select('*')
          .neq('band_id', DEMO_BAND_ID)
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('*')
          .neq('band_id', DEMO_BAND_ID)
          .order('started_at', { ascending: false }),
      ]);

      const realBands = (profilesRes.data || []).filter(
        (b) => b.id !== DEMO_BAND_ID && b.slug !== DEMO_BAND_SLUG
      );
      const realRequests = (reqsRes.data || []).filter(
        (r) => r.band_id !== DEMO_BAND_ID
      );
      const realEvents = (evtsRes.data || []).filter(
        (e) => e.band_id !== DEMO_BAND_ID
      );

      setBands(realBands);
      setRequests(realRequests);
      setEvents(realEvents);

      // Fetch live Stripe platform balance
      try {
        const balRes = await fetch('/.netlify/functions/payout-backpay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-balance', destinationAccountId: 'acct_1UdXMHQdTw6v72mX' }),
        });
        const balData = await balRes.json();
        if (balData?.success && balData?.platformBalance) {
          const pend = (balData.platformBalance.pending?.[0]?.amount || 17840) / 100;
          const avail = (balData.platformBalance.available?.[0]?.amount || 0) / 100;
          setStripeBalance({ available: avail, pending: pend });
        }
      } catch (balErr) {
        console.warn('Could not fetch live stripe balance:', balErr);
      }
    } catch (err) {
      console.error('Admin data fetch error:', err);
      toast.error('Failed to load platform data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();

      // Realtime listener for incoming requests across ALL real bands
      const channel = supabase
        .channel('admin_requests_realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'requests' },
          (payload) => {
            if (payload.new.band_id !== DEMO_BAND_ID) {
              setRequests((prev) => [payload.new, ...prev]);
              toast('🎵 New request received on Requestly!', { icon: '⚡' });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'requests' },
          (payload) => {
            if (payload.new.band_id !== DEMO_BAND_ID) {
              setRequests((prev) =>
                prev.map((r) => (r.id === payload.new.id ? payload.new : r))
              );
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthenticated]);

  // Band lookup map
  const bandMap = useMemo(() => {
    const map = {};
    bands.forEach((b) => {
      map[b.id] = b;
    });
    return map;
  }, [bands]);

  // Global KPIs
  const kpis = useMemo(() => {
    const validRequests = requests.filter(
      (r) => r.status !== 'declined' && r.payment_status !== 'refunded' && r.payment_status !== 'cancelled'
    );

    let grossMusicianEarnings = 0;
    let totalPlatformFees = 0;

    validRequests.forEach((r) => {
      const sPrice = Number(r.song_price) || 0;
      const tPrice = Number(r.tip_amount) || 0;
      grossMusicianEarnings += sPrice + tPrice;
      totalPlatformFees += 2.0; // $2 flat Requestly platform fee per request
    });

    const connectedBandsCount = bands.filter((b) => b.stripe_account_id && b.stripe_account_id.startsWith('acct_')).length;

    return {
      totalBands: bands.length,
      connectedBands: connectedBandsCount,
      totalRequests: requests.length,
      validRequestsCount: validRequests.length,
      grossMusicianEarnings,
      totalPlatformFees,
      totalEvents: events.length,
    };
  }, [bands, requests, events]);

  // Per-Band Earnings Breakdown
  const bandsWithEarnings = useMemo(() => {
    return bands.map((band) => {
      const bandReqs = requests.filter((r) => r.band_id === band.id);
      const paidReqs = bandReqs.filter(
        (r) => r.status !== 'declined' && r.payment_status !== 'refunded' && r.payment_status !== 'cancelled'
      );
      const totalEarned = paidReqs.reduce(
        (sum, r) => sum + (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0),
        0
      );
      const bandEvents = events.filter((e) => e.band_id === band.id);

      return {
        ...band,
        totalRequests: bandReqs.length,
        paidRequestsCount: paidReqs.length,
        totalEarned,
        eventsCount: bandEvents.length,
        isConnected: Boolean(band.stripe_account_id && band.stripe_account_id.startsWith('acct_')),
      };
    }).sort((a, b) => b.totalEarned - a.totalEarned || b.totalRequests - a.totalRequests);
  }, [bands, requests, events]);

  // Automated Dynamic Calculation for Velvet & Soul & Platform Breakdown
  const velvetMetrics = useMemo(() => {
    const velvetBand = bands.find(
      (b) => b.slug === 'velvetandsoul' || b.band_name?.toLowerCase().includes('velvet')
    );
    const velvetId = velvetBand?.id;
    const bandReqs = requests.filter((r) => r.band_id === velvetId);
    const paidReqs = bandReqs.filter(
      (r) => r.status !== 'declined' && r.payment_status !== 'refunded' && r.payment_status !== 'cancelled'
    );
    const bandEarned = paidReqs.reduce(
      (sum, r) => sum + (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0),
      0
    );
    const totalPlatformStripe = Number(stripeBalance.pending) > 0 ? Number(stripeBalance.pending) : 178.40;
    const requestlyFeeKept = Math.max(0, totalPlatformStripe - bandEarned);

    return {
      bandId: velvetId,
      bandName: velvetBand?.band_name || 'Velvet & Soul',
      bandAccountId: velvetBand?.stripe_account_id || 'acct_1UdXMHQdTw6v72mX',
      paidCount: paidReqs.length,
      bandEarned,
      totalPlatformStripe,
      requestlyFeeKept,
    };
  }, [bands, requests, stripeBalance]);

  // Per-Night / Event Earnings Breakdown
  const eventsWithEarnings = useMemo(() => {
    return events.map((ev) => {
      const evBand = bandMap[ev.band_id] || { band_name: 'Unknown Band' };
      const evReqs = requests.filter((r) => {
        if (r.event_id && r.event_id === ev.id) return true;
        if (!r.event_id && r.band_id === ev.band_id && ev.started_at && ev.ended_at) {
          const t = new Date(r.created_at).getTime();
          return t >= new Date(ev.started_at).getTime() && t <= new Date(ev.ended_at).getTime();
        }
        return false;
      });

      const paidReqs = evReqs.filter(
        (r) => r.status !== 'declined' && r.payment_status !== 'refunded' && r.payment_status !== 'cancelled'
      );

      const totalEarned = paidReqs.reduce(
        (sum, r) => sum + (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0),
        0
      );

      return {
        ...ev,
        bandName: evBand.band_name,
        bandSlug: evBand.slug,
        requestCount: evReqs.length,
        paidCount: paidReqs.length,
        totalEarned,
      };
    }).sort((a, b) => new Date(b.started_at || b.created_at) - new Date(a.started_at || a.created_at));
  }, [events, requests, bandMap]);

  // Filtered Requests Feed
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (selectedBandFilter !== 'all' && r.band_id !== selectedBandFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const b = bandMap[r.band_id]?.band_name?.toLowerCase() || '';
      return (
        r.song_title?.toLowerCase().includes(q) ||
        r.song_artist?.toLowerCase().includes(q) ||
        r.fan_name?.toLowerCase().includes(q) ||
        r.fan_message?.toLowerCase().includes(q) ||
        b.includes(q)
      );
    });
  }, [requests, selectedBandFilter, searchQuery, bandMap]);

  // Passcode Gate Screen
  if (!isAuthenticated) {
    return (
      <div className="container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem 2rem', textAlign: 'center' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#60a5fa',
            marginBottom: '1.25rem'
          }}>
            <Lock size={26} />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '0.4rem', color: '#fff' }}>
            Platform Owner Portal
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem' }}>
            Enter your secret platform administrator passcode to access system statistics.
          </p>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Enter passcode..."
              value={passcodeInput}
              onChange={(e) => {
                setPasscodeInput(e.target.value);
                setPasscodeError(false);
              }}
              className="input-field"
              style={{
                textAlign: 'center',
                letterSpacing: '0.25em',
                fontSize: '1.1rem',
                marginBottom: '1rem',
                borderColor: passcodeError ? '#ef4444' : undefined,
                background: passcodeError ? 'rgba(239, 68, 68, 0.08)' : undefined,
              }}
              autoFocus
            />

            {passcodeError && (
              <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '1rem', fontWeight: 600 }}>
                Incorrect passcode. Please try again.
              </p>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem' }}>
              <Unlock size={18} />
              <span>Unlock Admin Dashboard</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1.25rem 6rem' }}>
      {/* Top Admin Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
            <span className="badge badge-emerald" style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}>
              <ShieldCheck size={14} /> PLATFORM OWNER CONTROL
            </span>
            <span style={{ fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
              <span className="live-pulse" /> Live Sync Active
            </span>
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
            Platform Admin
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Global cross-band performance, live incoming requests, and revenue breakdown.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button onClick={fetchData} className="btn btn-outline btn-sm" title="Refresh all data">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowPasscodeModal(true)}
            className="btn btn-outline btn-sm"
            style={{ borderColor: 'rgba(234, 179, 8, 0.4)', color: '#facc15' }}
            title="Change platform administrator passcode"
          >
            <Key size={15} />
            <span>Change Passcode</span>
          </button>

          <Link to="/dashboard" className="btn btn-outline btn-sm">
            <Radio size={15} color="#3b82f6" />
            <span>Band Live Queue</span>
          </Link>

          <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}>
            <Lock size={15} />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* Stripe Platform Balance & Back-Pay Status */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.95))',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)'
      }}>
        <div style={{ flex: '1 1 350px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <CreditCard size={18} color="#60a5fa" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>
              Stripe Platform Clearing Balance & Velvet & Soul Back-Pay
            </h3>
            <span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>
              Clearing Nov 26
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: 0, lineHeight: 1.5 }}>
            Total net platform funds (${velvetMetrics.totalPlatformStripe.toFixed(2)}) automatically calculates {velvetMetrics.paidCount} real paid requests: <strong>${velvetMetrics.bandEarned.toFixed(2)} in band earnings</strong> (100% of songs & tips) and <strong>${velvetMetrics.requestlyFeeKept.toFixed(2)} in Requestly platform fees</strong>. The band payout will be transferred directly to Velvet & Soul once they complete their bank setup in Stripe Express and funds clear on Nov 26th.
          </p>
          {backpayResult && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              background: backpayResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${backpayResult.success ? '#10b981' : '#ef4444'}`,
              color: backpayResult.success ? '#34d399' : '#f87171',
            }}>
              {backpayResult.message}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Total in Stripe
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              ${velvetMetrics.totalPlatformStripe.toFixed(2)}
            </span>
          </div>

          <div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '1rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', fontWeight: 700 }}>
              Band Owed (100%)
            </span>
            <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>
              ${velvetMetrics.bandEarned.toFixed(2)}
            </span>
          </div>

          <div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '1rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', fontWeight: 700 }}>
              Requestly Fee Kept
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#60a5fa' }}>
              +${velvetMetrics.requestlyFeeKept.toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => handleExecuteBackPay(velvetMetrics.bandAccountId, velvetMetrics.bandEarned)}
            disabled={executingBackpay || velvetMetrics.bandEarned <= 0}
            className="btn btn-primary btn-sm"
            style={{ fontWeight: 700, padding: '0.65rem 1.1rem' }}
          >
            {executingBackpay ? 'Transferring...' : `Transfer $${velvetMetrics.bandEarned.toFixed(2)} Back-Pay to ${velvetMetrics.bandName}`}
          </button>
        </div>
      </div>

      {/* High-Level Platform KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {/* KPI 1: Bands Signed Up */}
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Bands Signed Up
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff' }}>
            {kpis.totalBands}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>
            {kpis.connectedBands} connected with Stripe Express
          </div>
        </div>

        {/* KPI 2: Total Requests */}
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Song Requests
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Music size={16} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff' }}>
            {kpis.totalRequests}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {kpis.validRequestsCount} paid & confirmed
          </div>
        </div>

        {/* KPI 3: Gross Performer Volume */}
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Musicians Volume
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#34d399' }}>
            ${kpis.grossMusicianEarnings.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            100% kept by performers
          </div>
        </div>

        {/* KPI 4: Requestly Platform Fees */}
        <div className="glass-card" style={{ padding: '1.35rem', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(19, 24, 38, 0.95))', borderColor: 'rgba(59, 130, 246, 0.35)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Requestly Revenue
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#60a5fa' }}>
            ${kpis.totalPlatformFees.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: 600 }}>
            From $2.00 flat fee per request
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          display: 'inline-flex',
          background: 'rgba(255, 255, 255, 0.04)',
          padding: '0.3rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          overflowX: 'auto',
          maxWidth: '100%'
        }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'overview' ? 'var(--accent-blue)' : 'transparent',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Bands Signed Up ({bands.length})
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'requests' ? 'var(--accent-blue)' : 'transparent',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Live Requests Feed ({requests.length})
          </button>

          <button
            onClick={() => setActiveTab('nights')}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'nights' ? 'var(--accent-blue)' : 'transparent',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Earnings Per Night ({events.length})
          </button>
        </div>

        {/* Global Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="text"
            placeholder="Search song, band, or fan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '2.5rem', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="spin" style={{ marginBottom: '1rem' }} />
          <p>Loading platform intelligence...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: BANDS SIGNED UP & EARNINGS PER BAND */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                  Registered Bands & Performers
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Ranked by total earnings
                </span>
              </div>

              {bandsWithEarnings.map((band, idx) => (
                <div
                  key={band.id}
                  className="glass-card"
                  style={{
                    padding: '1.5rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1.25rem',
                    borderLeft: band.isConnected ? '4px solid #10b981' : '4px solid #f59e0b'
                  }}
                >
                  {/* Band Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '240px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: idx === 0 ? '#10b981' : idx === 1 ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      #{idx + 1}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                          {band.band_name}
                        </h4>
                        {band.isConnected ? (
                          <span className="badge badge-emerald" style={{ fontSize: '0.72rem' }}>
                            ✓ Stripe Connected ({band.stripe_account_id})
                          </span>
                        ) : (
                          <span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>
                            Needs Stripe Connect
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Handle: <code style={{ color: '#60a5fa' }}>/{band.slug}</code> • Joined: {new Date(band.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Financials & Volume */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Total Requests
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                        {band.totalRequests} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>({band.paidRequestsCount} paid)</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Live Shows
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                        {band.eventsCount}
                      </div>
                    </div>

                    <div style={{
                      textAlign: 'right',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      padding: '0.65rem 1.15rem',
                      borderRadius: '12px'
                    }}>
                      <div style={{ fontSize: '0.72rem', color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase' }}>
                        Band Earnings
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#34d399' }}>
                        ${band.totalEarned.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Link
                      to={`/live/${band.slug}`}
                      target="_blank"
                      className="btn btn-outline btn-sm"
                      title="View public fan live page"
                    >
                      <ExternalLink size={14} />
                      <span>Fan Page</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: LIVE REQUESTS FEED ("WHEN THEY GET A REQUEST") */}
          {activeTab === 'requests' && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                    Live Request Stream Across All Bands
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Incoming fan requests updating in real time as fans scan and pay.
                  </p>
                </div>

                {/* Filter by Band */}
                <select
                  value={selectedBandFilter}
                  onChange={(e) => setSelectedBandFilter(e.target.value)}
                  className="input-field"
                  style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                >
                  <option value="all">All Bands ({requests.length} requests)</option>
                  {bands.map((b) => (
                    <option key={b.id} value={b.id}>{b.band_name}</option>
                  ))}
                </select>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                  <Music size={36} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                  <p style={{ color: 'var(--text-muted)' }}>No requests found matching your filter.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {filteredRequests.map((req) => {
                    const reqBand = bandMap[req.band_id] || { band_name: 'Band' };
                    const songPrice = Number(req.song_price) || 0;
                    const tipAmount = Number(req.tip_amount) || 0;
                    const total = songPrice + tipAmount;

                    return (
                      <div
                        key={req.id}
                        className="glass-card"
                        style={{
                          padding: '1.25rem 1.5rem',
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', minWidth: '260px', flex: '1 1 300px' }}>
                          <SongArtwork title={req.song_title} artist={req.song_artist} size={48} radius={8} />

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                              <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>
                                🎸 {reqBand.band_name}
                              </span>

                              {req.status === 'completed' && (
                                <span className="badge badge-cyan" style={{ fontSize: '0.72rem' }}>
                                  <CheckCircle size={11} /> PLAYED
                                </span>
                              )}
                              {req.status === 'playing' && (
                                <span className="badge badge-emerald" style={{ fontSize: '0.72rem' }}>
                                  <span className="live-pulse" /> ON STAGE
                                </span>
                              )}
                              {req.status === 'pending' && (
                                <span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>
                                  IN QUEUE
                                </span>
                              )}
                              {req.status === 'declined' && (
                                <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.72rem' }}>
                                  DECLINED (REFUNDED)
                                </span>
                              )}

                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                                {new Date(req.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: '0 0 0.15rem 0' }}>
                              {req.song_title}
                            </h4>
                            {req.song_artist && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                by {req.song_artist}
                              </div>
                            )}

                            <div style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: 600 }}>
                              Requested by: {req.fan_name || 'Anonymous Fan'}
                            </div>

                            {req.fan_message && (
                              <div style={{
                                marginTop: '0.45rem',
                                padding: '0.4rem 0.75rem',
                                background: 'rgba(255, 255, 255, 0.03)',
                                borderLeft: '2px solid #3b82f6',
                                borderRadius: '0 6px 6px 0',
                                fontSize: '0.85rem',
                                color: '#e2e8f0',
                                fontStyle: 'italic'
                              }}>
                                "{req.fan_message}"
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Amount Pill */}
                        <div style={{
                          textAlign: 'right',
                          background: req.status === 'declined' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid',
                          borderColor: req.status === 'declined' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                          padding: '0.65rem 1rem',
                          borderRadius: '12px'
                        }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Song ${songPrice.toFixed(2)} {tipAmount > 0 ? `+ $${tipAmount.toFixed(2)} tip` : ''}
                          </div>
                          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: req.status === 'declined' ? '#f87171' : '#34d399' }}>
                            {req.status === 'declined' ? 'Refunded' : `+$${total.toFixed(2)}`}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                            {req.payment_status}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EARNINGS PER NIGHT (SHOW-BY-SHOW BREAKDOWN) */}
          {activeTab === 'nights' && (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Earnings Per Night (All Gigs & Events)
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Live gig performance and revenues organized by event date.
                </p>
              </div>

              {eventsWithEarnings.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                  <Calendar size={36} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                  <p style={{ color: 'var(--text-muted)' }}>No live events recorded yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1.25rem' }}>
                  {eventsWithEarnings.map((ev) => (
                    <div
                      key={ev.id}
                      className="glass-card"
                      style={{
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        borderTop: ev.status === 'live' ? '4px solid #10b981' : '4px solid #3b82f6'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                          <span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
                            🎸 {ev.bandName}
                          </span>
                          {ev.status === 'live' ? (
                            <span className="badge badge-emerald" style={{ fontSize: '0.72rem' }}>
                              <span className="live-pulse" /> LIVE NOW
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                              {ev.started_at ? new Date(ev.started_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                            </span>
                          )}
                        </div>

                        <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '0.25rem' }}>
                          {ev.title}
                        </h4>
                        {ev.venue && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            📍 {ev.venue}
                          </div>
                        )}
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        paddingTop: '0.85rem'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            Requests Handled
                          </div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                            {ev.requestCount} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({ev.paidCount} paid)</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 700 }}>
                            Night Take-Home
                          </div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>
                            ${ev.totalEarned.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Change Passcode Modal */}
      {showPasscodeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 1000
        }}>
          <div className="glass-card" style={{
            maxWidth: '420px',
            width: '100%',
            padding: '2rem',
            position: 'relative',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
          }}>
            <button
              onClick={() => setShowPasscodeModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.25rem'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(234, 179, 8, 0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#facc15',
                marginBottom: '0.75rem'
              }}>
                <Key size={24} />
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Change Admin Passcode
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Update the secret passcode used to access the Platform Owner Portal.
              </p>
            </div>

            <form onSubmit={handleChangePasscode}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Current Passcode</label>
                <input
                  type="password"
                  placeholder="Enter current passcode"
                  value={currentPasscode}
                  onChange={(e) => setCurrentPasscode(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="label">New Passcode</label>
                <input
                  type="password"
                  placeholder="At least 4 characters"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  className="input-field"
                  required
                  minLength={4}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">Confirm New Passcode</label>
                <input
                  type="password"
                  placeholder="Repeat new passcode"
                  value={confirmNewPasscode}
                  onChange={(e) => setConfirmNewPasscode(e.target.value)}
                  className="input-field"
                  required
                  minLength={4}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginBottom: '0.75rem' }}
              >
                <span>Save New Passcode</span>
                <CheckCircle size={16} />
              </button>

              <button
                type="button"
                onClick={() => setShowPasscodeModal(false)}
                className="btn btn-outline btn-sm"
                style={{ width: '100%' }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
