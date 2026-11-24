import {normalizeFinanceDescription,semanticKey} from './operationalInsights';
import {moneyToMinorUnits} from '../domain/money';
export function merchantPattern(text=''){
 return String(text).split(/[·\n]/).map(part=>normalizeFinanceDescription(part).replace(/(?: (?:REF|REFERENCIA))? \d{3,}(?: \d{3,})*$/,'')).join(' ').trim().replace(/\s+/g,' ').replace(/^(?:(?:PAGO|PAGOS|COMPRA|COMPRAS|TARJETA|POS) )+/,'');
}
const unsafe=/\b(TRANSFERENCIA|TRASPASO|PRESTAMO|FINANCIACION|CREDITO|LIQUIDACION|INGRESO DESDE CUENTA|PAGO DE TARJETA)\b/;
const safeTypes=new Set(['OPERATING_INCOME','OPERATING_EXPENSE','OTHER_NON_OPERATING']);
export function patternContext(m,org){
 const p=merchantPattern(m.descripcion),account=m.source_account;
 if(/^(PAGO (?:DE )?(?:TARJETAS?|VISA|MASTERCARD)|INGRESO DESDE CUENTA|ABONO CUENTA|CARGO CUENTA)\b/.test(normalizeFinanceDescription(m.descripcion)))return null;
 if(m.organization_id!==org||m.status&&m.status!=='ACTIVE'||p.length<3||!/^[A-Z]/.test(p)||!account?.institution||!account?.product_type||unsafe.test(p))return null;
 return JSON.stringify([org,m.currency||'EUR',account.institution.toUpperCase(),account.product_type,Math.sign(Number(m.monto)),p]);
}
const eligible=m=>m.allocations?.length===1&&!m.allocations[0].transfer_candidate_id&&m.allocations[0].reconciliation_status!=='CONFIRMED';
const untouched=(a,proposal)=>a.classification_status==='PENDING'&&a.economic_type==='UNCLASSIFIED'&&!a.category_id&&!a.subcategory_id&&!a.counterparty_id||a.classification_status==='SUGGESTED'&&a.classification_source==='RULE'&&semanticKey(a)===semanticKey(proposal);
export function buildPatternKnowledge(movements,org){
 const index=new Map();
 for(const m of movements){const key=patternContext(m,org);if(!key||!eligible(m))continue;const a=m.allocations[0];
  if(a.classification_status!=='CONFIRMED'||a.classification_source!=='MANUAL'||a.economic_type==='UNCLASSIFIED'||['INTERNAL_TRANSFER','CARD_SETTLEMENT'].includes(a.economic_type)||m.duplicate_status!=='UNIQUE')continue;
  const tuple=semanticKey(a),bucket=index.get(key)||{examples:new Set(),tuples:new Map()};bucket.examples.add(m.financial_fingerprint||m.id);bucket.tuples.set(tuple,a);index.set(key,bucket);
 }return index;
}
export function buildPatternReviewGroups(movements,org,index=buildPatternKnowledge(movements,org)){
 const groups=new Map();
 for(const m of movements){const key=patternContext(m,org);if(!key||!eligible(m)||m.allocations[0].classification_status==='CONFIRMED')continue;
  const h=index.get(key),conflict=!!h&&h.tuples.size>1,proposal=h&&!conflict?[...h.tuples.values()][0]:null;
  const recognized=!!proposal&&h.examples.size>=2&&safeTypes.has(proposal.economic_type)&&proposal.counterparty_id&&proposal.category_id&&proposal.subcategory_id;
  const group=groups.get(key)||{key,merchant:merchantPattern(m.descripcion),context:JSON.parse(key).slice(1,5).join(' · '),rows:[],exceptions:[],volume:0,proposal,conflict,recognized:!!recognized,state:conflict?'Conflicto':recognized?'Reconocido':proposal?'Propuesta':'Nuevo',examples:h?.examples.size||0};
  if(m.duplicate_status==='POTENTIAL_OVERLAP'||proposal&&!untouched(m.allocations[0],proposal)){group.exceptions.push(m);group.recognized=false;group.state=conflict?'Conflicto':'Revisión necesaria';}
  group.rows.push(m);group.volume+=Math.abs(moneyToMinorUnits(Number(m.monto)));groups.set(key,group);
 }
 return [...groups.values()].sort((a,b)=>b.rows.length-a.rows.length||b.volume-a.volume||a.key.localeCompare(b.key));
}
export function settlementCandidates(movements,org){
 const banks=new Map(),possibles=[];
 for(const m of movements){if(m.organization_id!==org||m.status&&m.status!=='ACTIVE'||!eligible(m)||m.duplicate_status==='POTENTIAL_OVERLAP'||m.allocations[0].classification_status==='CONFIRMED')continue;
  if(m.source_account?.product_type==='BANK_ACCOUNT'&&Number(m.monto)<0&&/\b(PAGO|LIQUIDACION|CARGO|RECIBO|CUOTA)\b.*\b(TARJETAS?|VISA|MASTERCARD)\b/.test(normalizeFinanceDescription(m.descripcion))){const key=JSON.stringify([m.currency||'EUR',m.source_account.institution,Math.abs(moneyToMinorUnits(Number(m.monto))),m.fecha]);const rows=banks.get(key)||[];rows.push(m);banks.set(key,rows);}
 }
 for(const card of movements){if(card.organization_id!==org||card.status&&card.status!=='ACTIVE'||!eligible(card)||card.source_account?.product_type!=='CARD'||Number(card.monto)<=0||card.duplicate_status==='POTENTIAL_OVERLAP'||card.allocations[0].classification_status==='CONFIRMED'||!/\b(INGRESO DESDE CUENTA|PAGO DE TARJETA|ABONO CUENTA|CARGO CUENTA)\b/.test(normalizeFinanceDescription(card.descripcion)))continue;
  for(let offset=-5;offset<=5;offset++){
   const date=new Date(Date.parse(card.fecha)+offset*86400000).toISOString().slice(0,10),key=JSON.stringify([card.currency||'EUR',card.source_account.institution,Math.abs(moneyToMinorUnits(Number(card.monto))),date]);
   for(const bank of banks.get(key)||[])possibles.push({bank,card,days:Math.abs(offset)});
  }
 }
 const counts=new Map();for(const p of possibles)for(const m of [p.bank,p.card])counts.set(m.id,(counts.get(m.id)||0)+1);
 return possibles.map(p=>({...p,ambiguous:counts.get(p.bank.id)!==1||counts.get(p.card.id)!==1}));
}
