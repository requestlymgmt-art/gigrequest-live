// src/components/common/SongGenreBadge.jsx
// Automatically displays the song's genre, dynamically detecting it via the iTunes catalog
// if it is missing or generic (just like SongArtwork does for album covers).
import { useState, useEffect } from 'react';
import { getSongGenre } from '../../utils/artwork';

export default function SongGenreBadge({
  genre = '',
  title = '',
  artist = '',
  style = {},
  className = '',
  showPrefix = false,
}) {
  const [displayGenre, setDisplayGenre] = useState(genre && genre !== 'Live Cover' && genre !== 'General' ? genre : '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If a valid genre is already provided, use it directly
    if (genre && genre !== 'Live Cover' && genre !== 'General') {
      setDisplayGenre(genre);
      return;
    }

    // If genre is missing or generic, resolve it dynamically via catalog
    if (!title) return;

    let isCurrent = true;
    setLoading(true);

    getSongGenre(title, artist).then((detected) => {
      if (isCurrent && detected) {
        setDisplayGenre(detected);
      }
      if (isCurrent) setLoading(false);
    }).catch(() => {
      if (isCurrent) setLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [genre, title, artist]);

  if (!displayGenre && !loading) return null;

  return (
    <span
      className={className || 'badge'}
      style={{
        background: 'rgba(59, 130, 246, 0.1)',
        color: '#60a5fa',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        fontSize: '0.72rem',
        fontWeight: 600,
        padding: '0.2rem 0.55rem',
        borderRadius: '6px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        ...style,
      }}
    >
      {showPrefix && <span>•</span>}
      <span>{displayGenre || 'Detecting...'}</span>
    </span>
  );
}

