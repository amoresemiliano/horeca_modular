import { useState } from 'react';
import { Layers, ShieldCheck, Sparkles } from 'lucide-react';
import VegenBrand from './VegenBrand';
import CapabilityChips from './CapabilityChips';

export default function LoginHero() {
  const [selected, setSelected] = useState(null);
  const selectCapability = (capability) => setSelected(current => current?.label === capability.label ? null : capability);
  return (
    <section className="access-hero" aria-labelledby="access-title">
      <div className="access-watermark" aria-hidden="true"><VegenBrand leaf negative decorative /></div>
      <div className="access-hero-content">
        <header className="access-hero-header"><VegenBrand negative /><span className="access-suite"><span aria-hidden="true" />HORECA Modular Suite</span><span className="access-hero-security"><ShieldCheck size={16} aria-hidden="true" />Acceso seguro cifrado</span></header>
        <div className="access-hero-copy">
          <p className="access-kicker"><Sparkles size={15} aria-hidden="true" />SISTEMA OPERATIVO INTEGRAL</p>
          <h1 id="access-title">Plataforma de gestión <span>HORECA</span></h1>
          <p className="access-tagline">Tu negocio, conectado en un solo lugar.</p>
          <h2 className="access-modules-heading">MÓDULOS OPERATIVOS EN TIEMPO REAL</h2>
          <CapabilityChips selected={selected?.label} onSelect={selectCapability} />
        </div>
        <footer className="access-hero-footer"><p id="access-module-description" aria-live="polite" aria-atomic="true"><Layers size={16} aria-hidden="true" /><span>{selected?.description || 'Módulos integrados para sincronizar cada área operativa de tu restaurante.'}</span></p><span>Vegen Digital SL ™</span></footer>
      </div>
    </section>
  );
}
