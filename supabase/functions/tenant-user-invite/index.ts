import { createClient } from 'npm:@supabase/supabase-js@2.100.0';
import { invitationOrigin } from './origins.ts';

// Secret key stays exclusively in the Edge runtime. Auth verifies the bearer token;
// database RPCs authorize both the request and the final membership transaction.
Deno.serve(async (request: Request) => {
  const origin = invitationOrigin(request.headers.get('Origin'));
  const headers = { 'Access-Control-Allow-Origin': origin || '', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Vary': 'Origin' };
  if (!origin) return new Response('Origin denied', { status: 403 });
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return new Response('Method denied', { status: 405, headers });
  const response = (body: object, status = 200) => Response.json(body, { status, headers });
  try {
    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return response({ error: 'Authentication required' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: identity, error: authError } = await caller.auth.getUser(authorization.slice(7));
    if (authError || !identity.user) return response({ error: 'Authentication required' }, 401);
    const input = await request.json();
    if (typeof input.email !== 'string' || input.email.toLowerCase().trim() === identity.user.email?.toLowerCase()) return response({ error: 'Invalid invitation recipient' }, 400);
    const { data: ticket, error: denied } = await caller.rpc('core_prepare_invitation', { requested_organization_id: input.organization_id, email: input.email, role_code: input.role });
    if (denied) return response({ error: 'Invitation not authorized or invalid' }, 403);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email.trim(), { redirectTo: origin + '/reset-password' });
    if (error || !data.user?.email) return response({ error: 'Secure invitation delivery failed. No membership was created.' }, 409);
    const { data: membership, error: completionError } = await admin.rpc('core_complete_invitation', { ticket_id: ticket, verified_auth_user_id: data.user.id, verified_email: data.user.email });
    if (completionError) return response({ error: 'Invitation sent but membership was not activated. An administrator must review the pending request.' }, 409);
    return response({ membership_id: membership, status: 'invited' });
  } catch {
    return response({ error: 'Invitation could not be processed' }, 400);
  }
});
