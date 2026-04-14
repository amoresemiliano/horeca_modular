import { useState, useMemo, createContext, useContext } from 'react';

export const Role = {
  ADMIN: 'admin',
  USER: 'usuario',
  COCINA: 'cocina',
};

const generateHistory = () => {
    const history = [];
    const products = ['Cochinita', 'Birria', 'Pastor', 'Carnitas', 'Tinga'];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 15);
        const dateStr = date.toISOString().replace('T', ' ').substring(0, 19);
        products.forEach(p => {
             if (Math.random() > 0.3) {
                 history.push({
                     id: `hist-${i}-${p}`,
                     fecha: dateStr,
                     almacen: 'Vallecas',
                     tipo: 'Ingreso',
                     producto: p,
                     formato: 'Bolsa (1.5 kg)',
                     cantidad: Math.floor(Math.random() * 50) + 10,
                     usuario: 'admin@elcriollo.com'
                 });
             }
        });
    }
    return history;
};

const INITIAL_MOVIMIENTOS = [
    ...generateHistory(),
    { id: 1001, fecha: "2025-11-13 23:10:35", almacen: "Vallecas", tipo: "Ingreso", producto: "Champiñón", formato: "Bolsa (1 kg)", cantidad: 14, usuario: "usuario@elcriollo.com" },
    { id: 1002, fecha: "2025-11-13 23:09:58", almacen: "Vallecas", tipo: "Ingreso", producto: "Cochinita", formato: "Bolsa (1.5 kg)", cantidad: 21, usuario: "admin@elcriollo.com" },
    { id: 1003, fecha: "2025-11-11 20:43:16", almacen: "Vallecas", tipo: "Ingreso", producto: "Tinga", formato: "Bolsa (1 kg)", cantidad: 47, usuario: "usuario@elcriollo.com" },
    { id: 1004, fecha: "2025-11-08 11:11:04", almacen: "Vallecas", tipo: "Salida", producto: "Birria", formato: "Bolsa (1.5 kg)", cantidad: -31, usuario: "admin@elcriollo.com" },
    { id: 1005, fecha: "2025-11-08 11:11:25", almacen: "Palencia", tipo: "Ingreso", producto: "Birria", formato: "Bolsa (1.5 kg)", cantidad: 31, usuario: "usuario@elcriollo.com" },
    { id: 1006, fecha: "2025-10-28 14:18:26", almacen: "Vallecas", tipo: "Ingreso", producto: "Pastor", formato: "Bolsa (1.5 kg)", cantidad: 28, usuario: "admin@elcriollo.com" },
    { id: 1007, fecha: "2025-10-25 12:10:15", almacen: "Palencia", tipo: "Ingreso", producto: "Pastor", formato: "Bolsa (1.5 kg)", cantidad: 19, usuario: "usuario@elcriollo.com" },
    { id: 1008, fecha: "2025-10-24 13:52:08", almacen: "Palencia", tipo: "Ingreso", producto: "Carnitas", formato: "Bolsa (1.5 kg)", cantidad: 21, usuario: "admin@elcriollo.com" },
    { id: 1009, fecha: "2025-10-23 21:26:55", almacen: "Vallecas", tipo: "Salida", producto: "Res", formato: "Tarrina (800 gr)", cantidad: -27, usuario: "usuario@elcriollo.com" },
    { id: 1010, fecha: "2025-10-20 15:44:00", almacen: "Palencia", tipo: "Ingreso", producto: "Queso 1Kg", formato: "Bolsa (1 kg)", cantidad: 37, usuario: "admin@elcriollo.com" },
];

const INITIAL_USUARIOS = [
  { id: 1, nombre: 'Admin EC', rol: Role.ADMIN, email: 'admin@elcriollo.com', telefono: '600112233', foto: 'https://picsum.photos/seed/admin/200' },
  { id: 2, nombre: 'Usuario Tienda', rol: Role.USER, email: 'usuario@elcriollo.com', telefono: '600445566', foto: 'https://picsum.photos/seed/user1/200' },
  { id: 3, nombre: 'Cocina Central', rol: Role.COCINA, email: 'cocina@elcriollo.com', telefono: '600778899', foto: 'https://picsum.photos/seed/user2/200' },
];

const INITIAL_PRODUCTOS = [
    {id: 1, nombre: 'Champiñón'}, {id: 2, nombre: 'Cochinita'}, {id: 3, nombre: 'Tinga'},
    {id: 4, nombre: 'Birria'}, {id: 5, nombre: 'Pastor'}, {id: 6, nombre: 'Carnitas'},
    {id: 7, nombre: 'Res'}, {id: 8, nombre: 'Queso 1Kg'}, {id: 9, nombre: 'Nopales'}, {id: 10, nombre: 'Hielo 1Kg'},
    {id: 11, nombre: 'Tuna'}, {id: 12, nombre: 'Picadillo'}
];

