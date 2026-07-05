import { useState, useEffect } from 'react';

const Configuracion = ({ ESTRUCTURA_GLOBAL }) => {
  const [emailObjetivo, setEmailObjetivo] = useState('epalacios1194@gmail.com');
  const [permisosGlobales, setPermisosGlobales] = useState(() => JSON.parse(localStorage.getItem('vdc_permisos')) || {});
  
  // Computamos los permisos sobre la marcha para el email objetivo (en lugar de doble estado)
  const permisosUsuario = permisosGlobales[emailObjetivo] || ['Dashboard'];

  const toggleModulo = (modulo) => {
    const prev = permisosUsuario;
    const newPerms = prev.includes(modulo) ? prev.filter(m => m !== modulo) : [...prev, modulo];
    setPermisosGlobales({ ...permisosGlobales, [emailObjetivo]: newPerms });
  };

  const guardarConfiguracion = () => {
    localStorage.setItem('vdc_permisos', JSON.stringify(permisosGlobales));
    alert(`Permisos para ${emailObjetivo} guardados con éxito. Los cambios se aplicarán en su próximo inicio de sesión o al refrescar.`);
  };

  if (!ESTRUCTURA_GLOBAL) return null; // Safety check

  return (
    <div className="p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-gray-100 pb-6">
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Control de Accesos y Módulos</h3>
          <p className="text-sm text-gray-500 mt-1">Configura qué módulos completos están disponibles para cada usuario de tu equipo.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <input 
            type="email" 
            value={emailObjetivo}
            onChange={(e) => setEmailObjetivo(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-64 focus:ring-2 focus:ring-red-600 outline-none"
            placeholder="Email del usuario..."
          />
          <button 
            onClick={guardarConfiguracion}
            className="bg-gray-900 text-white px-6 py-2 rounded-full font-bold hover:bg-black transition shadow-lg whitespace-nowrap"
          >
            Guardar Cambios
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Object.keys(ESTRUCTURA_GLOBAL).map((modulo) => {
          if (modulo === 'Configuración') return null; // No auto-asignamos config
          const data = ESTRUCTURA_GLOBAL[modulo];
          const hasAccess = permisosUsuario.includes(modulo);
          
          return (
            <div 
              key={modulo} 
              className={`border rounded-2xl p-5 transition-all cursor-pointer ${hasAccess ? 'border-red-600 bg-red-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              onClick={() => toggleModulo(modulo)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{data.icon}</span>
                  <h4 className={`font-black uppercase tracking-tight ${hasAccess ? 'text-red-900' : 'text-gray-700'}`}>{modulo}</h4>
                </div>
                <input 
                  type="checkbox" 
                  checked={hasAccess}
                  readOnly
                  className="w-5 h-5 accent-red-600 cursor-pointer pointer-events-none"
                />
              </div>
              
              <div className="space-y-1">
                {data.tabs.map((tab) => (
                  <div key={tab} className="flex items-center gap-2 text-sm text-gray-500 pl-9">
                    <span className={`w-1.5 h-1.5 rounded-full ${hasAccess ? 'bg-red-400' : 'bg-gray-300'}`}></span>
                    {tab}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Configuracion;