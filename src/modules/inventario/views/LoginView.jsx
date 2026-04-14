import React, { useState } from 'react';
import { Role } from '../constants';

const LOGO_URL = "/logo.png";

const LoginView = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (email.includes('admin@')) {
            onLogin(Role.ADMIN);
        } else if (email.includes('cocina@')) {
            onLogin(Role.COCINA);
        } else if (email.includes('usuario@')) {
            onLogin(Role.USER);
        } else {
            setError('Credenciales incorrectas. Usa admin@, cocina@ o usuario@ para probar.');
        }
    };

    return (
        <div className="login-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f1f5f9' }}>
            <div className="login-box" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center', width: '100%', maxWidth: '400px' }}>
                <img src={LOGO_URL} alt="Logo El Criollo" style={{ width: '150px', marginBottom: '1.5rem' }} />
                
                <h2>Sistema de Inventarios</h2>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <input 
                            type="email" 
                            placeholder="Correo electrónico" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            className="form-input" 
                            required 
                            style={{ width: '100%', padding: '0.75rem', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div>
                        <input 
                            type="password" 
                            placeholder="Contraseña" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            className="form-input" 
                            required 
                            style={{ width: '100%', padding: '0.75rem', boxSizing: 'border-box' }}
                        />
                    </div>
                    
                    {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: '0' }}>{error}</p>}
                    
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '10px 0 0 0' }}>
                        ¡Bienvenido! Acceda con sus credenciales
                    </p>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem', width: '100%', marginTop: '0' }}>
                        Iniciar Sesión
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginView;