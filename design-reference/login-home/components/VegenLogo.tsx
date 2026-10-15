import React from 'react';

interface VegenLogoProps {
  /**
   * 'negative': For dark backgrounds (Leaf green, 'Vegen' white, 'Digital' green, transparent background)
   * 'leaf-only': For light backgrounds (Only the green leaf icon, without any text or box)
   * 'full-light': Full logo for light backgrounds (Leaf green, 'Vegen' dark, 'Digital' green)
   */
  variant?: 'negative' | 'leaf-only' | 'full-light';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showWordmark?: boolean;
}

/**
 * Pure SVG vector mark for the Vegen Digital leaf icon.
 * Features the signature organic double-sprout leaf with stem.
 */
export function VegenLeafIcon({
  className = 'w-9 h-9',
  glow = false,
}: {
  className?: string;
  glow?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`${className} ${glow ? 'drop-shadow-[0_0_16px_rgba(34,197,94,0.45)]' : ''}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="vegenLeafGrad" x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="60%" stopColor="#16A34A" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>
        <linearGradient id="vegenStemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#16A34A" />
          <stop offset="100%" stopColor="#166534" />
        </linearGradient>
      </defs>

      {/* Main right leaf - elegant ascending curve */}
      <path
        d="M52 50 C52 26 66 12 88 8 C88 32 76 56 52 50 Z"
        fill="url(#vegenLeafGrad)"
      />
      
      {/* Left auxiliary leaf - rounded balanced sprout */}
      <path
        d="M50 54 C34 50 18 36 20 18 C38 18 50 36 50 54 Z"
        fill="url(#vegenLeafGrad)"
      />

      {/* Center organic stem connecting both leaves smoothly to the base */}
      <path
        d="M50 50 C50 64 49 76 46 90"
        stroke="url(#vegenStemGrad)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function VegenLogo({
  variant = 'negative',
  size = 'md',
  className = '',
}: VegenLogoProps) {
  // If leaf-only, render just the leaf mark cleanly
  if (variant === 'leaf-only') {
    const leafSizes = {
      sm: 'w-8 h-8',
      md: 'w-11 h-11',
      lg: 'w-14 h-14',
      xl: 'w-16 h-16',
    };

    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <VegenLeafIcon className={leafSizes[size]} glow={false} />
      </div>
    );
  }

  // Dimension scaling
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  const subTextSizes = {
    sm: 'text-[9px] tracking-[0.24em]',
    md: 'text-[11px] tracking-[0.28em]',
    lg: 'text-[13px] tracking-[0.3em]',
    xl: 'text-[15px] tracking-[0.32em]',
  };

  const isNegative = variant === 'negative';

  return (
    <div
      className={`inline-flex items-center gap-3 select-none ${className}`}
      aria-label="Vegen Digital"
    >
      <div className="shrink-0 flex items-center justify-center">
        <VegenLeafIcon className={iconSizes[size]} glow={isNegative} />
      </div>

      <div className="flex flex-col leading-none justify-center">
        <span
          className={`font-bold tracking-tight font-sans ${textSizes[size]} ${
            isNegative ? 'text-white' : 'text-slate-900'
          }`}
        >
          Vegen
        </span>
        <span
          className={`font-semibold uppercase font-sans mt-0.5 text-emerald-500 ${subTextSizes[size]}`}
        >
          Digital
        </span>
      </div>
    </div>
  );
}
