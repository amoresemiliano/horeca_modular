import {randomUUID} from 'node:crypto';
import * as webpush from 'web-push';
import {callerClient,deviceCookie,requestKey,rpc,secureRequest,tokenHash,trustedClient,type Request,type Response} from '../server/personnel/runtime.js';
import {pinLookup,verifyPin,UUID} from '../server/personnel/security.js';
import {pushConfiguration,validateSubscription} from '../server/personnel/push.js';
import {incidentPdf} from '../server/personnel/hrPdf.js';

export default async function handler(req:Request,res:Response){
 try{
  // Binary upload has a separate bounded size; reuse the origin/config guards.
  const config=secureRequest({...req,body:{}},res),body=req.body||{};
  if(JSON.stringify(body).length>2900000)throw Error('INVALID_INPUT');
  // Deliberately DEV-first, including the server. Promotion requires a separate review.
  if(config.url!=='https://vmxjqwlfwnphorthhcwu.supabase.co')throw Error('DENIED');
  const action=String(body.action||''),payload=(body.payload||{}) as Record<string,unknown>;
  if(typeof payload!=='object'||Array.isArray(payload)||JSON.stringify(payload).length>24000)throw Error('INVALID_INPUT');
  if(body.employee===true){
   const token=deviceCookie(req);if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('INVALID_DEVICE');
   if(!['snapshot','leave.create','leave.accept','leave.decline','leave.cancel','incident.ack'].includes(action)||typeof body.pin!=='string'||!/^\d{4}$/.test(body.pin))throw Error('PIN_REJECTED');
   const client=trustedClient(),hash=tokenHash(token);
   const device=(op:string,data={})=>rpc(client,'personnel_device_command',{p_action:op,p_token_hash:hash,p_ip_key:requestKey(req),p_body:data});
   const context=await device('org');if(context.error)throw Error('INVALID_DEVICE');
   const prepared=await device('prepare',{lookup:pinLookup(context.org,body.pin,config.pepper),requestId:randomUUID()});if(prepared.error)throw Error('PIN_REJECTED');
   const verified=await verifyPin(body.pin,prepared.hash||`scrypt:32768:8:1:${'0'.repeat(32)}:${'0'.repeat(64)}`,config.pepper);
   const result=await rpc(client,'personnel_hr_employee',{p_token_hash:hash,p_body:{...payload,action,attemptId:prepared.attemptId,verified}});
   if(result.error)throw Error(result.error);res.status(200).json(result);return;
  }
  const org=String(body.organizationId||''),unit=String(body.unitId||'');if(!UUID.test(org)||!UUID.test(unit))throw Error('INVALID_INPUT');
  const client=await callerClient(req);
  const command=(op:string,data:Record<string,unknown>={})=>rpc(client,'personnel_hr_admin',{p_org:org,p_unit:unit,p_action:op,p_body:data});
  if(action==='leave.context'){res.status(200).json(await rpc(client,'personnel_hr_leave_context',{p_org:org,p_unit:unit,p_from:payload.from,p_to:payload.to}));return;}
  if(action==='incident.pdf'){
   const item=await command('incident.document',payload);
   const author=(value:string)=>value||'Responsable de Personal';
   const lines=['HORECA Personal — Comunicación de incidencia',item.organization+' · '+item.unit,'Empleado: '+item.employee,'Fecha: '+item.date,'Tipo: '+item.type+' · Gravedad: '+item.severity,'Estado: '+item.status,'Responsable: '+author(item.author),'Descripción:',item.description,'Objetivo / acuerdo:',item.objective,'Seguimiento:',...item.entries.flatMap((e:{date:string;text:string;author:string})=>[e.date+' · '+author(e.author),e.text]),'Generado: '+new Date().toISOString(),'El acuse acredita recepción, no conformidad con el contenido.'];
   res.status(200).json({pdf:incidentPdf(lines).toString('base64')});return;
  }
  if(action==='payroll.upload'||action==='payroll.replace'){
   if(typeof body.pdf!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.pdf))throw Error('INVALID_INPUT');
   const bytes=Buffer.from(body.pdf,'base64');if(bytes.length>2097152||bytes.subarray(0,5).toString()!=='%PDF-')throw Error('INVALID_INPUT');
   const replacing=action==='payroll.replace';
   if(replacing)await command('payroll.file',{id:payload.id});
   const reserved=replacing?{id:payload.id,path:org+'/'+unit+'/'+randomUUID()+'.pdf'}:await command('payroll.reserve',payload),storage=trustedClient().storage.from('personnel-hr-payroll');
   const upload=await storage.upload(reserved.path,bytes,{contentType:'application/pdf',upsert:false});
   if(upload.error){if(!replacing)await command('payroll.failed',{id:reserved.id});throw Error('UPLOAD_FAILED');}
   try{await command(replacing?'payroll.replace':'payroll.uploaded',replacing?{id:reserved.id,revision:payload.revision,path:reserved.path,filename:payload.filename}:{id:reserved.id});}catch(e){await storage.remove([reserved.path]);throw e;}
   res.status(200).json({id:reserved.id});return;
  }
  if(action==='payroll.download'){
   const file=await command('payroll.file',payload),signed=await trustedClient().storage.from('personnel-hr-payroll').createSignedUrl(file.path,60);
   if(signed.error)throw Error('OPERATION_UNAVAILABLE');res.status(200).json({url:signed.data.signedUrl});return;
  }
  if(!['snapshot','catalog.save','incident.save','incident.entry','incident.share','payroll.review','leave.decide'].includes(action))throw Error('INVALID_INPUT');
  const result=await command(action,payload);
  if(action==='leave.decide'){
   // Outbox claim is restricted to the just-authorized leave and revalidates opt-in/device.
   const service=trustedClient();let notification='FAILED';
   try{
    const jobs:{eventId:string;subscriptionId:string;subscription:unknown}[]=await rpc(service,'personnel_hr_push',{p_action:'claim',p_body:{leaveId:result.id}});
    notification=jobs.length?'SENT':'NOT_SUBSCRIBED';
    await Promise.all(jobs.map(async job=>{let code=0;try{const sent=await webpush.sendNotification(validateSubscription(job.subscription),JSON.stringify({title:'HORECA Personal',body:'Hay una actualización sobre tu solicitud. Abre Permisos / Vacaciones para consultarla.',tag:job.eventId}),{vapidDetails:pushConfiguration(),TTL:60,timeout:8000});code=sent.statusCode;}catch(e){code=Number((e as {statusCode?:number}).statusCode)||0;notification='FAILED';}
     await rpc(service,'personnel_hr_push',{p_action:'complete',p_body:{eventId:job.eventId,subscriptionId:job.subscriptionId,httpStatus:code}});
    }));
   }catch{notification='FAILED';/* Decision is persisted; delivery failure never pretends success. */}
   res.status(200).json({...result,notification});return;
  }
  res.status(200).json(result);
 }catch(e){const code=e instanceof Error?e.message:'';const safe=['ACCESS_DENIED','DENIED','PIN_REJECTED','INVALID_DEVICE','INVALID_INPUT','STALE_REVISION','UPLOAD_FAILED','SERVER_NOT_CONFIGURED'];res.status(['ACCESS_DENIED','DENIED'].includes(code)?403:400).json({error:safe.includes(code)?code:'OPERATION_UNAVAILABLE'});}
}
