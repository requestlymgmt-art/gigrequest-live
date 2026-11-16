import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Radio, 
  Music2, 
  QrCode, 
  Settings, 
  ExternalLink, 
  LogOut, 
  LogIn, 
  Menu, 
  X,
  Play
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, DEMO_BAND_ID } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, profile, isDemoMode, signOut, bandId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);

  const effectiveBandId = bandId || profile?.id || DEMO_BAND_ID;
  const bandSlug = profile?.slug || 'groove-collective';

  // Fetch active event for this band
  const fetchActiveEvent = async () => {
    if (!effectiveBandId) return;
    try {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('band_id', effectiveBandId)
        .eq('status', 'live')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveEvent(data || null);
    } catch (err) {
      console.error('Navbar event error:', err);
    }
  };

  useEffect(() => {
    fetchActiveEvent();

    if (!effectiveBandId) return;

    // Realtime listener for live events changes
    const channel = supabase
      .channel(`navbar_events_${effectiveBandId}`)
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
    };
  }, [effectiveBandId]);

  // Action when band clicks the Live Event / Set status button
  const handleEventAction = () => {
    if (activeEvent) {
      // Event is currently live -> go to live queue on dashboard
      if (location.pathname !== '/dashboard') {
        navigate('/dashboard');
      } else {
        toast(`🎸 Live Event "${activeEvent.title}" is in progress! Manage queue below or tap "End Event & Get Summary".`, { icon: '🟢' });
      }
    } else {
      // No active event -> Open Create Event modal!
      if (location.pathname === '/dashboard') {
        window.dispatchEvent(new CustomEvent('open-start-event-modal'));
      } else {
        navigate('/dashboard?create_event=1');
      }
    }
  };

  const navLinks = [
    { name: 'Live Queue', path: '/dashboard', icon: Radio },
    { name: 'Setlist & Pricing', path: '/setlist', icon: Music2 },
    { name: 'Gig QR Code', path: '/qr-code', icon: QrCode },
    { name: 'Settings & Stripe', path: '/settings', icon: Settings },
  ];

  return (
    <header className="no-print" style={{
      background: 'rgba(11, 12, 16, 0.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '70px',
      }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', textDecoration: 'none' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 16px rgba(59, 130, 246, 0.45)'
          }}>
            <Radio size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.3rem',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: '#fff',
              lineHeight: 1.1
            }}>
              Request<span style={{ color: '#3b82f6' }}>ly</span>
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', letterSpacing: '0.06em', fontWeight: 600 }}>
              LIVE STAGE TIPPING
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        {(user || isDemoMode) && (
          <nav style={{ display: 'none', gap: '0.5rem', alignItems: 'center' }} className="desktop-nav">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.5rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={16} color={isActive ? '#3b82f6' : 'currentColor'} />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {(user || isDemoMode) ? (
            <>
              {/* Live Gig Event Status Button */}
              <button
                onClick={handleEventAction}
                className="btn btn-sm"
                style={{
                  background: activeEvent ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.16)',
                  border: `1px solid ${activeEvent ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'}`,
                  color: activeEvent ? '#34d399' : '#f87171',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 0.8rem',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  boxShadow: activeEvent ? '0 0 12px rgba(16, 185, 129, 0.25)' : '0 2px 8px rgba(239, 68, 68, 0.2)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title={activeEvent ? `Live Event: ${activeEvent.title} (Click to view live queue)` : "Click to create a live gig event so fans can send requests"}
              >
                <span className={activeEvent ? 'live-pulse' : ''} style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: activeEvent ? '#10b981' : '#ef4444',
                  flexShrink: 0
                }} />
                <span>
                  {activeEvent ? 'Live Set Active' : 'Create Event'}
                </span>
              </button>

              {/* View Public Fan Page */}
              <a
                href={`/live/${bandSlug}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
                style={{ display: 'none' }}
                id="view-public-fan-btn"
              >
                <ExternalLink size={14} />
                <span>Fan View</span>
              </a>

              {/* Sign Out */}
              <button
                onClick={() => {
                  signOut();
                  navigate('/');
                  toast.success('Signed out');
                }}
                className="btn btn-outline btn-sm"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <Link to="/login" className="btn btn-outline btn-sm">
                <LogIn size={15} />
                <span>Musician Login</span>
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                <span>Start Free</span>
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          {(user || isDemoMode) && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="btn btn-outline btn-sm mobile-toggle"
              style={{ display: 'flex', padding: '0.45rem' }}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (user || isDemoMode) && (
        <div style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {/* Mobile Event Action Button */}
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleEventAction();
            }}
            className="btn btn-sm"
            style={{
              background: activeEvent ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
              border: `1px solid ${activeEvent ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'}`,
              color: activeEvent ? '#34d399' : '#f87171',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              width: '100%',
              justifyContent: 'center',
              marginBottom: '0.25rem',
              cursor: 'pointer'
            }}
          >
            <span className={activeEvent ? 'live-pulse' : ''} style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: activeEvent ? '#10b981' : '#ef4444',
              flexShrink: 0
            }} />
            <span>{activeEvent ? `🟢 Live Event: ${activeEvent.title}` : '🔴 Create Live Event'}</span>
          </button>

          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  fontWeight: 600
                }}
              >
                <Icon size={18} color={isActive ? '#3b82f6' : 'currentColor'} />
                {link.name}
              </Link>
            );
          })}
          <a
            href={`/live/${bandSlug}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              color: '#3b82f6',
              fontWeight: 600
            }}
          >
            <ExternalLink size={18} />
            Open Public Fan Page
          </a>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          #view-public-fan-btn { display: inline-flex !important; }
          .mobile-toggle { display: none !important; }
        }
      `}</style>
    </header>
  );
}
