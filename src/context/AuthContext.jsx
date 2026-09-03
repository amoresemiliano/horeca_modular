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
      // Fetch profile and active membership
      const { data: profData } = await supabase
        .from('eco_user_profiles')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      if (profData) {
        setProfile(profData);
        
        // Fetch active organization membership
        const { data: memData } = await supabase
          .from('eco_organization_members')
          .select('*')
          .eq('user_profile_id', profData.id)
          .eq('is_active', true)
          .maybeSingle();

        if (memData) {
          setMembership(memData);
          setRole(memData.role || profData.role || 'SUPERADMIN');
          setOrganizationId(memData.organization_id || profData.organization_id || '59436df3-9f15-4f5e-b17e-37c55482521c');
        } else {
          // Fallback to profile role/org if membership pending
          setRole(profData.role || 'SUPERADMIN');
          setOrganizationId(profData.organization_id || '59436df3-9f15-4f5e-b17e-37c55482521c');
        }
      } else {
        // Default for initial superadmin bootstrap session
        setRole('SUPERADMIN');
        setOrganizationId('59436df3-9f15-4f5e-b17e-37c55482521c');
      }
    } catch (err) {
      console.error('Error fetching user profile/membership:', err);
      setRole('SUPERADMIN');
      setOrganizationId('59436df3-9f15-4f5e-b17e-37c55482521c');
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
