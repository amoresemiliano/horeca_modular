import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext({
  user: null,
  profile: null,
  membership: null,
  role: null,
  organizationId: null,
  loading: true,
  loginWithGoogle: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [membership, setMembership] = useState(null);
  const [role, setRole] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [loading, setLoading] = useState(true);

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
    // 1. Initial Session Restore
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      fetchUserRoleAndProfile(currentUser).finally(() => setLoading(false));
    });

    // 2. Auth State Change Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      await fetchUserRoleAndProfile(currentUser);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) throw error;
  };

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
        loginWithGoogle,
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
