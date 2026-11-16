// src/components/common/AlphabetFastScroll.jsx
// Fast alphabetical scroller for jumping smoothly through song lists
// Fixed position that follows you as you scroll songs, staying completely hidden when viewing the bio/profile
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

export default function AlphabetFastScroll({
  songs = [],
  side = 'left',
  offset = 110, // Top distance from viewport
  minSongs = 5,  // Only show if list has enough songs to warrant fast scrolling
  containerId = 'song-list-container',
}) {
  const [activeLetter, setActiveLetter] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef(null);
  const stripRef = useRef(null);
  const lastScrolledLetterRef = useRef(null);

  // Extract distinct first letters from current song list in alphabetical order
  const letters = useMemo(() => {
    if (!songs || songs.length < minSongs) return [];

    const set = new Set();
    songs.forEach((song) => {
      const title = (song.title || '').trim();
      if (!title) return;
      const first = title.charAt(0).toUpperCase();
      if (/[A-Z]/.test(first)) {
        set.add(first);
      } else {
        set.add('#');
      }
    });

    return Array.from(set).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
  }, [songs, minSongs]);

  // Keep scroller visible ONLY while actively browsing the song list
  // It stays strictly hidden when viewing the profile header/bio/tip section above
  useEffect(() => {
    const handleScroll = () => {
      const container = document.getElementById(containerId) || document.querySelector('[data-letter-group]');
      if (!container) {
        setIsVisible(false);
        return;
      }

      const rect = container.getBoundingClientRect();
      // Only appear once the songs have reached near the top (rect.top <= offset + 40)
      // and remain active while songs are on screen (rect.bottom >= 180)
      const inView = rect.top <= (offset + 40) && rect.bottom >= 180;
      setIsVisible(inView);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [containerId, offset, songs]);

  // Scroll to the first song matching the selected letter
  const scrollToLetter = useCallback((letter, instant = false) => {
    if (!letter) return;
    if (lastScrolledLetterRef.current === letter && isDragging) return;
    lastScrolledLetterRef.current = letter;

    // First try finding an element with exact id `letter-anchor-${letter}`
    let target = document.getElementById(`letter-anchor-${letter}`);

    // If not found, find the first song card whose title starts with the letter
    if (!target) {
      const selector = letter === '#'
        ? '[data-letter-group="#"]'
        : `[data-letter-group="${letter}"]`;
      target = document.querySelector(selector);
    }

    if (target) {
      const rect = target.getBoundingClientRect();
      const targetY = window.pageYOffset + rect.top - offset;

      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: instant ? 'auto' : 'smooth',
      });

      if (navigator.vibrate) {
        try { navigator.vibrate(6); } catch (e) {}
      }
    }

    setActiveLetter(letter);

    // Auto-hide indicator bubble after release
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setActiveLetter(null);
      setIsDragging(false);
    }, 700);
  }, [offset, isDragging]);

  // Compute letter from touch coordinates
  const handleTouch = useCallback((clientY, instant = true) => {
    if (!stripRef.current || letters.length === 0) return;
    const rect = stripRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const progress = Math.max(0, Math.min(1, relativeY / rect.height));
    const index = Math.floor(progress * letters.length);
    const safeIndex = Math.max(0, Math.min(letters.length - 1, index));
    const letter = letters[safeIndex];

    if (letter) {
      scrollToLetter(letter, instant);
    }
  }, [letters, scrollToLetter]);

  // Touch event listeners with passive: false to prevent scrolling while dragging the alphabet
  const onTouchStart = (e) => {
    e.preventDefault();
    setIsDragging(true);
    handleTouch(e.touches[0].clientY, false);
  };

  const onTouchMove = (e) => {
    e.preventDefault();
    setIsDragging(true);
    handleTouch(e.touches[0].clientY, true);
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    lastScrolledLetterRef.current = null;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setActiveLetter(null), 700);
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (letters.length < 2) return null;

  return (
    <>
      {/* Alphabetical Fast Scroll Vertical Strip - Fixed and follows user as they scroll songs */}
      <div
        ref={stripRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'fixed',
          [side]: '4px',
          top: `${offset}px`,
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
          transform: isVisible ? 'scale(1)' : 'scale(0.85)',
          transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 80,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1px',
          background: 'rgba(11, 15, 25, 0.88)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
          borderRadius: '12px',
          padding: '4px 1px',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          width: '20px',
        }}
      >
        {letters.map((char) => {
          const isActive = activeLetter === char;
          return (
            <button
              key={char}
              type="button"
              onClick={() => scrollToLetter(char, false)}
              style={{
                background: isActive ? '#3b82f6' : 'transparent',
                color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                border: 'none',
                borderRadius: '4px',
                width: '16px',
                height: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6rem',
                fontWeight: isActive ? 800 : 700,
                lineHeight: 1,
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                transition: 'transform 0.1s ease, color 0.1s ease, background 0.1s ease',
                transform: isActive ? 'scale(1.25)' : 'scale(1)',
              }}
              aria-label={`Jump to ${char}`}
            >
              {char}
            </button>
          );
        })}
      </div>

      {/* Floating Magnifying Letter Bubble */}
      {activeLetter && isVisible && (
        <div
          style={{
            position: 'fixed',
            left: side === 'left' ? '38px' : 'auto',
            right: side === 'right' ? '38px' : 'auto',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 99,
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            boxShadow: '0 8px 24px rgba(59, 130, 246, 0.55), 0 2px 6px rgba(0,0,0,0.4)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.65rem',
            fontWeight: 900,
            pointerEvents: 'none',
            border: '2px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          {activeLetter}
        </div>
      )}
    </>
  );
}
