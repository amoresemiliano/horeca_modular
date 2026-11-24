import {BankStatementImportService} from './BankStatementImportService';
import type {ImportPreviewDTO} from '../domain/types';
export interface BatchFile {id:string;file:File;preview?:ImportPreviewDTO;error?:string;accountId:string;rejectionsAcknowledged?:boolean;duplicateInBatch?:boolean;overlapsInBatch?:number}
export async function analyzeBankFiles(files:File[],org:string,service:BankStatementImportService):Promise<BatchFile[]> {
 if(!org||!files.length||files.length>50||files.reduce((n,f)=>n+f.size,0)>100*1024*1024)throw Error('Selecciona entre 1 y 50 archivos, hasta 100 MB por lote.');
 const results:BatchFile[]=[],hashes=new Set<string>(),fingerprints=new Set<string>();
 for(const file of files){const item:BatchFile={id:crypto.randomUUID(),file,accountId:''};
  try{if(file.size>20*1024*1024)throw Error('El archivo supera 20 MB. Divide el extracto antes de cargarlo.');
   const p=await service.generateImportPreview(await file.arrayBuffer(),file.name,org);item.preview=p;item.accountId=p.resolvedAccountId||'';item.duplicateInBatch=hashes.has(p.fileHash);hashes.add(p.fileHash);item.overlapsInBatch=p.movements.filter(m=>m.fingerprint&&fingerprints.has(m.fingerprint)).length;p.movements.forEach(m=>{if(m.fingerprint)fingerprints.add(m.fingerprint);});
  }catch(e){item.error=e instanceof Error?e.message:'No se pudo analizar el archivo.';}results.push(item);
 }return annotateBatch(results);
}
export function annotateBatch(items:BatchFile[]):BatchFile[]{
 const hashes=new Set<string>(),fingerprints=new Set<string>();
 return items.map(item=>{const p=item.preview;if(!p)return item;
  const duplicateInBatch=hashes.has(p.fileHash);hashes.add(p.fileHash);
  const overlapsInBatch=p.movements.filter(m=>m.fingerprint&&fingerprints.has(m.fingerprint)).length;
  p.movements.forEach(m=>{if(m.fingerprint)fingerprints.add(m.fingerprint);});
  return {...item,duplicateInBatch,overlapsInBatch};
 });
}
export const batchBlocker=(item:BatchFile)=>item.error||(!item.preview?.totalMovements?'Sin movimientos válidos':!item.accountId?'Selecciona una cuenta de destino':item.preview.rejectedRows.length&&!item.rejectionsAcknowledged?'Confirma que has revisado las filas rechazadas.':'');
export async function confirmBankBatch(items:BatchFile[],org:string,service:BankStatementImportService){
 if(!items.length||items.some(batchBlocker))throw Error('Resuelve todos los archivos antes de confirmar el lote.');
 const results=[];let stopped=false;
 for(const item of items){
  if(stopped){results.push({id:item.id,fileName:item.file.name,status:'NOT_PROCESSED',imported:0,overlaps:0,rejected:item.preview!.rejectedRows.length});continue;}
  try{const r=await service.confirmBankImport(item.preview!,item.accountId,org);results.push({id:item.id,fileName:item.file.name,status:r.persistedCount===0?'ALREADY_IMPORTED':'IMPORTED',imported:r.persistedCount,overlaps:r.potentialOverlapCount,rejected:item.preview!.rejectedRows.length});}
  catch(e){stopped=true;results.push({id:item.id,fileName:item.file.name,status:'FAILED',imported:0,overlaps:0,rejected:item.preview!.rejectedRows.length,error:e instanceof Error?e.message:'Error de confirmación'});}
 }
 return {results,processed:results.filter(r=>!['FAILED','NOT_PROCESSED'].includes(r.status)).length,alreadyImported:results.filter(r=>r.status==='ALREADY_IMPORTED').length,imported:results.reduce((n,r)=>n+r.imported,0),overlaps:results.reduce((n,r)=>n+r.overlaps,0),rejected:results.reduce((n,r)=>n+r.rejected,0),intervention:results.filter(r=>['FAILED','NOT_PROCESSED'].includes(r.status)).length};
}
