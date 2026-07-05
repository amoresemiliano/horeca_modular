import InventarioApp  from '../modules/inventario/InventarioApp';
import ExtractosApp   from '../modules/extractos/ExtractosApp';
import VentasApp      from '../modules/ventas/VentasApp';
import PedidosApp     from '../modules/pedidos/PedidosApp';
import KpisApp        from '../modules/kpis/KpisApp';
import PrediccionApp  from '../modules/prediccion/PrediccionApp';
import EscandallosApp from '../modules/escandallos/EscandallosApp';
import HorariosApp    from '../modules/horarios/HorariosApp';
import ProduccionApp  from '../modules/produccion/ProduccionApp';
import Configuracion  from '../modules/configuracion/Configuracion.jsx';
import { useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import logoCliente from '../assets/logo_cliente.png';

/* ─── ESTRUCTURA MAESTRA ──────────────────────────────────────────────────── */
const MODULOS = {
  Dashboard:   { icon: '⌂',  label: 'Dashboard',   tabs: ['Inicio', 'Métricas Rápidas'],                                           group: 'principal' },
  Bancos:      { icon: '🏦', label: 'Bancos',       tabs: ['Consolidado', 'Resumen', 'Gráficas'],                                   group: 'finanzas'  },
  Ventas:      { icon: '💳', label: 'Ventas',       tabs: ['Productos', 'Gráficos', 'Tickets', 'Mesas'],                            group: 'finanzas'  },
  KPI:         { icon: '📈', label: 'KPIs',         tabs: ['DashBoard', 'Análisis', 'Productos', 'Predicción', 'Acciones'],         group: 'finanzas'  },
  Inventario:  { icon: '📦', label: 'Inventario',   tabs: ['DashBoard', 'Inventario', 'Producción', 'Movimientos', 'Planificación'],group: 'operaciones'},
  Escandallos: { icon: '🥘', label: 'Escandallos',  tabs: ['Preparación', 'Platos', 'Productos'],                                  group: 'operaciones'},
  Compras:     { icon: '🛒', label: 'Compras',      tabs: ['Orden', 'Historial'],                                                  group: 'operaciones'},
  Producción:  { icon: '🍳', label: 'Producción',   tabs: ['Registro', 'Historial', 'Resumen'],                                    group: 'operaciones'},
  Personal:    { icon: '👤', label: 'Personal',     tabs: ['Fichajes', 'Incidencias', 'Empleados', 'Informes'],                     group: 'rrhh'       },
  Predicción:  { icon: '🔮', label: 'Predicción',   tabs: ['Carga', 'Stock', 'Predicciones'],                                       group: 'analytics' },
  Config:      { icon: '⚙',  label: 'Config',       tabs: ['Accesos', 'Empresa', 'Usuarios'],                                       group: 'sistema'   },
};

const GRUPOS = {
  principal:   { label: 'Principal',    color: '#6B7280' },
  finanzas:    { label: 'Finanzas',     color: '#F59E0B' },
  operaciones: { label: 'Operaciones',  color: '#10B981' },
  rrhh:        { label: 'Personal',     color: '#3B82F6' },
  analytics:   { label: 'Analytics',   color: '#8B5CF6' },
  sistema:     { label: 'Sistema',      color: '#6B7280' },
};

/* ─── PERMISOS ────────────────────────────────────────────────────────────── */
const PERMISOS = {
  'emilianodirosa1@gmail.com': Object.keys(MODULOS),
  'epalacios1194@gmail.com':   ['Compras', 'Personal'],
};

/* ─── RENDER DE CONTENIDO ────────────────────────────────────────────────── */
const renderModulo = (modulo, tab, user) => {
  switch (modulo) {
    case 'Bancos':      return <ExtractosApp    tabActiva={tab} />;
    case 'Inventario':  return <InventarioApp   tabActiva={tab} />;
    case 'Ventas':      return <VentasApp       tabActiva={tab} />;
    case 'Compras':     return <PedidosApp      tabActiva={tab} />;
    case 'KPI':         return <KpisApp         tabActiva={tab} />;
    case 'Predicción':  return <PrediccionApp   tabActiva={tab} />;
    case 'Escandallos': return <EscandallosApp  tabActiva={tab} />;
    case 'Personal':    return <HorariosApp     tabActiva={tab} />;
    case 'Producción':  return <ProduccionApp   tabActiva={tab} />;
    case 'Config':      return <Configuracion />;
    default:
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center select-none">
          <span style={{ fontSize: '3.5rem', lineHeight: 1 }}>{MODULOS[modulo]?.icon}</span>
          <p className="mt-4 text-lg font-semibold" style={{ color: 'var(--c-text-2)' }}>{tab}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--c-text-4)' }}>Módulo en desarrollo · {user?.email}</p>
        </div>
      );
  }
};

