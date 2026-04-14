import React, { useState } from 'react';
import { AdminView, UserView, CocinaView, Role } from '../constants';

const LOGO_URL = "./logo.png"; // <-- Relativo para subcarpetas

const Header = ({ role, currentView, setView, onLogout }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const isAdmin = role === Role.ADMIN;
    const isCocina = role === Role.COCINA;
    
    let navItems = [];
    if (isAdmin) {
        navItems = [
            { label: 'Inicio', view: AdminView.DASHBOARD },
            { label: 'Inventario', view: AdminView.INVENTORY },
            { label: 'Producción', view: AdminView.PRODUCTION },
            { label: 'Movimientos', view: AdminView.MOVEMENTS },
            { label: 'Planificación', view: AdminView.PLANNING },
            { label: 'Configuración', view: AdminView.SETTINGS },
        ];
    } else if (isCocina) {
        navItems = [
            { label: 'Inicio', view: CocinaView.DASHBOARD },
            { label: 'Inventario', view: CocinaView.INVENTORY },
        ];
    }

    return (
        <header className="header" style={{ position: 'relative' }}>
            <div className="container navbar">
                <div className="navbar-left" style={{ display: 'flex', alignItems: 'center' }}>
                    <img src={LOGO_URL} alt="Logo El Criollo" className="navbar-logo" onClick={() => setView(isAdmin ? AdminView.DASHBOARD : (isCocina ? CocinaView.DASHBOARD : UserView.DASHBOARD))} />
                </div>

                {/* Desktop Menu */}
                {(isAdmin || isCocina) && (
                    <nav className="navbar-menu desktop-menu">
                        {navItems.map(item => (
                            <a 
                                key={item.view} 
                                onClick={() => setView(item.view)}
                                className={currentView === item.view ? 'active-tab' : ''}
                            >
                                {item.label}
                            </a>
                        ))}
                    </nav>
                )}

                <div className="navbar-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <a href="#" onClick={onLogout} className="logout-link desktop-only">Cerrar Sesión</a>
                    
                    {/* Hamburger Button (Mobile only) */}
                    {(isAdmin || isCocina) && (
                        <button className="hamburger-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                            ☰
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Dropdown Menu */}
            {(isAdmin || isCocina) && isMenuOpen && (
                <div className="mobile-menu-overlay">
                    <nav className="mobile-nav">
                        {navItems.map(item => (
                            <a 
                                key={item.view} 
                                onClick={() => { setView(item.view); setIsMenuOpen(false); }}
                                style={{ color: currentView === item.view ? 'var(--color-primary)' : 'var(--color-text-primary)' }}
                            >
                                {item.label}
                            </a>
                        ))}
                        <hr style={{margin: '10px 0', borderTop: '1px solid #e2e8f0'}}/>
                        <a href="#" onClick={onLogout} style={{color: '#ef4444'}}>Cerrar Sesión</a>
                    </nav>
                </div>
            )}
        </header>
    );
};

export default Header;