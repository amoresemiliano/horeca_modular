import { SupabaseClient } from '@supabase/supabase-js';
import {
  IOrganizationMembershipRepository,
  UserOrganizationContext,
} from '../../domain/tenancy/repositories/IOrganizationMembershipRepository';
import { Membership, OrganizationMembership } from '../../domain/tenancy/entities/Membership';
import { Organization } from '../../domain/tenancy/entities/Organization';
import { OperationalUnit } from '../../domain/tenancy/entities/OperationalUnit';
import { ModuleEntitlement } from '../../domain/tenancy/entities/ModuleEntitlement';
import { RoleTemplate } from '../../domain/tenancy/authorization/roles';
import { Result } from '../../shared/errors/Result';
import { AppError } from '../../shared/errors/AppError';

export class SupabaseOrganizationMembershipRepository implements IOrganizationMembershipRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  // 1. findByUserId
  public async findByUserId(userId: string): Promise<Result<Membership[], AppError>> {
    try {
      const { data, error } = await this.supabase
        .from('eco_organization_members')
        .select(`
          id,
          organization_id,
          user_id,
          role,
          role_template_id,
          operational_unit_id,
          is_active,
          created_at,
          updated_at,
          eco_role_templates (
            code,
            name
          ),
          eco_member_capability_overrides (
            id,
            capability_id,
            effect,
            operational_unit_id,
            eco_capabilities (
              code
            )
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        return Result.fail(AppError.infrastructure(`Database error retrieving memberships: ${error.message}`));
      }

      if (!data) {
        return Result.ok([]);
      }

      const memberships: Membership[] = [];

      for (const row of data as any[]) {
        let baseCapabilities: string[] = [];
        if (row.role_template_id) {
          const { data: capData } = await this.supabase
            .from('eco_role_template_capabilities')
            .select('eco_capabilities(code)')
            .eq('role_template_id', row.role_template_id);

          if (capData) {
            baseCapabilities = capData
              .map((c: any) => c.eco_capabilities?.code)
              .filter(Boolean);
          }
        }

        const overrides = (row.eco_member_capability_overrides || []).map((o: any) => ({
          id: o.id,
          capabilityCode: o.eco_capabilities?.code || '',
          effect: o.effect,
          operationalUnitId: o.operational_unit_id,
        }));

        memberships.push({
          id: row.id,
          organizationId: row.organization_id,
          userId: row.user_id,
          role: row.role || 'CONSULTA',
          roleTemplateId: row.role_template_id,
          roleTemplateCode: row.eco_role_templates?.code || null,
          operationalUnitId: row.operational_unit_id,
          capabilities: baseCapabilities,
          overrides,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      return Result.ok(memberships);
    } catch (e: any) {
      return Result.fail(AppError.unexpected(`Unexpected error in findByUserId: ${e.message}`));
    }
  }

  // 2. findPrimaryByUserId
  public async findPrimaryByUserId(userId: string): Promise<Result<Membership | null, AppError>> {
    const res = await this.findByUserId(userId);
    if (!res.success) {
      return Result.fail(res.error);
    }
    return Result.ok(res.value.length > 0 ? res.value[0] : null);
  }

  // 3. findOrganizationsByUserId
  public async findOrganizationsByUserId(userId: string): Promise<Result<Organization[], AppError>> {
    try {
      const { data, error } = await this.supabase
        .from('eco_organization_members')
        .select(`
          organization_id,
          eco_organizations (
            id,
            name,
            legal_name,
            tax_id,
            tax_id_type,
            holding_id,
            trade_name,
            country_code,
            currency,
            timezone,
            is_active,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        return Result.fail(AppError.infrastructure(`Database error retrieving organizations: ${error.message}`));
      }

      if (!data) {
        return Result.ok([]);
      }

      const orgs: Organization[] = [];
      for (const row of data as any[]) {
        const o = row.eco_organizations;
        if (o && o.is_active !== false) {
          orgs.push({
            id: o.id,
            name: o.name || o.legal_name || 'Organization',
            legalName: o.legal_name,
            taxId: o.tax_id,
            taxIdType: o.tax_id_type,
            holdingId: o.holding_id,
            tradeName: o.trade_name,
            country: o.country_code || 'ES',
            countryCode: o.country_code,
            currency: o.currency,
            timezone: o.timezone,
            isActive: o.is_active,
            createdAt: o.created_at,
            updatedAt: o.updated_at,
          });
        }
      }

      return Result.ok(orgs);
    } catch (e: any) {
      return Result.fail(AppError.unexpected(`Unexpected error in findOrganizationsByUserId: ${e.message}`));
    }
  }

  // 4. findOperationalUnitsByOrgId
  public async findOperationalUnitsByOrgId(orgId: string): Promise<Result<OperationalUnit[], AppError>> {
    try {
      const { data, error } = await this.supabase
        .from('eco_operational_units')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true);

      if (error) {
        return Result.fail(AppError.infrastructure(`Database error retrieving operational units: ${error.message}`));
      }

      const units: OperationalUnit[] = (data || []).map((u: any) => ({
        id: u.id,
        organizationId: u.organization_id,
        code: u.code,
        name: u.name,
        unitType: u.unit_type,
        isActive: u.is_active,
        metadata: u.metadata,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }));

      return Result.ok(units);
    } catch (e: any) {
      return Result.fail(AppError.unexpected(`Unexpected error in findOperationalUnitsByOrgId: ${e.message}`));
    }
  }

  // 5. findModuleEntitlementsByOrgId
  public async findModuleEntitlementsByOrgId(orgId: string): Promise<Result<ModuleEntitlement[], AppError>> {
    try {
      const { data, error } = await this.supabase
        .from('eco_organization_module_entitlements')
        .select('*')
        .eq('organization_id', orgId);

      if (error) {
        return Result.fail(AppError.infrastructure(`Database error retrieving module entitlements: ${error.message}`));
      }

      const entitlements: ModuleEntitlement[] = (data || []).map((e: any) => ({
        id: e.id,
        organizationId: e.organization_id,
        moduleKey: e.module_key,
        isEnabled: e.is_enabled,
        planTier: e.plan_tier,
        settings: e.settings,
      }));

      return Result.ok(entitlements);
    } catch (e: any) {
      return Result.fail(AppError.unexpected(`Unexpected error in findModuleEntitlementsByOrgId: ${e.message}`));
    }
  }

  // Legacy compat methods
  public async findUserOrganizations(userId: string): Promise<Result<readonly UserOrganizationContext[], AppError>> {
    const res = await this.findByUserId(userId);
    if (!res.success) {
      return Result.fail(res.error);
    }
    const orgsRes = await this.findOrganizationsByUserId(userId);
    if (!orgsRes.success) {
      return Result.fail(orgsRes.error);
    }

    const contexts: UserOrganizationContext[] = [];
    for (const org of orgsRes.value) {
      const membership = res.value.find((m: Membership) => m.organizationId === org.id);
      if (membership) {
        contexts.push({
          organization: org,
          membership: {
            id: membership.id,
            userId: membership.userId,
            organizationId: membership.organizationId,
            roleTemplate: (membership.roleTemplateCode as RoleTemplate) || RoleTemplate.CONSULTANT,
            role: membership.role,
            isActive: membership.isActive ?? true,
            createdAt: membership.createdAt || '',
            updatedAt: membership.updatedAt || '',
          },
        });
      }
    }

    return Result.ok(contexts);
  }

  public async findMembership(userId: string, organizationId: string): Promise<Result<OrganizationMembership | null, AppError>> {
    const res = await this.findByUserId(userId);
    if (!res.success) {
      return Result.fail(res.error);
    }
    const m = res.value.find((item: Membership) => item.organizationId === organizationId);
    if (!m) {
      return Result.ok(null);
    }
    return Result.ok({
      id: m.id,
      userId: m.userId,
      organizationId: m.organizationId,
      roleTemplate: (m.roleTemplateCode as RoleTemplate) || RoleTemplate.CONSULTANT,
      role: m.role,
      isActive: m.isActive ?? true,
      createdAt: m.createdAt || '',
      updatedAt: m.updatedAt || '',
    });
  }

  public async getActiveContext(_userId: string): Promise<Result<string | null, AppError>> {
    return Result.ok(null);
  }

  public async setActiveContext(_userId: string, _organizationId: string): Promise<Result<void, AppError>> {
    return Result.ok(undefined);
  }
}
