/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { HeroPanel } from './components/HeroPanel.tsx';
import { LoginCard } from './components/LoginCard.tsx';
import { CapabilityItem } from './components/CapabilityChips.tsx';
import { CheckCircle2, ArrowLeft, LayoutDashboard, Sparkles, Building2, TrendingUp, Users } from 'lucide-react';

export default function App() {
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<CapabilityItem | null>(null);

  const handleLoginSuccess = (email: string) => {
    setLoggedInUser(email);
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setSelectedModule(null);
  };

  // If logged in, provide a sleek, operational preview of the HORECA Modular control center
  if (loggedInUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Top bar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al portal</span>
            </button>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">HORECA Modular</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">En línea</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400 hidden sm:inline">{loggedInUser}</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Welcome Dashboard View */}
        <main className="flex-1 max-w-6xl w-full mx-auto p-6 sm:p-10 space-y-8">
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sesión iniciada correctamente
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Bienvenido a HORECA Modular
                </h1>
                <p className="text-slate-400 text-sm max-w-xl">
                  Plataforma integral activa. Tus extractos bancarios, inventarios vivos y escandallos están sincronizados con Vegen Digital SL ™.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Ir al panel general
                </button>
              </div>
            </div>
          </div>

          {/* KPI Snapshot preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Ventas del día</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white tabular-nums">4.820,50 €</div>
              <div className="text-xs text-emerald-400">+14.2% vs. semana anterior</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Food Cost real</span>
                <Building2 className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white tabular-nums">28.4%</div>
              <div className="text-xs text-emerald-400">Dentro del objetivo (&lt;30%)</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Personal en turno</span>
                <Users className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white tabular-nums">14 / 16</div>
              <div className="text-xs text-slate-400">2 turnos de cocina y sala</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Predicción demanda</span>
                <Sparkles className="w-4 h-4 text-fuchsia-400" />
              </div>
              <div className="text-2xl font-bold text-white tabular-nums">142 pax</div>
              <div className="text-xs text-fuchsia-400">Reserva 85% cubierta</div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Redesigned Login / Access Portal Homepage
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F4F5F7] overflow-x-hidden selection:bg-emerald-600 selection:text-white">
      {/* 
        LEFT PANEL (Hero Area on Desktop, top section on Mobile):
        - Expanded width so capability chips occupy exactly 2 lines
        - Rich dark blue gradient
        - Subtle oversized Vegen leaf watermark
        - Vertically compressed spaces aligning top logo with right leaf, and bottom footer with right security note
      */}
      <div className="w-full lg:flex-1 shrink-0 flex flex-col">
        <HeroPanel
          className="min-h-[500px] lg:min-h-screen flex-1"
          onSelectCapability={(cap) => setSelectedModule(cap)}
        />
      </div>

      {/* 
        RIGHT PANEL (Login Portal):
        - Unaltered layout and dimensions: compact, centered vertically
        - Harmonized refined light-gray background (#F4F5F7)
        - Vegen branding: ONLY the pure green leaf icon
        - Centered heading: "Iniciá sesión para continuar"
        - Focused, clean, calm login card
      */}
      <div className="w-full lg:w-[360px] xl:w-[380px] shrink-0 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-6 bg-[#F4F5F7] min-h-[500px] lg:min-h-screen">
        <div className="w-full max-w-[340px]">
          <LoginCard onSuccess={handleLoginSuccess} />
        </div>
      </div>
    </div>
  );
}
