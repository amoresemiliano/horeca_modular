import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

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
  isModuleEnabled: (_moduleKey) => true,
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

  function cleanUrlAuthParams() {
    if (typeof window === 'undefined') return;
    const hasHashTokens = window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token='));
    const hasQueryCode = window.location.search && (window.location.search.includes('code=') || window.location.search.includes('error='));

    if (hasHashTokens || hasQueryCode) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState(null, document.title, cleanUrl);
    }
  }

  const resolveFullContext = useCallback(async (authUser, targetOrgId = null) => {
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
            holding_id,
            is_active
          )
        `)
        .eq('is_active', true);

      // Support both user_id and user_profile_id columns
      query = query.or(`user_id.eq.${profData.id},user_profile_id.eq.${profData.id}`);

      const { data: memList, error: memErr } = await query;

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
        if (o && o.is_active !== false) {
          if (!orgs.some((existing) => existing.id === o.id)) {
            orgs.push({
              id: o.id,
              name: o.name || o.legal_name || 'Organization',
              legalName: o.legal_name,
              taxId: o.tax_id,
              tradeName: o.trade_name,
              holdingId: o.holding_id,
              membershipId: m.id,
              role: m.role,
              roleTemplateId: m.role_template_id,
            });
          }
        }
      }
      setAvailableOrganizations(orgs);

      // Select active organization
      let activeMem = null;
      if (targetOrgId) {
        activeMem = memList.find((m) => m.organization_id === targetOrgId);
      }
      if (!activeMem) {
        activeMem = memList.find((m) => m.role === 'SUPERADMIN' || m.role === 'OWNER') || memList[0];
      }

      if (activeMem) {
        setMembership(activeMem);
        setRole(activeMem.role || null);
        setOrganizationId(activeMem.organization_id);
        const orgInfo = orgs.find((o) => o.id === activeMem.organization_id);
        setActiveOrganization(orgInfo || null);

        // Fetch capabilities for active membership
        let caps = [];
        if (activeMem.role_template_id) {
          const { data: capData } = await supabase
            .from('eco_role_template_capabilities')
            .select('eco_capabilities(code)')
            .eq('role_template_id', activeMem.role_template_id);
          if (capData) {
            caps = capData.map((c) => c.eco_capabilities?.code).filter(Boolean);
          }
        } else if (activeMem.role === 'SUPERADMIN') {
          const { data: allCaps } = await supabase.from('eco_capabilities').select('code');
          if (allCaps) caps = allCaps.map((c) => c.code);
        }

        // Fetch overrides
        const { data: overrides } = await supabase
          .from('eco_member_capability_overrides')
          .select('capability_id, effect, operational_unit_id, eco_capabilities(code)')
          .eq('membership_id', activeMem.id);

        if (overrides && overrides.length > 0) {
          const capSet = new Set(caps);
          for (const ov of overrides) {
            const code = ov.eco_capabilities?.code;
            if (code) {
              if (ov.effect === 'GRANT') capSet.add(code);
              if (ov.effect === 'REVOKE') capSet.delete(code);
            }
          }
          caps = Array.from(capSet);
        }

        setEffectiveCapabilities(caps);

        // Fetch entitlements
        const { data: entData } = await supabase
          .from('eco_organization_module_entitlements')
          .select('*')
          .eq('organization_id', activeMem.organization_id);

        setEntitlements(entData || []);
      }
    } catch (err) {
      console.error('FAIL-CLOSED: Exception resolving user context:', err);
      setProfile(null);
      setMembership(null);
      setRole(null);
      setOrganizationId(null);
      setAvailableOrganizations([]);
      setActiveOrganization(null);
      setEffectiveCapabilities([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      if (session?.user) {
        setUser(session.user);
        await resolveFullContext(session.user);
        cleanUrlAuthParams();
      } else {
        setUser(null);
        setProfile(null);
        setMembership(null);
        setRole(null);
        setOrganizationId(null);
        setAvailableOrganizations([]);
        setActiveOrganization(null);
        setActiveOperationalUnit(null);
        setEffectiveCapabilities([]);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
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
    setActiveOperationalUnit(targetUnitId ? { id: targetUnitId } : null);
  };

  const can = (capabilityCode, _unitId = null) => {
    if (!effectiveCapabilities || effectiveCapabilities.length === 0) return false;
    return effectiveCapabilities.includes(capabilityCode);
  };

  const isModuleEnabled = (moduleKey) => {
    if (!entitlements || entitlements.length === 0) return true; // Transitional default
    const matched = entitlements.find((e) => e.module_key.toLowerCase() === moduleKey.toLowerCase());
    return matched ? matched.is_enabled : true;
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
      setUser(null);
      setProfile(null);
      setMembership(null);
      setRole(null);
      setOrganizationId(null);
      setAvailableOrganizations([]);
      setActiveOrganization(null);
      setActiveOperationalUnit(null);
      setEffectiveCapabilities([]);
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
