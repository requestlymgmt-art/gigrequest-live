import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radio, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { signIn, enterDemoMode } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('Signed in to band dashboard');
      navigate('/dashboard');
    } catch (err) {
      console.error('Sign in error:', err);
      toast.error(err.message || 'Invalid email or password');
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
      <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            marginBottom: '1rem',
            boxShadow: '0 0 20px rgba(249, 115, 22, 0.4)'
          }}>
            <Radio size={24} />
          </div>
          <h2 style={{ fontSize: '1.85rem', marginBottom: '0.35rem' }}>Musician Login</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Access your live stage queue, setlist, and earnings.
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="label">Email Address</label>
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
            <label className="label">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginBottom: '1rem' }}
          >
            <span>{loading ? 'Signing In...' : 'Sign In to Dashboard'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginTop: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Don't have an account yet? <Link to="/register" style={{ color: '#f97316', fontWeight: 600 }}>Create One</Link>
          </p>

          <button
            onClick={handleOpenDemo}
            className="btn btn-outline btn-sm"
            style={{ width: '100%' }}
          >
            <Sparkles size={14} color="#f59e0b" />
            <span>Launch Live Demo Band Directly</span>
          </button>
        </div>
      </div>
    </div>
  );
}
