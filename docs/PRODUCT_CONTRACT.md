# PRODUCT CONTRACT — HORECA MODULAR

## 1. Executive Overview
HORECA Modular is a multi-tenant SaaS platform built under the VEGEN Software Product System specifically designed for hospitality business management (restaurants, catering, food service). It provides comprehensive operational, financial, HR, inventory, and cost management capabilities.

## 2. Core Modules & Business Capabilities
1. **Extractos (Finances & Banking)**: Multi-format bank statement parsing (BBVA, Sabadell), duplicate detection, row normalization, deterministic classification rules, economic movement allocations, and financial reporting.
2. **Personal & Horarios (HR & Time Tracking)**: Employee registry, daily clock-in/clock-out (fichajes), absence & incident tracking (incidencias), and automated attendance reporting.
3. **Producción (Production)**: Daily production line tracking, recipe output batching, lot tracking, and operator logging.
4. **Inventario (Inventory)**: Stock management, movement logging, stockout predictions, and automated reorder triggers.
5. **Escandallos (Recipe Costing)**: Dish ingredient breakdowns, raw material cost tracking, margin calculations, and real-time food cost analytics.
6. **Compras & Pedidos (Purchases & Orders)**: Historical order tracking, supplier catalogs, purchase order management, and invoice reconciliation.
7. **Ventas (Sales & POS Integration)**: Ticket reconciliation, product performance analytics, table turn metrics, and Last.app POS integration adapter.
8. **KPIs & Analytics**: Real-time executive dashboards, profitability metrics, and predictive sales/stock models.

## 3. User Roles & Capabilities
- **SUPERADMIN**: Global platform control, cross-tenant management, user role assignments, system-wide configuration.
- **ADMIN**: Organization-level administrator with full access to financial, operational, HR, and configuration settings.
- **GERENTE**: Restaurant/store manager with operational access to sales, banking, inventory, production, and personal modules.
- **OPERADOR**: Floor staff / shift supervisor with access to daily logs (fichajes, produccion, inventario).
- **CONSULTA**: Read-only executive / accountant view restricted to financial reports and dashboards.

## 4. Non-Negotiable Operating Principles
- **Multi-Tenant Isolation**: Complete data segregation by `organization_id` backed by strict Database Row-Level Security (RLS).
- **Fail-Closed Authorization**: Unauthenticated or unauthorized users are strictly denied access across UI and API endpoints. No hardcoded role fallbacks.
- **Zero Exposure**: No secrets, plain-text passwords, or sensitive credentials in Git, source code, build artifacts, or documentation.
