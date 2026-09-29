import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { generateMovementFingerprint } from '../../src/domains/finance/domain/fingerprint';
import { parseBankStatementBuffer } from '../../src/domains/finance/infrastructure/parsers';
import { moneyToDecimal } from '../../src/domains/finance/domain/money';

const org = '10000000-0000-4000-8000-000000000001';
const foreign = '10000000-0000-4000-8000-000000000002';
const actor = '20000000-0000-4000-8000-000000000001';
const profile = '30000000-0000-4000-8000-000000000001';
const member = '40000000-0000-4000-8000-000000000001';
const account = '50000000-0000-4000-8000-000000000001';
const row = { bookingDate:'2026-01-01',valueDate:null,description:'HORECA TEST SHOP',amount:'-10.25',currency:'EUR',direction:'DEBIT',runningBalance:null,sourceRowNumber:4,bankNativeId:null,externalReference:null };

describe('Finance atomic SQL on embedded PostgreSQL (not hosted / not a concurrent-backend proof)', () => {
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

  it.each(['OWNER','MANAGER','ADMINISTRATIVE'])('%s confirms atomically',async roleCode=>{ await role(roleCode);expect((await confirm()).persistedCount).toBe(1); });
  it.each(['EXTERNAL_ACCOUNTANT','CONSULTANT'])('%s cannot confirm without a grant',async roleCode=>{ await role(roleCode);await expect(confirm()).rejects.toThrow(/denied/);expect(await count('eco_source_imports')).toBe(0); });
  it('denies cross-tenant calls and inactive memberships',async()=>{
    await expect(confirm([row],'a'.repeat(64),account,'BBVA_ACCOUNT',foreign)).rejects.toThrow(/denied/);
    await db.exec('UPDATE public.eco_organization_members SET is_active=false'); await expect(confirm()).rejects.toThrow(/denied/);
  });
  it('denies disabled entitlement and explicit revoke',async()=>{
    await db.exec('UPDATE public.eco_organization_module_entitlements SET is_enabled=false');await expect(confirm()).rejects.toThrow(/denied/);
    await db.exec('UPDATE public.eco_organization_module_entitlements SET is_enabled=true');
    await db.query<Record<string, unknown>>(`INSERT INTO public.eco_member_capability_overrides(membership_id,organization_id,capability_id,effect)
      SELECT $1,$2,id,'REVOKE' FROM public.eco_capabilities WHERE code='STATEMENTS_IMPORT_CONFIRM'`,[member,org]);
    await expect(confirm()).rejects.toThrow(/denied/);
  });
  it('rejects wrong institution, product, inactive and foreign accounts',async()=>{
    await expect(confirm([row],'a'.repeat(64),account,'SABADELL_ACCOUNT')).rejects.toThrow(/Invalid target/);
    await expect(confirm([row],'a'.repeat(64),account,'BBVA_CARD')).rejects.toThrow(/Invalid target/);
    await db.exec('UPDATE public.eco_financial_accounts SET is_active=false');await expect(confirm()).rejects.toThrow(/Invalid target/);
    await db.query<Record<string, unknown>>('UPDATE public.eco_financial_accounts SET is_active=true, organization_id=$1',[foreign]);await expect(confirm()).rejects.toThrow(/Invalid target/);
  });
  it('persists/reloads exact semantics and computes the final fingerprint itself',async()=>{
    const result=await confirm([{...row,fingerprint:'stale-untrusted-preview'}]);
    const saved=(await browser('SELECT m.*,m.fecha::text AS fecha FROM public.eco_financial_movements m'))[0];
    expect(saved).toMatchObject({organization_id:org,source_account_id:account,import_id:result.importId,fecha:'2026-01-01',fecha_valor:null,monto:'-10.25',currency:'EUR',descripcion:row.description,source_row_number:4,duplicate_status:'UNIQUE',bank_native_id:null});
    expect(saved.raw_payload).toEqual({sourceRowNumber:4});
    expect(saved.financial_fingerprint).toBe(await generateMovementFingerprint({bankAccountId:account,bookingDate:row.bookingDate,valueDate:null,amount:-10.25,normalizedDescription:row.description,runningBalance:null}));
    expect(await count('eco_movement_allocations')).toBe(1);
  });
  it('exact reimport inserts nothing while equal fingerprints in another file are retained',async()=>{
    const first=await confirm();const second=await confirm();expect(second.importId).toBe(first.importId);expect(second.persistedCount).toBe(0);
    expect((await confirm([row],'b'.repeat(64))).potentialOverlapCount).toBe(1);expect(await count('eco_financial_movements')).toBe(2);
  });
  it('keeps final account identities separate',async()=>{
    await confirm();const secondAccount='50000000-0000-4000-8000-000000000002';
    await db.query<Record<string, unknown>>("INSERT INTO public.eco_financial_accounts(id,organization_id,code,name,institution,product_type,masked_identifier) VALUES($1,$2,'TEST_B','HORECA_TEST_B','BBVA','BANK_ACCOUNT','5678')",[secondAccount,org]);
    expect((await confirm([row],'b'.repeat(64),secondAccount)).potentialOverlapCount).toBe(0);
  });
  it.each(['',null,'bad','1.001','NaN'])('malformed money %s rolls back the whole import',async amount=>{
    await expect(confirm([row,{...row,sourceRowNumber:5,amount}])).rejects.toThrow();
    for(const t of ['eco_source_imports','eco_source_files','eco_import_rows','eco_financial_movements','eco_movement_allocations']) expect(await count(t)).toBe(0);
  });
  it('preserves valid zero and minimized rejected provenance',async()=>{
    await confirm([{...row,amount:'0.00',direction:'CREDIT'}],'a'.repeat(64),account,'BBVA_ACCOUNT',org,[{sourceRowNumber:8,code:'INVALID_AMOUNT',reason:'PRIVATE RAW ROW'}]);
    const rejected=(await db.query<Record<string, unknown>>("SELECT * FROM public.eco_import_rows WHERE parse_status='REJECTED'")).rows[0];expect(rejected.reason).toBe('Source row failed validation');expect(JSON.stringify(rejected)).not.toContain('PRIVATE');
    expect((await db.query<Record<string, unknown>>('SELECT rejected_rows,status FROM public.eco_source_imports')).rows[0]).toEqual({rejected_rows:1,status:'COMPLETED'});
  });
  it('rejects invalid dates without partial rows',async()=>{await expect(confirm([{...row,bookingDate:'2026-02-30'}])).rejects.toThrow();expect(await count('eco_source_imports')).toBe(0);});
  it('restricts RPC grants and cannot classify without the separate capability',async()=>{
    const grants=await db.query<{allowed:boolean;anonymous:boolean}>("SELECT has_function_privilege('authenticated','public.rpc_confirm_bank_statement_import(uuid,uuid,text,text,jsonb,jsonb)','EXECUTE') AS allowed, has_function_privilege('anon','public.rpc_confirm_bank_statement_import(uuid,uuid,text,text,jsonb,jsonb)','EXECUTE') AS anonymous");
    expect(grants.rows[0]).toEqual({allowed:true,anonymous:false});
    await confirm();
    const allocation=(await db.query<Record<string,unknown>>('SELECT id FROM public.eco_movement_allocations')).rows[0];
    await db.query(`INSERT INTO public.eco_member_capability_overrides(membership_id,organization_id,capability_id,effect)
      SELECT $1,$2,id,'REVOKE' FROM public.eco_capabilities WHERE code='financial.allocation.edit'`,[member,org]);
    await expect(browser('SELECT public.rpc_update_bank_allocation($1,$2,$3::jsonb)',[org,allocation.id,'{}'])).rejects.toThrow(/denied/);
  });
  it('denies direct canonical inserts, provenance writes and cross-org reads',async()=>{
    for(const t of ['eco_source_imports','eco_source_files','eco_financial_movements']) await expect(browser(`INSERT INTO public.${t} DEFAULT VALUES`)).rejects.toThrow(/permission denied/);
    await confirm();await db.exec('UPDATE public.eco_organization_members SET is_active=false');expect(await browser('SELECT * FROM public.eco_financial_movements')).toHaveLength(0);
  });
  it('classifies with subcategory/counterparty and preserves atomic balanced splits',async()=>{
    await confirm();const allocation=(await db.query<Record<string, unknown>>('SELECT * FROM public.eco_movement_allocations')).rows[0];
    const cat=(await browser("INSERT INTO public.eco_tax_categories(organization_id,name,type) VALUES($1,'HORECA_TEST_CATEGORY','GASTO') RETURNING id",[org]))[0].id;
    const sub=(await browser("INSERT INTO public.eco_tax_subcategories(organization_id,category_id,name) VALUES($1,$2,'HORECA_TEST_SUBCATEGORY') RETURNING id",[org,cat]))[0].id;
    const cp=(await browser("INSERT INTO public.eco_counterparties(organization_id,name) VALUES($1,'HORECA_TEST_COUNTERPARTY') RETURNING id",[org]))[0].id;
    await browser('SELECT public.rpc_update_bank_allocation($1,$2,$3::jsonb)',[org,allocation.id,JSON.stringify({category_id:cat,subcategory_id:sub,counterparty_id:cp})]);
    expect((await browser('SELECT * FROM public.eco_movement_allocations'))[0]).toMatchObject({category_id:cat,subcategory_id:sub,counterparty_id:cp,classification_status:'CONFIRMED'});
    await expect(browser('SELECT public.rpc_split_bank_movement($1,$2,$3::jsonb)',[org,allocation.movement_id,JSON.stringify([{monto:'-10'}])])).rejects.toThrow(/Unbalanced/);
    expect(await count('eco_movement_allocations')).toBe(1);
    await browser('SELECT public.rpc_split_bank_movement($1,$2,$3::jsonb)',[org,allocation.movement_id,JSON.stringify([{monto:'-5.00',category_id:cat,subcategory_id:sub,counterparty_id:cp},{monto:'-5.25'}])]);
    expect(await count('eco_movement_allocations')).toBe(2);
    expect((await db.query<Record<string, unknown>>('SELECT monto FROM public.eco_financial_movements')).rows[0].monto).toBe('-10.25');
    await expect(browser('SELECT public.rpc_update_bank_allocation($1,$2,$3::jsonb)',[foreign,allocation.id,'{}'])).rejects.toThrow(/denied/);
  });
  it('applies deterministic reviewable rules without changing bank facts or reconciliation',async()=>{
    const cat=(await browser("INSERT INTO public.eco_tax_categories(organization_id,name,type) VALUES($1,'HORECA_TEST_CATEGORY','GASTO') RETURNING id",[org]))[0].id;
    await browser("INSERT INTO public.eco_classification_rules(organization_id,name,pattern,target_category_id) VALUES($1,'HORECA_TEST_RULE','SHOP',$2)",[org,cat]);
    await confirm();expect((await browser('SELECT * FROM public.eco_movement_allocations'))[0]).toMatchObject({category_id:cat,classification_status:'SUGGESTED',reconciliation_status:'UNMATCHED'});
    await db.exec("UPDATE public.eco_movement_allocations SET category_id=NULL,classification_status='PENDING'");
    expect((await browser('SELECT public.rpc_apply_finance_rules($1) AS n',[org]))[0].n).toBe(1);
    expect((await db.query<Record<string, unknown>>('SELECT descripcion,monto FROM public.eco_financial_movements')).rows[0]).toEqual({descripcion:row.description,monto:'-10.25'});
  });
  it.each(['bbva_account_a','bbva_account_b','bbva_card','sabadell_account','sabadell_card'])('parses and persists sanitized source %s',async name=>{
    const bytes=readFileSync(`tests/fixtures/finance/${name}_sanitized.xls`);
    const {parsedResult,detection}=await parseBankStatementBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),name+'.xls');
    await db.query<Record<string, unknown>>('UPDATE public.eco_financial_accounts SET institution=$1,product_type=$2',[detection.formatFamily.startsWith('BBVA')?'BBVA':'SABADELL',detection.formatFamily.endsWith('_CARD')?'CARD':'BANK_ACCOUNT']);
    const payload=parsedResult.movements.map(m=>({...m,amount:moneyToDecimal(m.amount),runningBalance:m.runningBalance===null?null:moneyToDecimal(m.runningBalance)}));
    const result=await confirm(payload,parsedResult.fileHash,account,detection.formatFamily,org,parsedResult.rejectedRows);
    expect(result.persistedCount).toBe(payload.length);expect(await count('eco_movement_allocations')).toBe(payload.length);
  });
});
