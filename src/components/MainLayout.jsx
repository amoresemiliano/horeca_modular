import InventarioApp from '../modules/inventario/InventarioApp';
import { useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import logoCliente from '../assets/logo_cliente.png'; 
import Configuracion from '../modules/configuracion/Configuracion.jsx'; // Asegúrate de que la ruta sea correcta

// 1. ESTA ES LA ESTRUCTURA MAESTRA (Todos los módulos posibles)
const ESTRUCTURA_GLOBAL = {
  Dashboard: {icon: '🏠', tabs: ["Inicio", "Métricas Rápidas"]},
  Inventario: {icon: '📦', tabs: ["DashBoard", "Inventario", "Producción", "Movimientos", "Planificación"]},
  Pedidos: {icon: '📋', tabs: ["Orden", "Historial"]},
  Extractos: {icon: '📊', tabs: ["Importar / Exportar", "DashBoard", "Consolidado", "Proveedores", "Análisis"]},
  KPI: {icon: '📈', tabs: ["Importar / Exportar", "DashBoard", "Análisis", "Productos", "Predicción", "Acciones"]},
  Ventas: {icon: '💰', tabs: ["Productos", "Gráficos", "Tickets", "Mesas"]},
  Config: { icon: '⚙️', tabs: ["Accesos", "Empresa", "Usuarios"] }
};

const MainLayout = ({ user }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 2. SIMULACIÓN DE PERMISOS (Esto luego vendrá de tu BD)
  // Por ahora, Emiliano ve todo. Otros verán lo que definas aquí.
  const [permisosUsuario, setPermisosUsuario] = useState({
    Dashboard: ["Inicio", "Métricas Rápidas"],
    Inventario: ["DashBoard", "Inventario", "Producción", "Movimientos", "Planificación"],
    Pedidos: ["Orden", "Historial"],
    Extractos: ["Importar / Exportar", "DashBoard", "Consolidado", "Proveedores", "Análisis"],
    KPI: ["Importar / Exportar", "DashBoard", "Análisis", "Productos", "Predicción", "Acciones"],
    Ventas: ["Productos", "Gráficos", "Tickets", "Mesas"],
    Config: ["Accesos", "Empresa", "Usuarios"] 
  });

  // 3. LÓGICA DE FILTRADO (SOLID)
  // Creamos una nueva estructura que solo contiene lo que el usuario tiene permitido
  const estructuraFiltrada = Object.keys(ESTRUCTURA_GLOBAL)
    .filter(modulo => Object.keys(permisosUsuario).includes(modulo))
    .reduce((obj, key) => {
      obj[key] = {
        icon: ESTRUCTURA_GLOBAL[key].icon,
        tabs: ESTRUCTURA_GLOBAL[key].tabs.filter(tab => permisosUsuario[key].includes(tab))
      };
      return obj;
    }, {});

  // Estados de navegación basados en el filtro
  const modulosDisponibles = Object.keys(estructuraFiltrada);
  const [moduloActivo, setModuloActivo] = useState(modulosDisponibles[0] || 'Dashboard');
  const [tabActiva, setTabActiva] = useState(estructuraFiltrada[moduloActivo]?.tabs[0] || '');

  // COLORES EL CRIOLLO
  const colPrimario = '#E2231A'; 
  const colSecundario = '#006847'; 

  const cerrarSesion = async () => {
    try { await signOut(auth); } catch (error) { console.error(error); }
  };

  const cambiarModulo = (mod) => {
    setModuloActivo(mod);
    setTabActiva(estructuraFiltrada[mod].tabs[0]);
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 font-sans text-gray-900 overflow-hidden">
      
      {/* 1. TOPBAR */}
      <header className="bg-white border-b border-gray-100 h-16 flex items-center justify-between px-6 shadow-sm z-30">
        <div className="flex items-center gap-8">
          <img src={logoCliente} alt="Logo" className="h-10 w-auto object-contain" />
          
          <nav className="hidden lg:flex gap-1">
            {modulosDisponibles.map((mod) => (
              <button
                key={mod}
                onClick={() => cambiarModulo(mod)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${moduloActivo === mod ? 'bg-gray-100' : 'text-gray-600 hover:bg-gray-50'}`}
                style={moduloActivo === mod ? { color: colPrimario, borderBottom: `2px solid ${colPrimario}`, borderRadius: '0px' } : {}}
              >
                {estructuraFiltrada[mod].icon} {mod}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
            <div className="w-px h-6 bg-gray-200"></div>
            <img src={user?.photoURL || 'https://via.placeholder.com/32'} alt="U" className="w-8 h-8 rounded-full border border-gray-200" />
            <span className="text-sm font-semibold hidden md:block">{user?.displayName || user?.email}</span>
            <button onClick={cerrarSesion} className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
            </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 2. SIDEBAR */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-100 transition-all duration-300 flex flex-col z-20`}>
          <div className="p-4 border-b border-gray-100 font-bold text-gray-900 text-sm flex items-center gap-2">
            <span>{estructuraFiltrada[moduloActivo]?.icon}</span>
            {sidebarOpen && <span>Pestañas: {moduloActivo}</span>}
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {estructuraFiltrada[moduloActivo]?.tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setTabActiva(tab)}
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${tabActiva === tab ? 'bg-gray-100 text-gray-950 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: tabActiva === tab ? colSecundario : '#D1D5DB' }}
                ></span>
                {sidebarOpen && <span>{tab}</span>}
              </button>
            ))}
          </nav>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-4 border-t border-gray-100 text-gray-400 hover:text-gray-600 flex justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" /></svg>
          </button>
        </aside>

        {/* 3. CONTENIDO PRINCIPAL DINÁMICO */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-10 pb-4 border-b border-gray-200">
                <div>
                    <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">{moduloActivo}</p>
                    <h2 className="text-4xl font-extrabold text-gray-950 tracking-tighter">{tabActiva}</h2>
                    <div className="h-1 w-12 mt-2 rounded-full" style={{ backgroundColor: colPrimario }}></div>
                </div>
                {/* Botones de acción solo si no estamos en Configuración */}
                {moduloActivo !== 'Config' && (
                  <div className="flex gap-2">
                      <button className="px-5 py-2.5 text-white rounded-full text-sm font-semibold shadow transition" style={{ backgroundColor: colSecundario }}>
                        + Nuevo Registro
                      </button>
                      <button className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-100 shadow-sm transition">Acciones</button>
                  </div>
                )}
            </div>

            {/* AQUÍ INYECTAMOS EL PANEL DE CONFIGURACIÓN O EL CONTENIDO DE LOS MÓDULOS */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
             {moduloActivo === 'Config' ? (
      <Configuracion />
        ) : moduloActivo === 'Inventario' ? (
      /* Pasamos la pestaña activa como propiedad */
      <InventarioApp tabActiva={tabActiva} /> 
        ) : (
      <div className="flex flex-col items-center justify-center text-gray-400 h-full">
        <p className="font-semibold text-gray-600 mb-2 italic text-center">Contenido de {tabActiva}</p>
        <p className="text-sm">VDC Core Engine / Cliente: {user?.email}</p>
          </div>
           )}
          </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;