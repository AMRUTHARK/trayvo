'use client';

import Image from 'next/image';
import { useState } from 'react';

interface ShopLogoProps {
  logoUrl?: string | null;
  shopName: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export default function ShopLogo({ 
  logoUrl,
  shopName,
  size = 'md', 
  showText = true,
  className = '' 
}: ShopLogoProps) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-16 w-16',
    lg: 'h-24 w-24'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {logoUrl && !imageError ? (
        <div className={`relative ${sizeClasses[size]} flex-shrink-0 rounded-lg overflow-hidden bg-white border-2 border-gray-200`}>
          <Image
            src={logoUrl}
            alt={`${shopName} Logo`}
            width={0}
            height={0}
            sizes="100vw"
            className="object-contain w-full h-full p-1"
            priority
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className={`${sizeClasses[size]} flex-shrink-0 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center border-2 border-gray-200`}>
          <span className={`font-bold text-white ${textSizeClasses[size]}`}>
            {shopName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      {showText && (
        <span className={`font-bold ${className.includes('text-white') ? 'text-white' : 'text-gray-800'} ${textSizeClasses[size]}`}>
          {shopName}
        </span>
      )}
    </div>
  );
}

