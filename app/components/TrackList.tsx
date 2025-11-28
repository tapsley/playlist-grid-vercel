'use client';

import Image from 'next/image';
import { AlbumArt } from '@/lib/spotify';

interface TrackListProps {
  albums: AlbumArt[];
  isLoading: boolean;
}

export default function AlbumGrid({ 
    albums, 
    isLoading
}: TrackListProps) {
  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="w-full text-center py-12">
        <p className="text-gray-400 text-lg">
          Enter a playlist URL or ID to get started
        </p>
      </div>
    );
  }

  return (
    <div>
      {albums.map((album, index) => (
        <a
          key={index}
          href={album.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative"
        >
   
          <div className="absolute inset-0 bg-black opacity-0 flex items-center justify-center">
            <div className="opacity-0 text-center px-2">
              <p className="text-white text-xs font-semibold">
                {album.trackName}
              </p>
              <p className="text-white text-xs">
                {album.artistName}
              </p>
              {typeof album.artistFollowers === 'number' && (
                <p className="text-green-400 text-xs mt-1">
                  Followers: {album.artistFollowers.toLocaleString()}
                </p>
              )}
            </div>
          </div>
          
        </a>
      ))}
    </div>
  );
}
