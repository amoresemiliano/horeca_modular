import { EntityId } from '../shared/types';

export interface UserIdentity {
  readonly id: EntityId;
  readonly email: string;
  readonly fullName?: string;
  readonly isActive: boolean;
}

export interface AuthSession {
  readonly user: UserIdentity;
  readonly token: string;
  readonly expiresAt: number;
}
