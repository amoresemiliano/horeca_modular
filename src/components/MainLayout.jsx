import InventarioApp from '../modules/inventario/InventarioApp';
import ExtractosApp from '../modules/extractos/ExtractosApp';
import VentasApp from '../modules/ventas/VentasApp';
import PedidosApp from '../modules/pedidos/PedidosApp';
import KpisApp from '../modules/kpis/KpisApp';
import PrediccionApp from '../modules/prediccion/PrediccionApp';
import EscandallosApp from '../modules/escandallos/EscandallosApp';
import HorariosApp from '../modules/horarios/HorariosApp';
import ProduccionApp from '../modules/produccion/ProduccionApp';
import { useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import logoCliente from '../assets/logo_cliente.png';
import Configuracion from '../modules/configuracion/Configuracion.jsx';

// ─── ESTRUCTURA MAESTRA DE MÓDULOS ──────────────────────────────────────────
const ESTRUCTURA_GLOBAL = {
  Dashboard:   { icon: '🏠', tabs: ['Inicio', 'Métricas Rápidas'] },
  Bancos:      { icon: '🏦', tabs: ['Consolidado', 'Resumen', 'Gráficas'] },
  Ventas:      { icon: '💰', tabs: ['Productos', 'Gráficos', 'Tickets', 'Mesas'] },
  Inventario:  { icon: '📦', tabs: ['DashBoard', 'Inventario', 'Producción', 'Movimientos', 'Planificación'] },
  Escandallos: { icon: '🥘', tabs: ['Preparación', 'Platos', 'Productos'] },
  Compras:     { icon: '📋', tabs: ['Orden', 'Historial'] },
  Producción:  { icon: '🍳', tabs: ['Registro', 'Historial', 'Resumen'] },
  Personal:    { icon: '👥', tabs: ['Fichajes', 'Incidencias', 'Empleados', 'Informes'] },
  KPI:         { icon: '📈', tabs: ['Importar / Exportar', 'DashBoard', 'Análisis', 'Productos', 'Predicción', 'Acciones'] },
  Predicción:  { icon: '🔮', tabs: ['Carga', 'Stock', 'Predicciones'] },
  Config:      { icon: '⚙️',  tabs: ['Accesos', 'Empresa', 'Usuarios'] },
};

// ─── COLORES MARCA EL CRIOLLO ────────────────────────────────────────────────
const COL_PRIMARIO   = '#E2231A';
const COL_SECUNDARIO = '#006847';

// ─── PERMISOS POR USUARIO ────────────────────────────────────────────────────
const PERMISOS = {
  'emilianodirosa1@gmail.com': Object.keys(ESTRUCTURA_GLOBAL), // Admin total
  'epalacios1194@gmail.com':   ['Compras', 'Personal'],         // Gerente
};

const MainLayout = ({ user }) => {
  const [sidebarOpen,      setSidebarOpen]      = useState(true);
  const [moduloActivo,     setModuloActivo]      = useState('Dashboard');
  const [tabActiva,        setTabActiva]         = useState('Inicio');
  const [modulosPermitidos, setModulosPermitidos] = useState([]);

  useEffect(() => {
    const permisos = PERMISOS[user?.email] ?? ['Dashboard'];
    setModulosPermitidos(permisos);
  }, [user]);

  const modulosDisponibles = Object.keys(ESTRUCTURA_GLOBAL);

  const cambiarModulo = (mod) => {
    setModuloActivo(mod);
    setTabActiva(ESTRUCTURA_GLOBAL[mod].tabs[0]);
  };

  const cerrarSesion = async () => {
    try { await signOut(auth); } catch (e) { console.error(e); }
  };

  // ─── Render del contenido según módulo y tab ──────────────────────────────
  const renderContenido = () => {
    if (!modulosPermitidos.includes(moduloActivo)) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-center">
          <div className="text-7xl mb-4">🔒</div>
          <h3 className="text-2xl font-bold text-gray-700 mb-2">Acceso Restringido</h3>
          <p className="text-gray-500 max-w-md">
            No tenés permisos para el módulo <strong>{moduloActivo}</strong>.<br />
            Contactá al administrador.
          </p>
        </div>
      );
    }

    switch (moduloActivo) {
      case 'Bancos':      return <ExtractosApp    tabActiva={tabActiva} />;
      case 'Inventario':  return <InventarioApp   tabActiva={tabActiva} />;
      case 'Ventas':      return <VentasApp       tabActiva={tabActiva} />;
      case 'Compras':     return <PedidosApp      tabActiva={tabActiva} />;
      case 'KPI':         return <KpisApp         tabActiva={tabActiva} />;
      case 'Predicción':  return <PrediccionApp   tabActiva={tabActiva} />;
      case 'Escandallos': return <EscandallosApp  tabActiva={tabActiva} />;
      case 'Personal':    return <HorariosApp     tabActiva={tabActiva} />;
      case 'Producción':  return <ProduccionApp   tabActiva={tabActiva} />;
      case 'Config':      return <Configuracion />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-lg font-semibold text-gray-600 italic">{tabActiva}</p>
            <p className="text-sm mt-1">Módulo en desarrollo · {user?.email}</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50 font-sans text-gray-900 overflow-hidden">

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 h-16 flex items-center justify-between px-6 shadow-sm z-30">
        <div className="flex items-center gap-8">
          <img src={logoCliente} alt="El Criollo" className="h-10 w-auto object-contain" />

          <nav className="hidden lg:flex gap-1">
            {modulosDisponibles.map((mod) => (
              <button
                key={mod}
                onClick={() => cambiarModulo(mod)}
                className="px-4 py-1.5 text-sm font-medium transition-colors"
                style={
                  moduloActivo === mod
                    ? { color: COL_PRIMARIO, borderBottom: `2px solid ${COL_PRIMARIO}`, borderRadius: 0 }
                    : { color: '#6B7280', borderBottom: '2px solid transparent', borderRadius: 0 }
                }
              >
                {ESTRUCTURA_GLOBAL[mod].icon} {mod}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-px h-6 bg-gray-200" />
          <img
            src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || user?.email)}&background=E2231A&color=fff`}
            alt="avatar"
            className="w-8 h-8 rounded-full border border-gray-200"
          />
          <span className="text-sm font-semibold hidden md:block">
            {user?.displayName || user?.email}
          </span>
          <button
            onClick={cerrarSesion}
            title="Cerrar sesión"
            className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
        <aside
          className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-white border-r border-gray-100 transition-all duration-300 flex flex-col z-20`}
        >
          <div className="p-4 border-b border-gray-100 text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <span>{ESTRUCTURA_GLOBAL[moduloActivo]?.icon}</span>
            {sidebarOpen && <span>{moduloActivo}</span>}
          </div>

          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {ESTRUCTURA_GLOBAL[moduloActivo]?.tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setTabActiva(tab)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  tabActiva === tab
                    ? 'bg-red-50 text-red-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tabActiva === tab ? COL_SECUNDARIO : '#D1D5DB' }}
                />
                {sidebarOpen && <span className="truncate">{tab}</span>}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-4 border-t border-gray-100 text-gray-400 hover:text-gray-600 flex justify-center transition"
            title={sidebarOpen ? 'Colapsar' : 'Expandir'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
          </button>
        </aside>

        {/* ── CONTENIDO PRINCIPAL ───────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumb / Header */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">
                  {moduloActivo}
                </p>
                <h2 className="text-3xl font-extrabold text-gray-950 tracking-tight">
                  {tabActiva}
                </h2>
                <div className="h-1 w-8 mt-2 rounded-full" style={{ backgroundColor: COL_PRIMARIO }} />
              </div>
            </div>

            {/* Panel de contenido */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[400px] p-8">
              {renderContenido()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;