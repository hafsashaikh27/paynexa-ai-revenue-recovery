import React from 'react';

interface PayNexaLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export const PayNexaLogo: React.FC<PayNexaLogoProps> = ({
  size = 36,
  className = '',
  showText = false,
}) => {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* PayNexa Rounded P Symbol with Upward Arrow & Cyan/Blue/Purple Gradient */}
      <div 
        className="relative flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-lg shadow-blue-950/60 transition-transform duration-200 hover:scale-105"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            {/* Base dark navy squircle background */}
            <linearGradient id="pDarkBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0B1226" />
              <stop offset="100%" stopColor="#080D1A" />
            </linearGradient>

            {/* Vibrant Cyan-to-Blue-to-Purple Gradient for the P */}
            <linearGradient id="pGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00E5FF" />
              <stop offset="25%" stopColor="#00B4D8" />
              <stop offset="55%" stopColor="#2563EB" />
              <stop offset="85%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#A855F7" />
            </linearGradient>

            {/* Arrow glow */}
            <filter id="arrowGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Dark Navy Rounded Squircle */}
          <rect width="100" height="100" rx="26" fill="url(#pDarkBg)" stroke="#1E293B" strokeWidth="1.5" />

          {/* Stylized Rounded 'P' Shape with inner aperture */}
          <path
            d="M 31 22 
               H 58 
               C 74 22, 83 31, 83 45 
               C 83 58, 73 68, 58 68 
               H 48 
               C 44 68, 41 71, 41 75 
               V 78 
               C 41 81, 38 84, 35 84 
               H 31 
               C 28 84, 26 81, 26 78 
               V 27 
               C 26 24, 28 22, 31 22 Z"
            fill="url(#pGradPrimary)"
          />

          {/* Inner P Counter / Hole */}
          <path
            d="M 44 35 
               H 56 
               C 64 35, 69 39, 69 46 
               C 69 53, 64 57, 56 57 
               H 44 
               Z"
            fill="#080D1A"
          />

          {/* Dynamic White Upward Recovery Arrow sweeping through the P */}
          <g filter="url(#arrowGlow)">
            {/* Curved Arrow Tail */}
            <path
              d="M 21 78 C 24 64, 34 50, 48 44 L 59 39"
              stroke="#FFFFFF"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Arrowhead pointing upward-right */}
            <path
              d="M 48 33 L 64 37 L 57 51 Z"
              fill="#FFFFFF"
            />
          </g>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base tracking-tight text-white font-sans">
              PayNexa
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400 tracking-tight">
            AI Revenue Recovery Platform
          </span>
        </div>
      )}
    </div>
  );
};
