import { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  QrCode, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles,
  Smartphone,
  Share2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function QRCodeHub() {
  const { profile } = useAuth();
  const slug = profile?.slug || 'groove-collective';
  const bandName = profile?.band_name || 'The Groove Collective';

  const [copied, setCopied] = useState(false);
  const [headline, setHeadline] = useState('Scan to Request a Song & Tip the Band!');
  const qrRef = useRef(null);

  const fanUrl = `${window.location.origin}/live/${slug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fanUrl);
    setCopied(true);
    toast.success('Public fan page URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const canvas = document.getElementById('gig-qr-canvas');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `${slug}-gig-qrcode.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    toast.success('QR Code downloaded as PNG!');
  };

  const handlePrintFlyer = () => {
    window.print();
  };

  return (
    <div className="container" style={{ padding: '2rem 1.25rem 5rem' }}>
      {/* Header (hidden in print) */}
      <div className="no-print" style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1.25rem',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Gig QR Code & Stage Sign</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Display this QR code at your gig so fans can scan, pick songs from your setlist, and tip with Stripe.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button onClick={handleDownloadQR} className="btn btn-outline btn-sm">
            <Download size={16} />
            <span>Download PNG</span>
          </button>
          <button onClick={handlePrintFlyer} className="btn btn-primary btn-sm">
            <Printer size={16} />
            <span>Print Stage Flyer</span>
          </button>
        </div>
      </div>

      {/* Share Link Banner (hidden in print) */}
      <div className="no-print glass-card" style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '2.5rem',
        background: 'rgba(59, 130, 246, 0.08)',
        borderColor: 'rgba(59, 130, 246, 0.35)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(59, 130, 246, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6'
          }}>
            <Share2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your Public Fan Page URL
            </div>
            <strong style={{ fontSize: '1rem', color: '#fff', wordBreak: 'break-all' }}>
              {fanUrl}
            </strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleCopyLink} className="btn btn-outline btn-sm">
            {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </button>
          <a href={fanUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
            <ExternalLink size={16} />
            <span>Open Page</span>
          </a>
        </div>
      </div>

      {/* Stage Sign Preview Card & Printable Flyer */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div 
          className="gig-flyer-printable"
          style={{
            background: '#ffffff',
            color: '#0f172a',
            borderRadius: 'var(--radius-xl)',
            padding: '3rem 2.5rem',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            position: 'relative'
          }}
        >
          {/* Top Live Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '9999px',
            padding: '0.35rem 0.85rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#475569',
            marginBottom: '1.25rem',
            textTransform: 'uppercase'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            LIVE ON STAGE TONIGHT
          </div>

          {/* Band Name */}
          <h2 style={{
            fontSize: '2.4rem',
            fontWeight: 800,
            color: '#090d16',
            lineHeight: 1.1,
            marginBottom: '0.5rem',
            fontFamily: 'var(--font-heading)'
          }}>
            {bandName}
          </h2>

          <p style={{
            color: '#64748b',
            fontSize: '1rem',
            fontWeight: 500,
            marginBottom: '2rem'
          }}>
            {headline}
          </p>

          {/* Center QR Code Container */}
          <div style={{
            display: 'inline-block',
            padding: '1.25rem',
            background: '#ffffff',
            border: '4px solid #0f172a',
            borderRadius: '20px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
            marginBottom: '1.75rem'
          }}>
            <QRCodeCanvas
              id="gig-qr-canvas"
              value={fanUrl}
              size={220}
              level="H"
              marginSize={2}
            />
          </div>

          {/* Instructions */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.5rem',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem' }}>
              <Smartphone size={16} /> How to Request:
            </div>
            <ol style={{ paddingLeft: '1.25rem', color: '#475569', fontSize: '0.85rem', lineHeight: 1.5 }}>
              <li>Open your phone's camera & scan the code.</li>
              <li>Browse our live song list & pick your song.</li>
              <li>Add your shoutout message & pay via Apple Pay, Google Pay, or Card!</li>
            </ol>
          </div>

          <div style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#64748b',
            borderTop: '1px solid #e2e8f0',
            paddingTop: '1rem'
          }}>
            Powered by Requestly • 100% of tips go directly to the musicians
          </div>
        </div>
      </div>
    </div>
  );
}
