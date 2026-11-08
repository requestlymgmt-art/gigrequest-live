// src/utils/artwork.js
// Automatic artist, song artwork, and genre resolver with iTunes API + persistent caching

const memCache = new Map();
const metaMemCache = new Map();
const CACHE_STORAGE_KEY = 'requestly_art_cache_v3';
const META_STORAGE_KEY = 'requestly_meta_cache_v3';

// Load persisted cache on init
function getPersistedCache(key = CACHE_STORAGE_KEY) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveToPersistedCache(storageKey, key, value) {
  try {
    const data = getPersistedCache(storageKey);
    data[key] = value;
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (e) {
    // LocalStorage quota or access exception
  }
}

// Clean song/artist title for high-accuracy iTunes search
export function cleanSearchQuery(title = '', artist = '') {
  const cleanTitle = (title || '')
    .replace(/\s*[\(\[](remastered|live|acoustic|deluxe|version|edit|cover|audio)[\)\]]/gi, '')
    .trim();

  // If artist includes multiple artists (e.g. "Amy Winehouse / Mark Ronson"), pick primary
  const cleanArtist = (artist || '')
    .split(/[\/,;&]|feat\.|ft\./i)[0]
    .replace(/\s*\(.*\)/g, '')
    .trim();

  return `${cleanTitle} ${cleanArtist}`.trim();
}

/**
 * Resolves full song metadata (artworkUrl, genre, albumTitle) via iTunes API.
 */
export async function getSongMetadata(title, artist) {
  if (!title) return null;

  const cacheKey = `${(title || '').trim().toLowerCase()}___${(artist || '').trim().toLowerCase()}`;

  if (metaMemCache.has(cacheKey)) {
    return metaMemCache.get(cacheKey);
  }

  const persisted = getPersistedCache(META_STORAGE_KEY);
  if (persisted && persisted[cacheKey]) {
    metaMemCache.set(cacheKey, persisted[cacheKey]);
    return persisted[cacheKey];
  }

  const query = cleanSearchQuery(title, artist);
  if (!query) return null;

  try {
    const endpoint = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error('Search failed');

    const data = await response.json();
    const result = data.results?.[0];

    if (result) {
      const artworkUrl = result.artworkUrl100
        ? result.artworkUrl100.replace('100x100bb.jpg', '300x300bb.jpg')
        : null;

      const metadata = {
        artworkUrl,
        genre: result.primaryGenreName || 'Pop',
        albumTitle: result.collectionName || '',
        artistName: result.artistName || artist,
        trackName: result.trackName || title,
      };

      metaMemCache.set(cacheKey, metadata);
      saveToPersistedCache(META_STORAGE_KEY, cacheKey, metadata);

      if (artworkUrl) {
        memCache.set(cacheKey, artworkUrl);
        saveToPersistedCache(CACHE_STORAGE_KEY, cacheKey, artworkUrl);
      }

      return metadata;
    } else {
      metaMemCache.set(cacheKey, null);
      saveToPersistedCache(META_STORAGE_KEY, cacheKey, null);
      return null;
    }
  } catch (err) {
    console.debug('Metadata lookup failed:', err.message);
    return null;
  }
}

/**
 * Resolves high-resolution album/artist artwork for a given song title & artist.
 * Returns null if not found or on network failure.
 */
export async function getSongArtworkUrl(title, artist, fallbackUrl = null) {
  if (fallbackUrl) return fallbackUrl;
  if (!title) return null;

  const meta = await getSongMetadata(title, artist);
  return meta?.artworkUrl || null;
}

/**
 * Resolves the primary genre for a song title & artist.
 */
export async function getSongGenre(title, artist) {
  if (!title) return 'Live Music';
  const meta = await getSongMetadata(title, artist);
  return meta?.genre || 'Live Music';
}
