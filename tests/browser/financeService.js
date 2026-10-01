// Deliberately synthetic fixtures. No Supabase client or network calls.
const accounts=[{id:'a',name:'Cuenta sintética A',masked_identifier:'1234',institution:'BBVA',product_type:'BANK_ACCOUNT',is_active:true,currency:'EUR'},{id:'b',name:'Cuenta sintética B',masked_identifier:'5678',institution:'BBVA',product_type:'BANK_ACCOUNT',is_active:true,currency:'EUR'}];
const catalogs={accounts,categories:[{id:'food',name:'Alimentos',type:'GASTO'},{id:'sales',name:'Ventas',type:'INGRESO'}],subcategories:[{id:'fresh',name:'Frescos',category_id:'food'},{id:'online',name:'Online',category_id:'sales'}],counterparties:[{id:'party',name:'Proveedor sintético'}],rules:[]};
const neutral=new URL(location.href).searchParams.has('neutral');
const movement=(id,amount,account,date)=>({id,fecha:date,descripcion:id==='negative'?'Compra sintética':id==='positive'?'Entrada sintética':'Sugerencia sintética',monto:amount,currency:'EUR',source_account_id:account,source_account:accounts.find(a=>a.id===account),allocations:[{id:'alloc-'+id,monto:amount,economic_type:'UNCLASSIFIED',classification_status:'PENDING',reconciliation_status:'UNMATCHED',notes:'',updated_at:'initial'}]});
const movements=[movement('negative',-18.5,'a','2026-04-08'),movement('positive',100,'b','2026-05-08'),movement('suggestion',-12,'a','2026-04-09')];
if(!neutral)Object.assign(movements[2].allocations[0],{economic_type:'OPERATING_EXPENSE',classification_status:'SUGGESTED',category_id:'food',subcategory_id:'fresh',counterparty_id:'party'});
window.financeCalls=[];
const log=(...args)=>window.financeCalls.push(args);
const clone=x=>structuredClone(x);
const key=kind=>({account:'accounts',category:'categories',subcategory:'subcategories',counterparty:'counterparties'}[kind]);
function joins(){for(const m of movements){m.source_account=accounts.find(a=>a.id===m.source_account_id);for(const a of m.allocations){a.category=catalogs.categories.find(x=>x.id===a.category_id);a.subcategory=catalogs.subcategories.find(x=>x.id===a.subcategory_id);a.counterparty=catalogs.counterparties.find(x=>x.id===a.counterparty_id);}}}
export async function getExtractosCatalogs(org){return org==='foreign-org'?{accounts:[],categories:[],subcategories:[],counterparties:[],rules:[]}:clone(catalogs)}
export async function fetchConsolidatedMovements(org){joins();return org==='foreign-org'?[]:clone(movements)}
export async function updateAllocationClassification(p){log('classification',p);if(p.economicType==='INTERNAL_TRANSFER')throw Error('Paired review only');const a=movements.flatMap(m=>m.allocations).find(a=>a.id===p.allocationId);Object.assign(a,{economic_type:p.economicType,category_id:p.categoryId,subcategory_id:p.subcategoryId,counterparty_id:p.counterpartyId,notes:p.notes,classification_status:p.status,updated_at:crypto.randomUUID()});return clone(a)}
export async function createFinanceCatalogEntry(kind,p,org){log('catalog',kind,p,org);const row={...p,id:crypto.randomUUID(),is_active:true};catalogs[key(kind)].push(row);return clone(row)}
export async function findOrCreateCounterparty(name,type,org){return (await createFinanceCatalogEntry('counterparty',{name,type},org)).id}
export async function renameFinanceCatalogEntry(kind,id,name,org){log('rename',kind,id,name,org);Object.assign(catalogs[key(kind)].find(x=>x.id===id),{name});}
export async function updateFinanceAccount(org,id,p){log('account',org,id,p);Object.assign(accounts.find(a=>a.id===id),p)}
export async function createClassificationRule(p){log('rule',p);catalogs.rules.push({id:crypto.randomUUID(),pattern:p.pattern,match_sign:p.matchSign,source_account_id:p.sourceAccountId,target_economic_type:p.economicType,target_category_id:p.categoryId,target_subcategory_id:p.subcategoryId,target_counterparty_id:p.counterpartyId,is_active:true})}
export async function updateClassificationRule(org,id,p){Object.assign(catalogs.rules.find(r=>r.id===id),p)}
export async function applyClassificationRules(){return 0}
export async function splitMovementAllocations(id,amount,lines,org){log('split',id,amount,lines,org);if(lines.some(a=>a.economic_type==='INTERNAL_TRANSFER'))throw Error('Paired review only');movements.find(m=>m.id===id).allocations=lines.map(a=>({...a,id:crypto.randomUUID(),classification_status:'CONFIRMED',updated_at:crypto.randomUUID()}))}
export async function fetchTransferCandidates(){return []}
export async function detectTransferCandidates(){return 0}
export async function reviewTransferCandidate(){throw Error('No synthetic candidate')}
export async function confirmFinanceSuggestions(org,selected){log('bulk',org,selected);for(const item of selected){const a=movements.flatMap(m=>m.allocations).find(a=>a.id===item.id);a.classification_status='CONFIRMED';a.updated_at=crypto.randomUUID();}return selected.length}
