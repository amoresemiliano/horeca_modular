import {supabase} from '../../../lib/supabase';
export async function hrRequest(organizationId,unitId,action,payload={},extra={}){
 const {data}=await supabase.auth.getSession();
 const response=await fetch('/api/personnel-hr',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',...(data.session?{Authorization:`Bearer ${data.session.access_token}`}:{})},body:JSON.stringify({organizationId,unitId,action,payload,...extra})});
 const result=await response.json();
 if(!response.ok||result.error)throw Error(({STALE_REVISION:'El registro ha cambiado. Actualiza antes de guardar.',PIN_REJECTED:'No se pudo validar el PIN. Compruébalo o espera un minuto.',INVALID_DEVICE:'Dispositivo no disponible. Solicita activación.',ACCESS_DENIED:'No tienes autorización.',INVALID_INPUT:'Revisa los datos y las fechas.',UPLOAD_FAILED:'No se pudo subir el PDF. El intento figura como error.'})[result.error]||'No se pudo completar la operación. Comprueba si el periodo ya tiene una nómina.');
 return result;
}
export function downloadPdf(base64){const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download='comunicacion-incidencia.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export {hrEnabled,labels,payrollFields} from './shared';
