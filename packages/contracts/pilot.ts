export type CustomerRole = 'Manager' | 'Employee';

export interface CustomerContext {
  sessionId: string;
  identityId: string;
  subject: string;
  tenantId: string;
  membershipId: string;
  membershipVersion: number;
  role: CustomerRole;
  mfaAt: Date | null;
  mfaEnrolled: boolean;
}

// Supplied only by the server's authenticated IdP adapter, never a request body.
export interface IdentityStatus {
  subject: string;
  email: string;
  verified: boolean;
  enabled: boolean;
  generation: string;
  firstName: string;
  lastName: string;
  requiredActions: string[];
  credentials: { id: string; type: string }[];
}
export type InspectIdentity = (subject: string) => Promise<IdentityStatus>;

export interface VerifiedIdentity {
  identityId: string;
  subject: string;
  email: string;
  firstName: string;
  lastName: string;
  previouslyVerified: boolean;
}
