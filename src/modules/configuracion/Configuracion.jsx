import { useState } from 'react';

// Esta es la fuente de verdad del sistema (debería coincidir con tu MainLayout)
const ESTRUCTURA_SISTEMA = {
  Dashboard: ["Inicio", "Métricas Rápidas"],
  Inventario: ["DashBoard", "Inventario", "Producción", "Movimientos", "Planificación"],
  Pedidos: ["Orden", "Historial"],
  Extractos: ["Importar / Exportar", "DashBoard", "Consolidado", "Proveedores", "Análisis"],
  KPI: ["Importar / Exportar", "DashBoard", "Análisis", "Productos", "Predicción", "Acciones"],
  Ventas: ["Productos", "Gráficos", "Tickets", "Mesas"]
};

const Configuracion = () => {
  // Simulamos el estado de permisos de un usuario específico
  const [permisos, setPermisos] = useState({
    Dashboard: ["Inicio"],
    Inventario: ["Inventario", "Movimientos"]
  });

  const toggleTab = (modulo, tab) => {
    setPermisos(prev => {
      const tabsActuales = prev[modulo] || [];
      const nuevasTabs = tabsActuales.includes(tab)
        ? tabsActuales.filter(t => t !== tab) // Quitar si ya está
        : [...tabsActuales, tab]; // Agregar si no está

      return { ...prev, [modulo]: nuevasTabs };
    });
  };

  const guardarConfiguracion = () => {
    console.log("Guardando en Firebase/Supabase:", permisos);
    alert("Configuración de permisos guardada con éxito.");
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Control de Accesos</h3>
          <p className="text-sm text-gray-500">Define qué módulos y pestañas están visibles para este perfil.</p>
        </div>
        <button 
          onClick={guardarConfiguracion}
          className="bg-gray-900 text-white px-6 py-2 rounded-full font-bold hover:bg-black transition shadow-lg"
        >
          Guardar Cambios
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.keys(ESTRUCTURA_SISTEMA).map((modulo) => (
          <div key={modulo} className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
              <span className="font-black text-gray-900 uppercase tracking-tighter">{modulo}</span>
              <input 
                type="checkbox" 
                checked={permisos[modulo]?.length > 0}
                readOnly
                className="w-5 h-5 accent-green-600"
              />
            </div>
            
            <div className="space-y-3">
              {ESTRUCTURA_SISTEMA[modulo].map((tab) => (
                <label key={tab} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={permisos[modulo]?.includes(tab)}
                    onChange={() => toggleTab(modulo, tab)}
                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className={`text-sm font-medium transition ${permisos[modulo]?.includes(tab) ? 'text-gray-900' : 'text-gray-400'}`}>
                    {tab}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Configuracion;