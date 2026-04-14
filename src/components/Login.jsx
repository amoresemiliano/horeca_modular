import { useState } from 'react';
import { auth } from '../firebaseConfig';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import logoVDC from '../assets/icono_VDC.png'; // Asegúrate de mover el archivo aquí

const Login = () => {
  const [status, setStatus] = useState('idle'); // 'idle', 'cargando', 'error'

  const handleLogin = async () => {
    setStatus('cargando');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // Al loguear, App.jsx hará el resto automáticamente
    } catch (error) {
      console.error("Error:", error.message);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000); // Resetear tras 3 seg si hay error
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] font-sans">
      <div className="bg-white p-12 rounded-[2rem] shadow-2xl shadow-blue-900/5 text-center max-w-md w-full border border-gray-100">
        
        {/* LOGO VEGEN DIGITAL (VDC) */}
        <div className="mb-8 flex justify-center">
          <img src={logoVDC} alt="VDC Logo" className="h-16 object-contain" />
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-1">Plataforma de Negocio</h2>
        <p className="text-gray-400 text-sm mb-10">Gestión Inteligente para PyMEs</p>
        
        {/* CAMPOS DE CREDENCIALES (Estilo profesional bloqueado) */}
        <div className="space-y-3 mb-10">
          <input 
            type="email" 
            placeholder="Usuario" 
            className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none cursor-not-allowed" 
            disabled 
          />
          <input 
            type="password" 
            placeholder="Contraseña" 
            className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none cursor-not-allowed" 
            disabled 
          />
        </div>

        {/* ÁREA DINÁMICA DE ACCESO */}
        <div className="space-y-6">
          {status === 'idle' && (
            <>
              <p className="text-[10px] text-gray-400 uppercase tracking-[0.3em] font-bold">Ingrese Credenciales</p>
              <button 
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-3 bg-[#5D7BCC] hover:bg-[#4A65B1] text-white px-6 py-4 rounded-2xl transition-all font-bold shadow-lg shadow-blue-200"
              >
                <img src="https://www.svgrepo.com/show/355037/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="G" />
                Acceder con Google
              </button>
            </>
          )}

          {status === 'cargando' && (
            <div className="py-4 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-blue-600 font-bold tracking-widest text-xs uppercase animate-pulse">Cargando...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="py-4 text-red-500 font-semibold text-sm">
              Hubo un error al intentar acceder.
            </div>
          )}
        </div>
        
        <div className="mt-12 pt-8 border-t border-gray-50">
          <p className="text-[9px] text-gray-300 uppercase tracking-widest font-black">Desarrollo de Vegen Digital SL</p>
        </div>
      </div>
    </div>
  );
};

export default Login;