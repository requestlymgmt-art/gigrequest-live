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
  AlertCircle
} from 'lucide-react';
import { supabase, DEMO_BAND_ID } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Setlist() {
  const { profile, bandId } = useAuth();
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
      const newSong = {
        band_id: effectiveBandId,
        title: formData.title.trim(),
        artist: formData.artist.trim() || profile?.band_name || 'Cover',
        genre: formData.genre.trim() || 'General',
        price: priceNum,
        note: formData.note.trim(),
        is_active: true,
      };

      const { data, error } = await supabase
        .from('songs')
        .insert(newSong)
        .select()
        .single();

      if (error) throw error;

      setSongs((prev) => [...prev, data]);
      toast.success(`Added "${data.title}" ($${priceNum.toFixed(2)})`);
      setShowAddModal(false);
      setFormData({ title: '', artist: '', genre: '', price: '5.00', note: '' });
    } catch (err) {
      console.error('Add song error:', err);
      toast.error('Failed to add song');
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
        let artist = profile?.band_name || 'Cover';
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

      const { data, error } = await supabase
        .from('songs')
        .insert(newItems)
        .select();

      if (error) throw error;

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
          <strong style={{ fontSize: '1.25rem', color: '#8b5cf6' }}>${avgPrice}</strong>
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
                borderColor: selectedGenre === g ? 'var(--accent-purple)' : 'var(--border-subtle)',
                background: selectedGenre === g ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
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
          <Music2 size={40} color="#8b5cf6" style={{ marginBottom: '1rem', opacity: 0.5 }} />
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
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}>
          {filteredSongs.map((song, idx) => {
            const isEditing = editingSongId === song.id;

            return (
              <div
                key={song.id}
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
                {/* Song Info */}
                <div style={{ flex: '1 1 250px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <h4 style={{ fontSize: '1.05rem', color: '#fff', fontWeight: 700 }}>
                      {song.title}
                    </h4>
                    {song.genre && (
                      <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        {song.genre}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {song.artist} {song.note ? `• ${song.note}` : ''}
                  </p>
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
                          border: '1px solid var(--accent-purple)',
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
            );
          })}
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
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Song Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Valerie, Tennessee Whiskey, Superstition"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Original Artist / Band</label>
                <input
                  type="text"
                  placeholder="e.g. Stevie Wonder, Amy Winehouse"
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="label">Genre</label>
                  <input
                    type="text"
                    placeholder="e.g. Rock, Soul, Country"
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    className="input-field"
                  />
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
