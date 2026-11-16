// src/components/events/StartEventModal.jsx
// Modal for initiating a live gig session so fans can submit song requests
import { useState } from 'react';
import { Play, Sparkles, MapPin, X, Music, Radio } from 'lucide-react';

export default function StartEventModal({ isOpen, onClose, onStart }) {
  const [title, setTitle] = useState(() => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `Live Set — ${today}`;
  });
  const [venue, setVenue] = useState('');
  const [starting, setStarting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setStarting(true);
    try {
      await onStart({ title: title.trim(), venue: venue.trim() });
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000, padding: '1rem' }}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '460px', 
          width: '100%',
          position: 'relative',
          padding: '2rem 1.5rem',
          background: 'linear-gradient(180deg, #131826 0%, #0d111a 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75), 0 0 30px rgba(59, 130, 246, 0.15)'
        }}
      >
        <button
          onClick={onClose}
          className="btn btn-outline btn-sm"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            padding: '0.4rem',
            borderRadius: '50%',
            color: 'var(--text-muted)'
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            marginBottom: '0.85rem',
            boxShadow: '0 0 24px rgba(6, 182, 212, 0.45)'
          }}>
            <Radio size={26} />
          </div>
          <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.35rem' }}>
            Start Live Event
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.4 }}>
            Unlock your live setlist so fans can send real-time song requests and tips during your performance.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.15rem' }}>
            <label className="label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Event Name / Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Saturday Night Jam, Live at Blue Note"
              className="input-field"
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Venue / Location (Optional)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. The Roxy, Downtown Pub"
                className="input-field"
                style={{ paddingLeft: '2.4rem' }}
              />
              <MapPin 
                size={16} 
                color="var(--text-dim)" 
                style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} 
              />
            </div>
          </div>

          <div style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '10px',
            padding: '0.75rem 0.9rem',
            marginBottom: '1.5rem',
            fontSize: '0.8rem',
            color: '#93c5fd',
            lineHeight: 1.45,
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'flex-start'
          }}>
            <Sparkles size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              Requests and gig earnings will be tracked specifically for this event. When you finish your set, tap <strong>End Event</strong> to view your gig summary.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={starting}
              className="btn btn-primary"
              style={{ 
                flex: 2, 
                justifyContent: 'center', 
                fontWeight: 700,
                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)'
              }}
            >
              <Play size={16} fill="currentColor" />
              <span>{starting ? 'Starting...' : 'Go Live Now'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
