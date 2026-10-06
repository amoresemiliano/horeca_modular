export interface Database {
  public: {
    Tables: {
      eco_organizations: {
        Row: {
          id: string;
          legal_name: string;
          commercial_name: string | null;
          tax_id: string;
          country: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      eco_organization_members: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          role_template: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      eco_user_active_context: {
        Row: {
          id: string;
          user_id: string;
          active_organization_id: string;
          updated_at: string;
        };
      };
    };
  };
}
