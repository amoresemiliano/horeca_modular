import React, { useState, useContext } from 'react';
import { AppContext } from '../store/store';
import ManageUsersModal from '../components/modals/ManageUsersModal';
import ManageGenericModal from '../components/modals/ManageGenericModal';

const SettingsView = () => {
    const { state, actions } = useContext(AppContext);
    const [modal, setModal] = useState(null);

    const SettingsItem = ({ title, modalId }) => (
        <div className="card settings-card">
            <h3>{title}</h3>
            <div style={{display:'flex', justifyContent:'center', width:'100%'}}>
                <button onClick={() => setModal(modalId)} className="btn btn-secondary settings-card-btn">Gestionar</button>
            </div>
        </div>
    );

    return (
        <div className="container view-container">
            <h1>Configuración</h1>
            <div className="dashboard-grid">
                <SettingsItem title="Usuarios" modalId="users" />
                <SettingsItem title="Productos" modalId="products" />
                <SettingsItem title="Formatos" modalId="formats" />
                <SettingsItem title="Presentaciones" modalId="presentations" />
                <SettingsItem title="Almacenes" modalId="warehouses" />
            </div>

            <ManageUsersModal show={modal === 'users'} onClose={() => setModal(null)} />
            <ManageGenericModal title="Gestionar Productos" show={modal === 'products'} onClose={() => setModal(null)} items={state.productos} actions={actions.productos} />
            <ManageGenericModal title="Gestionar Formatos" show={modal === 'formats'} onClose={() => setModal(null)} items={state.formatos} actions={actions.formatos} />
            <ManageGenericModal title="Gestionar Presentaciones" show={modal === 'presentations'} onClose={() => setModal(null)} items={state.presentaciones} actions={actions.presentaciones} />
            <ManageGenericModal title="Gestionar Almacenes" show={modal === 'warehouses'} onClose={() => setModal(null)} items={state.almacenes} actions={actions.almacenes} />
        </div>
    );
};

export default SettingsView;