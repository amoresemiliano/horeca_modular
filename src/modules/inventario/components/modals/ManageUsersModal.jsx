import React, { useState, useContext, useRef } from 'react';
import Modal from '../common/Modal';
import { AppContext, Role } from '../../store/store';
import { TrashIcon, EditIcon, UploadIcon } from '../Icons';

const ManageUsersModal = ({ show, onClose }) => {
    const { state, actions } = useContext(AppContext);
    
    const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', email: '', password: '', rol: Role.USER, foto: '' });
    const [editandoId, setEditandoId] = useState(null);
    const [datosEdicion, setDatosEdicion] = useState({});

    const fileInputRefNuevo = useRef(null);
    const fileInputRefsEdicion = useRef({});

    const handleAdd = async (e) => {
        e.preventDefault();
        if(!nuevoUsuario.nombre || !nuevoUsuario.email) return alert("Faltan datos");
        await actions.usuarios.add(nuevoUsuario);
        setNuevoUsuario({ nombre: '', email: '', password: '', rol: Role.USER, foto: '' }); 
        if(fileInputRefNuevo.current) fileInputRefNuevo.current.value = null;
    };

    const iniciarEdicion = (user) => {
        setEditandoId(user.id);
        setDatosEdicion(user);
    };

    const guardarEdicion = async (e) => {
        if(e) e.preventDefault();
        try {
            await actions.usuarios.update(editandoId, datosEdicion); 
            setEditandoId(null);
        } catch (error) {
            console.error("Error guardando:", error);
            setEditandoId(null);
        }
    };

    const handleFileUpload = async (e, userId = null) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecciona un archivo de imagen válido.');
            e.target.value = null; // Limpiar para permitir reintento
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        try {
            let basePath = window.location.pathname;
            if (basePath.endsWith('.html') || basePath.endsWith('.php')) {
                basePath = basePath.substring(0, basePath.lastIndexOf('/'));
            }
            if (!basePath.endsWith('/')) {
                basePath += '/';
            }
            
            const apiUrl = `${window.location.origin}${basePath}api/upload.php`;
            console.log("Subiendo a URL:", apiUrl);

            const response = await fetch(apiUrl, { method: 'POST', body: formData });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();

            if (result.success) {
                const imageUrl = `${window.location.origin}${basePath}uploads/${result.filename}`;
                
                if (userId) {
                    setDatosEdicion(prev => ({ ...prev, foto: imageUrl }));
                } else {
                    setNuevoUsuario(prev => ({ ...prev, foto: imageUrl }));
                }
            } else {
                alert('Error devuelto por el servidor: ' + (result.message || 'Desconocido'));
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            alert(`Error de red: ${error.message}. Verifica permisos de la carpeta uploads.`);
        } finally {
            // Esto es MÁGICO: limpia el input de archivo para que si el usuario sube
            // el MISMO archivo otra vez, el evento onChange se vuelva a disparar.
            e.target.value = null;
        }
    };

    const triggerFileInput = (userId = null) => {
        if (userId && fileInputRefsEdicion.current[userId]) {
            fileInputRefsEdicion.current[userId].click();
        } else if (fileInputRefNuevo.current) {
            fileInputRefNuevo.current.click();
        }
    };

    return (
        <Modal title="Gestionar Usuarios" show={show} onClose={onClose}>
            <div className="modal-body custom-scrollbar manage-list" style={{ padding: '15px' }}>
                
                {/* Formulario Añadir */}
                <form onSubmit={handleAdd} className="manage-add-form" style={{display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc', padding: '15px', borderRadius: '8px', width: '100%', boxSizing: 'border-box'}}>
                    <h4 style={{margin: '0 0 5px 0', color: '#334155'}}>Añadir Nuevo Usuario</h4>
                    
                    <div style={{display: 'flex', gap: '10px', width: '100%', flexWrap: 'wrap'}}>
                        <input type="text" placeholder="Nombre completo" className="form-input" value={nuevoUsuario.nombre} onChange={e => setNuevoUsuario({...nuevoUsuario, nombre: e.target.value})} required style={{flex: '1 1 120px'}}/>
                        <input type="email" placeholder="Email" className="form-input" value={nuevoUsuario.email} onChange={e => setNuevoUsuario({...nuevoUsuario, email: e.target.value})} required style={{flex: '1 1 120px'}}/>
                        <select className="form-select" value={nuevoUsuario.rol} onChange={e => setNuevoUsuario({...nuevoUsuario, rol: e.target.value})} style={{width: '100px', flex: '1 1 100px'}}>
                            <option value={Role.ADMIN}>Admin</option>
                            <option value={Role.USER}>Usuario</option>
                            <option value={Role.COCINA}>Cocina</option>
                        </select>
                    </div>

                    <div style={{display: 'flex', gap: '10px', width: '100%', alignItems: 'center', flexWrap: 'wrap'}}>
                        <div style={{display: 'flex', flex: '1 1 150px', gap: '5px'}}>
                            <input type="text" placeholder="URL Foto" className="form-input" value={nuevoUsuario.foto} onChange={e => setNuevoUsuario({...nuevoUsuario, foto: e.target.value})} style={{flexGrow: 1, minWidth: '0'}}/>
                            <input type="file" style={{ display: 'none' }} ref={fileInputRefNuevo} onChange={(e) => handleFileUpload(e)} accept="image/*" />
                            <button type="button" onClick={() => triggerFileInput()} className="btn" style={{padding: '0.5rem', background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', width: 'auto'}} title="Subir Imagen">
                                <UploadIcon />
                            </button>
                        </div>
                        
                        <input type="text" placeholder="Contraseña" className="form-input" value={nuevoUsuario.password} onChange={e => setNuevoUsuario({...nuevoUsuario, password: e.target.value})} style={{flex: '1 1 100px', minWidth: '0'}}/>
                        <button type="submit" className="btn btn-primary" style={{padding: '0.6rem 1rem', flex: '0 0 auto', width: 'auto'}}>Crear</button>
                    </div>
                </form>

                <hr style={{margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0'}}/>

                {/* Lista de usuarios */}
                <div className="manage-user-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    {state.usuarios.map(user => (
                        <div key={user.id} className="manage-user-item" style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box'}}>
                            
                            {/* Avatar */}
                            <div 
                                style={{ position: 'relative', width: '40px', height: '40px', flexShrink: 0, cursor: 'pointer', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1' }} 
                                onClick={() => {
                                    if (editandoId !== user.id) {
                                        iniciarEdicion(user);
                                        setTimeout(() => triggerFileInput(user.id), 50);
                                    } else {
                                        triggerFileInput(user.id);
                                    }
                                }} 
                                title="Cambiar foto"
                                onMouseEnter={(e) => {
                                    const overlay = e.currentTarget.querySelector('.avatar-overlay');
                                    if(overlay) overlay.style.opacity = '1';
                                }}
                                onMouseLeave={(e) => {
                                    const overlay = e.currentTarget.querySelector('.avatar-overlay');
                                    if(overlay && editandoId !== user.id) overlay.style.opacity = '0';
                                }}
                            >
                                <img 
                                    src={editandoId === user.id ? (datosEdicion.foto || 'https://via.placeholder.com/150') : (user.foto || 'https://via.placeholder.com/150')} 
                                    alt={user.nombre ? user.nombre.charAt(0).toUpperCase() : '?'} 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', color: 'transparent' }}
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        if (!e.target.parentElement.querySelector('span')) {
                                            const span = document.createElement('span');
                                            span.style.color = '#64748b';
                                            span.style.fontWeight = 'bold';
                                            span.style.fontSize = '1.2rem';
                                            span.innerText = user.nombre ? user.nombre.charAt(0).toUpperCase() : '?';
                                            e.target.parentElement.insertBefore(span, e.target.parentElement.firstChild);
                                        }
                                    }}
                                />
                                <div className="avatar-overlay" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 10, opacity: editandoId === user.id ? '1' : '0', transition: 'opacity 0.2s' }}>
                                    <UploadIcon />
                                </div>
                            </div>

                            <input type="file" style={{ display: 'none' }} ref={el => fileInputRefsEdicion.current[user.id] = el} onChange={(e) => handleFileUpload(e, user.id)} accept="image/*" />

                            {/* Info */}
                            {editandoId === user.id ? (
                                <div style={{display: 'flex', gap: '5px', flexGrow: 1, alignItems: 'center', flexWrap: 'wrap', minWidth: '0'}}>
                                    <input type="text" value={datosEdicion.nombre} onChange={e => setDatosEdicion({...datosEdicion, nombre: e.target.value})} className="form-input" style={{flex: '1 1 80px', minWidth: '0', padding: '0.4rem'}} />
                                    <input type="email" value={datosEdicion.email} onChange={e => setDatosEdicion({...datosEdicion, email: e.target.value})} className="form-input" style={{flex: '1 1 100px', minWidth: '0', padding: '0.4rem'}} />
                                    <select value={datosEdicion.rol} onChange={e => setDatosEdicion({...datosEdicion, rol: e.target.value})} className="form-select" style={{width: 'auto', flex: '0 0 auto', padding: '0.4rem'}}>
                                        <option value={Role.ADMIN}>Admin</option>
                                        <option value={Role.USER}>Usuario</option>
                                        <option value={Role.COCINA}>Cocina</option>
                                    </select>
                                </div>
                            ) : (
                                <div style={{display: 'flex', flexGrow: 1, alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: '0'}}>
                                    <span style={{fontWeight: '600', color: '#1e293b', flex: '1 1 100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem'}}>{user.nombre}</span>
                                    <span style={{fontSize: '0.8rem', color: '#64748b', flex: '0 0 auto', textTransform: 'capitalize'}}>{user.rol}</span>
                                    <span style={{color: '#475569', flex: '1 1 120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem'}}>{user.email}</span>
                                </div>
                            )}

                             {/* Acciones */}
                             <div className="manage-user-actions" style={{display: 'flex', flexDirection: 'row', gap: '2px', flexShrink: 0}}>
                                {editandoId === user.id ? (
                                    <button type="button" className="manage-icon-btn edit" onClick={guardarEdicion} title="Guardar" style={{background: '#dbeafe', color: '#1e40af'}}>💾</button>
                                ) : (
                                    <button type="button" className="manage-icon-btn edit" onClick={() => iniciarEdicion(user)} title="Editar"><EditIcon /></button>
                                )}
                                <button type="button" className="manage-icon-btn delete" onClick={() => actions.usuarios.delete(user.id)} title="Eliminar"><TrashIcon /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="modal-footer"><button onClick={onClose} className="modal-btn modal-btn-confirm">Cerrar</button></div>
        </Modal>
    );
};

export default ManageUsersModal;