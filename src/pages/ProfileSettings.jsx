import { useState, useEffect } from 'react';
import { 
  Settings, 
  CreditCard, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  Music, 
  Globe, 
  Camera, 
  DollarSign,
  Radio,
  ExternalLink
} from 'lucide-react';
import { supabase, DEMO_BAND_ID } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function ProfileSettings() {
  const { profile, updateProfile, isDemoMode } = useAuth();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    band_name: '',
    slug: '',
    genre: '',
    bio: '',
    avatar_url: '',
    announcement_banner: '',
    default_min_tip: 5.00,
    allow_custom_song_requests: true,
    custom_request_price: 15.00,
    accepting_requests: true,
    stripe_publishable_key: '',
    stripe_account_id: '',
    venmo_handle: '',
    cashapp_handle: '',
    instagram_handle: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        band_name: profile.band_name || '',
        slug: profile.slug || '',
        genre: profile.genre || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || '',
        announcement_banner: profile.announcement_banner || '',
        default_min_tip: profile.default_min_tip ?? 5.00,
        allow_custom_song_requests: profile.allow_custom_song_requests ?? true,
        custom_request_price: profile.custom_request_price ?? 15.00,
        accepting_requests: profile.accepting_requests ?? true,
        stripe_publishable_key: profile.stripe_publishable_key || '',
        stripe_account_id: profile.stripe_account_id || '',
        venmo_handle: profile.venmo_handle || '',
        cashapp_handle: profile.cashapp_handle || '',
        instagram_handle: profile.instagram_handle || '',
      });
    }
  }, [profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(formData);
      toast.success('Band profile & Stripe settings saved!');
    } catch (err) {
      console.error('Settings update error:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1.25rem 5rem', maxWidth: '800px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Band Profile & Stripe</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Configure your public profile, setlist options, and payout details.
          </p>
        </div>

        {formData.slug && (
          <a
            href={`/live/${formData.slug}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm"
          >
            <ExternalLink size={14} />
            <span>View Public Page</span>
          </a>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Band Identity Card */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Music size={18} color="#3b82f6" />
            <span>Band Identity</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="label">Band / Artist Name *</label>
              <input
                type="text"
                value={formData.band_name}
                onChange={(e) => setFormData({ ...formData, band_name: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="label">Custom URL Slug *</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ padding: '0.75rem 0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRight: 'none', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  /live/
                </span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  className="input-field"
                  style={{ borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}
                  required
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="label">Genre</label>
            <input
              type="text"
              placeholder="e.g. Funk / Soul / Indie Rock"
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              className="input-field"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="label">Band Photo / Logo URL</label>
            <input
              type="url"
              placeholder="https://example.com/band-photo.jpg"
              value={formData.avatar_url}
              onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              className="input-field"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="label">Bio / About Your Act</label>
            <textarea
              rows={3}
              placeholder="Brief description fans see when scanning your code..."
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="input-field"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div>
            <label className="label">Stage Announcement Banner</label>
            <input
              type="text"
              placeholder="e.g. 🎸 Live at the Rooftop Lounge! Welcome!"
              value={formData.announcement_banner}
              onChange={(e) => setFormData({ ...formData, announcement_banner: e.target.value })}
              className="input-field"
            />
          </div>
        </div>

        {/* Live Tipping & Request Settings Card */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Radio size={18} color="#10b981" />
            <span>Live Tipping & Request Rules</span>
          </h3>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem'
          }}>
            <div>
              <strong style={{ fontSize: '1rem', color: '#fff', display: 'block' }}>
                Accepting Requests Live
              </strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Turn off during set breaks or sound checks to pause fan submissions.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, accepting_requests: !formData.accepting_requests })}
              className="btn btn-sm"
              style={{
                background: formData.accepting_requests ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: formData.accepting_requests ? '#34d399' : '#f87171',
                border: `1px solid ${formData.accepting_requests ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
              }}
            >
              {formData.accepting_requests ? 'Accepting ✓' : 'Paused ✕'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="label">Default Minimum Tip ($)</label>
              <input
                type="number"
                step="1"
                min="1"
                value={formData.default_min_tip}
                onChange={(e) => setFormData({ ...formData, default_min_tip: parseFloat(e.target.value) || 5 })}
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Custom Song Request Price ($)</label>
              <input
                type="number"
                step="1"
                min="1"
                value={formData.custom_request_price}
                onChange={(e) => setFormData({ ...formData, custom_request_price: parseFloat(e.target.value) || 15 })}
                className="input-field"
              />
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div>
              <strong style={{ fontSize: '1rem', color: '#fff', display: 'block' }}>
                Allow Custom Song Requests
              </strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Let fans request songs not in your setlist at your custom price.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, allow_custom_song_requests: !formData.allow_custom_song_requests })}
              className="btn btn-outline btn-sm"
            >
              {formData.allow_custom_song_requests ? 'Allowed ✓' : 'Setlist Only'}
            </button>
          </div>
        </div>

        {/* Stripe API & Payout Details */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={18} color="#f59e0b" />
              <span>Stripe Payout Integration</span>
            </h3>
            <span className="badge badge-emerald">
              STRIPE INTEGRATED ✓
            </span>
          </div>

          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            marginBottom: '1.25rem'
          }}>
            <strong style={{ color: '#34d399', fontSize: '0.95rem', display: 'block', marginBottom: '0.25rem' }}>
              ✓ Transparent Fee Structure: 100% Artist Payout
            </strong>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Fans pay the standard Stripe card processing fee at checkout. You receive 100% of your song request price and direct tips directly into your bank account.
            </p>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="label">Stripe Publishable Key (or Connect Account ID)</label>
            <input
              type="text"
              placeholder="pk_live_... or pk_test_..."
              value={formData.stripe_publishable_key}
              onChange={(e) => setFormData({ ...formData, stripe_publishable_key: e.target.value })}
              className="input-field"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label className="label">Venmo Handle (Optional Backup)</label>
              <input
                type="text"
                placeholder="@your-band"
                value={formData.venmo_handle}
                onChange={(e) => setFormData({ ...formData, venmo_handle: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">CashApp Tag (Optional Backup)</label>
              <input
                type="text"
                placeholder="$yourband"
                value={formData.cashapp_handle}
                onChange={(e) => setFormData({ ...formData, cashapp_handle: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Instagram Handle</label>
              <input
                type="text"
                placeholder="@bandinstagram"
                value={formData.instagram_handle}
                onChange={(e) => setFormData({ ...formData, instagram_handle: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Save Submit Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary btn-lg"
            style={{ minWidth: '200px' }}
          >
            <Save size={18} />
            <span>{saving ? 'Saving Changes...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
