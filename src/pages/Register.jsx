import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radio, Music2, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const { signUp, enterDemoMode } = useAuth();
  const navigate = useNavigate();

  const [bandName, setBandName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBandNameChange = (val) => {
    setBandName(val);
    if (!slug || slug === bandName.toLowerCase().replace(/[^a-z0-9-]/g, '-')) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!bandName.trim() || !slug.trim()) {
      toast.error('Please enter your band name and URL slug');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, bandName.trim(), slug.trim());
      toast.success('Band profile created! Welcome to GigRequest!');
      navigate('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDemo = async () => {
    await enterDemoMode();
    toast.success('Loaded demo band');
    navigate('/dashboard');
  };

  return (
    <div style={{
      minHeight: '85vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div className="glass-card" style={{ maxWidth: '460px', width: '100%', padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            marginBottom: '1rem',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
          }}>
            <Radio size={24} />
          </div>
          <h2 style={{ fontSize: '1.85rem', marginBottom: '0.35rem' }}>Create Band Account</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Set your setlist, connect Stripe, and start taking paid requests.
          </p>
        </div>

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="label">Band or Artist Name *</label>
            <input
              type="text"
              placeholder="e.g. Neon Velvet, The Groove Band"
              value={bandName}
              onChange={(e) => handleBandNameChange(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="label">Your Public Fan URL *</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ padding: '0.75rem 0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRight: 'none', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                /live/
              </span>
              <input
                type="text"
                placeholder="neon-velvet"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                className="input-field"
                style={{ borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="label">Email Address *</label>
            <input
              type="email"
              placeholder="musician@band.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="label">Password *</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginBottom: '1rem' }}
          >
            <span>{loading ? 'Setting up Profile...' : 'Create Musician Account'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginTop: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Already have an account? <Link to="/login" style={{ color: '#8b5cf6', fontWeight: 600 }}>Sign In</Link>
          </p>

          <button
            onClick={handleOpenDemo}
            className="btn btn-outline btn-sm"
            style={{ width: '100%' }}
          >
            <Sparkles size={14} color="#f59e0b" />
            <span>Or Explore Live Demo Band Immediately</span>
          </button>
        </div>
      </div>
    </div>
  );
}
