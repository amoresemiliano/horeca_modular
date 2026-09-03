import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext({
  user: null,
  profile: null,
  membership: null,
  role: null,
  organizationId: null,
  loading: true,
  loginWithProvider: async (_provider) => {},
  loginWithGoogle: async () => {},
  loginWithGithub: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [membership, setMembership] = useState(null);
  const [role, setRole] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to safely clean OAuth tokens or auth code parameters from the browser address bar
  function cleanUrlAuthParams() {
    if (typeof window === 'undefined') return;
    const hasHashTokens = window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token='));
    const hasQueryCode = window.location.search && (window.location.search.includes('code=') || window.location.search.includes('error='));

    if (hasHashTokens || hasQueryCode) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState(null, document.title, cleanUrl);
    }
  }

  async function fetchUserRoleAndProfile(authUser) {
    if (!authUser) {
      setProfile(null);
      setMembership(null);
      setRole(null);
      setOrganizationId(null);
      return;
    }

    try {
      // 1. Fetch active global user profile matching auth_user_id
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
        return;
      }

      setProfile(profData);

      // 2. Fetch active organization membership for this profile
      const { data: memData, error: memErr } = await supabase
        .from('eco_organization_members')
        .select('*')
        .eq('user_profile_id', profData.id)
        .eq('is_active', true)
        .maybeSingle();

      if (memErr || !memData) {
        console.warn('FAIL-CLOSED: No active organization membership found for profile_id:', profData.id);
        setMembership(null);
        setRole(null);
        setOrganizationId(null);
        return;
      }

      // FAIL-CLOSED: Role and organizationId are strictly derived from validated DB membership
      setMembership(memData);
      setRole(memData.role || null);
      setOrganizationId(memData.organization_id || null);
    } catch (err) {
      console.error('FAIL-CLOSED: Exception fetching user profile/membership:', err);
      setProfile(null);
      setMembership(null);
      setRole(null);
      setOrganizationId(null);
    }
  }

  useEffect(() => {
    let isMounted = true;

    // 1. Subscribe to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        await fetchUserRoleAndProfile(currentUser);
        cleanUrlAuthParams();
      } else {
        setProfile(null);
        setMembership(null);
        setRole(null);
        setOrganizationId(null);
      }

      if (isMounted) setLoading(false);
    });

    // 2. Fallback Initial Session Check (in case onAuthStateChange didn't fire immediately)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      const currentUser = session?.user || null;
      if (currentUser && !user) {
        setUser(currentUser);
        await fetchUserRoleAndProfile(currentUser);
        cleanUrlAuthParams();
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loginWithProvider = async (providerName) => {
    if (providerName !== 'google' && providerName !== 'github') {
      throw new Error(`Unsupported OAuth provider: ${providerName}`);
    }

    const options = {
      redirectTo: window.location.origin,
    };

    if (providerName === 'google') {
      options.queryParams = {
        prompt: 'select_account',
      };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: providerName,
      options,
    });

    if (error) {
      if (error.message.includes('not enabled') || error.status === 400) {
        throw new Error(`El proveedor ${providerName === 'google' ? 'Google' : 'GitHub'} no está habilitado en el proyecto Supabase Staging. Por favor, usá Google o contactá al administrador.`);
      }
      throw error;
    }
  };

  const loginWithGoogle = async () => loginWithProvider('google');
  const loginWithGithub = async () => loginWithProvider('github');

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setMembership(null);
    setRole(null);
    setOrganizationId(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        membership,
        role,
        organizationId,
        loading,
        loginWithProvider,
        loginWithGoogle,
        loginWithGithub,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
