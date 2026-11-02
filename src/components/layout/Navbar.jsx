import { useState } from 'react';
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
  Sparkles,
  Sliders,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, profile, isDemoMode, signOut, updateProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const isLive = profile?.accepting_requests ?? true;
  const bandSlug = profile?.slug || 'groove-collective';

  const handleToggleLiveStatus = async () => {
    if (!profile) return;
    setUpdatingStatus(true);
    try {
      await updateProfile({ accepting_requests: !isLive });
      toast.success(!isLive ? '🟢 Band is now taking requests live!' : '⏸️ Requests paused for set break');
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
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
      background: 'rgba(10, 11, 16, 0.85)',
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
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)'
          }}>
            <Radio size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.25rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#fff',
              lineHeight: 1.1
            }}>
              Gig<span style={{ color: '#8b5cf6' }}>Request</span>
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
              LIVE STAGE TIPPING
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links (For logged-in bands or demo mode) */}
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
                    background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={16} color={isActive ? '#8b5cf6' : 'currentColor'} />
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
              {/* Accepting Requests Toggle */}
              <button
                onClick={handleToggleLiveStatus}
                disabled={updatingStatus}
                className="btn btn-sm"
                style={{
                  background: isLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                  color: isLive ? '#34d399' : '#f87171',
                }}
                title="Toggle whether fans can send requests right now"
              >
                <span className={isLive ? 'live-pulse' : ''} style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isLive ? '#10b981' : '#ef4444'
                }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  {isLive ? 'Taking Requests' : 'Requests Paused'}
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
              className="btn btn-outline btn-sm"
              style={{ display: 'flex', padding: '0.45rem' }}
              className="mobile-toggle"
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
                  background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                  fontWeight: 600
                }}
              >
                <Icon size={18} color={isActive ? '#8b5cf6' : 'currentColor'} />
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
              color: '#38bdf8',
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
