export async function payrollFile(command,record){
 const signed=await command('payroll.download',{id:record.id});
 const url=new URL(signed.url);
 if(url.protocol!=='https:'||url.hostname!=='vmxjqwlfwnphorthhcwu.supabase.co'||!url.pathname.startsWith('/storage/v1/object/sign/personnel-hr-payroll/'))throw Error('Acceso al PDF no válido.');
 const response=await fetch(url.href,{cache:'no-store',referrerPolicy:'no-referrer'});
 if(!response.ok)throw Error('No se pudo descargar el PDF. Actualiza y vuelve a intentarlo.');
 const blob=await response.blob();return new File([blob],record.filename||'nomina.pdf',{type:'application/pdf'});
}
export function savePayrollFile(file){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// Only a neutral attachment instruction is placed in URL parameters. Never a PDF URL or payroll data.
export function payrollShareIntent(channel,employee){
 const text='Te envío el documento de Personal como archivo adjunto por el canal acordado.';
 if(channel==='EMAIL'){
  if(!employee?.email)throw Error('No hay email de contacto. Puedes compartir el archivo desde tu dispositivo.');
  return 'mailto:'+encodeURIComponent(employee.email)+'?subject='+encodeURIComponent('Documento de Personal')+'&body='+encodeURIComponent(text);
 }
 if(channel==='WHATSAPP'){
  const phone=(employee?.phone||'').replace(/\D/g,'');if(!phone)throw Error('No hay teléfono de contacto. Puedes compartir el archivo desde tu dispositivo.');
  return 'https://wa.me/'+phone+'?text='+encodeURIComponent(text);
 }
 throw Error('Canal no disponible.');
}
