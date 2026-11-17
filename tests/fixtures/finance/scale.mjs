import XLSX from 'xlsx';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const csvHeader='Fecha Proceso,Fecha Valor,Código,Concepto,Observaciones,Oficina,Importe,Saldo,Remesa';
function workbook(rows,type='xlsx',sheet='Listado'){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),sheet);return XLSX.write(wb,{type:'buffer',bookType:type});}
export function sevenSyntheticFiles(){
 const files=['a','b'].map((suffix,i)=>({name:'synthetic_bbva_account_'+suffix+'.csv',buffer:Buffer.from(csvHeader+'\r\n'+`03/01/2023,,111,COMPRA DIA ${14053+i},Compra ficticia,222,"-31,75","100,00",FICTICIO_${i}\r\n`+(i===0?'04/06/2026,,111,PAGO TARJETA FICTICIA,,222,"-80,00","20,00",FICTICIO_CARD\r\n':''),'utf8')}));
 for(let month=6;month<=8;month++)files.push({name:'synthetic_bbva_card_'+month+'.xlsx',buffer:workbook([['EXTRACTO DE TARJETA','SYNTHETIC ONLY'],['NO DE CONTRATO','SYNTHETIC_BBVA_CARD'],['FECHA DE OPERACIÓN','CONCEPTO','TIPO DE MOVIMIENTO','IMPORTE','DIVISA'],[`03/0${month}/2026`,'COMPRA DIA '+(14053+month),'COMPRA',-18.25,'EUR'],[`04/0${month}/2026`,'INGRESO DESDE CUENTA','ABONO',80,'EUR']])});
 files.push({name:'synthetic_sabadell_account.xls',buffer:workbook([['CONSULTA DE MOVIMIENTOS','SYNTHETIC ONLY'],['CUENTA:','ES9900810000000000000001'],['F. Operativa','Concepto','F. Valor','Importe','Saldo','Referencia 1','Referencia 2'],['04/01/2023','PROVEEDOR FICTICIO','','-42,00','200,00','SYNTHETIC_R1','']],'biff8','Hoja1')});
 files.push({name:'synthetic_sabadell_card.xls',buffer:workbook([['Saldos y movimientos','SYNTHETIC ONLY'],['Contrato','SYNTHETIC_SABA_CARD'],['Cuenta relacionada','ES9900810000000000000001'],['Tarjeta','0000000000000005'],['MOVIMIENTOS DE CREDITO'],['Total operaciones pendientes 08/2026'],['FECHA','CONCEPTO','LOCALIDAD','IMPORTE','DIVISA'],['05/08/2026','DIA 18068','FICTICIA','24,25','EUR']],'biff8','Sheet0')});return files;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const dir=resolve('.local-data/wp-fin-005-fixtures');mkdirSync(dir,{recursive:true});for(const f of sevenSyntheticFiles())writeFileSync(resolve(dir,f.name),f.buffer);console.log('Seven fictional fixtures written to ignored local evidence.');}
