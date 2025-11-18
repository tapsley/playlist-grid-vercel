'use client';

import Image from 'next/image';
import { AlbumArt } from '@/lib/spotify';

interface AlbumGridProps {
  albums: AlbumArt[];
  isLoading: boolean;
  columns: number;
}

export default function AlbumGrid({ 
    albums, 
    isLoading,
    columns
}: AlbumGridProps) {
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
    <div 
      className="grid w-full"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {albums.map((album, index) => (
        <a
          key={index}
          href={album.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative aspect-square shadow-xs hover:shadow-xl transition-shadow duration-300"
        >
          {album.albumImage ? (
            <>
              <Image
                src={album.albumImage}
                alt={`${album.trackName} by ${album.artistName}`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
              />
              <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-50 transition-all duration-300 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center px-2">
                  <p className="text-white text-xs font-semibold">
                    {album.trackName}
                  </p>
                  <p className="text-white text-xs">
                    {album.artistName}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <span className="text-gray-500 text-xs text-center px-2">
                No Image
              </span>
            </div>
          )}
        </a>
      ))}
    </div>
  );
}
