'use client';

import { useState } from 'react';
import { SocialIcon } from 'react-social-icons';
import PlaylistInput from './components/PlaylistInput';
import AlbumGrid from './components/AlbumGrid';
import TrackList from './components/TrackList';
import { getPlaylistAlbumArts, getPlaylistName, extractPlaylistId, AlbumArt, getPlaylistAlbumArtsFilteredByFollowers, getPlaylistAlbumArtsFilteredByMonthlyListeners } from '@/lib/spotify';


export default function PlaylistGridPage() {
  const [albums, setAlbums] = useState<AlbumArt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [columns, setColumns] = useState(12);
  const [maxFollowers, setMaxFollowers] = useState(150000000);
  const [listMode, setListMode] = useState(false);

  const handleFetchPlaylist = async (input: string) => {
    setIsLoading(true);
    try {
      const playlistId = extractPlaylistId(input);
      const playlistName = await getPlaylistName(playlistId);
      const albumArts = await getPlaylistAlbumArtsFilteredByFollowers(playlistId, maxFollowers);
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
            
            <div className="flex flex-wrap items-center gap-6 bg-gray-900 px-4 py-2 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2">
                <label htmlFor="followers-slider" className="text-sm font-medium text-gray-300">
                  Max Artist Followers:
                </label>
                <input
                  id="followers-slider"
                  type="number"
                  step="1000"
                  value={maxFollowers}
                  onChange={(e) => setMaxFollowers(Number(e.target.value))}
                  className="w-34 px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <button
                  onClick={() => setListMode((prev) => !prev)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg"
                >
                  {listMode ? 'Grid Mode' : 'List Mode'}
                </button>
              </div>
            </div>
            
          </div>
          <p className="text-gray-400 text-sm">
            View all album artwork from your favorite playlists
          </p>
          <div className="gap-2 mt-5">
              <h1 className="text-gray-400 text-sm">
                Designed and built by Tyler Apsley
              </h1>

            <div className="flex items-center gap-2 mt-2">
              <SocialIcon url="https://instagram.com/tyler.apsley" className="colorscheme" style={{ width: 40, height: 40 }}/>
              <SocialIcon url="https://linkedin.com/in/tyler-apsley"  className="colorscheme" style={{ width: 40, height: 40 }}/>
              <SocialIcon url="https://github.com/tapsley"  className="colorscheme" style={{ width: 40, height: 40 }}/>
              <SocialIcon url="https://open.spotify.com/user/128314269?si=7stLtgogQ4ii2PMvWnD72g"  className="colorscheme" style={{ width: 40, height: 40 }}/>
            </div>
          </div>
          

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
        {listMode ? ( 
          <TrackList albums={albums} isLoading={isLoading} /> )
            
          : <AlbumGrid albums={albums} isLoading={isLoading} columns={columns} /> 
        }
        {/* Footer Info */}
        {albums.length === 0 && !isLoading && (
          <div className="mt-16 text-center">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 max-w-2xl mx-auto">
              <h2 className="text-xl font-semibold mb-4">How to use:</h2>
              <ol className="text-left text-gray-400 space-y-3">
                <li className="flex gap-3">
                  <span className="text-green-500 font-bold">1.</span>
                  <span>
                    Paste any Spotify playlist URL or ID in the input above
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-500 font-bold">2.</span>
                  <span>You can specify the maximum number of monthly listeners if you want!</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-500 font-bold">3.</span>
                  <span>Click "Load" to see all the album artwork!</span>
                </li>
              </ol>
              <p className="text-gray-500 text-sm mt-6 wrap-break-word">
                Example playlist URL: https://open.spotify.com/playlist/73XrmL8vvNbqoBII7NzHEf
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}