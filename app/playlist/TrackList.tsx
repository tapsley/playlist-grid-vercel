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
    <ul>
      {albums.map((album, index) => (
        <a
          key={index}
          href={album.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className=""
        >
   
        <div className="flex flex-row w-full text=center px-2">
          <div className="flex-1 text-white font-semibold italic">
            {album.trackName} 
          </div>
          <div className="flex-1 text-white font-semibold">{album.artistName}
          </div>
          {typeof album.artistFollowers === 'number' && (
              album.artistFollowers.toLocaleString()
          )}
        </div>
          
        </a>
      ))}
    </ul>
  );
}
