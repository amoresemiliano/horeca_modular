import React, { useState } from 'react';

/* ─── Selector rápido de período ─────────────────────────────────────────── */
const PERIODOS = [
  { id: 'todos',      label: 'Histórico completo' },
  { id: 'mes_actual', label: 'Mes en curso'        },
  { id: 'mes_pasado', label: 'Mes pasado'          },
  { id: 'trim',       label: 'Últimos 3 meses'     },
  { id: 'ano_actual', label: 'Año actual'           },
];

const getRango = (id) => {
  const today = new Date();
  const Y = today.getFullYear(), M = today.getMonth();
  switch (id) {
    case 'mes_actual': return {
      from: new Date(Y, M, 1).toISOString().slice(0,10),
      to:   new Date(Y, M+1, 0).toISOString().slice(0,10),
    };
    case 'mes_pasado': return {
      from: new Date(Y, M-1, 1).toISOString().slice(0,10),
      to:   new Date(Y, M, 0).toISOString().slice(0,10),
    };
    case 'trim': return {
      from: new Date(Y, M-2, 1).toISOString().slice(0,10),
      to:   new Date(Y, M+1, 0).toISOString().slice(0,10),
    };
    case 'ano_actual': return {
      from: new Date(Y, 0, 1).toISOString().slice(0,10),
      to:   new Date(Y, 11, 31).toISOString().slice(0,10),
    };
    default: return { from: '', to: '' };
  }
};

/* ─── Colores para cada categoría ────────────────────────────────────────── */
const CAT_COLORS = [
  '#E2231A', '#006847', '#F59E0B', '#3B82F6', '#8B5CF6',
  '#EC4899', '#10B981', '#F97316', '#6366F1', '#14B8A6',
];

/* ─── Barra horizontal con porcentaje ───────────────────────────────────── */
const BarraHorizontal = ({ label, valor, pct, color, total, rank }) => (
  <div style={{ marginBottom: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: color, flexShrink: 0,
        }} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label || 'Sin asignar'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0, marginLeft: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--c-text-4)', fontWeight: 500 }}>{pct}%</span>
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--c-brand)' }}>
          {Math.abs(valor).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
        </span>
      </div>
    </div>
    <div style={{ height: '6px', background: 'var(--c-bg)', borderRadius: '9999px', overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: color,
        borderRadius: '9999px',
        transition: 'width 600ms cubic-bezier(0.34,1.56,0.64,1)',
        opacity: 0.85,
      }} />
    </div>
  </div>
);

/* ─── Tabla de resumen por grupo ────────────────────────────────────────── */
const TablaResumen = ({ title, data, icon, totalGastos }) => (
  <div style={{
    background: 'var(--c-surface)',
    borderRadius: 'var(--r-xl)',
    border: '1px solid var(--c-border)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  }}>
    <div style={{
      padding: '1rem 1.25rem',
      borderBottom: '1px solid var(--c-border)',
      display: 'flex', alignItems: 'center', gap: '0.5rem',
    }}>
      <span style={{ fontSize: '1.125rem' }}>{icon}</span>
      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--c-text-1)' }}>
        {title}
      </span>
      <span style={{
        marginLeft: 'auto',
        fontSize: '0.6875rem', fontWeight: 700,
        color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {data.length} entradas
      </span>
    </div>
    <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '1rem 1.25rem' }}>
      {data.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--c-text-4)', fontSize: '0.875rem', padding: '2rem 0' }}>
          Sin datos en el período seleccionado
        </p>
      ) : data.map(([name, val], i) => {
        const pct = totalGastos > 0 ? ((Math.abs(val) / totalGastos) * 100).toFixed(1) : '0.0';
        return (
          <BarraHorizontal
            key={name}
            label={name}
            valor={val}
            pct={pct}
            color={CAT_COLORS[i % CAT_COLORS.length]}
            rank={i}
          />
        );
      })}
    </div>
  </div>
);

