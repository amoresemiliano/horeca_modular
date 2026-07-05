import React, { useState, useMemo } from 'react';

const CAT_COLORS = [
  '#E2231A', '#006847', '#F59E0B', '#3B82F6', '#8B5CF6',
  '#EC4899', '#10B981', '#F97316', '#6366F1', '#14B8A6',
  '#84CC16', '#EF4444',
];

/* ─── Gráfica de barras horizontales estilizada ──────────────────────────── */
const BarrasHorizontales = ({ data, total, title, icon }) => {
  const max = data[0]?.[1] || 1;
  return (
    <div style={{
      background: 'var(--c-surface)',
      borderRadius: 'var(--r-xl)',
      border: '1px solid var(--c-border)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.125rem' }}>{icon}</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--c-text-1)' }}>{title}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--c-text-4)', fontWeight: 600, textTransform: 'uppercase' }}>Top {data.length}</span>
      </div>
      <div style={{ padding: '1.25rem 1.5rem' }}>
        {data.length === 0 ? (
          <p style={{ color: 'var(--c-text-4)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>Sin datos suficientes</p>
        ) : data.map(([name, val], i) => {
          const pct = ((val / max) * 100).toFixed(1);
          const pctTotal = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
          const color = CAT_COLORS[i % CAT_COLORS.length];
          return (
            <div key={name} style={{ marginBottom: i < data.length - 1 ? '1.125rem' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name || 'Sin asignar'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0, marginLeft: '0.75rem' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--c-text-4)', fontWeight: 500 }}>{pctTotal}%</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--c-text-1)', minWidth: '80px', textAlign: 'right' }}>
                    {val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <div style={{ height: '8px', background: 'var(--c-bg)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}CC, ${color})`,
                  borderRadius: '9999px',
                  transition: 'width 800ms cubic-bezier(0.34,1.56,0.64,1)',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Mini donut CSS ─────────────────────────────────────────────────────── */
const MiniDonut = ({ data, total, size = 120 }) => {
  let offset = 0;
  const r = 40, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--c-bg)" strokeWidth="14" />
      {data.map(([name, val], i) => {
        const pct  = total > 0 ? val / total : 0;
        const dash = circ * pct;
        const gap  = circ - dash;
        const el = (
          <circle
            key={name}
            cx="50" cy="50" r={r}
            fill="none"
            stroke={CAT_COLORS[i % CAT_COLORS.length]}
            strokeWidth="14"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset * circ}
            strokeLinecap="butt"
          />
        );
        offset += pct;
        return el;
      })}
    </svg>
  );
};

/* ─── Evolución mensual: línea temporal con barras ───────────────────────── */
const EvolucionMensual = ({ db }) => {
  const meses = useMemo(() => {
    const map = {};
    db.forEach(item => {
      if (!item.fecha) return;
      const mes = item.fecha.slice(0, 7); // yyyy-mm
      if (!map[mes]) map[mes] = { gastos: 0, ingresos: 0 };
      if (item.importe < 0) map[mes].gastos   += Math.abs(item.importe);
      else                  map[mes].ingresos += item.importe;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12); // últimos 12 meses
  }, [db]);

  if (meses.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--c-text-4)', fontSize: '0.875rem' }}>
        Cargá movimientos para ver la evolución mensual
      </div>
    );
  }

  const maxVal = Math.max(...meses.flatMap(([, v]) => [v.gastos, v.ingresos])) || 1;

  return (
    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'flex-end', height: '160px', padding: '0.5rem 0' }}>
      {meses.map(([mes, vals], i) => {
        const [year, month] = mes.split('-');
        const label = new Date(+year, +month - 1).toLocaleString('es-ES', { month: 'short' });
        const gastH = (vals.gastos   / maxVal) * 130;
        const ingH  = (vals.ingresos / maxVal) * 130;
        return (
          <div key={mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }} title={`${mes}\nGastos: ${vals.gastos.toFixed(0)}€\nIngresos: ${vals.ingresos.toFixed(0)}€`}>
            <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '130px' }}>
              <div style={{
                width: '10px', height: `${gastH}px`,
                background: 'var(--c-brand)', borderRadius: '3px 3px 0 0',
                opacity: 0.85, minHeight: '2px',
                transition: 'height 600ms ease',
              }} />
              <div style={{
                width: '10px', height: `${ingH}px`,
                background: 'var(--c-green)', borderRadius: '3px 3px 0 0',
                opacity: 0.85, minHeight: '2px',
                transition: 'height 600ms ease',
              }} />
            </div>
            <span style={{ fontSize: '0.6rem', color: 'var(--c-text-4)', textTransform: 'uppercase', fontWeight: 600 }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ─── COMPONENTE PRINCIPAL ───────────────────────────────────────────────── */
const ExtractosGraficas = ({ db, filterConfig }) => {
  const filteredData = useMemo(() => db.filter(item => {
    const { from, to } = filterConfig.dateRange;
    if (!from && !to) return true;
    const d = new Date(item.fecha);
    if (from && d < new Date(from)) return false;
    if (to   && d > new Date(to))   return false;
    return true;
  }), [db, filterConfig]);

  const gastos   = filteredData.filter(i => i.importe < 0);
  const totalAbs = Math.abs(gastos.reduce((a, b) => a + b.importe, 0)) || 1;

  const groupBy = (key, limit = 8) => {
    const g = {};
    gastos.forEach(item => {
      const k = item[key] || 'Sin asignar';
      g[k] = (g[k] || 0) + Math.abs(item.importe);
    });
    return Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, limit);
  };

  const topCats  = groupBy('categoria',    8);
  const topProvs = groupBy('proveedor',   10);
  const topCanal = groupBy('canal',        5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Evolución mensual ─────────────────────────────────── */}
      <div style={{
        background: 'var(--c-surface)',
        borderRadius: 'var(--r-xl)',
        border: '1px solid var(--c-border)',
        boxShadow: 'var(--shadow-sm)',
        padding: '1.25rem 1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.125rem' }}>📅</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--c-text-1)' }}>
              Evolución Mensual
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--c-text-3)', fontWeight: 600 }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--c-brand)', display: 'inline-block' }} />
              Gastos
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--c-text-3)', fontWeight: 600 }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--c-green)', display: 'inline-block' }} />
              Ingresos
            </span>
          </div>
        </div>
        <EvolucionMensual db={db} />
      </div>

      {/* ── Donut + Top categorías ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Donut */}
        <div style={{
          background: 'var(--c-surface)',
          borderRadius: 'var(--r-xl)',
          border: '1px solid var(--c-border)',
          boxShadow: 'var(--shadow-sm)',
          padding: '1.5rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem',
          minWidth: '200px',
        }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.875rem', color: 'var(--c-text-1)' }}>
            Distribución Gastos
          </span>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <MiniDonut data={topCats} total={totalAbs} size={150} />
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1rem', color: 'var(--c-brand)', margin: 0 }}>
                {totalAbs.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
              </p>
              <p style={{ fontSize: '0.6875rem', color: 'var(--c-text-4)', margin: 0 }}>total</p>
            </div>
          </div>
          {/* Leyenda */}
          <div style={{ width: '100%' }}>
            {topCats.slice(0, 5).map(([name, val], i) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--c-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {name || 'Sin asignar'}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--c-text-2)', flexShrink: 0 }}>
                  {((val / totalAbs) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top categorías (barras) */}
        <BarrasHorizontales
          title="Gasto por Categoría"
          icon="📂"
          data={topCats}
          total={totalAbs}
        />
      </div>

      {/* ── Top proveedores + Canal ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        <BarrasHorizontales title="Top Proveedores" icon="🏢" data={topProvs} total={totalAbs} />
        <BarrasHorizontales title="Por Canal Bancario" icon="🏦" data={topCanal} total={totalAbs} />
      </div>
    </div>
  );
};

export default ExtractosGraficas;