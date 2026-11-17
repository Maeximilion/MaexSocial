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

// Server-supplied authority only. This delivery supplies it exclusively in isolated
// tests; #131 must establish real IdP/MFA provenance before any public login opens.
export interface IdentityStatus {
  subject: string;
  verified: boolean;
  enabled: boolean;
  requiredActions: string[];
  credentials: { id: string; type: string }[];
}
export type InspectIdentity = (subject: string) => Promise<IdentityStatus>;
