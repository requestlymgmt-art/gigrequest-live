import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  Users,
  Award,
  DollarSign,
  Calendar,
  Music,
  Heart,
  Sparkles,
  Clock,
  ArrowLeft,
  Radio,
  CheckCircle,
  RefreshCw,
  Flame,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, DEMO_BAND_ID } from '../lib/supabase';
import SongArtwork from '../components/common/SongArtwork';

export default function BandAnalytics() {
  const { user, profile, bandId } = useAuth();
  const effectiveBandId = bandId || profile?.id || DEMO_BAND_ID;

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' or 'YYYY-MM'

  // Fetch all band requests & events
  useEffect(() => {
    async function loadData() {
      if (!effectiveBandId) return;
      setLoading(true);
      try {
        const [reqRes, evRes] = await Promise.all([
          supabase
            .from('requests')
            .select('*')
            .eq('band_id', effectiveBandId)
            .order('created_at', { ascending: false }),
          supabase
            .from('events')
            .select('*')
            .eq('band_id', effectiveBandId)
            .order('started_at', { ascending: false }),
        ]);

        setRequests(reqRes.data || []);
        setEvents(evRes.data || []);
      } catch (err) {
        console.error('Error loading analytics:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [effectiveBandId]);

  // Derive unique months from requests for the month selector tabs
  const availableMonths = useMemo(() => {
    const monthSet = new Set();
    requests.forEach((r) => {
      if (r.created_at) {
        const d = new Date(r.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthSet.add(key);
      }
    });

    // Ensure current month is present
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthSet.add(currentMonthKey);

    return Array.from(monthSet).sort().reverse();
  }, [requests]);

  // Filter requests based on selected month (excluding declined/refunded from earnings)
  const paidRequests = useMemo(() => {
    return requests.filter((r) => r.status !== 'declined' && r.payment_status !== 'refunded');
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (selectedMonth === 'all') return paidRequests;
    return paidRequests.filter((r) => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }, [paidRequests, selectedMonth]);

  // Calculate High-Level Metrics
  const metrics = useMemo(() => {
    let totalEarnings = 0;
    let songEarnings = 0;
    let tipEarnings = 0;
    const uniqueFans = new Set();
    let completedSongs = 0;

    filteredRequests.forEach((r) => {
      const sPrice = Number(r.song_price) || 0;
      const tPrice = Number(r.tip_amount) || 0;
      totalEarnings += sPrice + tPrice;
      songEarnings += sPrice;
      tipEarnings += tPrice;

      if (r.fan_name && r.fan_name.toLowerCase() !== 'anonymous fan') {
        uniqueFans.add(r.fan_name.trim().toLowerCase());
      }
      if (r.status === 'completed' || r.status === 'playing') {
        completedSongs += 1;
      }
    });

    const averagePerRequest = filteredRequests.length > 0
      ? totalEarnings / filteredRequests.length
      : 0;

    return {
      totalEarnings,
      songEarnings,
      tipEarnings,
      uniqueListeners: Math.max(uniqueFans.size, filteredRequests.length > 0 ? 1 : 0),
      totalRequests: filteredRequests.length,
      completedSongs,
      averagePerRequest,
    };
  }, [filteredRequests]);

  // Monthly breakdown for the visual bar chart
  const monthlyChartData = useMemo(() => {
    const monthMap = {};

    // Get last 6 calendar months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      monthMap[key] = { key, label, total: 0 };
    }

    paidRequests.forEach((r) => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap[key]) {
        monthMap[key].total += (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0);
      }
    });

    const list = Object.values(monthMap);
    const maxVal = Math.max(...list.map((m) => m.total), 50);

    return list.map((m) => ({
      ...m,
      percent: Math.max(12, Math.round((m.total / maxVal) * 100)),
    }));
  }, [paidRequests]);

  // Top Requested & Most Profitable Songs
  const topSongs = useMemo(() => {
    const songMap = {};

    filteredRequests.forEach((r) => {
      // Don't count standalone direct tips as songs
      if (r.song_title && !r.song_title.includes('Direct Tip')) {
        const titleKey = r.song_title.trim().toLowerCase();
        if (!songMap[titleKey]) {
          songMap[titleKey] = {
            title: r.song_title,
            artist: r.song_artist || '',
            count: 0,
            earnings: 0,
          };
        }
        songMap[titleKey].count += 1;
        songMap[titleKey].earnings += (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0);
      }
    });

    return Object.values(songMap)
      .sort((a, b) => b.earnings - a.earnings || b.count - a.count)
      .slice(0, 5);
  }, [filteredRequests]);

  // Top Fan Supporters / Tippers
  const topFans = useMemo(() => {
    const fanMap = {};

    filteredRequests.forEach((r) => {
      const fanName = (r.fan_name || '').trim();
      if (fanName && fanName.toLowerCase() !== 'anonymous fan') {
        const key = fanName.toLowerCase();
        if (!fanMap[key]) {
          fanMap[key] = {
            name: fanName,
            requestCount: 0,
            totalSpent: 0,
          };
        }
        fanMap[key].requestCount += 1;
        fanMap[key].totalSpent += (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0);
      }
    });

    return Object.values(fanMap)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);
  }, [filteredRequests]);

  // Gigs & Event History with revenue
  const eventBreakdown = useMemo(() => {
    return events.map((ev) => {
      const evReqs = paidRequests.filter((r) => {
        if (r.event_id && r.event_id === ev.id) return true;
        if (!r.event_id && ev.started_at && ev.ended_at) {
          const t = new Date(r.created_at).getTime();
          return t >= new Date(ev.started_at).getTime() && t <= new Date(ev.ended_at).getTime();
        }
        return false;
      });

      const totalEarned = evReqs.reduce(
        (sum, r) => sum + (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0),
        0
      );

      return {
        id: ev.id,
        title: ev.title,
        venue: ev.venue,
        date: ev.started_at,
        requestCount: evReqs.length,
        totalEarned,
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [events, paidRequests]);

  const formatMonthLabel = (key) => {
    if (key === 'all') return 'All Time';
    const [year, month] = key.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="container" style={{ padding: '2rem 1.25rem 5rem' }}>
      {/* Top Navigation & Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            textDecoration: 'none',
            marginBottom: '0.75rem',
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Live Queue</span>
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className="badge badge-emerald" style={{ fontSize: '0.75rem' }}>
                <Sparkles size={12} /> BAND DASHBOARD
              </span>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>
              Statistics & Earnings
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Real-time performance analytics for {profile?.band_name || 'The Groove Collective'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to="/dashboard" className="btn btn-outline btn-sm">
              <Radio size={16} color="#3b82f6" />
              <span>Live Queue</span>
            </Link>
            <Link to="/qr-code" className="btn btn-primary btn-sm">
              <Flame size={16} />
              <span>Show QR Sign</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Month Selector Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        overflowX: 'auto',
        paddingBottom: '0.75rem',
        marginBottom: '1.5rem',
      }}>
        <button
          onClick={() => setSelectedMonth('all')}
          style={{
            padding: '0.55rem 1.15rem',
            borderRadius: '24px',
            border: '1px solid',
            borderColor: selectedMonth === 'all' ? '#10b981' : 'var(--border-subtle)',
            background: selectedMonth === 'all' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.03)',
            color: selectedMonth === 'all' ? '#10b981' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
        >
          All Time
        </button>

        {availableMonths.map((mKey) => (
          <button
            key={mKey}
            onClick={() => setSelectedMonth(mKey)}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '24px',
              border: '1px solid',
              borderColor: selectedMonth === mKey ? '#10b981' : 'var(--border-subtle)',
              background: selectedMonth === mKey ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              color: selectedMonth === mKey ? '#10b981' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {formatMonthLabel(mKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spin" style={{ marginBottom: '1rem' }} />
          <p>Calculating band earnings & statistics...</p>
        </div>
      ) : (
        <>
          {/* Total Earnings Hero Card */}
          <div className="glass-card" style={{
            padding: '2rem 1.75rem',
            marginBottom: '1.75rem',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(19, 24, 38, 0.95))',
            borderColor: 'rgba(16, 185, 129, 0.35)',
            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Total Performer Take-Home ({formatMonthLabel(selectedMonth)})
                </span>
                <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#fff', margin: '0.35rem 0', letterSpacing: '-0.03em' }}>
                  ${metrics.totalEarnings.toFixed(2)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span>🎵 Song Requests: <strong style={{ color: '#fff' }}>${metrics.songEarnings.toFixed(2)}</strong></span>
                  <span>💖 Direct Tips: <strong style={{ color: '#10b981' }}>+${metrics.tipEarnings.toFixed(2)}</strong></span>
                  <span style={{ color: '#60a5fa' }}>✓ 100% Retained by Band</span>
                </div>
              </div>

              {/* Monthly Visual Bars (Inspired by competitor chart) */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.65rem', minHeight: '110px', paddingTop: '1.5rem' }}>
                {monthlyChartData.map((bar) => {
                  const isSelected = selectedMonth === bar.key || (selectedMonth === 'all' && bar.total > 0);
                  return (
                    <div
                      key={bar.key}
                      onClick={() => setSelectedMonth(bar.key)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                      }}
                      title={`${bar.label}: $${bar.total.toFixed(2)}`}
                    >
                      {bar.total > 0 && (
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          color: isSelected ? '#10b981' : 'var(--text-dim)',
                          marginBottom: '2px'
                        }}>
                          ${Math.round(bar.total)}
                        </span>
                      )}
                      <div
                        style={{
                          width: '32px',
                          height: `${bar.percent}px`,
                          borderRadius: '6px',
                          background: isSelected
                            ? 'linear-gradient(180deg, #10b981, #059669)'
                            : 'rgba(255, 255, 255, 0.08)',
                          boxShadow: isSelected ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      />
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: isSelected ? '#fff' : 'var(--text-dim)',
                      }}>
                        {bar.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Key Metric Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div className="glass-card" style={{ padding: '1.35rem', textAlign: 'center' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.65rem'
              }}>
                <Users size={22} />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#fff' }}>
                {metrics.uniqueListeners}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Listeners / Fans
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.35rem', textAlign: 'center' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.65rem'
              }}>
                <Heart size={22} />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#10b981' }}>
                ${metrics.tipEarnings.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Extra Tips Received
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.35rem', textAlign: 'center' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(6, 182, 212, 0.15)',
                color: '#06b6d4',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.65rem'
              }}>
                <CheckCircle size={22} />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#fff' }}>
                {metrics.completedSongs}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Songs Played on Stage
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.35rem', textAlign: 'center' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.65rem'
              }}>
                <TrendingUp size={22} />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#fff' }}>
                ${metrics.averagePerRequest.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Average per Request
              </div>
            </div>
          </div>

          {/* Dual Columns: Top Songs & Top Fan Supporters */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* The Most Profitable Songs */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Award size={20} color="#f59e0b" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                  The Most Profitable Songs
                </h3>
              </div>

              {topSongs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <Music size={28} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                  <p>No song request earnings recorded yet for this timeframe.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {topSongs.map((song, idx) => (
                    <div
                      key={song.title}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: idx === 0 ? '#10b981' : idx === 1 ? '#3b82f6' : idx === 2 ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {song.title}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {song.artist || 'Requested song'} • {song.count} {song.count === 1 ? 'request' : 'requests'}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981', flexShrink: 0 }}>
                        ${song.earnings.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* The Most Profitable Listeners / Supporters */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Users size={20} color="#3b82f6" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                  The Most Profitable Listeners
                </h3>
              </div>

              {topFans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <Users size={28} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                  <p>No supporter data recorded yet for this timeframe.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {topFans.map((fan, idx) => (
                    <div
                      key={fan.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: idx === 0 ? '#3b82f6' : idx === 1 ? '#06b6d4' : idx === 2 ? '#8b5cf6' : 'rgba(255, 255, 255, 0.1)',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {fan.name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {fan.requestCount} {fan.requestCount === 1 ? 'song requested' : 'songs requested'}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8', flexShrink: 0 }}>
                        ${fan.totalSpent.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Events & Gig Earnings Breakdown */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={20} color="#10b981" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                  Gig & Event Performance
                </h3>
              </div>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                {eventBreakdown.length} {eventBreakdown.length === 1 ? 'live set' : 'live sets'} recorded
              </span>
            </div>

            {eventBreakdown.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <Radio size={32} style={{ marginBottom: '0.65rem', opacity: 0.5 }} />
                <p>No gigs recorded yet. Start a live set from the dashboard to track show-by-show earnings!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {eventBreakdown.map((ev, idx) => (
                  <div
                    key={ev.id}
                    style={{
                      padding: '1.15rem',
                      background: 'rgba(255, 255, 255, 0.025)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.85rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#60a5fa',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}>
                          Live Set #{eventBreakdown.length - idx}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                          {ev.date ? new Date(ev.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '0.2rem' }}>
                        {ev.title}
                      </h4>
                      {ev.venue && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          📍 {ev.venue}
                        </p>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      paddingTop: '0.65rem'
                    }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {ev.requestCount} requests
                      </span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>
                        ${ev.totalEarned.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
