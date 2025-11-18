'use client';

import { useState } from 'react';

interface PlaylistInputProps {
  onFetch: (playlistId: string) => Promise<void>;
  isLoading: boolean;
}

export default function PlaylistInput({
  onFetch,
  isLoading,
}: PlaylistInputProps) {
  const [input, setInput] = useState('https://open.spotify.com/playlist/73XrmL8vvNbqoBII7NzHEf');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!input.trim()) {
      setError('Please enter a playlist URL or ID');
      return;
    }

    try {
      await onFetch(input.trim());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load playlist'
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full mb-8">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter Spotify playlist URL or ID (e.g., https://open.spotify.com/playlist/XXXXX or just the ID)"
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors duration-200"
          >
            {isLoading ? 'Loading...' : 'Load'}
          </button>
        </div>
        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 px-4 py-2 rounded-lg border border-red-900/50">
            {error}
          </div>
        )}
      </div>
    </form>
  );
}
