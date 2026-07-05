import React, { useState } from 'react';
import Papa from 'papaparse';

const VentasApp = ({ tabActiva }) => {
  const [ventas, setVentas] = useState([]);
  
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Asumiremos que el CSV futuro de ventas tiene estos campos o similares
    // Por ahora, procesamos un CSV genérico
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        // Mapeo tentativo. Si el CSV tiene diferentes cabeceras, esto se adaptará.
        const mappedData = res.data.map(row => ({
          ticket: row.ticket || row.Ticket || row.id || '-',
          fecha: row.fecha || row.Fecha || row.Date || '-',
          hora: row.hora || row.Hora || row.Time || '-',
          productos: row.productos || row.Productos || row.Items || '-',
          comensales: row.comensales || row.Comensales || row.Guests || '1',
          tiempo: row.tiempo || row.Tiempo || row.Duration || '-',
          zona: row.zona || row.Zona || row.Zone || 'Salón',
          total: parseFloat(row.total || row.Total || row.Price || 0)
        }));
        setVentas([...ventas, ...mappedData]);
      }
    });
  };

  if (tabActiva === 'Productos' || tabActiva === 'Tickets') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="text-xl font-bold text-gray-800">
            Total Tickets: <span className="text-blue-600">{ventas.length}</span>
          </div>
          <div>
            <input 
              type="file" 
              id="ventas-upload" 
              hidden 
              accept=".csv"
              onChange={handleFileUpload}
            />
            <label 
              htmlFor="ventas-upload"
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 shadow transition cursor-pointer"
            >
              📥 Cargar Ventas TPV
            </label>
          </div>
        </div>

        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 uppercase tracking-wider border-b border-gray-200 text-gray-500">
              <tr>
                <th className="px-6 py-4">Ticket</th>
                <th className="px-6 py-4">Fecha / Hora</th>
                <th className="px-6 py-4">Zona</th>
                <th className="px-6 py-4">Comensales</th>
                <th className="px-6 py-4">Tiempo</th>
                <th className="px-6 py-4">Productos</th>
                <th className="px-6 py-4">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ventas.map((v, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{v.ticket}</td>
                  <td className="px-6 py-4">{v.fecha} {v.hora}</td>
                  <td className="px-6 py-4">{v.zona}</td>
                  <td className="px-6 py-4 text-center">{v.comensales}</td>
                  <td className="px-6 py-4">{v.tiempo}</td>
                  <td className="px-6 py-4 truncate max-w-xs" title={v.productos}>{v.productos}</td>
                  <td className="px-6 py-4 font-bold text-green-600">{v.total.toFixed(2)} €</td>
                </tr>
              ))}
              {ventas.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-gray-400">
                    No hay ventas cargadas. Sube un archivo CSV desde tu TPV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-gray-400 h-full py-20">
      <div className="text-4xl mb-4">💰</div>
      <p className="font-semibold text-gray-600 mb-2 text-center text-xl">Contenido de {tabActiva}</p>
      <p className="text-sm">Módulo de Ventas en desarrollo</p>
    </div>
  );
};

export default VentasApp;