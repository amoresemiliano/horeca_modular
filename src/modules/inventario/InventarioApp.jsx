import React from "react";
import { AppProvider } from "./store/store"; // <-- Verifica que este archivo exista aquí
import AdminDashboard from "./views/AdminDashboard";
import InventoryView from "./views/InventoryView";
import ProductionView from "./views/ProductionView";
import MovementsView from "./views/MovementsView";
import PlanningView from "./views/PlanningView";

export default function InventarioApp({ tabActiva }) {
  const renderContent = () => {
    switch (tabActiva) {
      case "DashBoard": return <AdminDashboard />;
      case "Inventario": return <InventoryView />;
      case "Producción": return <ProductionView />;
      case "Movimientos": return <MovementsView />;
      case "Planificación": return <PlanningView />;
      default: return <AdminDashboard />;
    }
  };

  return (
    <AppProvider>
      {renderContent()}
    </AppProvider>
  );
}