import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Check, 
  Clock, 
  Heart, 
  Radio, 
  Sparkles, 
  MessageSquare,
  DollarSign,
  Maximize2
} from 'lucide-react';
import { supabase, DEMO_BAND_ID } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import SongArtwork from '../components/common/SongArtwork';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

export default function StageMode() {
  const { profile, bandId } = useAuth();
  const effectiveBandId = bandId || profile?.id || DEMO_BAND_ID;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLiveQueue = async () => {
    if (!effectiveBandId) return;
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('band_id', effectiveBandId)
        .in('status', ['playing', 'up_next', 'pending'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Stage queue error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveQueue();

    const channel = supabase
      .channel(`stage_mode_${effectiveBandId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `band_id=eq.${effectiveBandId}`,
        },
        () => {
          fetchLiveQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveBandId]);

  const handleCompleteCurrent = async (reqId) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: 'completed' })
        .eq('id', reqId);

      if (error) throw error;

      confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
      toast.success('Song completed!');
      fetchLiveQueue();
    } catch (err) {
      toast.error('Failed to complete song');
    }
  };

  const handleStartPlaying = async (reqId) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: 'playing', played_at: new Date().toISOString() })
        .eq('id', reqId);

      if (error) throw error;

      toast('🎸 Now Playing on Stage!', { icon: '🔥' });
      fetchLiveQueue();
    } catch (err) {
      toast.error('Could not start song');
    }
  };

  const currentPlaying = requests.find((r) => r.status === 'playing');
  const upNextList = requests.filter((r) => r.status !== 'playing');

  return (
    <div style={{
      minHeight: '100vh',
      background: '#040507',
      color: '#fff',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '1rem',
        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/dashboard" className="btn btn-outline btn-sm" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
            <ArrowLeft size={16} />
            <span>Exit Stage View</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="live-pulse" />
            <span style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.05em', color: '#10b981' }}>
              STAGE TELEPROMPTER • {profile?.band_name || 'The Groove Collective'}
            </span>
          </div>
        </div>

        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#94a3b8' }}>
          Queue: {requests.length} Songs Waiting
        </div>
      </div>

      {/* Main Grid: Left = Current Playing Song (Huge), Right = Up Next Queue */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '2rem',
        alignItems: 'stretch'
      }}>
        {/* CURRENTLY PLAYING */}
        <div style={{
          background: currentPlaying ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.02)',
          border: `3px solid ${currentPlaying ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: '24px',
          padding: '2.5rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: currentPlaying ? '0 0 40px rgba(16, 185, 129, 0.25)' : 'none'
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#10b981',
              color: '#000',
              fontWeight: 900,
              padding: '0.4rem 1rem',
              borderRadius: '9999px',
              fontSize: '0.95rem',
              letterSpacing: '0.05em',
              marginBottom: '1.5rem'
            }}>
              <Radio size={16} /> NOW ON STAGE
            </div>

            {currentPlaying ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  <SongArtwork
                    title={currentPlaying.song_title}
                    artist={currentPlaying.song_artist}
                    size={110}
                    radius={18}
                  />
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <h2 style={{
                      fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
                      fontWeight: 900,
                      lineHeight: 1.05,
                      color: '#fff',
                      marginBottom: '0.4rem',
                      letterSpacing: '-0.02em'
                    }}>
                      {currentPlaying.song_title}
                    </h2>

                    {currentPlaying.song_artist && (
                      <p style={{ fontSize: '1.4rem', color: '#94a3b8', fontWeight: 600 }}>
                        by {currentPlaying.song_artist}
                      </p>
                    )}
                  </div>
                </div>

                {/* Fan Shoutout Banner in Huge Text */}
                {currentPlaying.fan_message && (
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.18)',
                    border: '2px solid rgba(59, 130, 246, 0.5)',
                    padding: '1.5rem',
                    borderRadius: '16px',
                    marginBottom: '2rem'
                  }}>
                    <div style={{ fontSize: '1.1rem', color: '#60a5fa', fontWeight: 800, marginBottom: '0.4rem' }}>
                      📢 DEDICATION FROM: {currentPlaying.fan_name || 'Fan'}
                    </div>
                    <div style={{ fontSize: '1.5rem', color: '#f8fafc', fontWeight: 700, fontStyle: 'italic', lineHeight: 1.4 }}>
                      "{currentPlaying.fan_message}"
                    </div>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  fontSize: '1.25rem',
                  color: '#34d399',
                  fontWeight: 700,
                  flexWrap: 'wrap'
                }}>
                  <span>Paid: +${(Number(currentPlaying.song_price) + Number(currentPlaying.tip_amount)).toFixed(2)}</span>
                  <span>•</span>
                  <span>Fan: {currentPlaying.fan_name}</span>
                  <span>•</span>
                  <span style={{ fontSize: '1.05rem', color: '#60a5fa' }}>
                    {currentPlaying.payment_method === 'apple_pay' ? ' Apple Pay ✓' : currentPlaying.payment_method === 'google_pay' ? 'G Pay ✓' : 'Card Paid ✓'}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ padding: '3rem 0', textAlign: 'center', color: '#64748b' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                  No song currently playing on stage.
                </p>
                {upNextList.length > 0 && (
                  <button
                    onClick={() => handleStartPlaying(upNextList[0].id)}
                    className="btn btn-emerald btn-lg"
                    style={{ fontSize: '1.25rem', padding: '1rem 2rem' }}
                  >
                    Start First Request: {upNextList[0].song_title}
                  </button>
                )}
              </div>
            )}
          </div>

          {currentPlaying && (
            <button
              onClick={() => handleCompleteCurrent(currentPlaying.id)}
              className="btn btn-emerald btn-lg"
              style={{
                width: '100%',
                fontSize: '1.4rem',
                padding: '1.25rem',
                fontWeight: 800,
                marginTop: '2rem'
              }}
            >
              <Check size={26} />
              <span>SONG FINISHED (MARK PLAYED)</span>
            </button>
          )}
        </div>

        {/* UP NEXT QUEUE */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '2px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            marginBottom: '1.5rem',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <Clock size={22} /> UP NEXT QUEUE ({upNextList.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1 }}>
            {upNextList.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '3rem 0' }}>
                Queue is clear. Waiting for fans to scan QR code.
              </div>
            ) : (
              upNextList.map((req, idx) => (
                <div
                  key={req.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                    <SongArtwork
                      title={req.song_title}
                      artist={req.song_artist}
                      size={48}
                      radius={10}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px'
                        }}>
                          #{idx + 1}
                        </span>
                        <strong style={{ fontSize: '1.25rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {req.song_title}
                        </strong>
                      </div>

                      <div style={{ color: '#94a3b8', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {req.song_artist} • Fan: {req.fan_name}
                      </div>

                      {req.fan_message && (
                        <div style={{ fontSize: '0.85rem', color: '#60a5fa', fontStyle: 'italic', marginTop: '0.35rem' }}>
                          "{req.fan_message}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399' }}>
                      +${(Number(req.song_price) + Number(req.tip_amount)).toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>
                      {req.payment_method === 'apple_pay' ? ' Apple Pay ✓' : req.payment_method === 'google_pay' ? 'G Pay ✓' : 'Card Paid ✓'}
                    </span>
                    <button
                      onClick={() => handleStartPlaying(req.id)}
                      className="btn btn-emerald btn-sm"
                      style={{ fontSize: '0.8rem' }}
                    >
                      Play Now
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
