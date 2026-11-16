import {useState} from 'react';
import {Mail,Share2,Download,MessageCircle} from 'lucide-react';
import {Modal} from '../../personal/ui';
import {payrollFile,payrollShareIntent,savePayrollFile} from './payrollDelivery';
export default function PayrollShare({record,employee,command,close,onInitiated}){
 const [file,setFile]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function prepare(){setBusy(true);setError('');try{setFile(await payrollFile(command,record));}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function share(channel){setError('');setNotice('');try{
  const url=channel==='NATIVE_SHARE'?null:payrollShareIntent(channel,employee);
  if(channel==='NATIVE_SHARE'&&!navigator.canShare?.({files:[file]}))throw Error('Este navegador no admite compartir archivos. Descarga el PDF y adjúntalo desde tu aplicación.');
  await command('payroll.delivery.initiate',{id:record.id,channel});onInitiated?.();
  if(channel==='NATIVE_SHARE'){await navigator.share({files:[file],title:'Documento de Personal'});setNotice('Acción de compartir iniciada. No se acredita entrega ni recepción.');}
  else{savePayrollFile(file);if(channel==='EMAIL')location.href=url;else window.open(url,'_blank','noopener,noreferrer');setNotice('PDF descargado. Adjunta el archivo en tu aplicación y comprueba el destinatario. Solo se ha registrado la iniciación.');}
 }catch(e){setError(e.name==='AbortError'?'Acción cancelada. El historial conserva únicamente la iniciación.':e.message);}}
 return <Modal title="Enviar nómina" onClose={close} className="hr-detail-modal"><div className="per-form"><p><strong>{employee?.name||'Empleado'}</strong> · {record.period}</p><p>Email de contacto: {employee?.email||'No configurado'}</p><p>Teléfono de contacto: {employee?.phone||'No configurado'}</p><p>Correo directo de administración pendiente de verificación. No se suplanta ningún remitente. Usa tu aplicación de correo o comparte el archivo; comprueba siempre el destinatario.</p>{!file?<button className="per-primary" disabled={busy} onClick={prepare}>Preparar PDF privado</button>:<><p>PDF preparado en memoria. No se comparte ningún enlace público ni firmado.</p><div className="hr-action-row"><button title="Compartir archivo" onClick={()=>share('NATIVE_SHARE')}><Share2 size={17} /> Compartir archivo</button><button title="Enviar por Email" onClick={()=>share('EMAIL')}><Mail size={17} /> Email</button><button title="Enviar por WhatsApp" onClick={()=>share('WHATSAPP')}><MessageCircle size={17} /> WhatsApp</button><button title="Descargar archivo" onClick={()=>savePayrollFile(file)}><Download size={17} /> Descargar</button></div><small>Email y WhatsApp descargan el original y abren tu aplicación. Debes adjuntarlo y enviarlo allí.</small></>}{error&&<p role="alert" className="per-error">{error}</p>}{notice&&<p role="status">{notice}</p>}</div></Modal>;
}
