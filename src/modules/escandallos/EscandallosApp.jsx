import React from 'react';
import './escandallos.css';

const EscandallosApp = ({ tabActiva }) => {
  if (tabActiva === 'Preparación') {
    return (
      <div className="ec-escandallos-wrapper">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Constructor de Escandallos</h2>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition">
              Borrador
            </button>
            <button className="px-4 py-2 bg-[#E2231A] text-white rounded-lg hover:bg-red-700 font-medium transition shadow">
              Guardar Receta
            </button>
          </div>
        </div>

        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase">Preparación</span>
            <input 
              type="text" 
              defaultValue="Guacamole" 
              className="text-2xl font-bold text-gray-900 w-full outline-none border-b-2 border-transparent focus:border-[#006847] transition p-1"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Cantidad Producida</label>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#006847]">
                <input type="number" defaultValue="116" className="w-full p-2.5 outline-none font-medium" />
                <select className="bg-gray-100 px-2 py-2.5 text-gray-600 font-medium border-l border-gray-300 outline-none">
                  <option value="gr">gr</option>
                  <option value="kg">kg</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                  <option value="ud">ud</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Categoría</label>
              <select className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#006847] font-medium text-gray-700">
                <option>Salsas y Dips</option>
                <option>Guisos</option>
                <option>Bebidas</option>
              </select>
            </div>
            <div className="text-right pb-2 border-b-2 border-dashed border-[#006847]">
              <small className="block text-xs font-bold text-[#006847] uppercase tracking-wider">COSTE / RECETA</small>
              <p className="text-3xl font-black text-gray-900">0,72 €</p>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Ingredientes (Escandallo)</h3>
            <button className="px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-gray-400 hover:bg-gray-50 font-medium transition">
              + Añadir Insumo
            </button>
          </div>

          {[
            { n: 'Aguacate', q: 90, u: 'gr', c: 0.54, m: 20 },
            { n: 'Tomate', q: 15, u: 'gr', c: 0.03, m: 5 },
            { n: 'Cebolla', q: 9, u: 'gr', c: 0.01, m: 10 },
            { n: 'Limón', q: 5, u: 'gr', c: 0.02, m: 40 },
            { n: 'Cilantro', q: 1, u: 'gr', c: 0.05, m: 5 },
            { n: 'Sal', q: 0.5, u: 'gr', c: 0.01, m: 0 },
            { n: 'Pimienta', q: 0.5, u: 'gr', c: 0.06, m: 0 },
          ].map((ing, i) => (
            <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-gray-200 border-l-[#E2231A] mb-3 transition hover:shadow-md flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-full md:w-1/4">
                <h4 className="font-bold text-gray-900">{ing.n}</h4>
                <p className="text-xs text-gray-400">Merma: {ing.m}%</p>
              </div>
              
              <div className="flex-1 grid grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Cant. Neta</label>
                  <div className="flex border border-gray-300 rounded text-sm overflow-hidden focus-within:ring-1 focus-within:ring-blue-400">
                    <input type="text" defaultValue={ing.q} className="w-full p-1.5 outline-none text-right" />
                    <span className="bg-gray-100 px-2 py-1.5 text-gray-500 border-l border-gray-300">{ing.u}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Cant. Bruta</label>
                  <div className="flex border border-gray-200 rounded text-sm overflow-hidden bg-gray-50">
                    <input type="text" value={(ing.q / (1 - ing.m/100)).toFixed(1)} readOnly className="w-full p-1.5 outline-none text-right bg-transparent text-gray-500 cursor-not-allowed" />
                    <span className="bg-gray-200 px-2 py-1.5 text-gray-500 border-l border-gray-200">{ing.u}</span>
                  </div>
                </div>
                <div className="text-right flex flex-col justify-end h-full pb-1">
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Subtotal</label>
                  <p className="text-sm font-bold text-gray-900">{ing.c.toFixed(2)} €</p>
                </div>
              </div>

              <div className="flex items-center justify-end w-full md:w-10">
                <button className="text-gray-300 hover:text-red-500 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
        </section>

        <section className="bg-[#006847] p-6 rounded-xl shadow-md text-white mb-10">
          <h3 className="text-lg font-bold opacity-90 mb-6 uppercase tracking-wider text-center text-green-100">Resumen Financiero: Guacamole</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 text-center">
            <div className="bg-white/10 p-4 rounded-lg border border-white/20">
              <span className="block text-xs font-medium text-green-100 mb-1 uppercase tracking-widest">Peso Total</span>
              <strong className="text-2xl font-black">116 gr</strong>
            </div>
            <div className="bg-white/10 p-4 rounded-lg border border-white/20">
              <span className="block text-xs font-medium text-green-100 mb-1 uppercase tracking-widest">Coste Receta</span>
              <strong className="text-2xl font-black">0,72 €</strong>
            </div>
            <div className="bg-white/10 p-4 rounded-lg border border-white/20">
              <span className="block text-xs font-medium text-green-100 mb-1 uppercase tracking-widest">Precio Sugerido</span>
              <strong className="text-2xl font-black text-green-300">2,50 €</strong>
            </div>
            <div className="bg-white/10 p-4 rounded-lg border border-white/20">
              <span className="block text-xs font-medium text-green-100 mb-1 uppercase tracking-widest">Food Cost</span>
              <strong className="text-2xl font-black text-green-300">28.8%</strong>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm font-bold mb-2">
              <span className="text-green-100 uppercase tracking-wide">Margen Bruto (71.2%)</span>
              <span>1,78 € Beneficio</span>
            </div>
            <div className="w-full h-3 bg-black/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full relative" style={{ width: '71.2%' }}>
                <div className="absolute top-0 right-0 bottom-0 w-2 bg-green-200"></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-gray-400 h-full py-20">
      <div className="text-4xl mb-4">🥘</div>
      <p className="font-semibold text-gray-600 mb-2 text-center text-xl">Contenido de {tabActiva}</p>
      <p className="text-sm">Módulo de Escandallos en desarrollo</p>
    </div>
  );
};

export default EscandallosApp;