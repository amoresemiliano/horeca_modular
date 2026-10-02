BEGIN;
CREATE TABLE public.eco_tenant_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 actor uuid NOT NULL, email text NOT NULL, role_code text NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','COMPLETED')),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 membership_id uuid REFERENCES public.eco_organization_members(id)
);
ALTER TABLE public.eco_tenant_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_tenant_invitations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.eco_tenant_invitations TO service_role;

CREATE FUNCTION public.core_prepare_invitation(requested_organization_id uuid, email text, role_code text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ticket uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.core_platform_can('platform.tenants.provision') OR
 (public.can_execute_capability_for_org(requested_organization_id,'membership.users.invite') AND public.can_execute_capability_for_org(requested_organization_id,'membership.roles.assign')))
 THEN RAISE EXCEPTION 'Provisioning denied' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.eco_organizations WHERE id=requested_organization_id AND is_active)
 OR NOT EXISTS(SELECT 1 FROM public.eco_role_templates r WHERE r.code=role_code AND r.tier='ORGANIZATION' AND r.is_active)
 OR email IS NULL OR length(email)>254 OR email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
 -- Do not let platform administration create its own tenant data authority.
 IF lower(email)=lower(coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'email','')) THEN RAISE EXCEPTION 'Self provisioning denied' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.eco_tenant_invitations WHERE actor=auth.uid() AND created_at>now()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'Invitation rate limit'; END IF;
 INSERT INTO public.eco_tenant_invitations(organization_id,actor,email,role_code) VALUES(requested_organization_id,auth.uid(),lower(btrim(email)),role_code) RETURNING id INTO ticket;
 INSERT INTO public.eco_access_audit(actor,action,organization_id,change) VALUES(auth.uid(),'user.invitation.requested',requested_organization_id,jsonb_build_object('invitation_id',ticket,'role',role_code));
 RETURN ticket;
END; $$;

-- Only the trusted Auth Admin boundary may bind a verified Auth ID to a ticket.
-- Recheck the initiating authority at completion, including revocations during delivery.
CREATE FUNCTION public.core_complete_invitation(ticket_id uuid, verified_auth_user_id uuid, verified_email text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ticket public.eco_tenant_invitations%ROWTYPE; profile_id uuid; member_id uuid; role_id uuid;
BEGIN
 SELECT * INTO STRICT ticket FROM public.eco_tenant_invitations WHERE id=ticket_id FOR UPDATE;
 IF ticket.actor=verified_auth_user_id OR lower(verified_email) IS DISTINCT FROM ticket.email THEN RAISE EXCEPTION 'Identity mismatch' USING ERRCODE='42501'; END IF;
 IF ticket.status='COMPLETED' THEN RETURN ticket.membership_id; END IF;
 IF ticket.created_at<now()-interval '15 minutes' THEN RAISE EXCEPTION 'Invitation expired'; END IF;
 PERFORM set_config('request.jwt.claim.sub',ticket.actor::text,true);
 PERFORM 1 FROM public.eco_organizations WHERE id=ticket.organization_id AND is_active FOR UPDATE;
 IF NOT FOUND OR NOT (public.core_platform_can('platform.tenants.provision') OR
 (public.can_execute_capability_for_org(ticket.organization_id,'membership.users.invite') AND public.can_execute_capability_for_org(ticket.organization_id,'membership.roles.assign')))
 THEN RAISE EXCEPTION 'Provisioning authority revoked' USING ERRCODE='42501'; END IF;
 SELECT id INTO STRICT role_id FROM public.eco_role_templates WHERE code=ticket.role_code AND tier='ORGANIZATION' AND is_active;
 INSERT INTO public.eco_user_profiles(auth_user_id,display_name) VALUES(verified_auth_user_id,verified_email) ON CONFLICT(auth_user_id) DO NOTHING;
 SELECT id INTO STRICT profile_id FROM public.eco_user_profiles WHERE auth_user_id=verified_auth_user_id AND is_active;
 -- An invitation never silently replaces an existing membership or its access.
 INSERT INTO public.eco_organization_members(organization_id,user_id,role_template_id,role,is_organization_wide)
 VALUES(ticket.organization_id,profile_id,role_id,ticket.role_code,true) RETURNING id INTO member_id;
 UPDATE public.eco_tenant_invitations SET status='COMPLETED',membership_id=member_id,completed_at=now() WHERE id=ticket.id;
 INSERT INTO public.eco_access_audit(actor,action,organization_id,target_membership_id,change)
 VALUES(ticket.actor,'user.invitation.completed',ticket.organization_id,member_id,jsonb_build_object('invitation_id',ticket.id,'auth_user_id',verified_auth_user_id,'role',ticket.role_code,'organization_wide',true));
 RETURN member_id;
END; $$;
REVOKE ALL ON FUNCTION public.core_prepare_invitation(uuid,text,text),public.core_complete_invitation(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.core_prepare_invitation(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.core_complete_invitation(uuid,uuid,text) TO service_role;
COMMIT;