/* ─── KPI Card ───────────────────────────────────────────────────────────── */
const KpiCard = ({ label, value, sub, color, icon }) => (
  <div style={{
    background: 'var(--c-surface)',
    borderRadius: 'var(--r-xl)',
    border: '1px solid var(--c-border)',
    boxShadow: 'var(--shadow-sm)',
    padding: '1.25rem 1.5rem',
    position: 'relative',
    overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute', top: 0, left: 0, bottom: 0,
      width: '4px', background: color, borderRadius: '4px 0 0 4px',
    }} />
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
      <div>
        <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>
          {label}
        </p>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.625rem', fontWeight: 800, color: color, margin: 0, lineHeight: 1 }}>
          {value}
        </p>
        {sub && <p style={{ fontSize: '0.75rem', color: 'var(--c-text-4)', marginTop: '0.375rem' }}>{sub}</p>}
      </div>
      <div style={{
        width: '40px', height: '40px', borderRadius: 'var(--r-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.25rem', flexShrink: 0,
        background: `${color}18`,
      }}>
        {icon}
      </div>
    </div>
  </div>
);

/* ─── COMPONENTE PRINCIPAL ───────────────────────────────────────────────── */
const ExtractosResumen = ({ db, filterConfig, setFilterConfig }) => {
  const [periodoActivo, setPeriodoActivo] = useState(filterConfig.quickDate || 'todos');

  const cambiarPeriodo = (id) => {
    setPeriodoActivo(id);
    setFilterConfig({ ...filterConfig, quickDate: id, dateRange: getRango(id) });
  };

  // Filtrar por fecha
  const filteredData = db.filter(item => {
    const { from, to } = filterConfig.dateRange;
    if (!from && !to) return true;
    const d = new Date(item.fecha);
    if (from && d < new Date(from)) return false;
    if (to   && d > new Date(to))   return false;
    return true;
  });

  const gastos   = filteredData.filter(i => i.importe < 0);
  const ingresos = filteredData.filter(i => i.importe > 0);

  const totalGastos   = Math.abs(gastos.reduce((a, b) => a + b.importe, 0));
  const totalIngresos = ingresos.reduce((a, b) => a + b.importe, 0);
  const balance       = totalIngresos - totalGastos;

  const groupBy = (key) => {
    const g = {};
    gastos.forEach(item => {
      const k = item[key] || 'Sin asignar';
      g[k] = (g[k] || 0) + item.importe;
    });
    return Object.entries(g).sort((a, b) => a[1] - b[1]);
  };

  const porCategoria   = groupBy('categoria');
  const porSubcat      = groupBy('subcategoria');
  const porProveedor   = groupBy('proveedor');
  const porCanal       = groupBy('canal');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Selector de período ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
        {PERIODOS.map(p => (
          <button
            key={p.id}
            onClick={() => cambiarPeriodo(p.id)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '9999px',
              border: periodoActivo === p.id ? 'none' : '1.5px solid var(--c-border)',
              background:  periodoActivo === p.id ? 'var(--c-brand)' : 'var(--c-surface)',
              color:       periodoActivo === p.id ? '#fff' : 'var(--c-text-3)',
              fontSize:    '0.8125rem',
              fontWeight:  periodoActivo === p.id ? 700 : 500,
              cursor:      'pointer',
              fontFamily:  'var(--font-body)',
              transition:  'all 150ms ease',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── KPI strip ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <KpiCard
          label="Total gastos"
          value={totalGastos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          sub={`${gastos.length} movimientos`}
          color="var(--c-brand)"
          icon="📉"
        />
        <KpiCard
          label="Total ingresos"
          value={totalIngresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          sub={`${ingresos.length} movimientos`}
          color="var(--c-green)"
          icon="📈"
        />
        <KpiCard
          label="Balance neto"
          value={balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          sub={balance >= 0 ? 'Superávit' : 'Déficit'}
          color={balance >= 0 ? 'var(--c-green)' : 'var(--c-brand)'}
          icon={balance >= 0 ? '✅' : '⚠️'}
        />
        <KpiCard
          label="Total movimientos"
          value={filteredData.length}
          sub={`${porCategoria.length} categorías`}
          color="var(--c-info)"
          icon="🔄"
        />
      </div>

      {/* ── Tablas de desglose ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        <TablaResumen title="Por Categoría"    icon="📂" data={porCategoria} totalGastos={totalGastos} />
        <TablaResumen title="Por Subcategoría" icon="🏷️" data={porSubcat}   totalGastos={totalGastos} />
        <TablaResumen title="Por Proveedor"    icon="🏢" data={porProveedor} totalGastos={totalGastos} />
        <TablaResumen title="Por Canal Bancario" icon="🏦" data={porCanal}  totalGastos={totalGastos} />
      </div>
    </div>
  );
};

export default ExtractosResumen;