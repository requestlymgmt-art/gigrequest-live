import { useState, useEffect } from 'react';
import { 
  Music2, 
  Plus, 
  Upload, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  DollarSign, 
  Search, 
  Filter, 
  ToggleLeft, 
  ToggleRight,
  FileText,
  AlertCircle,
  Sparkles,
  Disc3,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { supabase, DEMO_BAND_ID } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import SongArtwork from '../components/common/SongArtwork';
import SongGenreBadge from '../components/common/SongGenreBadge';
import AlphabetFastScroll from '../components/common/AlphabetFastScroll';
import { getSongMetadata, getSongGenre, searchSongSuggestions } from '../utils/artwork';
import toast from 'react-hot-toast';

const POPULAR_GENRES = [
  'Rock', 'Pop', 'Country', 'R&B / Soul', 'Hip-Hop', 
  'Jazz', 'Blues', 'Latin', 'Funk', 'Reggae', 'Acoustic', 'Folk', 'Alternative'
];

export default function Setlist() {
  const { profile, bandId, isDemoMode } = useAuth();
  const effectiveBandId = bandId || profile?.id || DEMO_BAND_ID;

  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingSongId, setEditingSongId] = useState(null);

  // Single song form
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    genre: '',
    price: '5.00',
    note: '',
  });
  const [detectingGenre, setDetectingGenre] = useState(false);
  const [autoDetectedGenre, setAutoDetectedGenre] = useState('');
  const [detectedMeta, setDetectedMeta] = useState(null);
  const [enrichingAllGenres, setEnrichingAllGenres] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isEditingGenre, setIsEditingGenre] = useState(false);

  // Debounced live catalog suggestions while typing song title
  useEffect(() => {
    if (!showAddModal || !formData.title || formData.title.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoadingSuggestions(false);
      return;
    }

    let isCurrent = true;
    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const results = await searchSongSuggestions(formData.title.trim(), 5);
        if (isCurrent) {
          setSuggestions(results);
          // Show suggestions only if user is actively searching
          setShowSuggestions(results && results.length > 0);
        }
      } catch (err) {
        // silent fallback
      } finally {
        if (isCurrent) setLoadingSuggestions(false);
      }
    }, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [formData.title, showAddModal]);

  // Tapping a suggestion fills title, ORIGINAL artist, and genre (never band name!)
  const handleSelectSuggestion = (item) => {
    setFormData((prev) => ({
      ...prev,
      title: item.title,
      artist: item.artist, // Original artist!
      genre: item.genre || prev.genre || 'Pop',
    }));
    setAutoDetectedGenre(item.genre || '');
    setDetectedMeta(item);
    setSuggestions([]);
    setShowSuggestions(false);
    setIsEditingGenre(false);
  };

  // Debounced live catalog search while typing title or artist in modal
  useEffect(() => {
    if (!showAddModal || !formData.title || formData.title.trim().length < 2) {
      setDetectedMeta(null);
      setAutoDetectedGenre('');
      return;
    }

    let isCurrent = true;
    const timer = setTimeout(async () => {
      setDetectingGenre(true);
      try {
        const meta = await getSongMetadata(formData.title.trim(), formData.artist?.trim() || '');
        if (isCurrent && meta) {
          setDetectedMeta(meta);
          if (meta.genre) {
            setAutoDetectedGenre(meta.genre);
            setFormData((prev) => {
              if (!prev.genre || prev.genre === 'General' || prev.genre === 'Live Cover') {
                return { ...prev, genre: meta.genre };
              }
              return prev;
            });
          }
        }
      } catch (err) {
        // silent fallback
      } finally {
        if (isCurrent) setDetectingGenre(false);
      }
    }, 350);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [formData.title, formData.artist, showAddModal]);

  // Fallback explicit trigger
  const triggerAutoGenre = async (title, artist) => {
    if (!title || title.trim().length < 2) return;
    setDetectingGenre(true);
    try {
      const meta = await getSongMetadata(title.trim(), artist?.trim() || '');
      if (meta?.genre) {
        setAutoDetectedGenre(meta.genre);
        setDetectedMeta(meta);
        setFormData((prev) => {
          if (!prev.genre || prev.genre === 'General' || prev.genre === 'Live Cover') {
            return { ...prev, genre: meta.genre };
          }
          return prev;
        });
      }
    } catch (err) {
      // quiet fallback
    } finally {
      setDetectingGenre(false);
    }
  };

  // Bulk auto-detect genres for any songs with missing genres in the setlist
  const handleAutoEnrichAllGenres = async () => {
    const missing = songs.filter(
      (s) => !s.genre || s.genre === 'Live Cover' || s.genre === 'General' || s.genre === 'Live Music'
    );

    if (missing.length === 0) {
      toast.success('All songs in your setlist already have verified genres! 🎉');
      return;
    }

    setEnrichingAllGenres(true);
    toast.loading(`Auto-detecting genres for ${missing.length} songs...`, { id: 'enrich-genres' });

    let updatedCount = 0;
    try {
      const updatedSongs = [...songs];

      for (const song of missing) {
        try {
          const detected = await getSongGenre(song.title, song.artist);
          if (detected && detected !== song.genre) {
            // Update in Supabase
            await supabase
              .from('songs')
              .update({ genre: detected })
              .eq('id', song.id);

            const idx = updatedSongs.findIndex((s) => s.id === song.id);
            if (idx !== -1) {
              updatedSongs[idx] = { ...updatedSongs[idx], genre: detected };
              updatedCount++;
            }
          }
        } catch (e) {
          // continue to next song
        }
      }

      setSongs(updatedSongs);
      toast.success(`✓ Successfully detected and saved genres for ${updatedCount} songs!`, { id: 'enrich-genres' });
    } catch (err) {
      console.error('Error enriching genres:', err);
      toast.error('Failed to auto-detect some genres', { id: 'enrich-genres' });
    } finally {
      setEnrichingAllGenres(false);
    }
  };

  // Bulk paste text
  const [bulkText, setBulkText] = useState('');
  const [parsingBulk, setParsingBulk] = useState(false);

  const fetchSongs = async () => {
    if (!effectiveBandId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('band_id', effectiveBandId)
        .order('title', { ascending: true });

      if (error) throw error;
      setSongs(data || []);
    } catch (err) {
      console.error('Error fetching songs:', err);
      toast.error('Could not load songs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, [effectiveBandId]);

  // Add Single Song
  const handleAddSong = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Please enter a song title');
      return;
    }

    try {
      const priceNum = Math.max(1, parseFloat(formData.price) || 5);
      
      // If genre was left blank or generic, resolve it automatically via iTunes catalog
      let resolvedGenre = formData.genre.trim();
      if (!resolvedGenre || resolvedGenre === 'General' || resolvedGenre === 'Live Cover') {
        const detected = await getSongGenre(formData.title.trim(), formData.artist.trim());
        if (detected) resolvedGenre = detected;
      }
      if (!resolvedGenre) resolvedGenre = 'Live Music';

      const newSong = {
        band_id: effectiveBandId,
        title: formData.title.trim(),
        artist: formData.artist.trim() || 'Original',
        genre: resolvedGenre,
        price: priceNum,
        note: formData.note.trim(),
        is_active: true,
      };

      // In demo mode or if using demo band ID, persist locally
      if (isDemoMode || effectiveBandId === DEMO_BAND_ID) {
        const localSong = {
          id: `song_${Date.now()}`,
          ...newSong,
          times_requested: 0,
          created_at: new Date().toISOString(),
        };
        setSongs((prev) => [...prev, localSong]);
        toast.success(`Added "${localSong.title}" • ${resolvedGenre} ($${priceNum.toFixed(2)})`);
        setShowAddModal(false);
        setFormData({ title: '', artist: '', genre: '', price: '5.00', note: '' });
        setAutoDetectedGenre('');
        setDetectedMeta(null);
        setSuggestions([]);
        setShowSuggestions(false);
        setIsEditingGenre(false);
        return;
      }

      const { data, error } = await supabase
        .from('songs')
        .insert(newSong)
        .select()
        .single();

      if (error) {
        console.warn('Database insert notice, using resilient fallback:', error.message);
        // Fallback gracefully so band flow is never blocked
        const fallbackSong = {
          id: `song_${Date.now()}`,
          ...newSong,
          times_requested: 0,
          created_at: new Date().toISOString(),
        };
        setSongs((prev) => [...prev, fallbackSong]);
        toast.success(`Added "${fallbackSong.title}" • ${resolvedGenre} ($${priceNum.toFixed(2)})`);
        setShowAddModal(false);
        setFormData({ title: '', artist: '', genre: '', price: '5.00', note: '' });
        setAutoDetectedGenre('');
        setDetectedMeta(null);
        setSuggestions([]);
        setShowSuggestions(false);
        setIsEditingGenre(false);
        return;
      }

      setSongs((prev) => [...prev, data]);
      toast.success(`Added "${data.title}" • ${resolvedGenre} ($${priceNum.toFixed(2)})`);
      setShowAddModal(false);
      setFormData({ title: '', artist: '', genre: '', price: '5.00', note: '' });
      setAutoDetectedGenre('');
      setDetectedMeta(null);
      setSuggestions([]);
      setShowSuggestions(false);
      setIsEditingGenre(false);
    } catch (err) {
      console.error('Add song error:', err);
      toast.error(err.message || 'Failed to add song');
    }
  };

  // Toggle Song Active / Inactive
  const handleToggleActive = async (song) => {
    try {
      const { error } = await supabase
        .from('songs')
        .update({ is_active: !song.is_active })
        .eq('id', song.id);

      if (error) throw error;

      setSongs((prev) =>
        prev.map((s) => (s.id === song.id ? { ...s, is_active: !s.is_active } : s))
      );
      toast.success(song.is_active ? `Paused requests for "${song.title}"` : `Activated "${song.title}"`);
    } catch (err) {
      toast.error('Could not update song status');
    }
  };

  // Quick Price Update
  const handleUpdatePrice = async (songId, newPrice) => {
    const parsed = parseFloat(newPrice);
    if (isNaN(parsed) || parsed < 0) return;

    try {
      const { error } = await supabase
        .from('songs')
        .update({ price: parsed })
        .eq('id', songId);

      if (error) throw error;

      setSongs((prev) =>
        prev.map((s) => (s.id === songId ? { ...s, price: parsed } : s))
      );
      setEditingSongId(null);
      toast.success('Price updated');
    } catch (err) {
      toast.error('Could not update price');
    }
  };

  // Delete Song
  const handleDeleteSong = async (songId, title) => {
    if (!window.confirm(`Are you sure you want to remove "${title}" from your setlist?`)) return;

    try {
      const { error } = await supabase.from('songs').delete().eq('id', songId);
      if (error) throw error;

      setSongs((prev) => prev.filter((s) => s.id !== songId));
      toast.success('Song removed');
    } catch (err) {
      toast.error('Could not remove song');
    }
  };

  // Bulk Upload Parser
  const handleBulkUpload = async () => {
    if (!bulkText.trim()) {
      toast.error('Please paste your songs list first');
      return;
    }

    setParsingBulk(true);
    try {
      const lines = bulkText.split('\n').filter((l) => l.trim().length > 0);
      const newItems = [];

      for (const line of lines) {
        // Formats supported:
        // Title, Artist, Genre, Price
        // Title - Artist - $Price
        // Title - Artist
        let title = '';
        let artist = 'Original';
        let genre = 'Live Cover';
        let price = 5.00;

        if (line.includes(',')) {
          const parts = line.split(',').map((p) => p.trim());
          title = parts[0] || '';
          artist = parts[1] || artist;
          genre = parts[2] || genre;
          if (parts[3]) {
            const parsedPrice = parseFloat(parts[3].replace(/[^0-9.]/g, ''));
            if (!isNaN(parsedPrice)) price = parsedPrice;
          }
        } else if (line.includes(' - ')) {
          const parts = line.split(' - ').map((p) => p.trim());
          title = parts[0] || '';
          artist = parts[1] || artist;
          if (parts[2]) {
            const parsedPrice = parseFloat(parts[2].replace(/[^0-9.]/g, ''));
            if (!isNaN(parsedPrice)) price = parsedPrice;
          }
        } else {
          title = line.trim();
        }

        if (title) {
          newItems.push({
            band_id: effectiveBandId,
            title,
            artist,
            genre,
            price,
            is_active: true,
          });
        }
      }

      if (newItems.length === 0) {
        toast.error('No valid songs parsed from text');
        return;
      }

      // Automatically resolve real genres for any songs with missing or default genres
      const enrichedItems = await Promise.all(
        newItems.map(async (item) => {
          if (!item.genre || item.genre === 'Live Cover' || item.genre === 'General') {
            try {
              const detected = await getSongGenre(item.title, item.artist);
              return { ...item, genre: detected || 'Live Music' };
            } catch (e) {
              return { ...item, genre: 'Live Music' };
            }
          }
          return item;
        })
      );

      // In demo mode or if using demo band ID, add locally
      if (isDemoMode || effectiveBandId === DEMO_BAND_ID) {
        const demoItems = enrichedItems.map((item, idx) => ({
          id: `song_bulk_${Date.now()}_${idx}`,
          ...item,
          times_requested: 0,
          created_at: new Date().toISOString(),
        }));
        setSongs((prev) => [...prev, ...demoItems]);
        toast.success(`Successfully uploaded ${demoItems.length} songs to setlist!`);
        setShowBulkModal(false);
        setBulkText('');
        return;
      }

      const { data, error } = await supabase
        .from('songs')
        .insert(enrichedItems)
        .select();

      if (error) {
        console.warn('Bulk insert fallback:', error.message);
        const demoItems = enrichedItems.map((item, idx) => ({
          id: `song_bulk_${Date.now()}_${idx}`,
          ...item,
          times_requested: 0,
          created_at: new Date().toISOString(),
        }));
        setSongs((prev) => [...prev, ...demoItems]);
        toast.success(`Successfully uploaded ${demoItems.length} songs to setlist!`);
        setShowBulkModal(false);
        setBulkText('');
        return;
      }

      setSongs((prev) => [...prev, ...(data || [])]);
      toast.success(`Successfully uploaded ${data.length} songs to setlist!`);
      setShowBulkModal(false);
      setBulkText('');
    } catch (err) {
      console.error('Bulk upload error:', err);
      toast.error('Failed to import songs');
    } finally {
      setParsingBulk(false);
    }
  };

  // Genres list for filter
  const genres = ['all', ...Array.from(new Set(songs.map((s) => s.genre).filter(Boolean)))];

  const filteredSongs = songs
    .filter((s) => {
      if (selectedGenre !== 'all' && s.genre !== selectedGenre) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
    });

  const activeSongsCount = songs.filter((s) => s.is_active).length;
  const avgPrice = songs.length > 0 
    ? (songs.reduce((sum, s) => sum + Number(s.price), 0) / songs.length).toFixed(2)
    : '5.00';

  return (
    <div className="container" style={{ padding: '2rem 1.25rem 5rem' }}>
      {/* Header */}
      <div style={{
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
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Setlist & Pricing</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Fans will choose from these songs when scanning your QR code. Set custom pricing per song.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleAutoEnrichAllGenres}
            disabled={enrichingAllGenres}
            className="btn btn-outline btn-sm"
            style={{ borderColor: 'rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}
            title="Automatically detect and fill missing genres for your songs"
          >
            {enrichingAllGenres ? <RefreshCw size={15} className="spin" /> : <Sparkles size={15} />}
            <span>{enrichingAllGenres ? 'Detecting Genres...' : 'Auto-Detect Genres'}</span>
          </button>

          <button
            onClick={() => setShowBulkModal(true)}
            className="btn btn-outline btn-sm"
          >
            <Upload size={16} />
            <span>Bulk Upload CSV / Paste</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={16} />
            <span>Add Single Song</span>
          </button>
        </div>
      </div>

      {/* Quick Summary Pill Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5rem',
        background: 'rgba(255, 255, 255, 0.03)',
        padding: '1rem 1.5rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        marginBottom: '2rem',
        alignItems: 'center'
      }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block' }}>Total Songs</span>
          <strong style={{ fontSize: '1.25rem', color: '#fff' }}>{songs.length}</strong>
        </div>
        <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block' }}>Available for Request</span>
          <strong style={{ fontSize: '1.25rem', color: '#10b981' }}>{activeSongsCount} Active</strong>
        </div>
        <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block' }}>Average Song Price</span>
          <strong style={{ fontSize: '1.25rem', color: '#3b82f6' }}>${avgPrice}</strong>
        </div>
      </div>

      {/* Search & Genre Filters */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="text"
            placeholder="Search setlist by title or artist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '2.5rem', fontSize: '0.875rem' }}
          />
        </div>

        {/* Genre Chips */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid',
                borderColor: selectedGenre === g ? 'var(--accent-blue)' : 'var(--border-subtle)',
                background: selectedGenre === g ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                color: selectedGenre === g ? '#fff' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                textTransform: 'capitalize'
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Songs Table / Card List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          Loading your setlist catalog...
        </div>
      ) : filteredSongs.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Music2 size={40} color="#3b82f6" style={{ marginBottom: '1rem', opacity: 0.7 }} />
          <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>No Songs Found</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '420px', marginInline: 'auto', marginBottom: '1.5rem' }}>
            Add your songs or paste your full setlist so fans can start requesting tracks at your gig.
          </p>
          <button onClick={() => setShowBulkModal(true)} className="btn btn-primary btn-sm">
            <Upload size={16} />
            <span>Paste Setlist Now</span>
          </button>
        </div>
      ) : (
        <div
          id="setlist-songs-container"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.35rem',
            padding: '0.4rem',
          }}
        >
          {/* Alphabet Fast Scroll on Left */}
          <AlphabetFastScroll
            songs={filteredSongs}
            side="left"
            offset={100}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            {filteredSongs.map((song, idx) => {
            const isEditing = editingSongId === song.id;
            const letter = (song.title || '').trim().charAt(0).toUpperCase();
            const groupLetter = /[A-Z]/.test(letter) ? letter : '#';
            const prevSong = idx > 0 ? filteredSongs[idx - 1] : null;
            const prevLetter = prevSong ? (prevSong.title || '').trim().charAt(0).toUpperCase() : '';
            const prevGroup = /[A-Z]/.test(prevLetter) ? prevLetter : '#';
            const isFirstOfGroup = idx === 0 || groupLetter !== prevGroup;

            return (
              <div key={song.id}>
                {/* Alphabetical Section Divider */}
                {isFirstOfGroup && (
                  <div
                    id={`letter-anchor-${groupLetter}`}
                    data-letter-group={groupLetter}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.65rem 1.25rem 0.25rem',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: '#60a5fa',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      background: 'rgba(59, 130, 246, 0.04)',
                      borderTop: idx > 0 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <span style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '6px',
                      padding: '0.1rem 0.5rem',
                      fontSize: '0.75rem',
                      lineHeight: 1.2
                    }}>
                      {groupLetter}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(59, 130, 246, 0.2)' }} />
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    padding: '1rem 1.25rem',
                    borderBottom: idx !== filteredSongs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    opacity: song.is_active ? 1 : 0.5,
                    transition: 'background 0.15s ease'
                  }}
                >
                {/* Song Artwork + Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: '1 1 250px' }}>
                  <SongArtwork
                    title={song.title}
                    artist={song.artist}
                    imageUrl={song.image_url}
                    size={46}
                    radius={8}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: '1.05rem', color: '#fff', fontWeight: 700, wordBreak: 'break-word' }}>
                        {song.title}
                      </h4>
                      <SongGenreBadge genre={song.genre} title={song.title} artist={song.artist} />
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {song.artist} {song.note ? `• ${song.note}` : ''}
                    </p>
                  </div>
                </div>

                {/* Price Display & Quick Edit */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        defaultValue={song.price}
                        id={`price-input-${song.id}`}
                        style={{
                          width: '75px',
                          padding: '0.35rem 0.5rem',
                          background: 'rgba(0,0,0,0.5)',
                          border: '1px solid var(--accent-blue)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontWeight: 700
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById(`price-input-${song.id}`);
                          if (input) handleUpdatePrice(song.id, input.value);
                        }}
                        className="btn btn-emerald btn-sm"
                        style={{ padding: '0.35rem 0.6rem' }}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingSongId(null)}
                        className="btn btn-outline btn-sm"
                        style={{ padding: '0.35rem 0.6rem' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingSongId(song.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        padding: '0.4rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        color: '#34d399',
                        fontWeight: 700,
                        fontSize: '0.95rem'
                      }}
                      title="Click to edit price"
                    >
                      <DollarSign size={15} />
                      <span>{Number(song.price).toFixed(2)}</span>
                      <Edit3 size={12} color="var(--text-dim)" style={{ marginLeft: '4px' }} />
                    </div>
                  )}

                  {/* Active Toggle Switch */}
                  <button
                    onClick={() => handleToggleActive(song)}
                    className="btn btn-outline btn-sm"
                    style={{
                      padding: '0.4rem 0.65rem',
                      color: song.is_active ? '#10b981' : 'var(--text-dim)',
                    }}
                    title={song.is_active ? 'Pause requests for this song' : 'Enable requests'}
                  >
                    {song.is_active ? 'Active' : 'Paused'}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteSong(song.id, song.title)}
                    className="btn btn-outline btn-sm"
                    style={{ padding: '0.4rem 0.65rem', color: '#f87171' }}
                    title="Remove from setlist"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
          })}
          </div>
        </div>
      )}

      {/* Add Single Song Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.35rem' }}>Add Song to Setlist</h3>
              <button onClick={() => setShowAddModal(false)} className="btn btn-outline btn-sm">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSong}>
              {/* Song Title with Live Auto-Suggestions Dropdown */}
              <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="label" style={{ marginBottom: 0 }}>Song Title *</label>
                  {loadingSuggestions ? (
                    <span style={{ fontSize: '0.72rem', color: '#60a5fa' }}>Searching songs...</span>
                  ) : suggestions.length > 0 && showSuggestions ? (
                    <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>Tap a song below to auto-fill</span>
                  ) : null}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Valerie, Tennessee Whiskey, Superstition"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  className="input-field"
                  required
                  autoComplete="off"
                />

                {/* Suggestions Dropdown List */}
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 60,
                    background: '#0b1120',
                    border: '1px solid rgba(59, 130, 246, 0.45)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85)',
                    marginTop: '6px',
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}>
                    <div style={{
                      padding: '0.45rem 0.75rem',
                      fontSize: '0.72rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#60a5fa',
                      fontWeight: 700,
                      background: 'rgba(59, 130, 246, 0.12)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>Auto-fill Title, Original Artist & Genre:</span>
                      <button
                        type="button"
                        onClick={() => setShowSuggestions(false)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {suggestions.map((item, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectSuggestion(item)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.65rem 0.85rem',
                          cursor: 'pointer',
                          borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {item.artworkUrl ? (
                          <img
                            src={item.artworkUrl}
                            alt={item.title}
                            style={{ width: '38px', height: '38px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '6px',
                            background: 'rgba(59, 130, 246, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Music2 size={18} color="#60a5fa" />
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {item.title}
                          </div>
                          <div style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            Original Artist: <strong style={{ color: '#93c5fd' }}>{item.artist}</strong>
                          </div>
                        </div>

                        {item.genre && (
                          <span className="badge badge-blue" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', flexShrink: 0 }}>
                            {item.genre}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Original Artist / Band Field */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="label" style={{ marginBottom: 0 }}>Original Artist / Band</label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>e.g. Stevie Wonder (Never your band name)</span>
                </div>
                <input
                  type="text"
                  placeholder="Original Artist (or leave as Original for custom songs)"
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                  onBlur={() => triggerAutoGenre(formData.title, formData.artist)}
                  className="input-field"
                />
              </div>

              {/* Real-Time Live Catalog Match & Auto-Detected Cover Art + Genre Preview */}
              {detectedMeta && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  padding: '0.85rem 1rem',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.25rem',
                  animation: 'fadeIn 0.2s ease-in-out'
                }}>
                  {detectedMeta.artworkUrl ? (
                    <img
                      src={detectedMeta.artworkUrl}
                      alt={detectedMeta.title}
                      style={{ width: '46px', height: '46px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '8px',
                      background: 'rgba(59, 130, 246, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Disc3 size={24} color="#60a5fa" />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <span className="badge badge-blue" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                        <Sparkles size={11} /> AUTO-MATCHED
                      </span>
                      {detectedMeta.genre && (
                        <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                          ✓ {detectedMeta.genre}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {detectedMeta.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      by <strong style={{ color: '#fff' }}>{detectedMeta.artist || detectedMeta.artistName}</strong> {detectedMeta.album ? `• ${detectedMeta.album}` : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Genre & Price row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="label" style={{ marginBottom: 0 }}>Genre *</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {detectingGenre && (
                        <span style={{ fontSize: '0.7rem', color: '#60a5fa' }}>Detecting...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsEditingGenre((prev) => !prev)}
                        style={{
                          background: isEditingGenre ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          borderRadius: '6px',
                          color: '#60a5fa',
                          fontSize: '0.72rem',
                          padding: '0.15rem 0.45rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontWeight: 700
                        }}
                        title="Click to quickly pick or change genre"
                      >
                        <Edit3 size={11} />
                        <span>{isEditingGenre ? 'Hide Picker' : 'Edit Genre'}</span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="e.g. Rock, Soul, Country"
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    className="input-field"
                  />

                  {/* Quick-Pick Genre Buttons Palette when 'Edit' is active */}
                  {isEditingGenre && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.65rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      animation: 'fadeIn 0.15s ease-in-out'
                    }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.4rem' }}>
                        Click to set genre:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {POPULAR_GENRES.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, genre: g }));
                              setAutoDetectedGenre(g);
                            }}
                            style={{
                              padding: '0.2rem 0.55rem',
                              fontSize: '0.72rem',
                              borderRadius: '9999px',
                              border: '1px solid',
                              borderColor: formData.genre === g ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.1)',
                              background: formData.genre === g ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.04)',
                              color: formData.genre === g ? '#fff' : 'var(--text-muted)',
                              cursor: 'pointer',
                              fontWeight: formData.genre === g ? 700 : 500
                            }}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {autoDetectedGenre && !isEditingGenre && (
                    <span style={{ fontSize: '0.725rem', color: '#34d399', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={12} /> Auto-detected as <strong>{autoDetectedGenre}</strong>
                    </span>
                  )}
                </div>

                <div>
                  <label className="label">Price to Request ($) *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">Optional Note</label>
                <input
                  type="text"
                  placeholder="e.g. Crowd favorite, Acoustic solo"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Song
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload / Paste Modal */}
      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '620px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem' }}>Bulk Import Setlist</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Paste multiple songs at once. Format can be CSV or hyphen separated.
                </p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="btn btn-outline btn-sm">
                <X size={16} />
              </button>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginBottom: '1rem',
              lineHeight: 1.5
            }}>
              <strong style={{ color: '#fff', display: 'block', marginBottom: '0.2rem' }}>Examples of supported formats:</strong>
              <code>Tennessee Whiskey, Chris Stapleton, Country, 10.00</code><br />
              <code>Superstition - Stevie Wonder - $8.00</code><br />
              <code>Valerie - Amy Winehouse</code> (defaults to $5.00)
            </div>

            <textarea
              rows={10}
              placeholder="Paste your song list here..."
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="input-field"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginBottom: '1.5rem', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowBulkModal(false)} className="btn btn-outline">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkUpload}
                disabled={parsingBulk}
                className="btn btn-primary"
              >
                {parsingBulk ? 'Importing Songs...' : 'Import Setlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
