import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  QrCode, 
  DollarSign, 
  Music, 
  Smartphone, 
  Radio, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Landing() {
  const { enterDemoMode } = useAuth();
  const navigate = useNavigate();
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleLaunchDemo = async () => {
    setLoadingDemo(true);
    try {
      await enterDemoMode();
      toast.success('Loaded live demo band: The Groove Collective!');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Could not load demo');
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div style={{ paddingBottom: '5rem' }}>
      {/* Hero Section */}
      <section style={{
        padding: '5rem 0 4rem',
        textAlign: 'center',
        position: 'relative'
      }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', marginBottom: '1.5rem' }}>
            <span className="badge badge-blue" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
              <Sparkles size={14} /> The Live Song-Request & Tipping Platform
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.2rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: '1.5rem',
            letterSpacing: '-0.03em'
          }}>
            Turn Gig Audiences into <br />
            <span style={{
              background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Active Tippers & Requesters
            </span>
          </h1>

          <p style={{
            fontSize: 'clamp(1.1rem, 2vw, 1.35rem)',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            marginBottom: '2.5rem',
            maxWidth: '720px',
            marginInline: 'auto'
          }}>
            Fans scan a QR code at your gig, pick songs from your personal setlist, and pay to request them via Stripe. 
            <strong style={{ color: '#fff' }}> The processing fee is charged to the fan</strong>, so you keep 100% of your tips.
          </p>

          {/* Call to Actions */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '3rem'
          }}>
            <button
              onClick={handleLaunchDemo}
              disabled={loadingDemo}
              className="btn btn-primary btn-lg"
            >
              <Radio size={20} />
              <span>{loadingDemo ? 'Opening Stage...' : 'Launch Live Band Demo'}</span>
              <ArrowRight size={18} />
            </button>

            <Link
              to="/live/groove-collective"
              className="btn btn-outline btn-lg"
              target="_blank"
            >
              <Smartphone size={20} />
              <span>Test Public Fan Page</span>
            </Link>
          </div>

          {/* Social Proof Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '1.5rem',
            padding: '0.75rem 1.5rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.875rem',
            color: 'var(--text-muted)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle2 size={16} color="#10b981" /> Zero App Downloads
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle2 size={16} color="#10b981" /> 100% Direct Stripe Payouts
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle2 size={16} color="#10b981" /> Real-Time Stage Alerts
            </span>
          </div>
        </div>
      </section>

      {/* Live Experience Interactive Preview */}
      <section style={{ padding: '2rem 0 4rem' }}>
        <div className="container">
          <div className="glass-card" style={{
            padding: '3rem 2rem',
            background: 'linear-gradient(180deg, rgba(23, 26, 38, 0.85) 0%, rgba(15, 17, 26, 0.98) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '3rem',
              alignItems: 'center'
            }}>
              {/* Left Column: What Musician Sees */}
              <div>
                <span className="badge badge-emerald" style={{ marginBottom: '1rem' }}>
                  <Radio size={14} /> LIVE STAGE COMMAND CENTER
                </span>
                <h2 style={{ fontSize: '2.2rem', marginBottom: '1rem' }}>
                  Watch Requests & Tips Roll in Real-Time
                </h2>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  Keep your iPad or phone on your mic stand. As soon as a fan pays, the request pops up with their shoutout message, dedication, and payment confirmation.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981',
                      flexShrink: 0
                    }}>
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>Fan Pays All Fees</h4>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        If a song is $10 and the fan adds a $5 tip, you get $15. The Stripe processing fee is transparently added on the fan's receipt.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#3b82f6',
                      flexShrink: 0
                    }}>
                      <Music size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>Full Setlist Control</h4>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Set individual prices per song ($5 for easy hits, $15 for hard vocal tracks) or allow custom song bids.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#f59e0b',
                      flexShrink: 0
                    }}>
                      <QrCode size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>Instant QR Code Generation</h4>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Print table-tents or display on your stage banner. Fans scan with their default camera app and are ready in seconds.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Mock Card */}
              <div style={{
                background: 'rgba(11, 12, 16, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-xl)',
                padding: '1.75rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="live-pulse" />
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>Incoming Live Request</span>
                  </div>
                  <span className="badge badge-emerald">PAID VIA STRIPE</span>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Song Requested
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                    Tennessee Whiskey
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Original by Chris Stapleton
                  </div>
                </div>

                {/* Fan message */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderLeft: '3px solid #3b82f6',
                  padding: '1rem',
                  borderRadius: '0 8px 8px 0',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 700, marginBottom: '0.2rem' }}>
                    Dave & Sarah (Table 7) says:
                  </div>
                  <div style={{ fontSize: '0.95rem', color: '#e2e8f0', fontStyle: 'italic' }}>
                    "Happy 10th anniversary to my lovely wife! You guys sound incredible tonight, thank you!"
                  </div>
                </div>

                {/* Financial breakdown */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      Band Payout (Song + $15 Tip)
                    </span>
                    <strong style={{ fontSize: '1.35rem', color: '#34d399' }}>+$25.00</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      Fan Covered Fee
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 600 }}>$1.03</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Step Workflow */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>How It Works at Gigs</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', maxWidth: '600px', marginInline: 'auto' }}>
            Built by and for musicians. No complex app installs, no awkward cash jars, just clean digital tipping.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem'
          }}>
            <div className="glass-card" style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: '2rem',
                fontWeight: 900,
                color: 'rgba(59, 130, 246, 0.4)',
                marginBottom: '0.5rem'
              }}>
                01
              </div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Add Setlist & Pricing</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Paste your songs into our setlist manager in 30 seconds. Choose how much each song costs to request ($5, $10, etc.).
              </p>
            </div>

            <div className="glass-card" style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: '2rem',
                fontWeight: 900,
                color: 'rgba(16, 185, 129, 0.4)',
                marginBottom: '0.5rem'
              }}>
                02
              </div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Place QR Code On Stage</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Download your printable table-tent flyer or stage banner sign. Fans point their phone cameras and your menu opens instantly.
              </p>
            </div>

            <div className="glass-card" style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: '2rem',
                fontWeight: 900,
                color: 'rgba(245, 158, 11, 0.4)',
                marginBottom: '0.5rem'
              }}>
                03
              </div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Get Paid in Real Time</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Fans pay securely via Apple Pay, Google Pay, or Card. Songs land in your live queue, you play them, and keep 100% of the funds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container">
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.1))',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: 'var(--radius-xl)',
            padding: '3.5rem 2rem',
            textAlign: 'center',
            position: 'relative'
          }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
              Ready for Your Next Gig?
            </h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '550px', marginInline: 'auto', marginBottom: '2rem', fontSize: '1.1rem' }}>
              Create your Requestly musician account today, connect your Stripe, and start earning up to 3x more tips from every crowd.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/register" className="btn btn-primary btn-lg">
                Create Musician Account Free
              </Link>
              <button onClick={handleLaunchDemo} className="btn btn-outline btn-lg">
                Explore Demo Band
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
