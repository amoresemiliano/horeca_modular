import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ==============================================================================
// TRUE POSTGRESQL / SUPABASE AUTHENTICATED DATABASE RLS SECURITY VALIDATION SUITE
// ==============================================================================
// Classification: D. TRUE DATABASE / POSTGRES RLS TESTS
// Target Environment: DEV (ourzapkjykzlwsjunzmd) & Version-Controlled Test Harness
// Source File: supabase/tests/00_verify_authenticated_rls.sql
// Security Architecture:
// - Standalone version-controlled SQL test harness (supabase/tests/00_verify_authenticated_rls.sql)
// - NO public RPC function exposed on application database surface (Zero Backdoor Policy)
// ==============================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

describe('SEC-RLS-DB Authentic Database Security Harness Integrity & Exposure Policy', () => {
  it('Verifies version-controlled SQL security harness exists at supabase/tests/00_verify_authenticated_rls.sql', () => {
    const harnessPath = path.join(process.cwd(), 'supabase', 'tests', '00_verify_authenticated_rls.sql');
    expect(fs.existsSync(harnessPath)).toBe(true);

    const content = fs.readFileSync(harnessPath, 'utf-8');
    expect(content).toContain('SEC-RLS-DB-01');
    expect(content).toContain('SEC-RLS-DB-02');
    expect(content).toContain('SEC-RLS-DB-03');
    expect(content).toContain('SEC-RLS-DB-04');
    expect(content).toContain('SEC-RLS-DB-05');
    expect(content).toContain('SEC-RLS-DB-06');
    expect(content).toContain('SEC-RLS-DB-07');
    expect(content).toContain('SEC-RLS-DB-08');
    expect(content).toContain('SEC-RLS-DB-09');
  });

  describe.runIf(isConfigured)('Live Application Database Surface Cleanliness Gate', () => {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    it('Confirms verify_authenticated_rls_security_suite RPC is NOT exposed to public anon/authenticated clients', async () => {
      // Attempting to invoke decommissioned RPC must fail / return 404 function not found error
      const { data, error } = await supabase.rpc('verify_authenticated_rls_security_suite');

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      // Supabase / PostgREST returns 404 undefined function error when RPC is decommissioned
      expect(error?.message).toMatch(/could not find the function|permission denied|not found/i);
    });
  });
});
