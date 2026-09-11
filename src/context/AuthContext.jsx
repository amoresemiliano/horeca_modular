import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext({
  user: null,
  profile: null,
  membership: null,
  role: null,
  organizationId: null,
  loading: true,
  isPasswordRecovery: false,
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
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

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

      // 2. Fetch active organization memberships for this profile
      const { data: memList, error: memErr } = await supabase
        .from('eco_organization_members')
        .select('*')
        .eq('user_profile_id', profData.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (memErr || !memList || memList.length === 0) {
        console.warn('FAIL-CLOSED: No active organization membership found for profile_id:', profData.id);
        setMembership(null);
        setRole(null);
        setOrganizationId(null);
        return;
      }

      // Prioritize SUPERADMIN or ADMIN if multiple memberships exist
      const activeMem = memList.find((m) => m.role === 'SUPERADMIN') || memList.find((m) => m.role === 'ADMIN') || memList[0];

      // FAIL-CLOSED: Role and organizationId are strictly derived from validated DB membership
      setMembership(activeMem);
      setRole(activeMem.role || null);
      setOrganizationId(activeMem.organization_id || null);
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

    // Check if current URL indicates a password recovery callback
    if (typeof window !== 'undefined') {
      const isRecovery = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
      if (isRecovery) {
        setIsPasswordRecovery(true);
      }
    }

    // Safety timeout to ensure app shell is never stuck indefinitely in loading state
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 2500);

    // 1. Subscribe to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }

      const currentUser = session?.user || null;
      setUser(currentUser);

      try {
        if (currentUser) {
          await fetchUserRoleAndProfile(currentUser);
          cleanUrlAuthParams();
        } else {
          setProfile(null);
          setMembership(null);
          setRole(null);
          setOrganizationId(null);
        }
      } catch (err) {
        console.error('Error handling auth state change:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    // 2. Fallback Initial Session Check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      const currentUser = session?.user || null;
      try {
        if (currentUser && !user) {
          setUser(currentUser);
          await fetchUserRoleAndProfile(currentUser);
          cleanUrlAuthParams();
        }
      } catch (err) {
        console.error('Error in initial getSession:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }).catch(err => {
      console.warn('getSession error:', err);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
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

  const loginWithPassword = async (email, password) => {
    if (!email || !password) {
      throw new Error('Email y contraseña son requeridos.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data?.user) {
      setUser(data.user);
      await fetchUserRoleAndProfile(data.user);
    }
  };

  const requestPasswordReset = async (email) => {
    if (!email) throw new Error('Ingresá tu email.');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) throw error;
  };

  const updatePassword = async (newPassword) => {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }

    const { data, error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) throw error;

    setIsPasswordRecovery(false);
    return data;
  };

  const logout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error during signOut:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setMembership(null);
      setRole(null);
      setOrganizationId(null);
      setIsPasswordRecovery(false);
      setLoading(false);
    }
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
        isPasswordRecovery,
        loginWithProvider,
        loginWithGoogle,
        loginWithGithub,
        loginWithPassword,
        requestPasswordReset,
        updatePassword,
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
