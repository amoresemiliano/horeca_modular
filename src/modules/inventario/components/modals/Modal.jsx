import React from 'react';
import { CloseIcon } from '../common/Icons';

const Modal = ({ title, children, onClose, show }) => {
    if (!show) return null;
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button onClick={onClose} className="modal-close-btn"><CloseIcon /></button>
                </div>
                {children}
            </div>
        </div>
    );
};

export default Modal;