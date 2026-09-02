-- Migration: 20260901000000_init_escandallos (Updated for 2026)
-- Creates the base tables for the Escandallos module

-- eco_organizations MUST already exist globally.
-- We are purely ensuring the schema uses the canonical table for multitenancy.

-- Ingredients
CREATE TABLE IF NOT EXISTS public.ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    base_unit TEXT NOT NULL,
    cost_strategy TEXT NOT NULL DEFAULT 'LAST_PURCHASE', -- LAST_PURCHASE, MANUAL, etc.
    manual_cost NUMERIC(10, 4),
    current_cost NUMERIC(10, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

-- Recipes / Elaborations
CREATE TABLE IF NOT EXISTS public.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- FINAL_PRODUCT or PREPARATION
    name TEXT NOT NULL,
    category TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    produced_quantity NUMERIC(10, 4) NOT NULL DEFAULT 1,
    produced_unit TEXT NOT NULL,
    merma_percentage NUMERIC(5, 2) DEFAULT 0,
    pvp_manual NUMERIC(10, 4),
    packaging_cost NUMERIC(10, 4) DEFAULT 0,
    total_cost NUMERIC(10, 4) NOT NULL DEFAULT 0,
    unit_cost NUMERIC(10, 4) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Recipe Items (BOM)
CREATE TABLE IF NOT EXISTS public.recipe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
    child_recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
    quantity_net NUMERIC(10, 4) NOT NULL,
    unit TEXT NOT NULL,
    merma_percentage NUMERIC(5, 2) DEFAULT 0,
    computed_cost NUMERIC(10, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT must_have_ingredient_or_child CHECK (ingredient_id IS NOT NULL OR child_recipe_id IS NOT NULL)
);
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;

-- Cost History
CREATE TABLE IF NOT EXISTS public.cost_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- INGREDIENT, RECIPE
    entity_id UUID NOT NULL,
    cost NUMERIC(10, 4) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);
ALTER TABLE public.cost_history ENABLE ROW LEVEL SECURITY;

-- Mappings for Last.app (from requirements)
CREATE TABLE IF NOT EXISTS public.external_product_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    external_source TEXT NOT NULL DEFAULT 'last_app',
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.external_product_mapping ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all on ingredients" ON public.ingredients FOR ALL USING (true);
CREATE POLICY "Allow all on recipes" ON public.recipes FOR ALL USING (true);
CREATE POLICY "Allow all on recipe_items" ON public.recipe_items FOR ALL USING (true);
CREATE POLICY "Allow all on cost_history" ON public.cost_history FOR ALL USING (true);
CREATE POLICY "Allow all on external_product_mapping" ON public.external_product_mapping FOR ALL USING (true);