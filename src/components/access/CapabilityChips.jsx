import { Landmark, TrendingUp, ShoppingCart, CircleDollarSign, Users, UtensilsCrossed, Boxes, Scale, Sparkles, Compass } from 'lucide-react';

const capabilities = [
  ['Bancos', Landmark, 'blue', 'Centraliza movimientos bancarios, conciliación y control financiero.'],
  ['KPIs', TrendingUp, 'green', 'Convierte tus datos operativos en indicadores claros para gestionar mejor.'],
  ['Compras', ShoppingCart, 'green', 'Planifica pedidos, proveedores y necesidades de compra desde un solo lugar.'],
  ['Ventas', CircleDollarSign, 'warm', 'Analiza ventas, tickets y rendimiento comercial de tu operación.'],
  ['Personal', Users, 'warm', 'Organiza equipos, jornadas y datos operativos de tu personal.'],
  ['Producción', UtensilsCrossed, 'warm', 'Planifica, registra y controla la producción diaria de tu cocina.'],
  ['Inventarios', Boxes, 'blue', 'Controla existencias, movimientos, mermas y disponibilidad de stock.'],
  ['Escandallos', Scale, 'green', 'Conoce recetas, costes, rendimientos y márgenes reales de tus productos.'],
  ['Predicciones', Sparkles, 'blue', 'Anticipa necesidades y tendencias a partir de tus datos operativos.'],
  ['Decisiones', Compass, 'green', 'Transforma información y predicciones en acciones concretas para tu negocio.'],
];

export default function CapabilityChips({ selected, onSelect }) {
  return (
    <ul className="access-chips" aria-label="Áreas de gestión HORECA">
      {capabilities.map(([label, Icon, accent, description]) => (
        <li key={label}>
          <button type="button" className={`access-chip access-chip--${accent}`} aria-pressed={selected === label} aria-controls="access-module-description" onClick={() => onSelect({ label, description })}>
            <Icon size={16} aria-hidden="true" /><span>{label}</span><span className="access-chip-dot" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
