import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { financeMetrics, type FinanceMovement } from '../../src/domains/finance/domain/economic';
import { PGlite } from '@electric-sql/pglite';

const org = '10000000-0000-4000-8000-000000000001';
const foreign = '10000000-0000-4000-8000-000000000002';
const actor = '20000000-0000-4000-8000-000000000001';
const profile = '30000000-0000-4000-8000-000000000001';
const member = '40000000-0000-4000-8000-000000000001';
const account = '50000000-0000-4000-8000-000000000001';
const row = { bookingDate:'2026-01-01',valueDate:null,description:'HORECA TEST SHOP',amount:'-10.25',currency:'EUR',direction:'DEBIT',runningBalance:null,sourceRowNumber:4,bankNativeId:null,externalReference:null };

describe('WP-FIN-005 proposed set-based review on ephemeral PostgreSQL', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    // Supabase Auth is an external fixture dependency: replace only its FK target
    // with a local test identity table. Never write auth.users, even in this suite.
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA test_auth; CREATE TABLE test_auth.identities(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated,anon;`);
    const baseline = readFileSync('supabase/migrations/20260926000000_horeca_core_baseline.sql','utf8');
    await db.exec(baseline.replace('REFERENCES auth.users(id)', 'REFERENCES test_auth.identities(id)'));
    await db.exec(readFileSync('supabase/migrations/20260927000000_ccr_fin_001_core_authorization.sql','utf8'));
    await db.exec(readFileSync('supabase/migrations/20260928010000_finance_atomic_bank_import.sql','utf8'));
    await db.exec(readFileSync('supabase/migrations/20261001000000_finance_classification_workflow.sql','utf8'));
    const old=(await db.query("SELECT oid,proname,prosrc,proacl::text FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY oid")).rows;
    await db.exec(readFileSync('docs/proposals/WP-FIN-005-pattern-review.sql','utf8'));
    const after=(await db.query("SELECT oid,proname,prosrc,proacl::text FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY oid")).rows;
    for(const previous of old as any[]){const current=after.find((p:any)=>p.oid===previous.oid) as any;expect(current.proacl).toBe(previous.proacl);const stripped=current.prosrc.split(" || public.finance_import_provenance(m->'provenance')").join('').replace(/ IF public\.finance_settlement_locked\(requested_organization_id, (?:mid|rpc_finance_soft_delete\.movement_id)\) THEN RAISE EXCEPTION 'Linked card settlement interpretation is protected'; END IF;\n/g,'');expect(stripped).toBe(previous.prosrc);}
  },60000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec('BEGIN');
    await db.query<Record<string, unknown>>('INSERT INTO test_auth.identities VALUES($1)',[actor]);
    await db.query<Record<string, unknown>>('INSERT INTO public.eco_user_profiles(id,auth_user_id) VALUES($1,$2)',[profile,actor]);
    await db.query<Record<string, unknown>>("INSERT INTO public.eco_organizations(id,code,name) VALUES($1,'HORECA_TEST_A','HORECA_TEST_A'),($2,'HORECA_TEST_B','HORECA_TEST_B')",[org,foreign]);
    await db.query<Record<string, unknown>>(`INSERT INTO public.eco_organization_members(id,organization_id,user_id,role_template_id,is_organization_wide)
      SELECT $1,$2,$3,id,true FROM public.eco_role_templates WHERE code='OWNER'`,[member,org,profile]);
    await db.query<Record<string, unknown>>("INSERT INTO public.eco_organization_module_entitlements(organization_id,module_key,is_enabled) VALUES($1,'bancos',true),($2,'bancos',true)",[org,foreign]);
    await db.query<Record<string, unknown>>("INSERT INTO public.eco_financial_accounts(id,organization_id,code,name,institution,product_type,masked_identifier) VALUES($1,$2,'TEST_A','HORECA_TEST_A','BBVA','BANK_ACCOUNT','1234')",[account,org]);
    await db.query<Record<string, unknown>>("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor]);
  });
  afterEach(async () => { await db.exec('ROLLBACK'); });
  async function browser(sql:string, params:unknown[] = []) {
    await db.exec('SAVEPOINT browser_call; SET LOCAL ROLE authenticated');
    try { const result = await db.query<Record<string, unknown>>(sql,params); await db.exec('RESET ROLE; RELEASE SAVEPOINT browser_call'); return result.rows; }
    catch (error) { await db.exec('ROLLBACK TO SAVEPOINT browser_call; RELEASE SAVEPOINT browser_call'); throw error; }
  }
  async function confirm(rows:unknown[]=[row], hash='a'.repeat(64), accountId=account, source='BBVA_ACCOUNT', organization=org, rejected:unknown[]=[]) {
    const result = await browser('SELECT public.rpc_confirm_bank_statement_import($1,$2,$3,$4,$5::jsonb,$6::jsonb) AS result', [organization,accountId,hash,source,JSON.stringify(rows),JSON.stringify(rejected)]);
    return result[0].result as {importId:string;persistedCount:number;duplicateSuppressedCount:number;potentialOverlapCount:number};
  }
  async function role(code:string) { await db.query<Record<string, unknown>>('UPDATE public.eco_organization_members SET role_template_id=(SELECT id FROM public.eco_role_templates WHERE code=$1) WHERE id=$2',[code,member]); }
  async function count(table:string) { return (await db.query<{n:number}>(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n; }

  async function tuple(){
   const category=(await browser("INSERT INTO public.eco_tax_categories(organization_id,name,type) VALUES($1,'Fictional category '||gen_random_uuid(),'GASTO') RETURNING id",[org]))[0].id;
   const sub=(await browser("INSERT INTO public.eco_tax_subcategories(organization_id,category_id,name) VALUES($1,$2,'Fictional subcategory') RETURNING id",[org,category]))[0].id;
   const party=(await browser("INSERT INTO public.eco_counterparties(organization_id,name) VALUES($1,'Fictional merchant '||gen_random_uuid()) RETURNING id",[org]))[0].id;
   return {economic_type:'OPERATING_EXPENSE',category_id:category,subcategory_id:sub,counterparty_id:party};
  }
  async function learning(count=3){await confirm(Array.from({length:count},(_,i)=>({...row,bookingDate:'2023-01-'+String(i+1).padStart(2,'0'),description:'COMPRA MERCADO FICTICIO '+(14053+i),sourceRowNumber:i+1})));return (await browser('SELECT a.*,a.updated_at::text updated_at FROM public.eco_movement_allocations a JOIN public.eco_financial_movements m ON m.id=a.movement_id ORDER BY m.fecha'));}
  async function patterns(operation:string,rows:Record<string,unknown>[]=[],value:object={},organization=org){return (await browser('SELECT public.rpc_review_finance_patterns($1,$2,$3,$4) result',[organization,operation,JSON.stringify(rows.map(a=>({id:a.id,updated_at:a.updated_at}))),JSON.stringify(value)]))[0].result as any;}
  it('retains existing RPC source and uses no new tables, RLS or browser write grants',async()=>{expect(await count('eco_counterparties')).toBe(0);expect((await db.query<{allowed:boolean}>("SELECT has_function_privilege('anon','public.rpc_review_finance_patterns(uuid,text,jsonb,jsonb)','EXECUTE') allowed")).rows[0].allowed).toBe(false);});
  it('uses the same conservative merchant suffix normalization as the UI',async()=>{for(const [raw,expected] of [['DIA 14053','DIA'],['COMPRA DIA 18068','DIA'],['PAGO MERCADO COMIDA REF 12345','MERCADO COMIDA'],['MERCADO MATERIAL OFICINA 14053','MERCADO MATERIAL OFICINA']])expect((await browser('SELECT public.finance_merchant_pattern($1) pattern',[raw]))[0].pattern).toBe(expected);});
  it('requires the first human confirmation, proposes second, recognizes third, and never rewrites bank facts',async()=>{
   const rows=await learning(),value=await tuple(),original=(await db.query('SELECT id,descripcion,monto FROM public.eco_financial_movements ORDER BY id')).rows;
   expect(await patterns('RECOGNIZE')).toMatchObject({suggested:0,recognized:0});
   expect(await patterns('REVIEW',[rows[0]],value)).toEqual({confirmed:1});
   expect(await patterns('RECOGNIZE')).toMatchObject({suggested:2,recognized:0});
   const second=(await browser('SELECT *,updated_at::text updated_at FROM public.eco_movement_allocations WHERE id=$1',[rows[1].id]))[0];
   await patterns('REVIEW',[second],value);
   // A later older export is eligible too; no assumption about chronological load order.
   await confirm([{...row,bookingDate:'2023-01-01',description:'COMPRA MERCADO FICTICIO 99999',sourceRowNumber:1}],'b'.repeat(64));
   expect(await patterns('RECOGNIZE')).toMatchObject({suggested:0,recognized:2});
   const recognized=(await browser("SELECT * FROM public.eco_movement_allocations WHERE classification_status='CONFIRMED' AND classification_source='RULE'"));expect(recognized).toHaveLength(2);
   expect((await db.query('SELECT id,descripcion,monto FROM public.eco_financial_movements WHERE id=ANY($1::uuid[]) ORDER BY id',[original.map((m:any)=>m.id)])).rows).toEqual(original);
  });
  it.each(['category_id','subcategory_id','economic_type','counterparty_id'])('conflicting human %s prevents any automatic proposal or confirmation',async field=>{
   const rows=await learning(),first=await tuple();await patterns('REVIEW',[rows[0]],first);
   const second=await tuple();const changed={...first,[field]:field==='economic_type'?'FINANCING_OUTFLOW':second[field as keyof typeof second]};if(field==='category_id')changed.subcategory_id=second.subcategory_id;if(field==='subcategory_id')changed.subcategory_id=(await browser("INSERT INTO public.eco_tax_subcategories(organization_id,category_id,name) VALUES($1,$2,'Other fictional sub') RETURNING id",[org,first.category_id]))[0].id;
   await patterns('REVIEW',[rows[1]],changed);expect(await patterns('RECOGNIZE')).toMatchObject({suggested:0,recognized:0});
  });
  it('supports one counterparty with different description patterns and categories without merging semantics',async()=>{
   const rows=await learning(),a=await tuple();await patterns('REVIEW',[rows[0]],a);await patterns('REVIEW',[rows[1]],a);
   await confirm([{...row,description:'MERCADO MATERIAL TECNICO 88888',sourceRowNumber:1}],'b'.repeat(64));
   expect(await patterns('RECOGNIZE')).toMatchObject({recognized:1});
   const pending=(await browser("SELECT a.*,a.updated_at::text updated_at FROM public.eco_movement_allocations a JOIN public.eco_financial_movements m ON m.id=a.movement_id WHERE m.descripcion LIKE 'MERCADO MATERIAL%'"))[0];
   expect(pending.classification_status).toBe('PENDING');const b=await tuple();await patterns('REVIEW',[pending],{...b,counterparty_id:a.counterparty_id});expect((await browser('SELECT counterparty_id,category_id FROM public.eco_movement_allocations WHERE id=$1',[pending.id]))[0]).toMatchObject({counterparty_id:a.counterparty_id,category_id:b.category_id});
  });
  it('fails atomically on stale versions, foreign catalog targets and mixed pattern groups',async()=>{
   const rows=await learning(),value=await tuple();await expect(patterns('REVIEW',[{...rows[0],updated_at:'2000-01-01'}],value)).rejects.toThrow(/changed/);
   await expect(patterns('REVIEW',[rows[0]],{...value,counterparty_id:'99999999-0000-4000-8000-000000000001'})).rejects.toThrow();
   expect((await browser("SELECT count(*)::int n FROM public.eco_movement_allocations WHERE classification_status='CONFIRMED'"))[0].n).toBe(0);
   await expect(patterns('REVIEW',rows,{...value,economic_type:'INTERNAL_TRANSFER'})).rejects.toThrow();
  });
  it('respects organization, active membership and Finance capability boundaries',async()=>{await expect(patterns('RECOGNIZE',[],{},foreign)).rejects.toThrow(/denied/);await role('CONSULTANT');await expect(patterns('RECOGNIZE')).rejects.toThrow(/denied/);});
  it('uses one set-based group confirmation for many pending allocations',async()=>{const rows=await learning(15),value=await tuple();expect(await patterns('REVIEW',rows,value)).toEqual({confirmed:15});});
  it('does not auto-confirm unresolved financing, splits, or already-reconciled allocations',async()=>{
   const rows=await learning(),value={...await tuple(),economic_type:'FINANCING_OUTFLOW'};await patterns('REVIEW',[rows[0]],value);await patterns('REVIEW',[rows[1]],value);expect(await patterns('RECOGNIZE')).toMatchObject({recognized:0,suggested:1});
  });
  it('links both settlement legs atomically and counts the card purchase as operating expense only once',async()=>{
   const card='50000000-0000-4000-8000-000000000005';await db.query("INSERT INTO public.eco_financial_accounts(id,organization_id,code,name,institution,product_type,masked_identifier) VALUES($1,$2,'CARD','Fictional card','BBVA','CARD','0005')",[card,org]);
   await confirm([{...row,description:'PAGO TARJETA FICTICIA',amount:'-80.00'}]);await confirm([{...row,description:'INGRESO DESDE CUENTA',amount:'80.00',direction:'CREDIT'}],'b'.repeat(64),card,'BBVA_CARD');
   const pair=await browser('SELECT a.*,a.updated_at::text updated_at FROM public.eco_movement_allocations a');expect(await patterns('SETTLEMENT',pair)).toEqual({settled:2});
   const legs=await browser('SELECT * FROM public.eco_movement_allocations');expect(legs.every(a=>a.economic_type==='CARD_SETTLEMENT'&&a.reconciled_movement_id&&a.reconciliation_status==='CONFIRMED')).toBe(true);
   await expect(browser('SELECT public.rpc_update_bank_allocation($1,$2,$3)',[org,legs[0].id,JSON.stringify({economic_type:'OPERATING_EXPENSE'})])).rejects.toThrow(/settlement/);
   await expect(browser('SELECT public.rpc_finance_reconcile($1,$2,$3,$4)',[org,legs[0].id,null,null])).rejects.toThrow(/settlement/);
   await expect(browser('SELECT public.rpc_finance_soft_delete($1,$2)',[org,legs[0].movement_id])).rejects.toThrow(/settlement/);
   const metrics=financeMetrics([{id:'purchase',monto:-80,fecha:'2023-01-01',allocations:[{id:'p',monto:-80,economic_type:'OPERATING_EXPENSE',classification_status:'CONFIRMED'}]},...legs.map((a:any)=>({id:a.id,monto:a.monto,fecha:'2023-01-01',allocations:[a]}))] as FinanceMovement[]);expect(metrics.economic.OPERATING_EXPENSE.count).toBe(1);
  });
  it('persists only optional bounded source metadata without changing fingerprints or canonical values',async()=>{
   const provenance={originalCurrency:'USD',originalFxAmount:15.25,fxDetail:'Importe original 15,25 USD / cambio ficticio'};
   await confirm([{...row,provenance}]);const saved=(await browser('SELECT raw_payload,normalized_payload,financial_fingerprint,monto FROM public.eco_financial_movements'))[0];
   expect(saved.raw_payload).toMatchObject({sourceRowNumber:4,...provenance});expect(saved.monto).toBe('-10.25');
   await confirm([row],'b'.repeat(64));const copies=await browser('SELECT financial_fingerprint,duplicate_status FROM public.eco_financial_movements');expect(copies[0].financial_fingerprint).toBe(copies[1].financial_fingerprint);expect(copies[1].duplicate_status).toBe('POTENTIAL_OVERLAP');
   await expect(confirm([{...row,provenance:{beneficiary:'PRIVATE NOT ALLOWED'}}],'c'.repeat(64))).rejects.toThrow(/provenance/);
  });

});
