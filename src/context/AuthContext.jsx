import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { moduleEnabled, resolveAuthorizedCapabilities, selectOrganization } from './tenantContext.js';

const AuthContext = createContext({
  user: null,
  profile: null,
  membership: null,
  role: null,
  organizationId: null,
  availableOrganizations: [],
  activeOrganization: null,
  activeOperationalUnit: null,
  effectiveCapabilities: [],
  loading: true,
  isPasswordRecovery: false,
  switchOrganization: async (_orgId) => {},
  switchOperationalUnit: async (_unitId) => {},
  can: (_capabilityCode, _unitId) => false,
  isModuleEnabled: (_moduleKey) => false,
  loginWithProvider: async (_provider) => {},
  loginWithGoogle: async () => {},
  loginWithGithub: async () => {},
  loginWithPassword: async (_email, _password) => {},
  requestPasswordReset: async (_email) => {},
  updatePassword: async (_newPassword) => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [membership, setMembership] = useState(null);
  const [role, setRole] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [activeOrganization, setActiveOrganization] = useState(null);
  const [activeOperationalUnit, setActiveOperationalUnit] = useState(null);
  const [effectiveCapabilities, setEffectiveCapabilities] = useState([]);
  const [entitlements, setEntitlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const selectedContext = useRef({ userId: null, organizationId: null, unitId: null });
  const contextRequest = useRef(0);

  function cleanUrlAuthParams() {
    if (typeof window === 'undefined') return;
    const hasHashTokens = window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token='));
    const hasQueryCode = window.location.search && (window.location.search.includes('code=') || window.location.search.includes('error='));

    if (hasHashTokens || hasQueryCode) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState(null, document.title, cleanUrl);
    }
  }

  const resolveFullContext = useCallback(async (authUser, targetOrgId = null, targetUnitId = null) => {
    const request = ++contextRequest.current;
    // Clear authority before resolving another identity, organization or scope.
    setProfile(null);
    setAvailableOrganizations([]);
    setMembership(null);
    setRole(null);
    setOrganizationId(null);
    setActiveOrganization(null);
    setActiveOperationalUnit(null);
    setEffectiveCapabilities([]);
    setEntitlements([]);
    if (!authUser) {
      setProfile(null);
      setMembership(null);
      setRole(null);
      setOrganizationId(null);
      setAvailableOrganizations([]);
      setActiveOrganization(null);
      setActiveOperationalUnit(null);
      setEffectiveCapabilities([]);
      setEntitlements([]);
      return;
    }

    try {
      // 1. Fetch user profile
      const { data: profData, error: profErr } = await supabase
        .from('eco_user_profiles')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .eq('is_active', true)
        .maybeSingle();
      if (request !== contextRequest.current) return;

      if (profErr || !profData) {
        console.warn('FAIL-CLOSED: No active user profile found for auth_user_id:', authUser.id);
        setProfile(null);
        setMembership(null);
        setRole(null);
        setOrganizationId(null);
        setAvailableOrganizations([]);
        setActiveOrganization(null);
        setEffectiveCapabilities([]);
        return;
      }

      setProfile(profData);

      // 2. Fetch memberships
      let query = supabase
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
          eco_organizations (
            id,
            name,
            legal_name,
            tax_id,
            tax_id_type,
            trade_name,
            is_active
          )
        `)
        .eq('is_active', true);

      // Support both user_id and user_profile_id columns
      query = query.or(`user_id.eq.${profData.id},user_profile_id.eq.${profData.id}`);

      const { data: memList, error: memErr } = await query;
      if (request !== contextRequest.current) return;

      if (memErr || !memList || memList.length === 0) {
        console.warn('FAIL-CLOSED: No active organization membership found for profile:', profData.id);
        setMembership(null);
        setRole(null);
        setOrganizationId(null);
        setAvailableOrganizations([]);
        setActiveOrganization(null);
        setEffectiveCapabilities([]);
        return;
      }

      // Build available organizations
      const orgs = [];
      for (const m of memList) {
        const o = m.eco_organizations;
        if (o && o.is_active === true) {
          if (!orgs.some((existing) => existing.id === o.id)) {
            orgs.push({
              id: o.id,
              name: o.name || o.legal_name || 'Organization',
              legalName: o.legal_name,
              taxId: o.tax_id,
              tradeName: o.trade_name,
              membershipId: m.id,
              role: m.role,
              roleTemplateId: m.role_template_id,
            });
          }
        }
      }
      setAvailableOrganizations(orgs);

      // Select active organization
      const previous = selectedContext.current.userId === authUser.id ? selectedContext.current : {};
      const selectedOrg = selectOrganization(orgs, targetOrgId, previous.organizationId);
      const activeMem = selectedOrg ? memList.find((m) => m.organization_id === selectedOrg.id) : null;
      const unitId = targetOrgId ? targetUnitId : previous.unitId || null;

      if (activeMem) {
        const orgInfo = orgs.find((o) => o.id === activeMem.organization_id);

        // Fetch capabilities for active membership
        let caps = [];
        if (activeMem.role_template_id) {
          const { data: capData, error: capError } = await supabase
            .from('eco_role_template_capabilities')
            .select('eco_capabilities(code)')
            .eq('role_template_id', activeMem.role_template_id);
          if (capError) throw capError;
          if (capData) {
            caps = capData.map((c) => c.eco_capabilities?.code).filter(Boolean);
          }
        }

        // Fetch overrides
        const { data: overrides, error: overrideError } = await supabase
          .from('eco_member_capability_overrides')
          .select('capability_id, effect, operational_unit_id, eco_capabilities(code)')
          .eq('membership_id', activeMem.id);
        if (overrideError) throw overrideError;

        if (overrides && overrides.length > 0) {
          const capSet = new Set(caps);
          for (const ov of overrides) {
            const code = ov.eco_capabilities?.code;
            if (code) {
              if (ov.effect === 'GRANT') capSet.add(code);
            }
          }
          caps = Array.from(capSet);
        }

        // Fetch entitlements
        const { data: entData, error: entitlementError } = await supabase
          .from('eco_organization_module_entitlements')
          .select('*')
          .eq('organization_id', activeMem.organization_id);
        if (entitlementError) throw entitlementError;

        // The canonical gate resolves role activity, scope, revoke precedence and
        // required entitlements. Candidate codes alone never confer authority.
        const decisions = await resolveAuthorizedCapabilities(supabase, activeMem.organization_id, caps, unitId);
        if (request !== contextRequest.current) return;
        selectedContext.current = { userId: authUser.id, organizationId: activeMem.organization_id, unitId };
        setMembership(activeMem);
        setRole(activeMem.role || null);
        setOrganizationId(activeMem.organization_id);
        setActiveOrganization(orgInfo);
        setActiveOperationalUnit(unitId ? { id: unitId } : null);
        setEffectiveCapabilities(decisions);

        setEntitlements(entData || []);
      }
    } catch (err) {
      if (request !== contextRequest.current) return;
      console.error('FAIL-CLOSED: Exception resolving user context:', err);
      setProfile(null);
      setMembership(null);
      setRole(null);
      setOrganizationId(null);
      setAvailableOrganizations([]);
      setActiveOrganization(null);
      setEffectiveCapabilities([]);
      setEntitlements([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const requestCounter = contextRequest;
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 4000);

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          setUser(session.user);
          await resolveFullContext(session.user);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (mounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      }
    }

    initAuth();

    // Resolve outside the Auth callback: network requests need the session lock
    // released by Supabase before they can obtain their access token.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setTimeout(async () => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        await resolveFullContext(session.user);
        cleanUrlAuthParams();
      } else {
        ++contextRequest.current;
        selectedContext.current = { userId: null, organizationId: null, unitId: null };
        setUser(null);
        setProfile(null);
        setMembership(null);
        setRole(null);
        setOrganizationId(null);
        setAvailableOrganizations([]);
        setActiveOrganization(null);
        setActiveOperationalUnit(null);
        setEffectiveCapabilities([]);
        setEntitlements([]);
      }
      setLoading(false);
      }, 0);
    });

    return () => {
      mounted = false;
      ++requestCounter.current;
      clearTimeout(safetyTimer);
      subscription?.unsubscribe();
    };
  }, [resolveFullContext]);

  const switchOrganization = async (targetOrgId) => {
    if (!user) return;
    setLoading(true);
    try {
      await resolveFullContext(user, targetOrgId);
    } finally {
      setLoading(false);
    }
  };

  const switchOperationalUnit = async (targetUnitId) => {
    if (!user || !organizationId) return;
    setLoading(true);
    try {
      await resolveFullContext(user, organizationId, targetUnitId);
    } finally {
      setLoading(false);
    }
  };

  const can = (capabilityCode, unitId = null) => {
    if (!organizationId || unitId !== (activeOperationalUnit?.id || null)) return false;
    if (!effectiveCapabilities || effectiveCapabilities.length === 0) return false;
    return effectiveCapabilities.includes(capabilityCode);
  };

  const isModuleEnabled = (moduleKey) => {
    return moduleEnabled(organizationId, entitlements, moduleKey);
  };

  const loginWithPassword = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const loginWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return data;
  };

  const loginWithGithub = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return data;
  };

  const loginWithProvider = async (provider) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return data;
  };

  const requestPasswordReset = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return data;
  };

  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setIsPasswordRecovery(false);
    return data;
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      ++contextRequest.current;
      selectedContext.current = { userId: null, organizationId: null, unitId: null };
      setUser(null);
      setProfile(null);
      setMembership(null);
      setRole(null);
      setOrganizationId(null);
      setAvailableOrganizations([]);
      setActiveOrganization(null);
      setActiveOperationalUnit(null);
      setEffectiveCapabilities([]);
      setEntitlements([]);
      setLoading(false);
    }
  };

  const value = {
    user,
    profile,
    membership,
    role,
    organizationId,
    availableOrganizations,
    activeOrganization,
    activeOperationalUnit,
    effectiveCapabilities,
    loading,
    isPasswordRecovery,
    switchOrganization,
    switchOperationalUnit,
    can,
    isModuleEnabled,
    loginWithProvider,
    loginWithGoogle,
    loginWithGithub,
    loginWithPassword,
    requestPasswordReset,
    updatePassword,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
