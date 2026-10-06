# ARCHITECTURE SPECIFICATION — HORECA MODULAR

> **Status**: APPROVED CANONICAL ARCHITECTURE (WP-001)  
> **Repository Baseline**: `https://github.com/amoresemiliano/horeca_modular`  
> **Architectural Pattern**: Modular Monolith with Clean / Hexagonal Layer Boundaries

---

## 1. Architectural Principles & Layer Boundaries

HORECA Modular follows a strict, unidirectional dependency rule:

```
UI / React Components
       ↓
Application / Use Cases
       ↓
Domain (Entities, Capabilities, Pure Business Rules)
       ↓
Repository Interfaces / Ports
       ↓
Infrastructure Adapters (Supabase, File Parsers, External APIs)
```

### Core Invariants
1. **Supabase is Infrastructure**: Supabase is a persistence and auth adapter, not domain authority. UI components must not execute arbitrary direct database queries.
2. **React Components are Not Business Authorities**: Components render state and dispatch user intent to Application Use Cases.
3. **Pure Domain Primitives**: The `domain/` layer has zero external framework dependencies and executes purely in standard TypeScript.
4. **Explicit Result / Error Model**: All application boundaries return `Result<T, AppError>` rather than throwing unhandled exceptions or returning silent empty arrays.

---

## 2. Canonical Source Structure

```
src/
  ├── app/                  # Application bootstrap, routing, and provider shells
  ├── domain/               # Enterprise domain entities, capability rules, value objects
  │     ├── auth/           # User identity, auth session types
  │     ├── tenancy/        # Organizations, memberships, capabilities, roles, can() evaluator
  │     └── shared/         # BaseEntity, AuditableEntity, EntityId primitives
  ├── application/          # Use cases, orchestrators, DTOs, application services
  │     └── tenancy/        # Active context validation, membership resolution use cases
  ├── infrastructure/       # External service adapters, repositories, database clients
  │     ├── supabase/       # Typed Supabase client singleton, config, error mappers
  │     └── repositories/   # SupabaseOrganizationMembershipRepository adapter
  ├── shared/               # Cross-cutting primitives (config, errors, validation)
  │     ├── config/         # Zod-validated environment config with safe logging
  │     ├── errors/         # AppError (7 discrete error codes), Result<T, E> container
  │     └── validation/     # Schema validation helpers
  └── modules/              # Coexisting legacy business modules (Extractos, Inventario, HR)
```

### Coexistence Mapping (Legacy vs Target)

| Component Area | Current Legacy Path (`src/modules/`) | Target Architectural Foundation | Migration Plan |
| :--- | :--- | :--- | :--- |
| **Authentication & Profile** | `src/context/AuthContext.jsx` | `src/domain/auth/`, `src/infrastructure/supabase/` | Standardized in WP-001 foundation; AuthContext delegates to use cases. |
| **Tenancy & Membership** | `src/context/AuthContext.jsx` (`LIMIT 1`) | `src/domain/tenancy/`, `src/application/tenancy/` | Established in WP-001; full schema binding in subsequent WPs. |
| **Extractos & Financial** | `src/modules/extractos/` | `src/modules/extractos/` + Target Domain / Repositories | Preserved in WP-001; migrated in WP-002. |
| **Personal & HR** | `src/modules/personal/` | `src/modules/personal/` + Target Domain / Repositories | Preserved in WP-001; migrated in WP-003. |
| **Inventario & Producción** | `src/modules/inventario/`, `src/modules/produccion/` | Target Domain / Repositories | Preserved in WP-001; migrated in WP-004. |
| **Escandallos (Recipes)** | Branch `feature/escandallos-*` | `src/domain/escandallos/`, `src/modules/escandallos/` | Preserved on branch; audited and integrated in WP-005. |
| **Purchases & Orders** | `src/modules/pedidos/` | `src/domain/purchases/`, `src/modules/purchases/` | Preserved in WP-001; migrated in WP-006. |
| **Ventas & Last.app POS** | Standalone repo `last_horeca_integracion` | `src/infrastructure/adapters/lastapp/` | Integrated via adapter in WP-007. |

---

## 3. Infrastructure & Repository Pattern

All persistence operations implement explicit port interfaces:

```typescript
// Domain Port Interface (src/domain/tenancy/repositories/IOrganizationMembershipRepository.ts)
export interface IOrganizationMembershipRepository {
  findByUserId(userId: string): Promise<Result<OrganizationMembership[], AppError>>;
  findActiveMembership(userId: string, organizationId: string): Promise<Result<OrganizationMembership | null, AppError>>;
  getUserActiveContext(userId: string): Promise<Result<ActiveContext | null, AppError>>;
  setActiveContext(userId: string, organizationId: string, operationalUnitId?: string): Promise<Result<void, AppError>>;
}
```

```typescript
// Concrete Infrastructure Adapter (src/infrastructure/repositories/SupabaseOrganizationMembershipRepository.ts)
export class SupabaseOrganizationMembershipRepository implements IOrganizationMembershipRepository {
  // Queries Supabase PostgREST, maps database errors to AppError, returns Result<T, AppError>
}
```

---

## 4. Error & Result Model

All new architectural boundaries use the functional container `Result<T, E>` and `AppError`:

```typescript
export type AppErrorCode =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INFRASTRUCTURE'
  | 'UNEXPECTED';
```

---

## 5. Runtime Environment Contract

Config is parsed through Zod schema validation on application boot ([`src/shared/config/env.ts`](file:///c:/Users/Emiliano/Documents/1.%20Sistemas/El%20Criollo/el-criollo-ecosistema/el_criollo_modular/src/shared/config/env.ts)).
- **Explicit Environments**: `development`, `uat`, `production`.
- **Secret Protection**: Only variables prefixed with `VITE_` are exposed to the client. API keys are masked in diagnostic outputs (`sb_pub...`).

---

## 6. Prohibited Architectural Patterns

- ❌ Microservices (unjustified operational complexity for current scale).
- ❌ Redux or complex global state libraries (use React Context / TanStack Query where needed).
- ❌ Redis or separate caching layers.
- ❌ Separate custom backend framework layered over Supabase without demonstrated need.
- ❌ Client-side direct table mutations bypassing domain validation.
