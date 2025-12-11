'use client';

import Image from 'next/image';
import { useState } from 'react';

interface CompanyLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export default function CompanyLogo({ 
  size = 'md', 
  showText = true,
  className = '' 
}: CompanyLogoProps) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'h-16 w-full',
    md: 'h-24 w-full',
    lg: 'h-64 w-full'
  };

  const textSizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl'
  };

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {!imageError && (
        <div className={`relative ${sizeClasses[size]} flex-shrink-0`}>
          <Image
            src="/logo.png"
            alt="Company Logo"
            width={0}
            height={0}
            sizes="100vw"
            className="object-contain w-full h-full"
            priority
            onError={() => setImageError(true)}
          />
        </div>
      )}
      {showText && (
        <span className={`font-bold ${className.includes('text-white') ? 'text-white' : 'text-blue-600'} ${textSizeClasses[size]}`}>
          Trayvo
        </span>
      )}
    </div>
  );
}

