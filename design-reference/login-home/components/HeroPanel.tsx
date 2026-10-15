import React, { useState } from 'react';
import { VegenLogo } from './VegenLogo.tsx';
import { VegenWatermark } from './VegenWatermark.tsx';
import { CapabilityChips, CapabilityItem } from './CapabilityChips.tsx';
import { ShieldCheck, Sparkles, Layers } from 'lucide-react';

interface HeroPanelProps {
  className?: string;
  onSelectCapability?: (cap: CapabilityItem) => void;
}

export function HeroPanel({
  className = '',
  onSelectCapability,
}: HeroPanelProps) {
  const [activeCapability, setActiveCapability] = useState<CapabilityItem | null>(null);

  const handleSelect = (cap: CapabilityItem) => {
    setActiveCapability(cap);
    if (onSelectCapability) {
      onSelectCapability(cap);
    }
  };

  return (
    <section
      aria-label="Presentación HORECA Modular"
      className={`relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-[#080E21] via-[#0E1A38] to-[#0A1329] text-white p-6 sm:p-10 lg:px-14 lg:py-6 ${className}`}
    >
      {/* Background oversized diffused watermark and ambient lighting */}
      <VegenWatermark />

      {/* 
        Inner container centered vertically on desktop:
        Height matched to the 504px login card block on the right panel.
        Separation between header and "Sistema Operativo..." is compressed.
        Separation between capability chips and footer is compressed.
      */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col justify-between lg:h-[504px] my-auto">
        {/* Top zone: Brand Mark negative adaptation - lowered to align with login leaf icon */}
        <header className="flex items-center justify-between h-[64px] shrink-0">
          <div className="flex items-center gap-3">
            <VegenLogo variant="negative" size="md" />
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              HORECA Modular Suite
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Acceso seguro cifrado</span>
          </div>
        </header>

        {/* Center zone: Headline, supporting line, and capability badges */}
        <div className="my-auto py-2 sm:py-3 w-full">
          {/* Category kicker */}
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2 sm:mb-2.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sistema Operativo Integral</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15] text-balance">
            Plataforma de gestión HORECA
          </h1>

          {/* Supporting Line */}
          <p className="mt-2.5 text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-xl text-pretty">
            Tu negocio, conectado en un solo lugar.
          </p>

          {/* Capability Chips with 10 modules in 2 neat lines */}
          <div className="mt-5 sm:mt-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Módulos operativos en tiempo real
            </div>
            <CapabilityChips
              activeItem={activeCapability}
              onActiveItemChange={setActiveCapability}
              onSelect={handleSelect}
            />
          </div>
        </div>

        {/* Bottom zone: Concept descriptions on the left, Vegen Digital SL ™ on the right - raised to align with "Uso restringido..." */}
        <footer className="border-t border-slate-800/80 pt-3 min-h-[34px] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          {/* Left: Dynamic descriptions of each concept */}
          <div className="flex-1 flex items-center pr-4 overflow-hidden">
            {activeCapability ? (
              <div className="flex items-center gap-2.5 text-xs text-slate-200 transition-all duration-200">
                <span
                  className={`p-1 rounded-md ${activeCapability.subtleBg} ${activeCapability.iconColor} shrink-0`}
                >
                  <activeCapability.icon className="w-4 h-4" />
                </span>
                <span className="leading-snug truncate">
                  <strong className="text-white font-semibold mr-1.5">
                    {activeCapability.label}:
                  </strong>
                  <span className="text-slate-300">
                    {activeCapability.description}
                  </span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Layers className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="truncate">
                  Módulos integrados para sincronizar cada área operativa de tu restaurante.
                </span>
              </div>
            )}
          </div>

          {/* Right: Vegen Digital SL ™ replacing Versión 2026 */}
          <div className="text-xs text-slate-400 font-medium tracking-wide shrink-0 whitespace-nowrap self-start md:self-center">
            Vegen Digital SL ™
          </div>
        </footer>
      </div>
    </section>
  );
}
