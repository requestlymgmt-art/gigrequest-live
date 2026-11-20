// src/components/events/EventSummaryModal.jsx
// Displays a comprehensive gig summary when a live event ends:
// duration, requests, total tips, average tip, captured vs held earnings, listeners, and top songs.
import { useState } from 'react';
import { 
  DollarSign, 
  Music, 
  Users, 
  Clock, 
  Heart, 
  Sparkles, 
  CheckCircle, 
  ChevronRight, 
  ShieldCheck, 
  X,
  Play
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function EventSummaryModal({
  event,
  requests = [],
  onClose,
  onStartNextEvent,
}) {
  if (!event) return null;

  // Calculate Duration
  const startTime = new Date(event.started_at || event.created_at).getTime();
  const endTime = event.ended_at ? new Date(event.ended_at).getTime() : Date.now();
  const diffMs = Math.max(0, endTime - startTime);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const formattedDuration = hours > 0 
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;

  // Filter confirmed requests only (Stripe authorized or paid, strictly excluding declined or refunded)
  const confirmedRequests = requests.filter(
    (r) => r.status !== 'declined' && 
           r.payment_status !== 'refunded' && 
           r.payment_status !== 'cancelled' && 
           (r.payment_status === 'authorized' || r.payment_status === 'paid')
  );

  // Refunded or Declined Requests
  const refundedRequests = requests.filter(
    (r) => r.status === 'declined' || r.payment_status === 'refunded' || r.payment_status === 'cancelled'
  );
  const refundedTotal = refundedRequests.reduce(
    (sum, r) => sum + (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0),
    0
  );

  // Earnings Breakdown: Captured vs Held
  const capturedRequests = confirmedRequests.filter((r) => r.payment_status === 'paid');
  const heldRequests = confirmedRequests.filter((r) => r.payment_status === 'authorized');

  const capturedEarnings = capturedRequests.reduce(
    (sum, r) => sum + (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0),
    0
  );
  const heldEarnings = heldRequests.reduce(
    (sum, r) => sum + (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0),
    0
  );
  const totalEarnings = capturedEarnings + heldEarnings;

  // Songs played count
  const playedSongsCount = confirmedRequests.filter(
    (r) => r.status === 'completed' || r.status === 'playing'
  ).length;

  // Unique listeners / fans
  const uniqueFans = new Set(
    confirmedRequests.map((r) => (r.fan_name || '').trim().toLowerCase()).filter(Boolean)
  ).size;

  // Tips breakdown
  const totalTips = confirmedRequests.reduce(
    (sum, r) => sum + (Number(r.tip_amount) || 0),
    0
  );
  const requestsWithTips = confirmedRequests.filter((r) => Number(r.tip_amount) > 0);
  const avgTip = requestsWithTips.length > 0 
    ? totalTips / requestsWithTips.length 
    : 0;

  // Top Songs calculation
  const songMap = {};
  confirmedRequests.forEach((r) => {
    const key = (r.song_title || 'Untitled').trim();
    if (!songMap[key]) {
      songMap[key] = {
        title: key,
        artist: r.song_artist || '',
        count: 0,
        earnings: 0,
      };
    }
    songMap[key].count += 1;
    songMap[key].earnings += (Number(r.song_price) || 0) + (Number(r.tip_amount) || 0);
  });

  const topSongs = Object.values(songMap)
    .sort((a, b) => b.count - a.count || b.earnings - a.earnings)
    .slice(0, 5);

  return (
    <div className="modal-overlay" style={{ zIndex: 1000, overflowY: 'auto', padding: '1.5rem 1rem' }}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '540px', 
          width: '100%', 
          position: 'relative',
          padding: '2rem 1.5rem',
          background: 'linear-gradient(180deg, #101626 0%, #0a0d18 100%)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(59, 130, 246, 0.15)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="btn btn-outline btn-sm"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            padding: '0.4rem',
            borderRadius: '50%',
            color: 'var(--text-muted)',
            borderColor: 'var(--border-subtle)'
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Celebratory Header with Glowing Stage Lights Vibe */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem', position: 'relative' }}>
          {/* Subtle Stage Light Beams */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '280px',
            height: '90px',
            background: 'radial-gradient(ellipse at top, rgba(59, 130, 246, 0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Badges Bar (Star Icons: Earnings, Songs, Listeners, Time) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              boxShadow: '0 0 12px rgba(16, 185, 129, 0.25)'
            }}>
              <DollarSign size={18} />
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 18px rgba(59, 130, 246, 0.45)',
              transform: 'translateY(-4px)'
            }}>
              <Music size={22} />
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 18px rgba(6, 182, 212, 0.45)',
              transform: 'translateY(-4px)'
            }}>
              <Users size={22} />
            </div>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fbbf24',
              boxShadow: '0 0 12px rgba(245, 158, 11, 0.25)'
            }}>
              <Clock size={18} />
            </div>
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.25rem' }}>
            Event Summary
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {event.title} {event.venue ? `• ${event.venue}` : ''}
          </p>
        </div>

        {/* Primary 2x2 Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.85rem',
          marginBottom: '1.25rem'
        }}>
          {/* Card 1: Total Confirmed Earnings */}
          <div 
            className="glass-card" 
            style={{ 
              padding: '1.15rem 1rem', 
              textAlign: 'center', 
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.28)',
              borderRadius: '16px'
            }}
          >
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#34d399', lineHeight: 1.1, marginBottom: '0.35rem' }}>
              ${totalEarnings.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Confirmed Earnings
            </div>
          </div>

          {/* Card 2: Played Songs */}
          <div 
            className="glass-card" 
            style={{ 
              padding: '1.15rem 1rem', 
              textAlign: 'center', 
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.28)',
              borderRadius: '16px'
            }}
          >
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, marginBottom: '0.35rem' }}>
              {playedSongsCount}
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Played Songs
            </div>
          </div>

          {/* Card 3: Listeners / Fans */}
          <div 
            className="glass-card" 
            style={{ 
              padding: '1.15rem 1rem', 
              textAlign: 'center', 
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.28)',
              borderRadius: '16px'
            }}
          >
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, marginBottom: '0.35rem' }}>
              {uniqueFans}
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Unique Fans
            </div>
          </div>

          {/* Card 4: Event Duration Time */}
          <div 
            className="glass-card" 
            style={{ 
              padding: '1.15rem 1rem', 
              textAlign: 'center', 
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.28)',
              borderRadius: '16px'
            }}
          >
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, marginBottom: '0.35rem', fontFamily: 'JetBrains Mono, monospace' }}>
              {formattedDuration}
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Event Time
            </div>
          </div>
        </div>

        {/* Stripe Confirmed Payment Breakdown: Captured vs Held */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '14px',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
              Direct Bank Captured:
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
              ${capturedEarnings.toFixed(2)}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
              Pre-Authorized on Hold:
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#60a5fa' }}>
              ${heldEarnings.toFixed(2)}
            </div>
          </div>

          {refundedTotal > 0 && (
            <div style={{
              width: '100%',
              paddingTop: '0.5rem',
              marginTop: '0.4rem',
              borderTop: '1px dashed rgba(239, 68, 68, 0.3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.78rem'
            }}>
              <span style={{ color: '#fca5a5' }}>
                ✕ Refunded to Fans ({refundedRequests.length} declined):
              </span>
              <span style={{ fontWeight: 800, color: '#ef4444' }}>
                -${refundedTotal.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Tips Summary */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '14px',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Heart size={18} color="#f59e0b" fill="#f59e0b" />
            <span style={{ fontSize: '0.85rem', color: '#fef3c7', fontWeight: 600 }}>
              Fan Tips ({requestsWithTips.length})
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fbbf24' }}>
              ${totalTips.toFixed(2)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              (avg ${avgTip.toFixed(2)})
            </span>
          </div>
        </div>

        {/* Top Requested Songs of the Event */}
        {topSongs.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Top Songs of the Night
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {topSongs.map((s, idx) => (
                <div 
                  key={s.title}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.85rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    fontSize: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    <span style={{ fontWeight: 800, color: idx === 0 ? '#fbbf24' : '#94a3b8', fontSize: '0.8rem' }}>
                      #{idx + 1}
                    </span>
                    <span style={{ fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {s.count} {s.count === 1 ? 'request' : 'requests'}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>
                      ${s.earnings.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions: Create Next Event or Back to Dashboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onStartNextEvent}
            className="btn btn-primary btn-lg"
            style={{
              width: '100%',
              fontSize: '1rem',
              fontWeight: 800,
              padding: '0.9rem',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              boxShadow: '0 4px 20px rgba(6, 182, 212, 0.4)',
              justifyContent: 'center',
              borderRadius: '14px'
            }}
          >
            <Play size={18} fill="currentColor" />
            <span>CREATE NEXT EVENT</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline"
            style={{
              width: '100%',
              fontSize: '0.9rem',
              color: 'var(--text-muted)',
              borderColor: 'transparent',
              justifyContent: 'center'
            }}
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
