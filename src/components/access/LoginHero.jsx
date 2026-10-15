import { Layers, Sparkles } from 'lucide-react';
import VegenBrand from './VegenBrand';
import CapabilityChips from './CapabilityChips';

export default function LoginHero() {
  return (
    <section className="access-hero" aria-labelledby="access-title">
      <div className="access-watermark" aria-hidden="true"><VegenBrand leaf negative decorative /></div>
      <div className="access-hero-content">
        <header className="access-hero-header"><VegenBrand negative /><span className="access-suite"><span aria-hidden="true" />HORECA Modular</span></header>
        <div className="access-hero-copy">
          <p className="access-kicker"><Sparkles size={15} aria-hidden="true" />Gestión integral para hostelería</p>
          <h1 id="access-title">Plataforma de gestión <span>HORECA</span></h1>
          <p className="access-tagline">Tu negocio, conectado en un solo lugar.</p>
          <CapabilityChips />
        </div>
        <footer className="access-hero-footer"><p><Layers size={16} aria-hidden="true" />Cada área de tu negocio, conectada.</p><span>Vegen Digital SL ™</span></footer>
      </div>
    </section>
  );
}
