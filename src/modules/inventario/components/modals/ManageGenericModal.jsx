import React, { useState } from 'react';
import Modal from '../common/Modal';
import { TrashIcon } from '../Icons';

const ManageGenericModal = ({ title, show, onClose, items, actions }) => {
    const [newItem, setNewItem] = useState('');
    
    return (
        <Modal title={title} show={show} onClose={onClose}>
            <div className="modal-body custom-scrollbar manage-list">
                <div className="manage-add-form">
                    <input type="text" value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Añadir nuevo..." className="form-input" />
                    <button className="btn btn-primary" onClick={() => { if(newItem) { actions.add({nombre: newItem}); setNewItem(''); }}}>Añadir</button>
                </div>
                <div className="manage-list-items">
                    {items.map(item => (
                        <div key={item.id} className="manage-list-item">
                           <input type="text" value={item.nombre} onChange={(e) => actions.update(item.id, {nombre: e.target.value})} className="form-input"/>
                           <button className="manage-icon-btn delete" onClick={() => actions.delete(item.id)}><TrashIcon /></button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="modal-footer"><button onClick={onClose} className="modal-btn modal-btn-confirm">Cerrar</button></div>
        </Modal>
    );
};

export default ManageGenericModal;