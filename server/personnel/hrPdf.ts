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
