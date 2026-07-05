import React, { useState } from 'react';
import './pedidos.css';

const PedidosApp = ({ tabActiva }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Inicialización de estado mock
  const [pedidos] = useState([
    { id: 1, proveedor: 'Carnicería Carlos', fecha: '2023-10-25', estado: 'Entregado', total: 150.50 },
    { id: 2, proveedor: 'Bebidas Premium', fecha: '2023-10-26', estado: 'Pendiente', total: 320.00 },
    { id: 3, proveedor: 'Verduras Frescas', fecha: '2023-10-27', estado: 'En camino', total: 85.20 },
  ]);

  if (tabActiva === 'Historial') {
    return (
      <div className="ec-pedidos-wrapper p-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Historial de Compras</h2>
          <button 
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
            onClick={() => alert('Función de exportar a Excel en desarrollo')}
          >
            <i className="fas fa-file-excel mr-2"></i> Exportar
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 uppercase tracking-wider border-b border-gray-200 text-gray-500">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Proveedor</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pedidos.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 font-bold">#{p.id}</td>
                  <td className="px-6 py-4">{p.proveedor}</td>
                  <td className="px-6 py-4">{p.fecha}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      p.estado === 'Entregado' ? 'bg-green-100 text-green-700' : 
                      p.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium">{p.total.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Vista por defecto: "Orden" (Nuevo pedido)
  return (
    <div className="ec-pedidos-wrapper p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Generar Orden</h2>
        <button 
          className="px-5 py-2.5 bg-[#E2231A] hover:bg-red-700 text-white rounded-lg font-semibold shadow transition"
          onClick={() => setIsModalOpen(true)}
        >
          + Nueva Compra
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Selección de Proveedor</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <select className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#006847] outline-none bg-gray-50">
                <option>Seleccione proveedor...</option>
                <option>Carnicería Carlos</option>
                <option>Bebidas Premium</option>
                <option>Frutas y Verduras Ruiz</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Esperada de Entrega</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#006847] outline-none bg-gray-50" />
            </div>
          </div>

          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Detalle de Compra</h3>
          
          <div className="space-y-3 mb-6">
            {/* Cabecera lista productos */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs font-bold text-gray-500 uppercase tracking-wider">
              <div className="col-span-5">Producto</div>
              <div className="col-span-2">Cantidad</div>
              <div className="col-span-2">Precio Unit.</div>
              <div className="col-span-2 text-right">Subtotal</div>
              <div className="col-span-1 text-center"></div>
            </div>

            {/* Fila Producto 1 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-4 py-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
              <div className="md:col-span-5">
                <select className="w-full bg-transparent outline-none font-medium text-gray-800">
                  <option>Entrecot de Ternera</option>
                  <option>Chuletas de Cerdo</option>
                  <option>Pollo Entero</option>
                </select>
              </div>
              <div className="md:col-span-2 flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="number" defaultValue="5" className="w-full p-1.5 outline-none text-center" />
                <span className="bg-gray-100 px-2 py-1.5 text-gray-500 text-xs border-l border-gray-300">kg</span>
              </div>
              <div className="md:col-span-2 flex items-center border border-gray-300 rounded overflow-hidden">
                <span className="bg-gray-100 px-2 py-1.5 text-gray-500 text-xs border-r border-gray-300">€</span>
                <input type="text" defaultValue="14.50" className="w-full p-1.5 outline-none" />
              </div>
              <div className="md:col-span-2 text-right font-bold text-gray-900">
                72.50 €
              </div>
              <div className="md:col-span-1 text-center md:text-right">
                <button className="text-red-400 hover:text-red-600 transition"><i className="fas fa-trash"></i> ✖</button>
              </div>
            </div>

            {/* Fila Producto 2 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-4 py-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
              <div className="md:col-span-5">
                <select className="w-full bg-transparent outline-none font-medium text-gray-800">
                  <option>Pollo Entero</option>
                  <option>Entrecot de Ternera</option>
                  <option>Chuletas de Cerdo</option>
                </select>
              </div>
              <div className="md:col-span-2 flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="number" defaultValue="10" className="w-full p-1.5 outline-none text-center" />
                <span className="bg-gray-100 px-2 py-1.5 text-gray-500 text-xs border-l border-gray-300">kg</span>
              </div>
              <div className="md:col-span-2 flex items-center border border-gray-300 rounded overflow-hidden">
                <span className="bg-gray-100 px-2 py-1.5 text-gray-500 text-xs border-r border-gray-300">€</span>
                <input type="text" defaultValue="3.20" className="w-full p-1.5 outline-none" />
              </div>
              <div className="md:col-span-2 text-right font-bold text-gray-900">
                32.00 €
              </div>
              <div className="md:col-span-1 text-center md:text-right">
                <button className="text-red-400 hover:text-red-600 transition"><i className="fas fa-trash"></i> ✖</button>
              </div>
            </div>
            
            <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium hover:border-gray-400 hover:bg-gray-50 transition">
              + Añadir Producto
            </button>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas para el proveedor</label>
            <textarea className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#006847] bg-gray-50" rows="3" placeholder="Ej: Entregar por la puerta trasera antes de las 10am..."></textarea>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-900 text-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-300 mb-4 uppercase tracking-widest text-sm">Resumen de Compra</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-300">
                <span>Subtotal</span>
                <span>104.50 €</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Impuestos (10%)</span>
                <span>10.45 €</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Descuento</span>
                <span className="text-green-400">- 0.00 €</span>
              </div>
              <div className="pt-4 border-t border-gray-700 flex justify-between items-end">
                <span className="font-bold text-lg">Total Pedido</span>
                <span className="text-3xl font-black text-[#E2231A]">114.95 €</span>
              </div>
            </div>

            <button className="w-full py-4 bg-[#006847] hover:bg-green-700 text-white rounded-xl font-bold text-lg shadow-lg transition-transform transform hover:-translate-y-1">
              Confirmar y Enviar <span className="ml-2">➔</span>
            </button>
            <button className="w-full mt-3 py-3 border border-gray-600 text-gray-300 hover:bg-gray-800 rounded-xl font-medium transition">
              Guardar Borrador
            </button>
          </div>

          <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl p-6 text-[#128C7E]">
            <div className="flex items-center gap-3 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 1.748 6.136L0 24l6.027-1.579A12 12 0 1 0 11.944 0zm0 20.254a8.254 8.254 0 0 1-4.218-1.156l-.302-.178-3.13.82 .836-3.05-.196-.312A8.254 8.254 0 1 1 11.944 20.254zm4.536-6.19c-.248-.124-1.468-.726-1.696-.808-.228-.082-.394-.124-.56.124-.166.248-.642.808-.788.974-.146.166-.29.186-.538.062-.248-.124-1.048-.386-1.996-1.09-.738-.548-1.236-1.226-1.382-1.474-.146-.248-.016-.382.108-.506.112-.112.248-.29.372-.436.124-.146.166-.248.248-.414.082-.166.042-.312-.02-.436-.062-.124-.56-1.352-.766-1.85-.2-.486-.404-.42-.56-.428-.146-.008-.312-.008-.478-.008s-.436.062-.664.312c-.228.248-.87 .85-.87 2.072s.89 2.404 1.014 2.57c.124.166 1.752 2.674 4.244 3.75.592.256 1.054.41 1.414.524.594.188 1.136.162 1.562.098.474-.07 1.468-.6 1.676-1.178.208-.578.208-1.074.146-1.178-.062-.104-.228-.166-.476-.29z"/></svg>
              <h4 className="font-bold text-lg">Pedidos por WhatsApp</h4>
            </div>
            <p className="text-sm opacity-90 mb-4">Al confirmar, podrás enviar el resumen del pedido automáticamente al WhatsApp del proveedor.</p>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Crear Nueva Compra</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                <select className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#006847] outline-none">
                  <option>Seleccione proveedor...</option>
                  <option>Carnicería Carlos</option>
                  <option>Bebidas Premium</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Esperada</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none" />
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 mb-6 text-center text-gray-500 bg-gray-50">
              Formulario de productos aquí (Migración de Tom-Select)
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button className="px-4 py-2 bg-[#006847] text-white rounded-lg hover:bg-green-800">Guardar Compra</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedidosApp;