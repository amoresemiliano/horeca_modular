import React, { useState } from 'react';
import {
  Landmark,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Boxes,
  Scale,
  Sparkles,
  Compass,
  ShoppingCart,
  CircleDollarSign,
} from 'lucide-react';

export interface CapabilityItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  subtleBg: string;
  description: string;
  hasRedAccent?: boolean;
}

export const CAPABILITIES_ROW_1: CapabilityItem[] = [
  {
    id: 'bancos',
    label: 'Bancos',
    icon: Landmark,
    iconColor: 'text-sky-400',
    subtleBg: 'bg-sky-500/10',
    description: 'Conciliación bancaria automática y control de tesorería diaria.',
    hasRedAccent: true,
  },
  {
    id: 'kpis',
    label: 'KPIs',
    icon: TrendingUp,
    iconColor: 'text-emerald-400',
    subtleBg: 'bg-emerald-500/10',
    description: 'Métricas financieras, ticket medio y rentabilidad en tiempo real.',
    hasRedAccent: false,
  },
  {
    id: 'compras',
    label: 'Compras',
    icon: ShoppingCart,
    iconColor: 'text-teal-300',
    subtleBg: 'bg-teal-500/10',
    description: 'Gestión de albaranes, pedidos automáticos y precios de proveedor.',
    hasRedAccent: true,
  },
  {
    id: 'ventas',
    label: 'Ventas',
    icon: CircleDollarSign,
    iconColor: 'text-rose-400',
    subtleBg: 'bg-rose-500/10',
    description: 'Integración TPV en vivo, facturación, cierres de caja y canales de venta.',
    hasRedAccent: true,
  },
  {
    id: 'personal',
    label: 'Personal',
    icon: Users,
    iconColor: 'text-amber-400',
    subtleBg: 'bg-amber-500/10',
    description: 'Gestión de turnos, productividad, coste de personal y fichajes.',
    hasRedAccent: true,
  },
];

export const CAPABILITIES_ROW_2: CapabilityItem[] = [
  {
    id: 'produccion',
    label: 'Producción',
    icon: UtensilsCrossed,
    iconColor: 'text-orange-400',
    subtleBg: 'bg-orange-500/10',
    description: 'Planificación de cocina, mermas operativas y órdenes de pase.',
    hasRedAccent: true,
  },
  {
    id: 'inventarios',
    label: 'Inventarios',
    icon: Boxes,
    iconColor: 'text-violet-400',
    subtleBg: 'bg-violet-500/10',
    description: 'Stock vivo multicentro, alertas de rotura y pedidos a proveedor.',
    hasRedAccent: false,
  },
  {
    id: 'escandallos',
    label: 'Escandallos',
    icon: Scale,
    iconColor: 'text-cyan-400',
    subtleBg: 'bg-cyan-500/10',
    description: 'Fichas técnicas dinámicas vinculadas al coste real de materia prima.',
    hasRedAccent: true,
  },
  {
    id: 'predicciones',
    label: 'Predicciones',
    icon: Sparkles,
    iconColor: 'text-fuchsia-400',
    subtleBg: 'bg-fuchsia-500/10',
    description: 'Previsión de demanda y ocupación basada en patrones históricos y clima.',
    hasRedAccent: true,
  },
  {
    id: 'decisiones',
    label: 'Decisiones',
    icon: Compass,
    iconColor: 'text-blue-400',
    subtleBg: 'bg-blue-500/10',
    description: 'Recomendaciones accionables para optimizar márgenes operativos.',
    hasRedAccent: false,
  },
];

export const ALL_CAPABILITIES = [...CAPABILITIES_ROW_1, ...CAPABILITIES_ROW_2];

interface CapabilityChipsProps {
  className?: string;
  activeItem?: CapabilityItem | null;
  onActiveItemChange?: (item: CapabilityItem | null) => void;
  onSelect?: (capability: CapabilityItem) => void;
}

export function CapabilityChips({
  className = '',
  activeItem: controlledActiveItem,
  onActiveItemChange,
  onSelect,
}: CapabilityChipsProps) {
  const [internalActiveItem, setInternalActiveItem] = useState<CapabilityItem | null>(null);

  const activeItem = controlledActiveItem !== undefined ? controlledActiveItem : internalActiveItem;

  const handleItemHover = (item: CapabilityItem | null) => {
    if (controlledActiveItem === undefined) {
      setInternalActiveItem(item);
    }
    if (onActiveItemChange) {
      onActiveItemChange(item);
    }
  };

  const handleItemClick = (item: CapabilityItem) => {
    const next = activeItem?.id === item.id ? null : item;
    if (controlledActiveItem === undefined) {
      setInternalActiveItem(next);
    }
    if (onActiveItemChange) {
      onActiveItemChange(next);
    }
    if (next && onSelect) {
      onSelect(next);
    }
  };

  const renderChip = (cap: CapabilityItem) => {
    const Icon = cap.icon;
    const isSelected = activeItem?.id === cap.id;

    return (
      <button
        key={cap.id}
        type="button"
        onClick={() => handleItemClick(cap)}
        onMouseEnter={() => handleItemHover(cap)}
        onMouseLeave={() => handleItemHover(null)}
        className={`group relative inline-flex items-center gap-2 px-3 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 shrink-0 ${
          isSelected
            ? 'bg-slate-800 text-white border-slate-400 shadow-md scale-[1.02]'
            : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 hover:border-slate-500 shadow-xs'
        }`}
        title={`${cap.label}: ${cap.description}`}
        aria-label={`${cap.label} - ${cap.description}`}
      >
        {/* Icon with individual accent color */}
        <span
          className={`p-1 rounded-lg ${cap.subtleBg} ${cap.iconColor} transition-transform duration-200 group-hover:scale-110 flex items-center justify-center`}
        >
          <Icon className="w-3.5 h-3.5" />
        </span>

        {/* Label */}
        <span className="tracking-tight whitespace-nowrap">{cap.label}</span>

        {/* Subtle red accent detail for energy & visual tension */}
        <span
          className="relative flex h-1.5 w-1.5 shrink-0"
          aria-hidden="true"
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-40 group-hover:opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500/90 shadow-[0_0_5px_rgba(244,63,94,0.7)]" />
        </span>
      </button>
    );
  };

  return (
    <div
      className={`space-y-2 sm:space-y-2.5 ${className}`}
      role="region"
      aria-label="Módulos y capacidades de HORECA Modular"
    >
      {/* Línea 1 (5 conceptos) */}
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-2.5">
        {CAPABILITIES_ROW_1.map(renderChip)}
      </div>

      {/* Línea 2 (5 conceptos) */}
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-2.5">
        {CAPABILITIES_ROW_2.map(renderChip)}
      </div>
    </div>
  );
}