const INITIAL_FORMATOS = [
    {id: 1, nombre: 'Bolsa (1.5 kg)', peso_kg: 1.5},
    {id: 2, nombre: 'Bolsa (1 kg)', peso_kg: 1},
    {id: 3, nombre: 'Tarrina (800 gr)', peso_kg: 0.8},
    {id: 4, nombre: 'Tarrina (250 gr)', peso_kg: 0.25}
];

const INITIAL_PRESENTACIONES = [
    {id: 1, nombre: '1.5 kg'}, {id: 2, nombre: '1 kg'}, {id: 3, nombre: '800 gr'}, {id: 4, nombre: '250 gr'}
];

const INITIAL_ALMACENES = [{id: 1, nombre: 'Vallecas'}, {id: 2, nombre: 'Palencia'}];

export const AppContext = createContext();

// Helper para cargar de LocalStorage (Base de datos local) o usar initial
const usePersistedState = (key, initialValue) => {
    const [state, setState] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setPersistedState = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(state) : value;
            setState(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };

    return [state, setPersistedState];
};

export const AppProvider = ({ children }) => {
    const [movimientos, setMovimientos] = usePersistedState('criollo_movimientos', INITIAL_MOVIMIENTOS);
    const [usuarios, setUsuarios] = usePersistedState('criollo_usuarios', INITIAL_USUARIOS);
    const [productos, setProductos] = usePersistedState('criollo_productos', INITIAL_PRODUCTOS);
    const [formatos, setFormatos] = usePersistedState('criollo_formatos', INITIAL_FORMATOS);
    const [presentaciones, setPresentaciones] = usePersistedState('criollo_presentaciones', INITIAL_PRESENTACIONES);
    const [almacenes, setAlmacenes] = usePersistedState('criollo_almacenes', INITIAL_ALMACENES);

    const stock = useMemo(() => {
        const stockMap = {};
        
        movimientos.forEach(m => {
            const key = `${m.producto}|${m.formato}`;
            const formatoItem = formatos.find(f => f.nombre === m.formato);
            const pesoKg = formatoItem ? parseFloat(formatoItem.peso_kg) : 1; 

            if (!stockMap[key]) {
                stockMap[key] = { id: key, producto: m.producto, formato: m.formato, stockP: 0, stockV: 0, stockP_kg: 0, stockV_kg: 0, stockTotal_kg: 0 };
            }
            
            const kilos = m.cantidad * pesoKg;

            if (m.almacen === 'Palencia') {
                stockMap[key].stockP += m.cantidad;
                stockMap[key].stockP_kg += kilos;
            } else if (m.almacen === 'Vallecas') {
                stockMap[key].stockV += m.cantidad;
                stockMap[key].stockV_kg += kilos;
            }
        });
        
        return Object.values(stockMap).map(item => ({
            ...item,
            stockP_kg: parseFloat(item.stockP_kg.toFixed(2)),
            stockV_kg: parseFloat(item.stockV_kg.toFixed(2)),
            stockTotal_kg: parseFloat((item.stockP_kg + item.stockV_kg).toFixed(2))
        }));
    }, [movimientos, formatos]);

    const addMovement = (movement) => {
        setMovimientos(prev => [{ ...movement, id: Date.now() }, ...prev]);
    };

    const updateMovement = (id, updatedFields) => {
        setMovimientos(prev => prev.map(m => m.id === id ? { ...m, ...updatedFields } : m));
    };

    const deleteMovement = (id) => {
        if (confirm("¿Estás seguro de que quieres eliminar este movimiento?")) {
            setMovimientos(prev => prev.filter(m => m.id !== id));
        }
    };

    const adjustStock = (producto, formato, almacen, nuevoStock, stockActual) => {
        const diferencia = nuevoStock - stockActual;
        if (diferencia === 0) return;
        
        addMovement({
            producto,
            formato,
            almacen,
            tipo: diferencia > 0 ? 'Ingreso' : 'Salida',
            cantidad: diferencia,
            usuario: 'admin@elcriollo.com',
            esAjuste: true,
            fecha: new Date().toISOString().replace('T', ' ').slice(0, 19)
        });
    };

    const crudActions = (setter) => ({
        add: (item) => setter(prev => [...prev, { ...item, id: Date.now() }]),
        update: (id, fields) => setter(prev => prev.map(i => i.id === id ? { ...i, ...fields } : i)),
        delete: (id) => { if(confirm("¿Borrar?")) setter(prev => prev.filter(i => i.id !== id)); }
    });

    const value = {
        state: { movimientos, usuarios, productos, formatos, presentaciones, almacenes, stock },
        actions: {
            addMovement, updateMovement, deleteMovement, adjustStock,
            usuarios: crudActions(setUsuarios),
            productos: crudActions(setProductos),
            formatos: crudActions(setFormatos),
            presentaciones: crudActions(setPresentaciones),
            almacenes: crudActions(setAlmacenes),
        }
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};