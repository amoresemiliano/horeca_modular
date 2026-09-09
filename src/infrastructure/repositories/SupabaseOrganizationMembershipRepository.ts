import { SupabaseClient } from '@supabase/supabase-js';
import {
  IOrganizationMembershipRepository,
  UserOrganizationContext,
} from '../../domain/tenancy/repositories/IOrganizationMembershipRepository';
import { OrganizationMembership } from '../../domain/tenancy/entities/Membership';
import { RoleTemplate } from '../../domain/tenancy/authorization/roles';
import { Result } from '../../shared/errors/Result';
import { AppError } from '../../shared/errors/AppError';

export class SupabaseOrganizationMembershipRepository implements IOrganizationMembershipRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  public async findUserOrganizations(userId: string): Promise<Result<readonly UserOrganizationContext[]>> {
    try {
      const { data, error } = await this.supabase
        .from('eco_organization_members')
        .select(`
          id,
          user_id,
          organization_id,
          role_template,
          is_active,
          created_at,
          updated_at,
          eco_organizations (
            id,
            legal_name,
            commercial_name,
            tax_id,
            country,
            is_active,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        return Result.fail(
          AppError.infrastructure(`Database error retrieving user organizations: ${error.message}`, {
            reason: error.details,
          })
        );
      }

      if (!data) {
        return Result.ok([]);
      }

      const contexts: UserOrganizationContext[] = [];

      for (const row of data as any[]) {
        const orgData = row.eco_organizations;
        if (orgData && orgData.is_active) {
          contexts.push({
            organization: {
              id: orgData.id,
              legalName: orgData.legal_name,
              commercialName: orgData.commercial_name || undefined,
              taxId: orgData.tax_id,
              country: orgData.country,
              isActive: orgData.is_active,
              createdAt: orgData.created_at,
              updatedAt: orgData.updated_at,
            },
            membership: {
              id: row.id,
              userId: row.user_id,
              organizationId: row.organization_id,
              roleTemplate: (row.role_template as RoleTemplate) || RoleTemplate.CONSULTANT,
              isActive: row.is_active,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            },
          });
        }
      }

      return Result.ok(contexts);
    } catch (err: any) {
      return Result.fail(AppError.unexpected(`Unexpected error in findUserOrganizations: ${err.message}`));
    }
  }

  public async findMembership(userId: string, organizationId: string): Promise<Result<OrganizationMembership | null>> {
    try {
      const { data, error } = await this.supabase
        .from('eco_organization_members')
        .select('*')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        return Result.fail(
          AppError.infrastructure(`Database error finding membership: ${error.message}`, {
            reason: error.details,
          })
        );
      }

      if (!data) {
        return Result.ok(null);
      }

      const membership: OrganizationMembership = {
        id: data.id,
        userId: data.user_id,
        organizationId: data.organization_id,
        roleTemplate: (data.role_template as RoleTemplate) || RoleTemplate.CONSULTANT,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      return Result.ok(membership);
    } catch (err: any) {
      return Result.fail(AppError.unexpected(`Unexpected error in findMembership: ${err.message}`));
    }
  }

  public async getActiveContext(userId: string): Promise<Result<string | null>> {
    try {
      const { data, error } = await this.supabase
        .from('eco_user_active_context')
        .select('active_organization_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        return Result.fail(
          AppError.infrastructure(`Database error reading active context: ${error.message}`, {
            reason: error.details,
          })
        );
      }

      return Result.ok(data ? data.active_organization_id : null);
    } catch (err: any) {
      return Result.fail(AppError.unexpected(`Unexpected error in getActiveContext: ${err.message}`));
    }
  }

  public async setActiveContext(userId: string, organizationId: string): Promise<Result<void>> {
    try {
      const { error } = await this.supabase.from('eco_user_active_context').upsert(
        {
          user_id: userId,
          active_organization_id: organizationId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        return Result.fail(
          AppError.infrastructure(`Database error setting active context: ${error.message}`, {
            reason: error.details,
          })
        );
      }

      return Result.ok(undefined);
    } catch (err: any) {
      return Result.fail(AppError.unexpected(`Unexpected error in setActiveContext: ${err.message}`));
    }
  }
}
