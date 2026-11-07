// src/utils/artwork.js
// Automatic artist & song album artwork resolver with iTunes API + persistent caching

const memCache = new Map();
const CACHE_STORAGE_KEY = 'requestly_art_cache_v2';

// Load persisted cache on init
function getPersistedCache() {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveToPersistedCache(key, url) {
  try {
    const data = getPersistedCache();
    data[key] = url;
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // LocalStorage quota or access exception
  }
}

// Clean song/artist title for high-accuracy iTunes search
export function cleanSearchQuery(title = '', artist = '') {
  const cleanTitle = title
    .replace(/\s*[\(\[](remastered|live|acoustic|deluxe|version|edit|cover|audio)[\)\]]/gi, '')
    .trim();

  // If artist includes multiple artists (e.g. "Amy Winehouse / Mark Ronson"), pick primary
  const cleanArtist = artist
    .split(/[\/,;&]|feat\.|ft\./i)[0]
    .replace(/\s*\(.*\)/g, '')
    .trim();

  return `${cleanTitle} ${cleanArtist}`.trim();
}

/**
 * Resolves high-resolution album/artist artwork for a given song title & artist.
 * Returns null if not found or on network failure.
 */
export async function getSongArtworkUrl(title, artist, fallbackUrl = null) {
  if (fallbackUrl) return fallbackUrl;
  if (!title) return null;

  const cacheKey = `${(title || '').trim().toLowerCase()}___${(artist || '').trim().toLowerCase()}`;

  // 1. Check in-memory cache
  if (memCache.has(cacheKey)) {
    return memCache.get(cacheKey);
  }

  // 2. Check localStorage cache
  const localCache = getPersistedCache();
  if (localCache && localCache[cacheKey]) {
    memCache.set(cacheKey, localCache[cacheKey]);
    return localCache[cacheKey];
  }

  // 3. Query iTunes API
  const query = cleanSearchQuery(title, artist);
  if (!query) return null;

  try {
    const endpoint = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error('Search failed');

    const data = await response.json();
    const result = data.results?.[0];

    let artUrl = null;
    if (result && result.artworkUrl100) {
      // Upgrade 100x100 thumbnail to 300x300 high resolution artwork
      artUrl = result.artworkUrl100.replace('100x100bb.jpg', '300x300bb.jpg');
    }

    if (artUrl) {
      memCache.set(cacheKey, artUrl);
      saveToPersistedCache(cacheKey, artUrl);
      return artUrl;
    } else {
      // Cache empty result to avoid re-querying every render
      memCache.set(cacheKey, null);
      saveToPersistedCache(cacheKey, null);
      return null;
    }
  } catch (err) {
    console.debug('Artwork lookup skipped:', err.message);
    return null;
  }
}

