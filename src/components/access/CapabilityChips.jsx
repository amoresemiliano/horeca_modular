import { Landmark, TrendingUp, Users, UtensilsCrossed, Boxes, Scale, Sparkles, Compass } from 'lucide-react';

const capabilities = [
  ['Bancos', Landmark, 'blue'], ['KPIs', TrendingUp, 'green'],
  ['Personal', Users, 'warm'], ['Producción', UtensilsCrossed, 'warm'],
  ['Inventarios', Boxes, 'blue'], ['Escandallos', Scale, 'green'],
  ['Predicciones', Sparkles, 'blue'], ['Decisiones', Compass, 'green'],
];

export default function CapabilityChips() {
  return (
    <ul className="access-chips" aria-label="Áreas de gestión HORECA">
      {capabilities.map(([label, Icon, accent]) => <li className={`access-chip access-chip--${accent}`} key={label}><Icon size={16} aria-hidden="true" /><span>{label}</span><span className="access-chip-dot" aria-hidden="true" /></li>)}
    </ul>
  );
}
