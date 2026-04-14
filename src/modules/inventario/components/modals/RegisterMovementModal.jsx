import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../store/store';
import Modal from './Modal';

const RegisterMovementModal = ({ show, onClose, initialData }) => {
    const { state, actions } = useContext(AppContext);
    const { productos, formatos, presentaciones } = state;
    
    // Form State
    const [formData, setFormData] = useState({
        almacen: 'Palencia',
        movimiento: 'Ingreso',
        producto: '',
        formato: '',
        presentacion: '',
        unidades: ''
    });

    useEffect(() => {
        if (initialData) {
            // Populate form for editing
            setFormData({
                almacen: initialData.almacen,
                movimiento: initialData.tipo,
                producto: initialData.producto,
                formato: initialData.formato?.split(' (')[0] || '', // Simple parse
                presentacion: initialData.formato?.split(' (')[1]?.replace(')', '') || '',
                unidades: Math.abs(initialData.cantidad)
            });
        }
    }, [initialData]);

    const handleSave = () => {
        if (!formData.producto || !formData.unidades) return alert("Completa los campos obligatorios");
        
        let formatoFinal = formData.formato;
        if (formData.presentacion) {
            formatoFinal += ` (${formData.presentacion})`;
        }

        const movementData = {
            almacen: formData.almacen,
            tipo: formData.movimiento,
            producto: formData.producto,
            formato: formatoFinal,
            presentacion: formData.presentacion,
            cantidad: Number(formData.unidades) * (formData.movimiento === 'Salida' ? -1 : 1),
            usuario: 'usuario@email.com' // Simulando usuario logueado
        };

        if (initialData) {
            actions.updateMovement(initialData.id, movementData);
        } else {
            actions.addMovement(movementData);
        }
        onClose();
    };
    
    // Helpers
    const handleSelectChange = (field, e, listActions) => {
        if (e.target.value === 'crear_nuevo') {
            const newItemName = prompt('Nuevo elemento:');
            if (newItemName) {
                listActions.add({ nombre: newItemName });
                setFormData({...formData, [field]: newItemName});
            }
        } else {
            setFormData({...formData, [field]: e.target.value});
        }
    };

    const renderSelect = (id, label, field, items, listActions) => (
         <div className="form-group">
            <label htmlFor={id} className="form-label">{label}:</label>
            <select id={id} className="form-select" value={formData[field]} onChange={(e) => handleSelectChange(field, e, listActions)}>
                <option value="" disabled>Selecciona una opción</option>
                {items && items.map(item => <option key={item.id} value={item.nombre}>{item.nombre}</option>)}
                <option value="crear_nuevo">+ Crear nuevo...</option>
            </select>
        </div>
    );
    
    return (
        <Modal title={initialData ? "Editar Movimiento" : "Registrar Movimiento"} show={show} onClose={onClose}>
            <div className="modal-body custom-scrollbar">
                <form className="form-grid" onSubmit={e => e.preventDefault()}>
                    <div className="form-group">
                        <span className="form-label">Almacén:</span>
                        <div className="form-radio-group">
                            {['Palencia', 'Vallecas'].map(op => (
                                <label key={op} className="form-radio-label">
                                    <input type="radio" name="almacen" value={op} 
                                        checked={formData.almacen === op} 
                                        onChange={e => setFormData({...formData, almacen: e.target.value})} /> {op}
                                </label>
                            ))}
                        </div>
                    </div>
                     <div className="form-group">
                        <span className="form-label">Movimiento:</span>
                        <div className="form-radio-group">
                             {['Ingreso', 'Salida'].map(op => (
                                <label key={op} className="form-radio-label">
                                    <input type="radio" name="movimiento" value={op} 
                                        checked={formData.movimiento === op} 
                                        onChange={e => setFormData({...formData, movimiento: e.target.value})} /> {op}
                                </label>
                            ))}
                        </div>
                    </div>
                    {renderSelect('modal-producto', 'Producto', 'producto', productos, actions.productos)}
                    {renderSelect('modal-formato', 'Formato', 'formato', formatos, actions.formatos)}
                    {renderSelect('modal-presentacion', 'Presentación', 'presentacion', presentaciones, actions.presentaciones)}
                    <div className="form-group">
                         <label className="form-label">Unidades:</label>
                        <input type="number" value={formData.unidades} onChange={e => setFormData({...formData, unidades: e.target.value})} required className="form-input" />
                    </div>
                </form>
            </div>
            <div className="modal-footer">
                <button onClick={onClose} className="modal-btn modal-btn-cancel">Cancelar</button>
                <button onClick={handleSave} className="modal-btn modal-btn-confirm">Guardar</button>
            </div>
        </Modal>
    );
};

export default RegisterMovementModal;