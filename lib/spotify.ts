// Spotify API Service
// Uses Client Credentials flow for authentication

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/api/token';

// You'll need to set these in your environment variables
const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID as string;
const CLIENT_SECRET = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET as string;
//

let accessToken: string | null = null;
let tokenExpiry: number = 0;

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken as string;
  }

  // Encode credentials in base64
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
    'base64'
  );

  try {
    const response = await fetch(SPOTIFY_AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = await response.json();
    const token = data.access_token as string;
    accessToken = token;
    tokenExpiry = Date.now() + data.expires_in * 1000 - 60000; // Refresh 1 min before expiry

    return accessToken;
  } catch (error) {
    console.error('Error getting Spotify access token:', error);
    throw error;
  }
}

export async function getPlaylistTracks(playlistId: string): Promise<any[]> {
  const token = await getAccessToken();
  const limit = 100; // Spotify's max per request
  let items: any[] = [];
  let nextUrl: string | null = `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=${limit}&offset=0`;
  const maxAttempts = 5;

  while (nextUrl) {
    let attempt = 0;
    let response: Response | null = null;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        response = await fetch(nextUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Handle 429 - rate limited
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitSec = retryAfter ? Number(retryAfter) : Math.min(2 ** attempt, 30);
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          continue; // retry
        }

        // Retry on 5xx transient errors
        if (response.status >= 500 && response.status < 600) {
          const waitMs = Math.min(500 * attempt, 5000);
          await new Promise((r) => setTimeout(r, waitMs));
          continue; // retry
        }

        break; // got a non-retriable response (200 or 4xx)
      } catch (err) {
        // network error -> exponential backoff and retry
        const waitMs = Math.min(200 * attempt, 2000);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    if (!response) {
      throw new Error('Failed to fetch playlist tracks (no response)');
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Failed to fetch playlist tracks: ${response.status} ${response.statusText} ${text}`);
    }

    const data = await response.json();
    if (Array.isArray(data.items)) {
      items = items.concat(data.items);
    }

    // Spotify provides a `next` URL; follow it if present
    nextUrl = data.next ?? null;
  }

  return items;
}

export function extractPlaylistId(spotifyUrl: string): string {
  // Extract playlist ID from Spotify URL
  // Supports: https://open.spotify.com/playlist/PLAYLIST_ID
  // Or just the ID directly
  const match = spotifyUrl.match(/playlist\/([a-zA-Z0-9]+)/);
  if (match) {
    return match[1];
  }
  // If it's just an ID, return as is
  if (/^[a-zA-Z0-9]+$/.test(spotifyUrl)) {
    return spotifyUrl;
  }
  throw new Error('Invalid Spotify playlist URL or ID');
}

export interface AlbumArt {
  trackName: string;
  artistName: string;
  albumImage: string | null;
  spotifyUrl: string;
}

export async function getPlaylistName( playlistId: string): Promise<string> {
  const token = await getAccessToken();
  const response = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch playlist details: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.name || 'Unknown Playlist';
}

export async function getPlaylistAlbumArts(
  playlistId: string
): Promise<AlbumArt[]> {
  const tracks = await getPlaylistTracks(playlistId);

  return tracks
    .map((item: any) => {
      const track = item.track;
      if (!track) return null;

      const albumImage =
        track.album?.images?.[0]?.url ||
        track.album?.images?.[1]?.url ||
        null;

      return {
        trackName: track.name,
        artistName: track.artists?.[0]?.name || 'Unknown Artist',
        albumImage,
        spotifyUrl: track.external_urls?.spotify || '',
      };
    })
    .filter((item: AlbumArt | null) => item !== null);
}
