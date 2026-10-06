import { z } from 'zod';

export const SwitchOrganizationInputSchema = z.object({
  userId: z.string().min(1, 'UserId is required'),
  targetOrganizationId: z.string().min(1, 'TargetOrganizationId is required'),
});
export type SwitchOrganizationInput = z.infer<typeof SwitchOrganizationInputSchema>;

export const SwitchOperationalUnitInputSchema = z.object({
  userId: z.string().min(1, 'UserId is required'),
  organizationId: z.string().min(1, 'OrganizationId is required'),
  targetOperationalUnitId: z.string().nullable().optional(),
});
export type SwitchOperationalUnitInput = z.infer<typeof SwitchOperationalUnitInputSchema>;

export const CanExecuteInputSchema = z.object({
  userId: z.string().min(1, 'UserId is required'),
  organizationId: z.string().min(1, 'OrganizationId is required'),
  capabilityCode: z.string().min(1, 'CapabilityCode is required'),
  operationalUnitId: z.string().nullable().optional(),
});
export type CanExecuteInput = z.infer<typeof CanExecuteInputSchema>;
