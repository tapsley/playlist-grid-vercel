'use client';

import { useState } from 'react';
import PlaylistInput from './components/PlaylistInput';
import AlbumGrid from './components/AlbumGrid';
import { getPlaylistAlbumArts, getPlaylistName, extractPlaylistId, AlbumArt } from '@/lib/spotify';

export default function Home() {
  const [albums, setAlbums] = useState<AlbumArt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [columns, setColumns] = useState(6);

  const handleFetchPlaylist = async (input: string) => {
    setIsLoading(true);
    try {
      const playlistId = extractPlaylistId(input);
      const playlistName = await getPlaylistName(playlistId);
      const albumArts = await getPlaylistAlbumArts(playlistId);
      setAlbums(albumArts);
      setPlaylistName(playlistName);
    } catch (error) {
      console.error('Error:', error);
      setAlbums([]);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="z-10 border-b border-gray-800 bg-black backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Spotify Playlist Viewer</h1>
            </div>
            {albums.length > 0 && (
              <div className="flex items-center gap-3 bg-gray-900 px-4 py-2 rounded-lg border border-gray-700">
                <label htmlFor="columns-slider" className="text-sm font-medium text-gray-300">
                  Columns:
                </label>
                <input
                  id="columns-slider"
                  type="range"
                  min="1"
                  max="25"
                  value={columns}
                  onChange={(e) => setColumns(Number(e.target.value))}
                  className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <span className="text-sm font-semibold text-green-400 w-8 text-right">
                  {columns}
                </span>
              </div>
            )}
          </div>
          <p className="text-gray-400 text-sm">
            View all album artwork from your favorite playlists
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PlaylistInput onFetch={handleFetchPlaylist} isLoading={isLoading} />

        {/* Results Info */}
        {albums.length > 0 && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-900/50 rounded-lg">
            <p className="text-green-400 font-semibold">
              ✓ Loaded {albums.length} tracks from {playlistName}
            </p>
          </div>
        )}

        {/* Album Grid */}
        <AlbumGrid albums={albums} isLoading={isLoading} columns={columns} />

        {/* Footer Info */}
        {albums.length === 0 && !isLoading && (
          <div className="mt-16 text-center">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 max-w-2xl mx-auto">
              <h2 className="text-xl font-semibold mb-4">How to use:</h2>
              <ol className="text-left text-gray-400 space-y-3">
                <li className="flex gap-3">
                  <span className="text-green-500 font-bold">3.</span>
                  <span>
                    Paste any Spotify playlist URL or ID in the input above
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-500 font-bold">4.</span>
                  <span>Click "Load" to see all the album artwork!</span>
                </li>
              </ol>
              <p className="text-gray-500 text-sm mt-6">
                Example playlist URL: https://open.spotify.com/playlist/37i9dQZF1DX7K3vNL5FgHN
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
