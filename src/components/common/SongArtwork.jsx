// src/components/common/SongArtwork.jsx
import { useState, useEffect } from 'react';
import { Music, Disc3 } from 'lucide-react';
import { getSongArtworkUrl } from '../../utils/artwork';

// Generates consistent elegant gradient colors based on string
function getGradientFromText(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const gradients = [
    'linear-gradient(135deg, #1e3a8a, #3b82f6)',
    'linear-gradient(135deg, #1e1b4b, #2563eb)',
    'linear-gradient(135deg, #0f172a, #1d4ed8)',
    'linear-gradient(135deg, #0369a1, #38bdf8)',
    'linear-gradient(135deg, #312e81, #60a5fa)',
    'linear-gradient(135deg, #172554, #2563eb)',
  ];
  const idx = Math.abs(hash) % gradients.length;
  return gradients[idx];
}

export default function SongArtwork({
  title = '',
  artist = '',
  imageUrl = null,
  size = 46,
  radius = 10,
  style = {},
  className = '',
}) {
  const [artworkUrl, setArtworkUrl] = useState(imageUrl || null);
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setHasError(false);
    setLoaded(false);

    if (imageUrl) {
      setArtworkUrl(imageUrl);
      return;
    }

    if (!title) {
      setArtworkUrl(null);
      return;
    }

    getSongArtworkUrl(title, artist, imageUrl).then((url) => {
      if (isCurrent) {
        setArtworkUrl(url);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [title, artist, imageUrl]);

  const fallbackGradient = getGradientFromText(`${title}_${artist}`);
  const iconSize = Math.max(16, Math.round(size * 0.42));

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: `${radius}px`,
        overflow: 'hidden',
        background: fallbackGradient,
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
        ...style,
      }}
    >
      {artworkUrl && !hasError ? (
        <img
          src={artworkUrl}
          alt={`${title} by ${artist}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setHasError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.25s ease-in-out',
          }}
        />
      ) : null}

      {/* Fallback musical vinyl placeholder */}
      {(!artworkUrl || hasError || !loaded) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.85)',
          }}
        >
          <Disc3 size={iconSize} style={{ opacity: 0.85 }} />
        </div>
      )}
    </div>
  );
}

