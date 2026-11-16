// src/hooks/useEventTimer.js
// Live ticking timer for ongoing events (HH:MM:SS)
import { useState, useEffect } from 'react';

export function useEventTimer(startTime) {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!startTime) {
      setElapsed('00:00:00');
      return;
    }

    const startMs = new Date(startTime).getTime();

    const update = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - startMs) / 1000));
      const hours = Math.floor(diffSec / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);
      const seconds = diffSec % 60;
      setElapsed(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}
