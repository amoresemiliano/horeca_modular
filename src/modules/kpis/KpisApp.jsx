import React, { useState } from 'react';
import './kpis.css';

const KpisApp = ({ tabActiva }) => {
  const [dataLoaded, setDataLoaded] = useState({ ventas: false, tickets: false, comensales: false, productos: false });

  // Simulación de carga de archivos CSV
  const handleUpload = (type) => (e) => {
    if (e.target.files.length > 0) {
      setDataLoaded(prev => ({ ...prev, [type]: true }));
      // Aquí iría la lógica con PapaParse para leer los CSVs en el futuro
    }
  };

  const renderUploadBox = (title, id, type) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center gap-2 relative overflow-hidden transition hover:border-[#E2231A]">
      <span className="font-semibold text-gray-700">{title}</span>
      <input type="file" id={id} hidden accept=".csv" onChange={handleUpload(type)} />
      <label htmlFor={id} className="cursor-pointer text-sm text-[#006847] hover:underline">
        Subir CSV
      </label>
      <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${dataLoaded[type] ? 'bg-green-500' : 'bg-red-500'}`}></div>
    </div>
  );

  // Vistas condicionadas según la pestaña seleccionada
  if (tabActiva === 'Importar / Exportar') {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-gray-800">Carga de Datos (KPIs)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {renderUploadBox('Ventas', 'upVentas', 'ventas')}
          {renderUploadBox('Tickets', 'upTickets', 'tickets')}
          {renderUploadBox('Comensales', 'upComensales', 'comensales')}
          {renderUploadBox('Productos', 'upProductos', 'productos')}
        </div>
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mt-4 text-blue-800 text-sm">
          <strong>Nota:</strong> Este módulo procesa los archivos CSV provenientes del TPV para construir los indicadores clave de rendimiento (KPIs). En futuras actualizaciones, esta carga se podrá automatizar vía API.
        </div>
      </div>
    );
  }

  if (tabActiva === 'DashBoard') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="flex gap-4 items-center">
            <span className="font-semibold text-gray-700">Período:</span>
            <input type="date" className="border border-gray-300 rounded p-1.5 text-sm" defaultValue="2025-12-01" />
            <input type="date" className="border border-gray-300 rounded p-1.5 text-sm" defaultValue="2025-12-31" />
          </div>
        </div>

        {/* Tarjetas KPI de Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h4 className="text-gray-500 text-sm mb-1">Total Ventas</h4>
            <p className="text-2xl font-bold text-gray-900">0,00 €</p>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h4 className="text-gray-500 text-sm mb-1">Ticket Medio</h4>
            <p className="text-2xl font-bold text-gray-900">0,00 €</p>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h4 className="text-gray-500 text-sm mb-1">PPA (Comensales)</h4>
            <p className="text-2xl font-bold text-gray-900">0,00 €</p>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h4 className="text-gray-500 text-sm mb-1">Ratio Salón/Terraza</h4>
            <p className="text-2xl font-bold text-gray-900">0% / 0%</p>
          </div>
        </div>

        {/* Gráfico Placeholder */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[300px] flex items-center justify-center">
           <div className="text-center text-gray-400">
             <div className="text-5xl mb-2">📊</div>
             <p>Gráficos interactivos en desarrollo...</p>
             <p className="text-xs mt-2">Requiere carga de datos para visualizar (Chart.js)</p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-gray-400 h-full py-20">
      <div className="text-4xl mb-4">📈</div>
      <p className="font-semibold text-gray-600 mb-2 text-center text-xl">Contenido de {tabActiva}</p>
      <p className="text-sm">Módulo de Business Intelligence y KPIs</p>
    </div>
  );
};

export default KpisApp;