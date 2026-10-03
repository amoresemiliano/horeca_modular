import { getSupabaseClient } from '../supabase/client';

export async function salesOperation(input: Record<string, unknown>) {
  const {data,error} = await getSupabaseClient().auth.getSession();
  if (error || !data.session) throw new Error('Sesión no disponible para la operación de ventas.');
  const response = await fetch('/api/sales',{method:'POST',headers:{'Content-Type':'application/json',
    Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(input)});
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error('La operación de ventas no está disponible. Revisa la configuración y los permisos.');
  return result;
}
