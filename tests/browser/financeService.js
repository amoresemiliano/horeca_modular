// Deliberately synthetic fixtures. No Supabase client or network calls.
const accounts=[{id:'a',name:'Cuenta sintética A',masked_identifier:'1234',institution:'BBVA',product_type:'BANK_ACCOUNT',is_active:true,currency:'EUR'},{id:'b',name:'Cuenta sintética B',masked_identifier:'5678',institution:'BBVA',product_type:'BANK_ACCOUNT',is_active:true,currency:'EUR'}];
const catalogs={accounts,categories:[{id:'food',name:'Alimentos',type:'GASTO'},{id:'sales',name:'Ventas',type:'INGRESO'}],subcategories:[{id:'fresh',name:'Frescos',category_id:'food'},{id:'online',name:'Online',category_id:'sales'}],counterparties:[{id:'party',name:'Proveedor sintético'}],rules:[]};
const neutral=new URL(location.href).searchParams.has('neutral');
const movement=(id,amount,account,date)=>({id,organization_id:'synthetic-org',fecha:date,descripcion:id==='negative'?'Compra sintética':id==='positive'?'Entrada sintética':'Sugerencia sintética',monto:amount,currency:'EUR',source_account_id:account,source_account:accounts.find(a=>a.id===account),allocations:[{id:'alloc-'+id,monto:amount,economic_type:'UNCLASSIFIED',classification_status:'PENDING',reconciliation_status:'UNMATCHED',notes:'',updated_at:'initial'}]});
const movements=[movement('negative',-18.5,'a','2026-04-08'),movement('positive',100,'b','2026-05-08'),movement('suggestion',-12,'a','2026-04-09')];
if(!neutral)Object.assign(movements[2].allocations[0],{economic_type:'OPERATING_EXPENSE',classification_status:'SUGGESTED',category_id:'food',subcategory_id:'fresh',counterparty_id:'party'});
const dense=new URL(location.href).searchParams.has('dense');
const candidates=[];
if(new URL(location.href).searchParams.has('large')) for(let i=0;i<1205;i++){const m=movement('large-'+String(i).padStart(4,'0'),-i-1,i%2?'a':'b',i%2?'2026-04-10':'2026-05-10');m.descripcion='Movimiento sintético '+i;movements.push(m);}
if(dense){
 accounts.push({id:'card',name:'Tarjeta sintética',masked_identifier:'8899',institution:'SABADELL',product_type:'CARD',is_active:true,currency:'EUR'});
 for(let i=0;i<2;i++){const m=movement('history-'+i,-20,'a','2026-05-10');m.descripcion='SUMINISTROS OLIVA '+(1111+i);m.duplicate_status='UNIQUE';m.financial_fingerprint='synthetic-'+i;Object.assign(m.allocations[0],{economic_type:'OPERATING_EXPENSE',classification_status:'CONFIRMED',classification_source:'MANUAL',category_id:'food',subcategory_id:'fresh',counterparty_id:'party'});movements.push(m);}
 for(let i=0;i<130;i++){const m=movement('dense-'+i,-(i+1),i===129?'card':'a','2026-04-10');m.descripcion=i<12?'SUMINISTROS OLIVA '+(2222+i):'Movimiento denso '+i;movements.push(m);}
 const left=movement('transfer-left',-40,'a','2026-04-10'),right=movement('transfer-right',40,'b','2026-04-11');left.descripcion='Traspaso salida';right.descripcion='Traspaso entrada';movements.push(left,right);
 candidates.push({id:'pair',source_movement_id:left.id,target_movement_id:right.id,status:'SUGGESTED',evidence:{dayDistance:1,referenceMatch:true,descriptionHint:true}});
}
window.financeCalls=[];
const log=(...args)=>window.financeCalls.push(args);
const clone=x=>structuredClone(x);
const key=kind=>({account:'accounts',category:'categories',subcategory:'subcategories',counterparty:'counterparties'}[kind]);
function joins(){for(const m of movements){m.source_account=accounts.find(a=>a.id===m.source_account_id);for(const a of m.allocations){a.category=catalogs.categories.find(x=>x.id===a.category_id);a.subcategory=catalogs.subcategories.find(x=>x.id===a.subcategory_id);a.counterparty=catalogs.counterparties.find(x=>x.id===a.counterparty_id);}}}
export async function getExtractosCatalogs(org){return org==='foreign-org'?{accounts:[],categories:[],subcategories:[],counterparties:[],rules:[]}:clone(catalogs)}
export async function fetchConsolidatedMovements(org){log('full-history');joins();return org==='foreign-org'?[]:clone(movements)}
export async function fetchConsolidatedPage(org,{page=1,pageSize=25,filters={}}={}){joins();const rows=org==='foreign-org'?[]:movements.filter(m=>(!filters.currency||m.currency===filters.currency)&&(!filters.account||m.source_account_id===filters.account)&&(!filters.month||m.fecha.startsWith(filters.month))&&(!filters.query||m.descripcion.toLowerCase().includes(filters.query.toLowerCase()))&&(!(filters.status||filters.economicType||filters.category||filters.subcategory||filters.counterparty)||m.allocations.some(a=>(!filters.status||a.classification_status===filters.status)&&(!filters.economicType||a.economic_type===filters.economicType)&&(!filters.category||a.category_id===filters.category)&&(!filters.subcategory||a.subcategory_id===filters.subcategory)&&(!filters.counterparty||a.counterparty_id===filters.counterparty)))).sort((a,b)=>b.fecha.localeCompare(a.fecha)||a.id.localeCompare(b.id));log('page',page,pageSize,clone(filters),rows.length);return {rows:clone(rows.slice((page-1)*pageSize,page*pageSize)),total:rows.length,page,pageSize};}
export async function fetchTransferMovementContext(org,pairs){joins();const ids=new Set(pairs.flatMap(p=>[p.source_movement_id,p.target_movement_id]));return org==='foreign-org'?[]:clone(movements.filter(m=>ids.has(m.id)));}
export async function updateAllocationClassification(p){log('classification',p);if(p.economicType==='INTERNAL_TRANSFER')throw Error('Paired review only');const a=movements.flatMap(m=>m.allocations).find(a=>a.id===p.allocationId);Object.assign(a,{economic_type:p.economicType,category_id:p.categoryId,subcategory_id:p.subcategoryId,counterparty_id:p.counterpartyId,notes:p.notes,classification_status:p.status,updated_at:crypto.randomUUID()});return clone(a)}
export async function createFinanceCatalogEntry(kind,p,org){log('catalog',kind,p,org);const row={...p,id:crypto.randomUUID(),is_active:true};catalogs[key(kind)].push(row);return clone(row)}
export async function findOrCreateCounterparty(name,type,org){return (await createFinanceCatalogEntry('counterparty',{name,type},org)).id}
export async function renameFinanceCatalogEntry(kind,id,name,org){log('rename',kind,id,name,org);Object.assign(catalogs[key(kind)].find(x=>x.id===id),{name});}
export async function updateFinanceAccount(org,id,p){log('account',org,id,p);Object.assign(accounts.find(a=>a.id===id),p)}
export async function createClassificationRule(p){log('rule',p);catalogs.rules.push({id:crypto.randomUUID(),pattern:p.pattern,match_sign:p.matchSign,source_account_id:p.sourceAccountId,target_economic_type:p.economicType,target_category_id:p.categoryId,target_subcategory_id:p.subcategoryId,target_counterparty_id:p.counterpartyId,is_active:true})}
export async function updateClassificationRule(org,id,p){Object.assign(catalogs.rules.find(r=>r.id===id),p)}
export async function applyClassificationRules(){let count=0;for(const m of movements){const a=m.allocations[0];if(m.allocations.length!==1||a.classification_status!=='PENDING')continue;const r=catalogs.rules.find(r=>r.is_active&&m.descripcion.toUpperCase().includes(r.pattern.toUpperCase())&&(!r.source_account_id||r.source_account_id===m.source_account_id)&&(r.match_sign==='ALL'||(r.match_sign==='NEGATIVE'&&m.monto<0)||(r.match_sign==='POSITIVE'&&m.monto>0)));if(r){Object.assign(a,{economic_type:r.target_economic_type,category_id:r.target_category_id,subcategory_id:r.target_subcategory_id,counterparty_id:r.target_counterparty_id,classification_status:'SUGGESTED',updated_at:crypto.randomUUID()});count++;}}log('apply-rules',count);return count}
export async function splitMovementAllocations(id,amount,lines,org){log('split',id,amount,lines,org);if(lines.some(a=>a.economic_type==='INTERNAL_TRANSFER'))throw Error('Paired review only');movements.find(m=>m.id===id).allocations=lines.map(a=>({...a,id:crypto.randomUUID(),classification_status:'CONFIRMED',updated_at:crypto.randomUUID()}))}
export async function fetchTransferCandidates(){return clone(candidates)}
export async function detectTransferCandidates(){return 0}
export async function reviewTransferCandidate(org,id,decision){log('transfer-review',org,id,decision);candidates.find(c=>c.id===id).status=decision}
export async function confirmFinanceSuggestions(org,selected){log('bulk',org,selected);for(const item of selected){const a=movements.flatMap(m=>m.allocations).find(a=>a.id===item.id);a.classification_status='CONFIRMED';a.updated_at=crypto.randomUUID();}return selected.length}
import {buildPatternReviewGroups} from '../../src/domains/finance/application/patternLearning';
import {generateMovementFingerprint} from '../../src/domains/finance/domain/fingerprint';
const scale=new URL(location.href).searchParams.has('scale');
if(scale){
 movements.splice(0);catalogs.categories.splice(0);catalogs.subcategories.splice(0);catalogs.counterparties.splice(0);
 accounts.push({id:'bbva-card',name:'Tarjeta BBVA ficticia',institution:'BBVA',product_type:'CARD',masked_identifier:'0003',external_reference:'SYNTHETIC_BBVA_CARD',is_active:true,currency:'EUR'},
 {id:'saba-account',name:'Cuenta Sabadell ficticia',institution:'SABADELL',product_type:'BANK_ACCOUNT',masked_identifier:'0004',external_reference:'ES9900810000000000000001',is_active:true,currency:'EUR'},
 {id:'saba-card',name:'Tarjeta Sabadell ficticia',institution:'SABADELL',product_type:'CARD',masked_identifier:'0005',external_reference:'0000000000000005',is_active:true,currency:'EUR'});
}
const sourceFiles=new Map();
export function bankRead(table,filters,inside,start=0,end=499){
 if(filters.organization_id!=='synthetic-org')return [];
 if(table==='eco_financial_accounts')return clone(accounts.map(a=>({...a,organization_id:'synthetic-org'})));
 if(table==='eco_source_files'){const f=sourceFiles.get(filters.sha256_hash);return f?[clone(f)]:[];}
 if(table==='eco_financial_movements')return clone(movements.filter(m=>!inside||inside.includes(m.financial_fingerprint)).slice(start,end+1));
 throw Error('Unexpected synthetic table');
}
export async function bankRpc(name,p){
 if(p.requested_organization_id!=='synthetic-org')return {data:null,error:{message:'denied'}};
 if(name==='can_execute_capability_for_org')return {data:true,error:null};
 if(name!=='rpc_confirm_bank_statement_import')throw Error('Unexpected synthetic RPC');
 log('import',p.file_hash,p.bank_account_id,p.movements.length);
 const old=sourceFiles.get(p.file_hash);if(old)return {data:{status:'COMPLETED',importId:old.import_id,bankAccountId:old.eco_source_imports.bank_account_id,persistedCount:0,potentialOverlapCount:0,totalParsed:p.movements.length,duplicateSuppressedCount:p.movements.length},error:null};
 const account=accounts.find(a=>a.id===p.bank_account_id);if(!account)throw Error('Invalid target');
 let overlaps=0;for(const row of p.movements){const fp=await generateMovementFingerprint({bankAccountId:account.id,bookingDate:row.bookingDate,valueDate:row.valueDate,amount:Number(row.amount),normalizedDescription:row.description,runningBalance:row.runningBalance===null?null:Number(row.runningBalance),bankNativeId:row.bankNativeId,externalReference:row.externalReference});const overlap=movements.some(m=>m.financial_fingerprint===fp);if(overlap)overlaps++;
 const id=crypto.randomUUID(),m=movement(id,Number(row.amount),account.id,row.bookingDate);m.descripcion=row.description;m.financial_fingerprint=fp;m.duplicate_status=overlap?'POTENTIAL_OVERLAP':'UNIQUE';m.allocations[0].classification_source='MANUAL';movements.push(m);}
 const importId=crypto.randomUUID();sourceFiles.set(p.file_hash,{import_id:importId,eco_source_imports:{bank_account_id:account.id,status:'COMPLETED'}});
 return {data:{status:'COMPLETED',importId,bankAccountId:account.id,persistedCount:p.movements.length,potentialOverlapCount:overlaps,totalParsed:p.movements.length,duplicateSuppressedCount:0},error:null};
}
export async function reviewFinancePattern(org,rows,value){
 log('pattern-review',org,rows,value);for(const row of rows){const a=movements.flatMap(m=>m.allocations).find(a=>a.id===row.id);if(!a||a.updated_at!==row.updated_at)throw Error('Stale group');}
 for(const row of rows)Object.assign(movements.flatMap(m=>m.allocations).find(a=>a.id===row.id),{economic_type:value.economic_type,category_id:value.category_id,subcategory_id:value.subcategory_id,counterparty_id:value.counterparty_id},{classification_status:'CONFIRMED',classification_source:'MANUAL',updated_at:crypto.randomUUID()});return rows.length;
}
export async function recognizeFinancePatterns(org){
 let recognized=0,suggested=0;for(const group of buildPatternReviewGroups(movements,org))for(const m of group.rows){if(!group.proposal||group.conflict)continue;const a=m.allocations[0];if(a.classification_status==='SUGGESTED'&&!group.recognized)continue;
 const status=group.recognized?'CONFIRMED':'SUGGESTED';Object.assign(a,{economic_type:group.proposal.economic_type,category_id:group.proposal.category_id,subcategory_id:group.proposal.subcategory_id,counterparty_id:group.proposal.counterparty_id,classification_status:status,classification_source:'RULE',updated_at:crypto.randomUUID()});if(group.recognized)recognized++;else suggested++;}
 log('recognize',recognized,suggested);return {recognized,suggested};
}
export async function confirmCardSettlement(org,pair){log('settlement',org,pair.bank.id,pair.card.id);for(const [m,target] of [[pair.bank,pair.card],[pair.card,pair.bank]])Object.assign(movements.find(x=>x.id===m.id).allocations[0],{category_id:null,subcategory_id:null,counterparty_id:null,economic_type:'CARD_SETTLEMENT',classification_status:'CONFIRMED',is_card_settlement:true,reconciled_movement_id:target.id,reconciliation_status:'CONFIRMED',updated_at:crypto.randomUUID()});return {settled:2};}
window.financeFixture={snapshot:()=>clone({catalogs,movements}),add:(description,amount=-18.25,account='bbva-card')=>{const m=movement(crypto.randomUUID(),amount,account,'2023-02-01');m.descripcion=description;m.duplicate_status='UNIQUE';movements.push(m);return m.id;},classify:(id,patch)=>{const m=movements.find(x=>x.id===id);if(m)Object.assign(m.allocations[0],patch);}};
