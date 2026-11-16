// Small text-only PDF writer. No remote renderer, HTML execution or external processor.
// WinAnsi covers the Spanish communication text; other characters are replaced visibly.
export function incidentPdf(lines: string[]): Buffer {
 const wrapped = lines.flatMap(line => {
  const text = line.replace(/[\r\n]/g, ' ').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
  return text.match(/.{1,88}(?:\s|$)|.{1,88}/g) || [''];
 });
 const pages: string[][] = [];for(let i=0;i<wrapped.length;i+=46)pages.push(wrapped.slice(i,i+46));
 const objects: string[]=['','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
 const ids:number[]=[];
 for(const page of pages){const id=objects.length+1;ids.push(id);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id+1} 0 R >>`);const content='BT /F1 11 Tf 42 800 Td 16 TL '+page.map((l,i)=>(i?'T* ':'')+'('+l.replace(/([\\()])/g,'\\$1')+') Tj').join('\n')+' ET';objects.push(`<< /Length ${Buffer.byteLength(content,'latin1')} >>\nstream\n${content}\nendstream`);}
 objects[0]='<< /Type /Catalog /Pages 2 0 R >>';objects[1]=`<< /Type /Pages /Count ${ids.length} /Kids [${ids.map(id=>id+' 0 R').join(' ')}] >>`;
 let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf,'latin1'));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(pdf,'latin1');pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return Buffer.from(pdf,'latin1');
}

export interface IncidentDocument {
 organization:string; unit:string; employee:string; date:string; type:string; severity:string; status:string; author:string;
 description:string; objective:string; entries:{date:string;author:string;text:string}[];
 deliveries:{channel:string;created_at:string;acknowledged_at?:string|null}[];
 generatedAt:string; logo?:Buffer;
}
// Branded A4 document. All content is text/images; no HTML, scripts or remote fetches.
export function incidentDocumentPdf(doc:IncidentDocument):Buffer {
 const objects:Buffer[]=[];const add=(s:string|Buffer)=>{objects.push(typeof s==='string'?Buffer.from(s,'latin1'):s);return objects.length;};
 const catalog=add(''),pages=add(''),regular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const image=doc.logo?add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 510 /Height 289 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${doc.logo.length} >>\nstream\n`),doc.logo,Buffer.from('\nendstream')])):null;
 const ids:number[]=[],contents:string[]=[];let commands:string[]=[],y=0;
 const clean=(value:string)=>String(value||'—').replace(/€/g,'\x80').replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[’]/g,"'").replace(/[^\x20-\xff\n]/g,'?');
 const text=(value:string,x:number,at:number,size=10,heavy=false,color='0.13 0.18 0.23')=>commands.push(`BT /${heavy?'F2':'F1'} ${size} Tf ${color} rg 1 0 0 1 ${x} ${at} Tm (${clean(value).replace(/([\\()])/g,'\\$1').replace(/\n/g,' ')}) Tj ET`);
 const line=(at:number)=>commands.push(`0.86 0.88 0.90 RG 0.6 w 42 ${at} m 553 ${at} l S`);
 function page(){
  if(commands.length)contents.push(commands.join('\n'));commands=[];
  if(image)commands.push('q 104 0 0 59 42 750 cm /Logo Do Q');
  text('HORECA Personal',image?165:42,795,11,true);text('Comunicación de incidencia',image?165:42,773,17,true);
  text(doc.organization+' · '+doc.unit,image?165:42,755,10);commands.push('0.84 0.09 0.16 RG 2 w 42 739 m 553 739 l S');y=718;
 }
 const ensure=(height:number)=>{if(y-height<89)page();};
 function paragraph(value:string,size=10,heavy=false,x=42,width=511){
  const limit=Math.floor(width/(size*0.55));
  const rows=clean(value).split('\n').flatMap(l=>{const result:string[]=[];let part='';for(const word of l.split(/\s+/)){if(part.length+word.length+1>limit&&part){result.push(part);part='';}let rest=word;while(rest.length>limit){if(part){result.push(part);part='';}result.push(rest.slice(0,limit));rest=rest.slice(limit);}part+=(part?' ':'')+rest;}result.push(part||' ');return result;});
  for(const row of rows){ensure(size+5);text(row,x,y,size,heavy);y-=size+4;}
 }
 function section(title:string){ensure(45);y-=8;text(title.toUpperCase(),42,y,10,true,'0.63 0.08 0.13');y-=7;line(y);y-=17;}
 const date=(value:string)=>{const d=new Date(value);return Number.isNaN(d.valueOf())?value:new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(d);};
 page();section('Empleado / incidencia');
 for(const [label,value] of [['Empleado',doc.employee],['Fecha',doc.date],['Tipo',doc.type],['Gravedad',doc.severity],['Estado',doc.status],['Responsable',doc.author]])paragraph(label+': '+value,10,label==='Empleado');
 section('Descripción de la incidencia');paragraph(doc.description);
 section('Objetivo / acuerdo');paragraph(doc.objective);
 section('Seguimiento cronológico');
 if(!doc.entries.length)paragraph('Sin entradas de seguimiento.');
 for(const entry of [...doc.entries].sort((a,b)=>a.date.localeCompare(b.date))){ensure(38);paragraph(date(entry.date)+' · '+entry.author,9,true);paragraph(entry.text);y-=4;}
 section('Comunicación / recepción');
 if(!doc.deliveries.length)paragraph('Sin comunicaciones iniciadas.');
 for(const delivery of doc.deliveries){paragraph(delivery.channel+' · Iniciada: '+date(delivery.created_at),9,true);paragraph(delivery.acknowledged_at?'Recepción confirmada: '+date(delivery.acknowledged_at):'Recepción pendiente.',9);}
 contents.push(commands.join('\n'));
 for(let i=0;i<contents.length;i++){
  commands=[contents[i]];line(74);text('El acuse acredita recepción, no conformidad con el contenido.',42,59,8);text('Generado: '+date(doc.generatedAt),42,45,8);text(`${i+1} / ${contents.length}`,514,45,8);
  const content=Buffer.from(commands.join('\n'),'latin1'),stream=add(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`),content,Buffer.from('\nendstream')]));
  ids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> ${image?`/XObject << /Logo ${image} 0 R >>`:''} >> /Contents ${stream} 0 R >>`));
 }
 objects[catalog-1]=Buffer.from(`<< /Type /Catalog /Pages ${pages} 0 R >>`);objects[pages-1]=Buffer.from(`<< /Type /Pages /Count ${ids.length} /Kids [${ids.map(id=>id+' 0 R').join(' ')}] >>`);
 const chunks=[Buffer.from('%PDF-1.4\n')],offsets=[0];let offset=chunks[0].length;
 objects.forEach((obj,i)=>{offsets.push(offset);const chunk=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),obj,Buffer.from('\nendobj\n')]);chunks.push(chunk);offset+=chunk.length;});
 chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${offset}\n%%EOF`));return Buffer.concat(chunks);
}