/* ─── ACCESO RESTRINGIDO ─────────────────────────────────────────────────── */
const AccesoRestringido = ({ modulo }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
         style={{ background: 'var(--c-brand-light)' }}>
      🔒
    </div>
    <h3 className="heading-section text-xl mb-2">Acceso restringido</h3>
    <p style={{ color: 'var(--c-text-3)', maxWidth: '360px', fontSize: '0.9rem' }}>
      No tenés permisos para el módulo <strong>{modulo}</strong>. Contactá al administrador.
    </p>
  </div>
);

/* ─── COMPONENTE PRINCIPAL ───────────────────────────────────────────────── */
const MainLayout = ({ user }) => {
  const [moduloActivo,      setModuloActivo]      = useState('Dashboard');
  const [tabActiva,         setTabActiva]          = useState('Inicio');
  const [sidebarOpen,       setSidebarOpen]        = useState(true);
  const [modulosPermitidos, setModulosPermitidos]  = useState([]);

  useEffect(() => {
    setModulosPermitidos(PERMISOS[user?.email] ?? ['Dashboard']);
  }, [user]);

  const cambiarModulo = (mod) => {
    setModuloActivo(mod);
    setTabActiva(MODULOS[mod].tabs[0]);
  };

  const cerrarSesion = async () => {
    try { await signOut(auth); } catch (e) { console.error(e); }
  };

  // Agrupar módulos por grupo para la nav top
  const gruposConModulos = Object.entries(GRUPOS).map(([key, grupo]) => ({
    key,
    ...grupo,
    modulos: Object.entries(MODULOS).filter(([, m]) => m.group === key).map(([k]) => k),
  })).filter(g => g.modulos.length > 0);

  const tabActual = MODULOS[moduloActivo];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--c-bg)', fontFamily: 'var(--font-body)', overflow: 'hidden' }}>

      {/* ══════════════════════════════════════════════════
          TOPBAR
      ══════════════════════════════════════════════════ */}
      <header style={{
        height: '60px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        zIndex: 30,
        position: 'sticky',
        top: 0,
        boxShadow: 'var(--shadow-xs)',
      }}>
        {/* Logo + Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <img src={logoCliente} alt="El Criollo" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />

          {/* Línea divisoria */}
          <div style={{ width: '1px', height: '28px', background: 'var(--c-border)' }} />

          {/* Navegación por grupos */}
          <nav style={{ display: 'flex', gap: '0.125rem', flexWrap: 'nowrap' }}>
            {Object.entries(MODULOS).map(([key, mod]) => {
              const isActive = moduloActivo === key;
              return (
                <button
                  key={key}
                  onClick={() => cambiarModulo(key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.8125rem',
                    fontWeight: isActive ? 600 : 500,
                    borderRadius: 'var(--r-lg)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all var(--t-fast)',
                    background:  isActive ? 'var(--c-brand-light)' : 'transparent',
                    color:       isActive ? 'var(--c-brand)' : 'var(--c-text-3)',
                    fontFamily:  'var(--font-body)',
                    whiteSpace:  'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--c-surface-2)';
                      e.currentTarget.style.color = 'var(--c-text-1)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--c-text-3)';
                    }
                  }}
                >
                  <span style={{ fontSize: '0.875rem' }}>{mod.icon}</span>
                  <span>{mod.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Perfil */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ textAlign: 'right', display: 'none' }}>
            {/* Desktop only label */}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <img
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || user?.email || 'U')}&background=E2231A&color=fff&bold=true&size=64`}
              alt="avatar"
              style={{ width: '34px', height: '34px', borderRadius: '50%', border: '2px solid var(--c-border)', objectFit: 'cover' }}
            />
            <div style={{ lineHeight: 1.2 }}>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--c-text-1)', margin: 0 }}>
                {user?.displayName || 'Usuario'}
              </p>
              <p style={{ fontSize: '0.6875rem', color: 'var(--c-text-4)', margin: 0 }}>
                {user?.email}
              </p>
            </div>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'var(--c-border)' }} />
          <button
            onClick={cerrarSesion}
            title="Cerrar sesión"
            style={{
              width: '34px', height: '34px',
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--c-border)',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--c-text-3)',
              transition: 'all var(--t-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-danger-bg)'; e.currentTarget.style.color = 'var(--c-danger)'; e.currentTarget.style.borderColor = 'var(--c-danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-3)'; e.currentTarget.style.borderColor = 'var(--c-border)'; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════
          BODY (sidebar + main)
      ══════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── SIDEBAR ───────────────────────────────────── */}
        <aside style={{
          width: sidebarOpen ? '196px' : '56px',
          background: '#0F172A',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          transition: 'width 300ms cubic-bezier(0.4,0,0.2,1)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 20,
          flexShrink: 0,
        }}>
          {/* Módulo header */}
          <div style={{
            padding: '1rem 0.875rem 0.75rem',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            minHeight: '56px',
          }}>
            <div style={{
              width: '30px', height: '30px',
              borderRadius: 'var(--r-md)',
              background: 'rgba(226,35,26,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem',
              flexShrink: 0,
            }}>
              {tabActual?.icon}
            </div>
            {sidebarOpen && (
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.02em', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {tabActual?.label}
              </span>
            )}
          </div>

          {/* Nav tabs */}
          <nav style={{ flex: 1, padding: '0.625rem', overflowY: 'auto', overflowX: 'hidden' }}>
            {tabActual?.tabs.map((tab, i) => {
              const isActive = tabActiva === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setTabActiva(tab)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.625rem',
                    borderRadius: 'var(--r-md)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all var(--t-fast)',
                    background:  isActive ? 'rgba(226,35,26,0.15)' : 'transparent',
                    color:       isActive ? '#FCA5A5' : 'rgba(255,255,255,0.5)',
                    fontFamily:  'var(--font-body)',
                    fontSize:    '0.8125rem',
                    fontWeight:  isActive ? 600 : 400,
                    textAlign:   'left',
                    marginBottom: '0.125rem',
                    animation:   `fadeIn ${100 + i * 50}ms ease both`,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                    }
                  }}
                  title={!sidebarOpen ? tab : undefined}
                >
                  {/* Dot indicator */}
                  <span style={{
                    width: '5px', height: '5px',
                    borderRadius: '50%',
                    background:  isActive ? '#F87171' : 'rgba(255,255,255,0.2)',
                    flexShrink:  0,
                    transition:  'all var(--t-fast)',
                  }} />
                  {sidebarOpen && (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tab}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Toggle + versión */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '0.625rem' }}>
            <button
              onClick={() => setSidebarOpen(s => !s)}
              style={{
                width: '100%', padding: '0.5rem',
                borderRadius: 'var(--r-md)',
                border: 'none',
                background: 'transparent',
                color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'flex-end' : 'center',
                gap: '0.5rem',
                transition: 'all var(--t-fast)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
            >
              {sidebarOpen && <span>Colapsar</span>}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                   style={{ transform: sidebarOpen ? 'none' : 'rotate(180deg)', transition: 'transform var(--t-base)' }}>
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
          </div>
        </aside>

        {/* ── CONTENIDO PRINCIPAL ───────────────────────── */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '2rem',
          background: 'var(--c-bg)',
        }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

            {/* Page header */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {MODULOS[moduloActivo]?.label}
                </span>
                <span style={{ color: 'var(--c-border)', fontSize: '0.75rem' }}>›</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--c-brand)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {tabActiva}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <h1 className="heading-display" style={{ fontSize: '1.75rem', margin: 0 }}>
                  {tabActiva}
                </h1>
                <div style={{
                  height: '6px', width: '6px', borderRadius: '50%',
                  background: 'var(--c-brand)', marginTop: '2px', flexShrink: 0,
                }} />
              </div>
            </div>

            {/* Panel de contenido */}
            <div style={{
              background: 'var(--c-surface)',
              borderRadius: 'var(--r-2xl)',
              border: '1px solid var(--c-border)',
              boxShadow: 'var(--shadow-sm)',
              minHeight: '480px',
              padding: '2rem',
              animation: 'fadeIn 200ms ease',
            }}>
              {!modulosPermitidos.includes(moduloActivo)
                ? <AccesoRestringido modulo={moduloActivo} />
                : renderModulo(moduloActivo, tabActiva, user)
              }
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;