# ROLE CAPABILITY MATRIX — HORECA MODULAR

## 1. System Roles Overview
HORECA Modular defines 5 operational roles assigned per tenant in `eco_organization_members`:

1. **SUPERADMIN**: Global platform administrator.
2. **ADMIN**: Tenant business owner / financial director.
3. **GERENTE**: Store manager / operations director.
4. **OPERADOR**: Shift supervisor / line operator.
5. **CONSULTA**: Read-only stakeholder / external accountant.

## 2. Module Access Matrix

| Module | SUPERADMIN | ADMIN | GERENTE | OPERADOR | CONSULTA |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Dashboard** | Full | Full | Full | Full | View Only |
| **Bancos (Extractos)** | Full | Full | Full | Denied | View Only |
| **Ventas (Sales)** | Full | Full | Full | Denied | View Only |
| **KPIs & Analytics** | Full | Full | Full | Denied | View Only |
| **Inventario** | Full | Full | Full | Operational | Denied |
| **Escandallos** | Full | Full | Operational | Denied | View Only |
| **Compras / Pedidos** | Full | Full | Operational | Denied | Denied |
| **Producción** | Full | Full | Operational | Operational | Denied |
| **Personal (HR)** | Full | Full | Operational | Operational | Denied |
| **Configuracion** | Full | Full | Denied | Denied | Denied |

## 3. Enforcement Layers
- **Database RLS**: All database operations evaluate `get_auth_user_org_id()`. Multi-tenant queries filter strictly by validated organization membership.
- **Frontend Navigation**: `MainLayout.jsx` filters module tabs based on the resolved `role` from `AuthContext.jsx`.
- **Fail-Closed Safeguard**: If `role` is null or unrecognized, access is denied to all modules.
