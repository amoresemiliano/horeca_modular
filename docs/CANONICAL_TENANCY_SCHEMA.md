# CANONICAL TENANCY & AUTHORIZATION SCHEMA — HORECA MODULAR

## 1. 3-Tier Multi-Tenant & Multi-CIF Hierarchy
HORECA Modular models hospitality enterprise groups using a canonical three-tier hierarchy:

```
eco_holdings (Holding / Brand Group)
  └── eco_organizations (Legal Entities / CIFs)
        └── eco_operational_units (Physical Locations / Production Units / Salons)
```

### Table Specifications

#### 1. `eco_holdings`
- `id` (UUID, PK)
- `code` (TEXT, UNIQUE): Human-readable slug (e.g. `EL_CRIOLLO_GROUP`)
- `name` (TEXT): Display name
- `legal_name` (TEXT, NULLABLE): Legal company name
- `tax_id` (TEXT, NULLABLE): Group tax identifier
- `country_code` (VARCHAR(2), DEFAULT 'ES')
- `is_active` (BOOLEAN, DEFAULT true)
- `metadata` (JSONB)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### 2. `eco_organizations` (Legal CIF Tenant)
- `id` (UUID, PK)
- `holding_id` (UUID, FK `eco_holdings.id`, ON DELETE SET NULL)
- `name` (TEXT)
- `legal_name` (TEXT)
- `trade_name` (TEXT)
- `tax_id` (TEXT): CIF/NIF
- `tax_id_type` (TEXT, DEFAULT 'CIF')
- `country_code` (VARCHAR(2), DEFAULT 'ES')
- `currency` (VARCHAR(3), DEFAULT 'EUR')
- `timezone` (TEXT, DEFAULT 'Europe/Madrid')
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### 3. `eco_operational_units` (Locations & Departments)
- `id` (UUID, PK)
- `organization_id` (UUID, FK `eco_organizations.id`, ON DELETE CASCADE)
- `code` (TEXT)
- `name` (TEXT)
- `unit_type` (TEXT: `'KITCHEN'`, `'SALON'`, `'BAR'`, `'WAREHOUSE'`, `'CENTRAL_OFFICE'`, `'DELIVERY_HUB'`, `'OTHER'`)
- `is_active` (BOOLEAN, DEFAULT true)
- `metadata` (JSONB)
- `created_at`, `updated_at` (TIMESTAMPTZ)
- *Constraint*: `UNIQUE(organization_id, code)`

#### 4. `eco_holding_members`
- `id` (UUID, PK)
- `holding_id` (UUID, FK `eco_holdings.id`, ON DELETE CASCADE)
- `user_id` (UUID, FK `eco_user_profiles.id`, ON DELETE CASCADE)
- `role` (TEXT: `'HOLDING_OWNER'`, `'HOLDING_ADMIN'`)
- `is_active` (BOOLEAN, DEFAULT true)
- *Constraint*: `UNIQUE(holding_id, user_id)`

#### 5. `eco_organization_members`
- `id` (UUID, PK)
- `organization_id` (UUID, FK `eco_organizations.id`, ON DELETE CASCADE)
- `user_id` (UUID, FK `eco_user_profiles.id`, ON DELETE CASCADE)
- `role` (TEXT): Transitional role string (`'SUPERADMIN'`, `'ADMIN'`, `'GERENTE'`, `'OPERADOR'`, `'CONSULTA'`)
- `role_template_id` (UUID, FK `eco_role_templates.id`, ON DELETE SET NULL)
- `operational_unit_id` (UUID, FK `eco_operational_units.id`, ON DELETE SET NULL)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### 6. `eco_role_templates` (13 Canonical Templates)
- `id` (UUID, PK)
- `code` (TEXT, UNIQUE): Canonical template code
- `name` (TEXT)
- `description` (TEXT)
- `tier` (TEXT: `'PLATFORM'`, `'HOLDING'`, `'ORGANIZATION'`)
- `is_active` (BOOLEAN, DEFAULT true)

#### 7. `eco_capabilities` (42 Atomic Capabilities)
- `id` (UUID, PK)
- `code` (TEXT, UNIQUE): Capability code (e.g. `BANK_IMPORT`, `RECORD_VIEW`)
- `scope` (TEXT: `'PLATFORM'`, `'HOLDING'`, `'ORGANIZATION'`, `'OPERATIONAL_UNIT'`)
- `description` (TEXT)
- `is_active` (BOOLEAN, DEFAULT true)

#### 8. `eco_role_template_capabilities`
- `id` (UUID, PK)
- `role_template_id` (UUID, FK `eco_role_templates.id`, ON DELETE CASCADE)
- `capability_id` (UUID, FK `eco_capabilities.id`, ON DELETE CASCADE)
- *Constraint*: `UNIQUE(role_template_id, capability_id)`

#### 9. `eco_member_capability_overrides`
- `id` (UUID, PK)
- `membership_id` (UUID, FK `eco_organization_members.id`, ON DELETE CASCADE)
- `capability_id` (UUID, FK `eco_capabilities.id`, ON DELETE CASCADE)
- `effect` (TEXT: `'GRANT'`, `'REVOKE'`)
- `operational_unit_id` (UUID, FK `eco_operational_units.id`, ON DELETE CASCADE, NULLABLE)
- *Constraint*: `UNIQUE(membership_id, capability_id, operational_unit_id)`

#### 10. `eco_organization_module_entitlements`
- `id` (UUID, PK)
- `organization_id` (UUID, FK `eco_organizations.id`, ON DELETE CASCADE)
- `module_key` (TEXT)
- `is_enabled` (BOOLEAN, DEFAULT true)
- `plan_tier` (TEXT, DEFAULT 'transitional')
- `settings` (JSONB)
- *Constraint*: `UNIQUE(organization_id, module_key)`
