import React, { useState } from 'react';
import './prediccion.css';

const PrediccionApp = ({ tabActiva }) => {
  const [dataLoaded, setDataLoaded] = useState({ inventario: false, ventas: false });

  const handleFileUpload = (type) => (e) => {
    if (e.target.files.length > 0) {
      setDataLoaded(prev => ({ ...prev, [type]: true }));
      // Aquí se procesaría el CSV con PapaParse y la lógica original de main.js
    }
  };

  if (tabActiva === 'Carga') {
    return (
      <div className="flex flex-col gap-6 ec-prediccion-wrapper">
        <h2 className="text-2xl font-bold text-gray-800">Carga de Datos Iniciales</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center hover:border-blue-300 transition">
            <h2 className="text-xl font-bold mb-2 text-gray-800">📦 Cargar Inventario Inicial</h2>
            <p className="text-gray-500 text-sm mb-4">Sube tu stock actual y mínimos permitidos.</p>
            <div className={`p-8 border-2 border-dashed rounded-xl relative ${dataLoaded.inventario ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
              <input type="file" id="csv-inventory" accept=".csv" className="hidden" onChange={handleFileUpload('inventario')} />
              <label htmlFor="csv-inventory" className="cursor-pointer">
                {dataLoaded.inventario ? (
                  <span className="text-green-600 font-bold">¡Inventario Cargado!</span>
                ) : (
                  <span className="text-blue-600 font-semibold">Seleccionar archivo CSV</span>
                )}
              </label>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center hover:border-blue-300 transition">
            <h2 className="text-xl font-bold mb-2 text-gray-800">📈 Cargar Historial de Ventas</h2>
            <p className="text-gray-500 text-sm mb-4">Sube las ventas del mes para proyectar compras.</p>
            <div className={`p-8 border-2 border-dashed rounded-xl relative ${dataLoaded.ventas ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
              <input type="file" id="csv-sales" accept=".csv" className="hidden" onChange={handleFileUpload('ventas')} />
              <label htmlFor="csv-sales" className="cursor-pointer">
                {dataLoaded.ventas ? (
                  <span className="text-green-600 font-bold">¡Ventas Cargadas!</span>
                ) : (
                  <span className="text-blue-600 font-semibold">Seleccionar archivo CSV</span>
                )}
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tabActiva === 'Stock') {
    return (
      <div className="flex flex-col gap-6 ec-prediccion-wrapper">
        <h2 className="text-2xl font-bold text-gray-800">Estado de Almacén</h2>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          {!dataLoaded.inventario ? (
            <div className="text-center py-10 text-gray-400">
              <i className="fas fa-box-open text-4xl mb-3"></i>
              <p>No hay datos de inventario cargados. Ve a la pestaña "Carga" para importar tu CSV.</p>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 uppercase tracking-wider border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-6 py-3">Insumo</th>
                  <th className="px-6 py-3">Stock Actual</th>
                  <th className="px-6 py-3">Stock Mínimo</th>
                  <th className="px-6 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-6 py-4">Carne de Ternera</td>
                  <td className="px-6 py-4 font-bold">12 kg</td>
                  <td className="px-6 py-4">15 kg</td>
                  <td className="px-6 py-4"><span className="text-red-600 font-semibold bg-red-50 px-2 py-1 rounded">Bajo Mínimo</span></td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-6 py-4">Tomates</td>
                  <td className="px-6 py-4 font-bold">25 kg</td>
                  <td className="px-6 py-4">10 kg</td>
                  <td className="px-6 py-4"><span className="text-green-600 font-semibold bg-green-50 px-2 py-1 rounded">Óptimo</span></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  if (tabActiva === 'Predicciones') {
    return (
      <div className="flex flex-col gap-6 ec-prediccion-wrapper">
        <h2 className="text-2xl font-bold text-gray-800">Predicción de Compras (Próxima Semana)</h2>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          {(!dataLoaded.inventario || !dataLoaded.ventas) ? (
            <div className="text-center py-10 text-gray-400">
              <i className="fas fa-magic text-4xl mb-3"></i>
              <p>Esperando datos de ventas e inventario para calcular las proyecciones...</p>
            </div>
          ) : (
            <div>
              <p className="text-lg mb-4">Basado en el ritmo de ventas actual y tu stock, te sugerimos pedir:</p>
              <ul className="space-y-3">
                <li className="p-4 bg-red-50 border border-red-100 rounded-lg flex justify-between items-center">
                  <span className="font-semibold text-gray-800">Carne de Ternera</span>
                  <span className="text-red-700 font-bold text-lg">+ 8 kg</span>
                </li>
                <li className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg flex justify-between items-center">
                  <span className="font-semibold text-gray-800">Cebollas</span>
                  <span className="text-yellow-700 font-bold text-lg">+ 5 kg</span>
                </li>
              </ul>
              <button className="mt-6 w-full py-3 bg-[#E2231A] text-white font-bold rounded-lg hover:bg-red-700 transition shadow">
                Enviar al Módulo de Pedidos
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default PrediccionApp;