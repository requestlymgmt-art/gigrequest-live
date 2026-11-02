import { Link } from 'react-router-dom';
import { Radio, Heart, ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="no-print" style={{
      borderTop: '1px solid var(--border-subtle)',
      background: 'rgba(8, 9, 13, 0.95)',
      padding: '3rem 0 2rem',
      marginTop: 'auto'
    }}>
      <div className="container" style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <Radio size={16} />
          </div>
          <div>
            <strong style={{ fontSize: '1.1rem', color: '#fff' }}>
              Gig<span style={{ color: '#8b5cf6' }}>Request</span>
            </strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Live Song Requests & Tipping Platform for Musicians
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <Link to="/" style={{ color: 'inherit' }}>Home</Link>
          <Link to="/live/groove-collective" style={{ color: 'inherit' }}>Live Demo</Link>
          <Link to="/register" style={{ color: 'inherit' }}>Musicians Sign Up</Link>
          <Link to="/login" style={{ color: 'inherit' }}>Sign In</Link>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'right' }}>
          Built with Supabase & Stripe • Fan-paid fees ensure 100% artist payout
        </div>
      </div>
    </footer>
  );
}
