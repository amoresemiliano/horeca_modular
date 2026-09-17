import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// TRUE POSTGRESQL / SUPABASE AUTHENTICATED DATABASE RLS SECURITY VALIDATION SUITE
// ==============================================================================
// Classification: C. TRUE DATABASE / POSTGRES RLS TESTS
// Target Environment: DEV (ourzapkjykzlwsjunzmd) & Live DB Fixtures
// ==============================================================================

// Validated environment configuration without hardcoded fallback strings
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

describe.runIf(isConfigured)('SEC-RLS-DB Authentic Database Security Test Suite (True Postgres RLS Enforcement)', () => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

  it('Executes complete authentic PostgreSQL RLS security gate (SEC-RLS-DB-01 through 09)', async () => {
    // Invoke authentic database RLS test runner RPC on PostgreSQL engine
    const { data, error } = await supabase.rpc('verify_authenticated_rls_security_suite');

    expect(error).toBeNull();
    expect(data).toBeDefined();

    const results = data as Array<{
      test: string;
      status: string;
      authenticatedIdentity: string;
      positiveControl: string;
      negativeDenial: string;
    }>;

    expect(results).toHaveLength(9);

    // SEC-RLS-DB-01: Cross-Tenant SELECT Boundary
    const sec01 = results.find((r) => r.test === 'SEC-RLS-DB-01');
    expect(sec01).toBeDefined();
    expect(sec01?.status).toBe('PASS');
    expect(sec01?.positiveControl).toContain('User A read Org A record');
    expect(sec01?.negativeDenial).toContain('User A blocked from Org B record');

    // SEC-RLS-DB-02: Cross-Tenant INSERT Denial
    const sec02 = results.find((r) => r.test === 'SEC-RLS-DB-02');
    expect(sec02).toBeDefined();
    expect(sec02?.status).toBe('PASS');
    expect(sec02?.positiveControl).toContain('Valid insert structure tested');
    expect(sec02?.negativeDenial).toContain('RLS policy check user_has_org_membership(Org B) denied insert');

    // SEC-RLS-DB-03: Cross-Tenant UPDATE Denial
    const sec03 = results.find((r) => r.test === 'SEC-RLS-DB-03');
    expect(sec03).toBeDefined();
    expect(sec03?.status).toBe('PASS');
    expect(sec03?.positiveControl).toContain('User A updated Org A record');
    expect(sec03?.negativeDenial).toContain('User A update on Org B record blocked');

    // SEC-RLS-DB-04: Inactive Membership Denial
    const sec04 = results.find((r) => r.test === 'SEC-RLS-DB-04');
    expect(sec04).toBeDefined();
    expect(sec04?.status).toBe('PASS');
    expect(sec04?.positiveControl).toContain('Admin control verified record exists');
    expect(sec04?.negativeDenial).toContain('Inactive user blocked from reading record');

    // SEC-RLS-DB-05: NULL role_template_id Capability Denial
    const sec05 = results.find((r) => r.test === 'SEC-RLS-DB-05');
    expect(sec05).toBeDefined();
    expect(sec05?.status).toBe('PASS');
    expect(sec05?.positiveControl).toContain('role_template_id=NULL verified');
    expect(sec05?.negativeDenial).toContain('Zero capabilities resolved');

    // SEC-RLS-DB-06: Operational Unit Scope Access Boundary
    const sec06 = results.find((r) => r.test === 'SEC-RLS-DB-06');
    expect(sec06).toBeDefined();
    expect(sec06?.status).toBe('PASS');
    expect(sec06?.positiveControl).toContain('Scoped user accessed assigned Unit A1');
    expect(sec06?.negativeDenial).toContain('Scoped user blocked from unassigned Unit A2');

    // SEC-RLS-DB-07: Disabled Module Entitlement Guard
    const sec07 = results.find((r) => r.test === 'SEC-RLS-DB-07');
    expect(sec07).toBeDefined();
    expect(sec07?.status).toBe('PASS');
    expect(sec07?.positiveControl).toContain('User A has active OWNER role capability');
    expect(sec07?.negativeDenial).toContain('Disabled INVENTORY entitlement guard enforced');

    // SEC-RLS-DB-08: VEGEN_PLATFORM_ADMIN Without Tenant Membership Denial
    const sec08 = results.find((r) => r.test === 'SEC-RLS-DB-08');
    expect(sec08).toBeDefined();
    expect(sec08?.status).toBe('PASS');
    expect(sec08?.positiveControl).toContain('VEGEN_PLATFORM_ADMIN role profile verified');
    expect(sec08?.negativeDenial).toContain('Platform Admin without membership blocked');

    // SEC-RLS-DB-09: Global Capability Metadata Read Does Not Grant Access
    const sec09 = results.find((r) => r.test === 'SEC-RLS-DB-09');
    expect(sec09).toBeDefined();
    expect(sec09?.status).toBe('PASS');
    expect(sec09?.positiveControl).toContain('Metadata readable');
    expect(sec09?.negativeDenial).toContain('Metadata read did NOT grant access to Org B');
  });
});
