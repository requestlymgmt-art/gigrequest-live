import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  ExternalLink,
  Upload,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Zap,
  RefreshCw,
  Crop,
  Calendar,
  ArrowUpRight,
  Receipt,
  FileText
} from 'lucide-react';
import { supabase, DEMO_BAND_ID } from '../lib/supabase';
import { initiateStripeConnectOnboarding } from '../lib/stripe';
import { uploadCoverImage } from '../cloudinary/upload';
import { useAuth } from '../context/AuthContext';
import ImageCropModal from '../components/common/ImageCropModal';
import toast from 'react-hot-toast';

const isLegacyTest = (rawId) => Boolean(rawId && (rawId.startsWith('acct_test_') || rawId.includes('test')));

export default function ProfileSettings() {
  const { profile, updateProfile, isDemoMode } = useAuth();
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageForCrop, setRawImageForCrop] = useState(null);
  const [stripeProfileNotice, setStripeProfileNotice] = useState(false);
  const [showManualStripe, setShowManualStripe] = useState(false);
  const [manualStripeId, setManualStripeId] = useState('');
  const [linkingManual, setLinkingManual] = useState(false);

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
    stripe_connected: false,
    venmo_handle: '',
    cashapp_handle: '',
    instagram_handle: '',
  });

  useEffect(() => {
    if (profile) {
      const rawStripeId = profile.stripe_account_id || '';
      const isTestMock = isLegacyTest(rawStripeId);
      const cleanStripeId = isTestMock ? '' : rawStripeId;

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
        stripe_account_id: cleanStripeId,
        stripe_connected: isTestMock ? false : (profile.stripe_connected ?? (!!cleanStripeId)),
        venmo_handle: profile.venmo_handle || '',
        cashapp_handle: profile.cashapp_handle || '',
        instagram_handle: profile.instagram_handle || '',
      });

      // Automatically purge legacy test simulations from Supabase so they never appear again
      if (isTestMock) {
        updateProfile({ stripe_account_id: '', stripe_connected: false }).catch(() => {});
      }
    }
  }, [profile]);

  // Handle Stripe Connect return redirect
  useEffect(() => {
    const connectStatus = searchParams.get('connect');
    const accountId = searchParams.get('account_id');

    if (connectStatus === 'success') {
      if (accountId && accountId.startsWith('acct_') && !isLegacyTest(accountId)) {
        const updated = {
          ...formData,
          stripe_account_id: accountId,
          stripe_connected: true,
        };
        setFormData(updated);
        updateProfile(updated).then(() => {
          toast.success('🎉 Bank account linked via Stripe Connect! Ready to receive direct deposits.');
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      } else {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else if (connectStatus === 'refresh') {
      toast('Stripe onboarding session expired. Click "Connect Bank" to resume.', { icon: 'ℹ️' });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  // Direct device file upload with interactive pan/zoom crop frame
  const handlePhotoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setRawImageForCrop(loadEvent.target.result);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    // Clear input so selecting the same file can trigger again
    e.target.value = '';
  };

  // Called when user finishes moving/zooming the circular frame in the crop modal
  const handleCropComplete = async (croppedDataUrl) => {
    setFormData((prev) => ({ ...prev, avatar_url: croppedDataUrl }));
    toast.success('✓ Profile photo framed! Click "Save Settings" below to apply.');

    // Upload optimized cropped image to Cloudinary in background if available
    try {
      const blob = await (await fetch(croppedDataUrl)).blob();
      const file = new File([blob], 'band-avatar.jpg', { type: 'image/jpeg' });
      uploadCoverImage(file).then((res) => {
        if (res && res.url) {
          setFormData((prev) => ({ ...prev, avatar_url: res.url }));
        }
      }).catch(() => {
        // Safe fallback - croppedDataUrl already persisted
      });
    } catch (e) {
      // Safe fallback
    }
  };

  const handleConnectStripe = async () => {
    setConnectingStripe(true);
    try {
      const res = await initiateStripeConnectOnboarding({
        bandId: profile?.id || DEMO_BAND_ID,
        bandName: formData.band_name || 'Band',
        email: profile?.email || 'band@requestly.live',
        accountId: formData.stripe_account_id,
      });

      if (res && res.url) {
        window.location.href = res.url;
        return;
      }

      if (res?.needsPlatformProfile) {
        setStripeProfileNotice(true);
        toast((t) => (
          <div style={{ fontSize: '0.85rem', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '0.35rem' }}>
              One-Time Stripe Connect Platform Setup:
            </strong>
            <p style={{ margin: '0 0 0.65rem', color: '#cbd5e1' }}>
              Stripe requires you to answer a 1-minute platform questionnaire on your Stripe dashboard before creating live connected accounts.
            </p>
            <a
              href="https://dashboard.stripe.com/connect/accounts/overview"
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
            >
              Open Stripe Connect Setup &rarr;
            </a>
          </div>
        ), { duration: 15000, icon: '⚠️' });
        return;
      }

      if (res?.error) {
        toast.error(res.error, { duration: 6000 });
        return;
      }

      if (res?.accountId && res.accountId.startsWith('acct_') && !isLegacyTest(res.accountId)) {
        const updated = {
          ...formData,
          stripe_account_id: res.accountId,
          stripe_connected: true,
        };
        setFormData(updated);
        await updateProfile(updated);
        toast.success('🎉 Bank account linked via Stripe Connect! Ready to receive direct deposits.');
      } else {
        toast.error('Unable to create Stripe Connect link. Please verify Stripe settings.');
      }
    } catch (err) {
      console.error('Stripe Connect error:', err);
      toast.error('Failed to link Stripe account');
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleManualLinkStripe = async (e) => {
    if (e) e.preventDefault();
    const clean = (manualStripeId || '').trim();
    if (!clean.startsWith('acct_') || isLegacyTest(clean)) {
      toast.error('Please enter a valid live Stripe Express Account ID (starts with acct_1...)');
      return;
    }
    setLinkingManual(true);
    try {
      const updated = {
        ...formData,
        stripe_account_id: clean,
        stripe_connected: true,
      };
      setFormData(updated);
      await updateProfile(updated);
      setManualStripeId('');
      setShowManualStripe(false);
      toast.success('🎉 Stripe Connected Account linked successfully! Direct deposits active.');
    } catch (err) {
      toast.error('Failed to link account ID');
    } finally {
      setLinkingManual(false);
    }
  };

  const handleDisconnectStripe = async () => {
    const updated = {
      ...formData,
      stripe_account_id: '',
      stripe_connected: false,
    };
    setFormData(updated);
    await updateProfile(updated);
    toast.success('Stripe Connect account unlinked.');
  };

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

          {/* Band Profile Picture / Avatar Uploader */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="label">Band Profile Picture / Logo</label>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.15rem',
              flexWrap: 'wrap'
            }}>
              {/* Photo Preview Circle */}
              <div style={{
                position: 'relative',
                width: '88px',
                height: '88px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '3px solid #3b82f6',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.35)',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {formData.avatar_url ? (
                  <img
                    src={formData.avatar_url}
                    alt={formData.band_name || 'Band'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Music size={36} color="#60a5fa" />
                )}

                {uploadingPhoto && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <RefreshCw size={22} className="spin" color="#3b82f6" />
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div style={{ flex: '1 1 240px' }}>
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <input
                    type="file"
                    accept="image/*"
                    id="band-photo-file-input"
                    style={{ display: 'none' }}
                    onChange={handlePhotoFileChange}
                    disabled={uploadingPhoto}
                  />

                  <label
                    htmlFor="band-photo-file-input"
                    className="btn btn-primary btn-sm"
                    style={{ cursor: uploadingPhoto ? 'not-allowed' : 'pointer' }}
                  >
                    <Camera size={15} />
                    <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo from Device'}</span>
                  </label>

                  {formData.avatar_url && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRawImageForCrop(formData.avatar_url);
                          setCropModalOpen(true);
                        }}
                        className="btn btn-outline btn-sm"
                        style={{ borderColor: 'rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}
                        title="Move & Zoom Crop Frame"
                      >
                        <Crop size={14} />
                        <span>Move & Zoom Frame</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, avatar_url: '' }))}
                        className="btn btn-outline btn-sm"
                        style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}
                      >
                        <Trash2 size={14} />
                        <span>Remove</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowManualUrl(!showManualUrl)}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.78rem' }}
                  >
                    {showManualUrl ? 'Hide URL' : 'Or Paste URL'}
                  </button>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  Fans see this photo at the top of your public live page and QR flyer. Supports JPG, PNG, WEBP.
                </div>

                {showManualUrl && (
                  <div style={{ marginTop: '0.65rem' }}>
                    <input
                      type="url"
                      placeholder="https://example.com/band-photo.jpg"
                      value={formData.avatar_url}
                      onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                      className="input-field"
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                )}
              </div>
            </div>
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

        {/* Requestly Musician Plan & Billing */}
        <div className="glass-card" style={{ border: '1px solid rgba(16, 185, 129, 0.35)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <Zap size={18} color="#10b981" />
                <span>Requestly Musician Unlimited Plan</span>
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: 0 }}>
                Official musician membership with direct Stripe bank payouts & 100% revenue retention.
              </p>
            </div>
            <span className="badge badge-emerald" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle size={13} /> ACTIVE • 100% DIRECT PAYOUTS
            </span>
          </div>

          {/* Current Cycle Start & End Dates Banner */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Calendar size={22} color="#10b981" />
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', display: 'block' }}>
                  Current Billing & Performance Cycle
                </span>
                <strong style={{ fontSize: '1rem', color: '#fff' }}>
                  {new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' — '}
                  {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </strong>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', display: 'block' }}>
                Next Cycle Renewal
              </span>
              <span style={{ fontSize: '0.92rem', color: '#34d399', fontWeight: 700 }}>
                {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ($0.00 / mo)
              </span>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
                Monthly Plan Subscription
              </span>
              <strong style={{ fontSize: '1.4rem', color: '#fff' }}>$0 / month</strong>
              <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '0.2rem' }}>Free Forever for Musicians</div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
                Musician Revenue
              </span>
              <strong style={{ fontSize: '1.4rem', color: '#34d399' }}>100% Take-Home</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>0% taken from your songs or tips</div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
                Fan Transparent Fee
              </span>
              <strong style={{ fontSize: '1.4rem', color: '#60a5fa' }}>$2 or 10%</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>Covered transparently by fan</div>
            </div>
          </div>

          {/* Billing & Payout History Ledger */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={16} color="#60a5fa" />
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>Billing & Payout History</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Standard 2-Business-Day Rolling Bank Deposits
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.65rem' }}>Billing Period</th>
                    <th style={{ padding: '0.5rem 0.65rem' }}>Plan Charge</th>
                    <th style={{ padding: '0.5rem 0.65rem' }}>Payout Method</th>
                    <th style={{ padding: '0.5rem 0.65rem' }}>Musician Split</th>
                    <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.75rem 0.65rem', color: '#fff', fontWeight: 600 }}>
                      {new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' — '}
                      {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '0.75rem 0.65rem', color: '#34d399', fontWeight: 700 }}>$0.00 (Free)</td>
                    <td style={{ padding: '0.75rem 0.65rem', color: 'var(--text-muted)' }}>
                      Stripe Connect Express • 2-Day Rolling
                    </td>
                    <td style={{ padding: '0.75rem 0.65rem', color: '#34d399', fontWeight: 700 }}>100% Net</td>
                    <td style={{ padding: '0.75rem 0.65rem', textAlign: 'right' }}>
                      <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>ACTIVE CYCLE ✓</span>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: '0.75rem 0.65rem', color: '#cbd5e1' }}>
                      {new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' — '}
                      {new Date(new Date().getFullYear(), new Date().getMonth(), 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '0.75rem 0.65rem', color: '#34d399', fontWeight: 700 }}>$0.00 (Waived)</td>
                    <td style={{ padding: '0.75rem 0.65rem', color: 'var(--text-muted)' }}>
                      Stripe Direct Deposit
                    </td>
                    <td style={{ padding: '0.75rem 0.65rem', color: '#34d399', fontWeight: 700 }}>100% Net</td>
                    <td style={{ padding: '0.75rem 0.65rem', textAlign: 'right' }}>
                      <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>SETTLED ✓</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{
            fontSize: '0.825rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            paddingTop: '0.5rem'
          }}>
            <ShieldCheck size={16} color="#10b981" />
            <span>You never pay out-of-pocket fees. All card processing and Requestly platform fees are transparently billed to the fan at checkout.</span>
          </div>
        </div>

        {/* Stripe Connect Express Bank Payout Hub */}
        <div className="glass-card" style={{ border: '1px solid rgba(59, 130, 246, 0.35)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={18} color="#3b82f6" />
              <span>Stripe Connect Express Payouts</span>
            </h3>
            {formData.stripe_account_id && !isLegacyTest(formData.stripe_account_id) ? (
              <span className="badge badge-emerald" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle size={13} /> BANK LINKED & ACTIVE
              </span>
            ) : (
              <span className="badge badge-amber" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <AlertCircle size={13} /> ACTION NEEDED TO RECEIVE PAYOUTS
              </span>
            )}
          </div>

          <div style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem',
            marginBottom: '1.25rem'
          }}>
            <strong style={{ color: '#60a5fa', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
              <Sparkles size={16} /> 0% Musician Fee • 100% Direct Payouts
            </strong>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.55 }}>
              Fans pay the transparent Requestly platform and Stripe processing fee at checkout. You keep <strong>100% of every song request and tip</strong>. Payments are deposited directly into your linked bank account via Stripe Connect Express — no developer keys or API setup required.
            </p>
          </div>

          {/* Connected or Not Connected View */}
          {formData.stripe_account_id && !isLegacyTest(formData.stripe_account_id) ? (
            <div style={{
              background: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
                      Connected Stripe Express Account
                    </span>
                    <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                      LIVE PRODUCTION
                    </span>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>
                    {formData.stripe_account_id}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    disabled={connectingStripe}
                    onClick={handleConnectStripe}
                    className="btn btn-primary btn-sm"
                  >
                    <span>Update Bank / Payout Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectStripe}
                    className="btn btn-outline btn-sm"
                    style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}
                  >
                    Unlink
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle size={14} color="#10b981" />
                <span>Automatic 2-business-day rolling deposits enabled directly to your verified bank account.</span>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              textAlign: 'center',
              marginBottom: '1.5rem'
            }}>
              <CreditCard size={36} color="#3b82f6" style={{ margin: '0 auto 0.75rem' }} />
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Connect Your Bank with Stripe Express
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '520px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                Link your checking account or debit card in 60 seconds with Stripe Express. Fans can instantly pay you via Apple Pay, Google Pay, or card! Standard 2-business-day rolling deposits go directly into your bank account.
              </p>
              <button
                type="button"
                disabled={connectingStripe}
                onClick={handleConnectStripe}
                className="btn btn-primary btn-lg"
                style={{ padding: '0.85rem 1.75rem', fontSize: '1rem', fontWeight: 700 }}
              >
                {connectingStripe ? (
                  <span>Connecting to Stripe...</span>
                ) : (
                  <span>Connect Bank Account with Stripe (1-Click Express)</span>
                )}
              </button>

              {/* Stripe Platform Setup Guidance & Manual Account ID Entry */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '1.15rem',
                marginTop: '1.5rem',
                textAlign: 'left',
                overflow: 'hidden',
                boxSizing: 'border-box',
                width: '100%'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
                  <Sparkles size={16} color="#60a5fa" style={{ flexShrink: 0 }} />
                  <strong style={{ color: '#60a5fa', fontSize: '0.92rem' }}>
                    Stripe Live Connect Setup
                  </strong>
                </div>
                <p style={{
                  fontSize: '0.825rem',
                  color: '#cbd5e1',
                  lineHeight: 1.55,
                  margin: '0 0 0.85rem',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word'
                }}>
                  To enable 1-click bank onboarding links, Stripe requires the platform owner to answer a quick 1-minute questionnaire on the Stripe dashboard. Once answered, onboarding links work seamlessly for all musicians!
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%' }}>
                  <a
                    href="https://dashboard.stripe.com/connect/accounts/overview"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{
                      fontSize: '0.82rem',
                      padding: '0.6rem 0.85rem',
                      textDecoration: 'none',
                      justifyContent: 'center',
                      textAlign: 'center',
                      width: '100%',
                      fontWeight: 700
                    }}
                  >
                    <span>Open Stripe Connect Questionnaire &rarr;</span>
                  </a>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.4, margin: '0.1rem 0 0.2rem' }}>
                    💡 <em>Tip: Open on a computer/laptop (or Chrome) for smooth document uploads — mobile Safari often crashes on heavy document upload pages.</em>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualStripe(!showManualStripe)}
                    className="btn btn-outline btn-sm"
                    style={{
                      fontSize: '0.82rem',
                      padding: '0.55rem 0.85rem',
                      justifyContent: 'center',
                      textAlign: 'center',
                      width: '100%'
                    }}
                  >
                    <span>{showManualStripe ? 'Hide Manual ID Field' : 'Or Enter Existing Stripe Account ID'}</span>
                  </button>
                </div>

                {showManualStripe && (
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', width: '100%' }}>
                    <label className="label" style={{ fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                      Have an existing Stripe Express Account ID? Enter here:
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                      <input
                        type="text"
                        placeholder="acct_1..."
                        value={manualStripeId}
                        onChange={(e) => setManualStripeId(e.target.value)}
                        className="input-field"
                        style={{ fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
                      />
                      <button
                        type="button"
                        disabled={linkingManual}
                        onClick={handleManualLinkStripe}
                        className="btn btn-emerald btn-sm"
                        style={{ fontWeight: 700, padding: '0.55rem', width: '100%', justifyContent: 'center' }}
                      >
                        {linkingManual ? 'Linking...' : 'Link Account'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Social Backup Payout Handles */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Optional Backup Handles
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label className="label">Venmo Handle (Backup)</label>
                <input
                  type="text"
                  placeholder="@your-band"
                  value={formData.venmo_handle}
                  onChange={(e) => setFormData({ ...formData, venmo_handle: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">CashApp Tag (Backup)</label>
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

      {/* Interactive Pan & Zoom Image Crop Modal */}
      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={rawImageForCrop}
        onClose={() => setCropModalOpen(false)}
        onCrop={handleCropComplete}
        title="Move & Zoom Profile Picture"
      />
    </div>
  );
}
