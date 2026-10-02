-- =============================================================================
-- Migration: 20260903000000_supabase_auth_rls.sql
-- Description: Native Supabase Auth + Identity/Membership Model + Strict RLS
-- =============================================================================

BEGIN;

-- 1. Ensure eco_organization_members table exists
CREATE TABLE IF NOT EXISTS public.eco_organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    user_profile_id UUID NOT NULL REFERENCES public.eco_user_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'CONSULTA',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT eco_org_members_unique UNIQUE (organization_id, user_profile_id)
);

-- Enable RLS on eco_organization_members
ALTER TABLE public.eco_organization_members ENABLE ROW LEVEL SECURITY;

-- 2. Create eco_auth_bootstrap_allowlist table
CREATE TABLE IF NOT EXISTS public.eco_auth_bootstrap_allowlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'SUPERADMIN',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    consumed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on eco_auth_bootstrap_allowlist (internal/admin only)
ALTER TABLE public.eco_auth_bootstrap_allowlist ENABLE ROW LEVEL SECURITY;

-- 3. Seed Superadmin Allowlist for controlled initial bootstrap
INSERT INTO public.eco_auth_bootstrap_allowlist (email, organization_id, role, is_active)
VALUES 
    ('vegendigital@gmail.com', '59436df3-9f15-4f5e-b17e-37c55482521c', 'SUPERADMIN', TRUE),
    ('emilianodirosa1@gmail.com', '59436df3-9f15-4f5e-b17e-37c55482521c', 'SUPERADMIN', TRUE)
ON CONFLICT (email) DO UPDATE 
SET organization_id = EXCLUDED.organization_id,
    role = EXCLUDED.role,
    is_active = TRUE;

-- 4. Provision Multi-Tenant Operational Tables (No Hardcoded Tenant Default)
CREATE TABLE IF NOT EXISTS public.empleados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    apellidos TEXT,
    email TEXT,
    telefono TEXT,
    puesto TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.fichajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    empleado_id UUID REFERENCES public.empleados(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_entrada TIME,
    hora_salida TIME,
    tipo TEXT NOT NULL DEFAULT 'ENTRADA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.fichajes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.incidencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    empleado_id UUID REFERENCES public.empleados(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    descripcion TEXT,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.produccion_registros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    linea TEXT NOT NULL,
    producto TEXT NOT NULL,
    cantidad NUMERIC NOT NULL DEFAULT 0,
    unidad TEXT NOT NULL DEFAULT 'kg',
    lote TEXT,
    empleado_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.produccion_registros ENABLE ROW LEVEL SECURITY;

-- 5. Helper Function: get_auth_user_org_id()
-- Resolves active organization_id strictly via auth.uid() -> eco_user_profiles -> eco_organization_members
CREATE OR REPLACE FUNCTION public.get_auth_user_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT m.organization_id INTO v_org_id
    FROM public.eco_user_profiles p
    JOIN public.eco_organization_members m ON m.user_profile_id = p.id
    WHERE p.auth_user_id = auth.uid()
      AND p.is_active = TRUE
      AND m.is_active = TRUE
    ORDER BY m.created_at ASC
    LIMIT 1;

    RETURN v_org_id;
END;
$$;

-- 6. Trigger Handler for New Users (`public.handle_new_user`)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_id UUID;
    v_allow_record RECORD;
BEGIN
    -- Check or create global profile in eco_user_profiles
    SELECT id INTO v_profile_id
    FROM public.eco_user_profiles
    WHERE auth_user_id = NEW.id;

    IF v_profile_id IS NULL THEN
        INSERT INTO public.eco_user_profiles (auth_user_id, organization_id, role, is_active)
        VALUES (
            NEW.id,
            '59436df3-9f15-4f5e-b17e-37c55482521c',
            COALESCE(NEW.raw_user_meta_data->>'role', 'CONSULTA'),
            TRUE
        )
        RETURNING id INTO v_profile_id;
    END IF;

    -- Check bootstrap allowlist by email
    IF NEW.email IS NOT NULL THEN
        SELECT * INTO v_allow_record
        FROM public.eco_auth_bootstrap_allowlist
        WHERE LOWER(email) = LOWER(NEW.email)
          AND is_active = TRUE
        LIMIT 1;

        IF v_allow_record IS NOT NULL THEN
            -- Provision or update eco_organization_members
            INSERT INTO public.eco_organization_members (organization_id, user_profile_id, role, is_active)
            VALUES (v_allow_record.organization_id, v_profile_id, v_allow_record.role, TRUE)
            ON CONFLICT (organization_id, user_profile_id)
            DO UPDATE SET role = EXCLUDED.role, is_active = TRUE;

            -- Update profile role and default org
            UPDATE public.eco_user_profiles
            SET organization_id = v_allow_record.organization_id,
                role = v_allow_record.role
            WHERE id = v_profile_id;

            -- Mark allowlist consumed
            UPDATE public.eco_auth_bootstrap_allowlist
            SET consumed_at = NOW()
            WHERE id = v_allow_record.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Attach Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. CLEAN UP ALL LEGACY RLS POLICIES ALLOWING auth.uid() IS NULL OR PUBLIC ANON ACCESS
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND (policyname LIKE 'Org isolation%' OR roles @> '{public}')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Also explicitly drop old policies on core tables
DROP POLICY IF EXISTS "Imports viewable by org" ON public.eco_source_imports;
DROP POLICY IF EXISTS "Files viewable by org" ON public.eco_source_files;
DROP POLICY IF EXISTS "Select active financial movements by org" ON public.eco_financial_movements;
DROP POLICY IF EXISTS "Profiles viewable by user and admin" ON public.eco_user_profiles;

-- 8. APPLY STRICT RLS POLICIES FOR AUTHENTICATED USERS ONLY

-- eco_user_profiles
CREATE POLICY "Profiles strict user access" ON public.eco_user_profiles
    FOR ALL TO authenticated
    USING (auth_user_id = auth.uid() OR organization_id = get_auth_user_org_id())
    WITH CHECK (auth_user_id = auth.uid() OR organization_id = get_auth_user_org_id());

-- eco_organizations
CREATE POLICY "Organizations member view" ON public.eco_organizations
    FOR SELECT TO authenticated
    USING (id = get_auth_user_org_id());

-- eco_organization_members
CREATE POLICY "Members strict access" ON public.eco_organization_members
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

-- Multi-Tenant Financial & Operational Tables
CREATE POLICY "Strict RLS eco_financial_movements" ON public.eco_financial_movements
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Strict RLS eco_source_imports" ON public.eco_source_imports
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Strict RLS eco_source_files" ON public.eco_source_files
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Strict RLS eco_import_rows" ON public.eco_import_rows
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Strict RLS eco_movement_allocations" ON public.eco_movement_allocations
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Strict RLS eco_financial_accounts" ON public.eco_financial_accounts
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Strict RLS eco_classification_rules" ON public.eco_classification_rules
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Strict RLS eco_counterparties" ON public.eco_counterparties
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Strict RLS eco_tax_subcategories" ON public.eco_tax_subcategories
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Strict RLS empleados" ON public.empleados
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Strict RLS fichajes" ON public.fichajes
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Strict RLS incidencias" ON public.incidencias
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Strict RLS produccion_registros" ON public.produccion_registros
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());

COMMIT;
