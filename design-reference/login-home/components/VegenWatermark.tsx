import React from 'react';

/**
 * Oversized, diffused Vegen leaf watermark background element.
 * Adds subtle atmospheric depth and embossed brand presence to the dark blue hero panel
 * with low opacity, muted green tone, and soft edge diffusion.
 */
export function VegenWatermark({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
    >
      {/* Ambient soft glow aura in deep emerald/teal */}
      <div className="absolute -top-32 -left-32 w-[540px] h-[540px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
      
      {/* Secondary warm accent reflection in top-right */}
      <div className="absolute -top-24 right-10 w-[420px] h-[420px] rounded-full bg-indigo-500/[0.05] blur-[100px]" />

      {/* Oversized diffused Vegen Leaf watermark graphic */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute top-1/2 left-1/2 -translate-x-[42%] -translate-y-[45%] w-[680px] h-[680px] sm:w-[840px] sm:h-[840px] text-emerald-400/[0.045] filter blur-[1.5px]"
      >
        <defs>
          <linearGradient id="watermarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
          </linearGradient>
          <filter id="softEmboss" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
            <feOffset in="blur" dx="2" dy="3" result="offset" />
            <feComponentTransfer in="offset" result="shadow">
              <feFuncA type="linear" slope="0.08" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#softEmboss)">
          {/* Main Leaf */}
          <path
            d="M52 50 C52 24 68 10 90 6 C90 32 78 58 52 50 Z"
            fill="url(#watermarkGrad)"
          />
          {/* Auxiliary Leaf */}
          <path
            d="M50 54 C32 50 16 34 18 14 C38 14 50 34 50 54 Z"
            fill="url(#watermarkGrad)"
          />
          {/* Stem */}
          <path
            d="M50 50 C50 66 48 80 44 94"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeOpacity="0.4"
          />
        </g>
      </svg>

      {/* Subtle blueprint grid overlay for modern tech feel */}
      <div 
        className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)`,
          backgroundSize: '36px 36px'
        }}
      />
    </div>
  );
}
