import { z } from 'zod';
import { RoleTemplate } from '../../../domain/tenancy/authorization/roles';

export const RequestActiveContextSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
  requestedOrganizationId: z.string().uuid('Organization ID must be a valid UUID').optional(),
});

export type RequestActiveContextInput = z.infer<typeof RequestActiveContextSchema>;

export interface ActiveContextResponseDto {
  readonly activeOrganizationId: string;
  readonly legalName: string;
  readonly taxId: string;
  readonly roleTemplate: RoleTemplate;
  readonly availableOrganizations: readonly {
    readonly id: string;
    readonly legalName: string;
    readonly taxId: string;
    readonly roleTemplate: RoleTemplate;
  }[];
}
