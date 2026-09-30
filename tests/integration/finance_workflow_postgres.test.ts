import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { financeMetrics, type FinanceMovement } from '../../src/domains/finance/domain/economic';
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

describe('WP-FIN-002 upgraded Finance contract on embedded PostgreSQL', () => {
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

  async function pair(amount=-17.25, targetAmount=17.25, days='2026-01-02', sameAccount=false) {
    const second='50000000-0000-4000-8000-000000000003';
    await db.query("INSERT INTO public.eco_financial_accounts(id,organization_id,code,name,institution,product_type,masked_identifier) VALUES($1,$2,'TEST_B','Synthetic B','BBVA','BANK_ACCOUNT','5678')",[second,org]);
    await confirm([{...row,amount:amount.toFixed(2),direction:amount<0?'DEBIT':'CREDIT',description:'SYNTHETIC TRANSFER'}]);
    await confirm([{...row,amount:targetAmount.toFixed(2),direction:targetAmount<0?'DEBIT':'CREDIT',bookingDate:days,description:'SYNTHETIC TRANSFER'}],'b'.repeat(64),sameAccount?account:second);
    return (await db.query<{id:string}>('SELECT id FROM public.eco_financial_movements ORDER BY monto')).rows;
  }
  async function detect() { return (await browser('SELECT public.rpc_detect_finance_transfers($1) n',[org]))[0].n; }
  async function candidate() { return (await db.query<{id:string;status:string}>('SELECT id,status FROM public.eco_finance_match_candidates')).rows[0]; }
  async function review(id:string, decision='CONFIRMED', tenant=org) { return browser('SELECT public.rpc_review_finance_transfer($1,$2,$3)',[tenant,id,decision]); }
  async function allocation() { return (await db.query<Record<string,unknown>>('SELECT * FROM public.eco_movement_allocations ORDER BY monto')).rows[0]; }

  it('defaults preexisting allocations to UNCLASSIFIED without reading their sign',async()=>{
    await confirm([{...row,amount:'15.00',direction:'CREDIT'}, {...row,sourceRowNumber:5,amount:'-12.00'}]);
    expect((await db.query<{economic_type:string}>('SELECT economic_type FROM public.eco_movement_allocations')).rows.map(a=>a.economic_type)).toEqual(['UNCLASSIFIED','UNCLASSIFIED']);
  });
  it('suggests, confirms and links both transfer legs without changing any bank fact',async()=>{
    await pair();const before=(await db.query('SELECT * FROM public.eco_financial_movements ORDER BY id')).rows;
    // PostgREST exposes dates as strings; PGlite's native date value is a JS Date.
    const bankingBefore=financeMetrics((await db.query<FinanceMovement>('SELECT id,fecha::text,monto,currency,status FROM public.eco_financial_movements ORDER BY id')).rows).banking;
    expect(await detect()).toBe(1);const c=await candidate();expect(c.status).toBe('SUGGESTED');
    expect((await allocation()).economic_type).toBe('UNCLASSIFIED');
    await review(c.id);await review(c.id);
    const allocations=(await db.query<Record<string,unknown>>('SELECT * FROM public.eco_movement_allocations')).rows;
    expect(allocations).toHaveLength(2);
    for(const a of allocations) expect(a).toMatchObject({economic_type:'INTERNAL_TRANSFER',classification_status:'CONFIRMED',transfer_candidate_id:c.id,reconciliation_status:'UNMATCHED'});
    expect((await db.query('SELECT * FROM public.eco_financial_movements ORDER BY id')).rows).toEqual(before);
    expect(await browser('SELECT * FROM public.eco_financial_movements')).toHaveLength(2);
    expect((await candidate()).status).toBe('CONFIRMED');expect(await detect()).toBe(0);
    const persisted = (await db.query<FinanceMovement>(`SELECT m.id,m.fecha::text,m.monto,m.currency,m.status,
      (SELECT jsonb_agg(to_jsonb(a)) FROM public.eco_movement_allocations a WHERE a.movement_id=m.id AND a.organization_id=m.organization_id) allocations
      FROM public.eco_financial_movements m ORDER BY m.id`)).rows;
    for (const m of persisted) expect(m.allocations![0].transfer_candidate_id).toBe(c.id);
    const metrics=financeMetrics(persisted);
    expect(metrics.operatingIncome).toBe(0);expect(Math.abs(metrics.operatingExpense)).toBe(0);
    expect(metrics.banking).toEqual(bankingBefore);
    expect(metrics.economic.INTERNAL_TRANSFER.count).toBe(2);
  });
  it.each([
    ['same account',-17.25,17.25,'2026-01-02',true], ['same sign',-17.25,-17.25,'2026-01-02',false],
    ['different amount',-17.25,18,'2026-01-02',false], ['distant date',-17.25,17.25,'2026-02-02',false],
  ] as const)('does not suggest %s',async(_name,amount,target,date,same)=>{await pair(amount,target,date,same);expect(await detect()).toBe(0);});
  it('rejects a suggestion permanently across detection reruns',async()=>{
    await pair();await detect();const c=await candidate();await review(c.id,'REJECTED');expect(await detect()).toBe(0);
    await expect(review(c.id)).rejects.toThrow(/already reviewed/);expect((await allocation()).economic_type).toBe('UNCLASSIFIED');
  });
  it('revalidates candidate allocations and prevents overlapping confirmed pairs',async()=>{
    await pair();await confirm([{...row,amount:'17.25',direction:'CREDIT'}],'c'.repeat(64),'50000000-0000-4000-8000-000000000003');
    expect(await detect()).toBe(2);const candidates=(await db.query<{id:string}>('SELECT id FROM public.eco_finance_match_candidates ORDER BY id')).rows;
    await review(candidates[0].id);await expect(review(candidates[1].id)).rejects.toThrow(/already linked/);
  });
  it('protects linked transfer interpretations from classification, split, generic reconciliation and deletion',async()=>{
    await pair();await detect();await review((await candidate()).id);const a=await allocation();
    await expect(browser('SELECT public.rpc_update_bank_allocation($1,$2,$3)',[org,a.id,'{"economic_type":"OPERATING_EXPENSE"}'])).rejects.toThrow(/protected/);
    await expect(browser('SELECT public.rpc_split_bank_movement($1,$2,$3)',[org,a.movement_id,'[{"monto":"-17.25"}]'])).rejects.toThrow(/review/);
    await expect(browser('SELECT public.rpc_finance_reconcile($1,$2,NULL,NULL)',[org,a.id])).rejects.toThrow(/protected|denied/);
    await expect(browser('SELECT public.rpc_finance_soft_delete($1,$2)',[org,a.movement_id])).rejects.toThrow(/visible|denied/);
  });
  it('enforces candidate RLS, tenancy and entitlement on detection/review',async()=>{
    await pair();await detect();const c=await candidate();
    await expect(review(c.id,'CONFIRMED',foreign)).rejects.toThrow(/denied/);
    await expect(browser('INSERT INTO public.eco_finance_match_candidates DEFAULT VALUES')).rejects.toThrow(/permission denied/);
    await db.exec('UPDATE public.eco_organization_module_entitlements SET is_enabled=false');
    expect(await browser('SELECT * FROM public.eco_finance_match_candidates')).toHaveLength(0);
    await expect(detect()).rejects.toThrow(/denied/);await expect(review(c.id)).rejects.toThrow(/denied/);
  });
  it('saves economic meaning and notes without a category and rejects foreign catalog IDs',async()=>{
    await confirm();const a=await allocation();
    await browser('SELECT public.rpc_update_bank_allocation($1,$2,$3)',[org,a.id,'{"economic_type":"FINANCING_OUTFLOW","notes":"Synthetic loan repayment"}']);
    expect(await allocation()).toMatchObject({economic_type:'FINANCING_OUTFLOW',classification_status:'CONFIRMED',notes:'Synthetic loan repayment',category_id:null});
    const cat=(await db.query<{id:string}>("INSERT INTO public.eco_tax_categories(organization_id,name,type) VALUES($1,'Foreign','GASTO') RETURNING id",[foreign])).rows[0].id;
    await expect(browser('SELECT public.rpc_update_bank_allocation($1,$2,$3)',[org,a.id,JSON.stringify({category_id:cat})])).rejects.toThrow();
    await expect(browser('SELECT public.rpc_update_bank_allocation($1,$2,$3)',[org,a.id,'{"economic_type":"GUESS"}'])).rejects.toThrow();
  });
  it('preserves allocation economic types and exact cents across split/reload',async()=>{
    await confirm();const a=await allocation();
    await browser('SELECT public.rpc_split_bank_movement($1,$2,$3)',[org,a.movement_id,JSON.stringify([{monto:'-4.10',economic_type:'OPERATING_EXPENSE',notes:'Food'}, {monto:'-6.15',economic_type:'FINANCING_OUTFLOW'}])]);
    expect((await db.query<{economic_type:string}>('SELECT economic_type FROM public.eco_movement_allocations ORDER BY monto DESC')).rows.map(a=>a.economic_type)).toEqual(['OPERATING_EXPENSE','FINANCING_OUTFLOW']);
    expect((await db.query<{n:string}>('SELECT sum(monto) n FROM public.eco_movement_allocations')).rows[0].n).toBe('-10.25');
    expect((await db.query<{monto:string}>('SELECT monto FROM public.eco_financial_movements')).rows[0].monto).toBe('-10.25');
  });
  it('rules create/edit/disable, honor sign and account, and only suggest generic economic types',async()=>{
    const rule=(await browser("INSERT INTO public.eco_classification_rules(organization_id,name,pattern,source_account_id,match_sign,target_economic_type) VALUES($1,'Synthetic loan','SHOP',$2,'POSITIVE','FINANCING_INFLOW') RETURNING id",[org,account]))[0].id;
    await confirm();expect((await allocation()).classification_status).toBe('PENDING');
    await browser("UPDATE public.eco_classification_rules SET match_sign='NEGATIVE',target_economic_type='FINANCING_OUTFLOW',is_active=false WHERE id=$1 AND organization_id=$2",[rule,org]);
    expect((await browser('SELECT public.rpc_apply_finance_rules($1) n',[org]))[0].n).toBe(0);
    await browser('UPDATE public.eco_classification_rules SET is_active=true WHERE id=$1 AND organization_id=$2',[rule,org]);
    expect((await browser('SELECT public.rpc_apply_finance_rules($1) n',[org]))[0].n).toBe(1);
    expect(await allocation()).toMatchObject({economic_type:'FINANCING_OUTFLOW',classification_status:'SUGGESTED'});
    await confirm([{...row,amount:'-3.00'}],'d'.repeat(64));
    expect((await db.query<{economic_type:string;classification_status:string}>('SELECT economic_type,classification_status FROM public.eco_movement_allocations')).rows.every(a=>a.economic_type==='FINANCING_OUTFLOW'&&a.classification_status==='SUGGESTED')).toBe(true);
  });
  it('bulk confirmation requires explicit fresh suggestions and rolls back a stale selection',async()=>{
    await confirm();const a=await allocation();await browser('SELECT public.rpc_update_bank_allocation($1,$2,$3)',[org,a.id,'{"economic_type":"OPERATING_EXPENSE","classification_status":"SUGGESTED"}']);
    const fresh=await allocation();
    await expect(browser('SELECT public.rpc_confirm_finance_suggestions($1,$2)',[org,JSON.stringify([{id:fresh.id,updated_at:'2000-01-01'}])])).rejects.toThrow(/changed/);
    expect((await browser('SELECT public.rpc_confirm_finance_suggestions($1,$2) n',[org,JSON.stringify([{id:fresh.id,updated_at:fresh.updated_at}])]))[0].n).toBe(1);
    expect((await allocation()).classification_status).toBe('CONFIRMED');
  });
  it('account management permits rename/last4/activation but denies identity changes and historical delete',async()=>{
    await confirm();const before=(await db.query('SELECT * FROM public.eco_financial_movements')).rows;
    await browser('SELECT public.rpc_update_finance_account($1,$2,$3)',[org,account,'{"name":"Renamed synthetic","masked_identifier":"8765","is_active":false}']);
    expect((await browser('SELECT name,masked_identifier,is_active FROM public.eco_financial_accounts'))[0]).toEqual({name:'Renamed synthetic',masked_identifier:'8765',is_active:false});
    await browser('SELECT public.rpc_update_finance_account($1,$2,$3)',[org,account,'{"is_active":true}']);
    for(const patch of [{institution:'SABADELL'},{product_type:'CARD'},{organization_id:foreign}]) await expect(browser('SELECT public.rpc_update_finance_account($1,$2,$3)',[org,account,JSON.stringify(patch)])).rejects.toThrow(/mutable/);
    await expect(browser('UPDATE public.eco_financial_accounts SET institution=\'SABADELL\' WHERE id=$1',[account])).rejects.toThrow(/permission denied/);
    await expect(browser('DELETE FROM public.eco_financial_accounts WHERE id=$1',[account])).rejects.toThrow(/permission denied/);
    await expect(browser('SELECT public.rpc_update_finance_account($1,$2,$3)',[foreign,account,'{"name":"Attack"}'])).rejects.toThrow(/denied/);
    expect((await db.query('SELECT * FROM public.eco_financial_movements')).rows).toEqual(before);
  });
  it('does not apply an account-restricted rule to another own account',async()=>{
    await pair();
    await browser("INSERT INTO public.eco_classification_rules(organization_id,name,pattern,source_account_id,target_economic_type) VALUES($1,'Synthetic','TRANSFER',$2,'FINANCING_OUTFLOW')",[org,account]);
    expect((await browser('SELECT public.rpc_apply_finance_rules($1) n',[org]))[0].n).toBe(1);
    const rows=(await db.query<{monto:string;classification_status:string}>('SELECT monto,classification_status FROM public.eco_movement_allocations ORDER BY monto')).rows;
    expect(rows).toEqual([{monto:'-17.25',classification_status:'SUGGESTED'},{monto:'17.25',classification_status:'PENDING'}]);
  });
  it('rolls back every selected suggestion when a later item is stale',async()=>{
    await pair();
    const all=(await db.query<Record<string,unknown>>('SELECT * FROM public.eco_movement_allocations ORDER BY id')).rows;
    for(const a of all) await browser('SELECT public.rpc_update_bank_allocation($1,$2,$3)',[org,a.id,'{"economic_type":"OTHER_NON_OPERATING","classification_status":"SUGGESTED"}']);
    const fresh=(await db.query<Record<string,unknown>>('SELECT * FROM public.eco_movement_allocations ORDER BY id')).rows;
    await expect(browser('SELECT public.rpc_confirm_finance_suggestions($1,$2)',[org,JSON.stringify([{id:fresh[0].id,updated_at:fresh[0].updated_at},{id:fresh[1].id,updated_at:'2000-01-01'}])])).rejects.toThrow(/changed/);
    expect((await db.query<{classification_status:string}>('SELECT classification_status FROM public.eco_movement_allocations')).rows.every(a=>a.classification_status==='SUGGESTED')).toBe(true);
  });
  it('denies read-only roles access to paired transfer review',async()=>{
    await pair();await detect();const c=await candidate();await role('CONSULTANT');
    await expect(detect()).rejects.toThrow(/denied/);await expect(review(c.id)).rejects.toThrow(/denied/);
  });
  it.each(['PENDING','SUGGESTED','CONFIRMED'])('rejects generic INTERNAL_TRANSFER with %s without mutation', async status=>{
    await confirm();const before=await allocation();
    await expect(browser('SELECT public.rpc_update_bank_allocation($1,$2,$3)',[org,before.id,JSON.stringify({economic_type:'INTERNAL_TRANSFER',classification_status:status})])).rejects.toThrow('Internal transfer requires paired transfer review');
    expect(await allocation()).toEqual(before);
  });
  it('rejects an entire split with a transfer line and preserves original allocation identity',async()=>{
    await confirm();const before=await allocation();
    const lines=[{monto:'-4.10',economic_type:'OPERATING_EXPENSE'},{monto:'-6.15',economic_type:'INTERNAL_TRANSFER'}];
    await expect(browser('SELECT public.rpc_split_bank_movement($1,$2,$3)',[org,before.movement_id,JSON.stringify(lines)])).rejects.toThrow('Internal transfer requires paired transfer review');
    expect(await allocation()).toEqual(before);expect(await count('eco_movement_allocations')).toBe(1);
  });
  it('rejects rule insertion and updates targeting INTERNAL_TRANSFER at the database boundary',async()=>{
    await expect(browser("INSERT INTO public.eco_classification_rules(organization_id,name,pattern,target_economic_type) VALUES($1,'Synthetic','SHOP','INTERNAL_TRANSFER')",[org])).rejects.toThrow(/finance_rule_no_internal_transfer/);
    expect(await count('eco_classification_rules')).toBe(0);
    const r=(await browser("INSERT INTO public.eco_classification_rules(organization_id,name,pattern,target_economic_type) VALUES($1,'Synthetic','SHOP','OPERATING_EXPENSE') RETURNING *",[org]))[0];
    await expect(browser("UPDATE public.eco_classification_rules SET target_economic_type='INTERNAL_TRANSFER' WHERE id=$1 AND organization_id=$2",[r.id,org])).rejects.toThrow(/finance_rule_no_internal_transfer/);
    expect((await browser('SELECT * FROM public.eco_classification_rules WHERE id=$1',[r.id]))[0]).toEqual(r);
  });
  it('rejects an unpaired confirmed interpretation at the storage boundary',async()=>{
    await confirm();const a=await allocation();
    await db.exec('SAVEPOINT invalid_interpretation');
    try {
      await expect(db.query("UPDATE public.eco_movement_allocations SET economic_type='INTERNAL_TRANSFER',classification_status='CONFIRMED' WHERE id=$1",[a.id])).rejects.toThrow(/finance_internal_transfer_requires_pair/);
    } finally { await db.exec('ROLLBACK TO SAVEPOINT invalid_interpretation; RELEASE SAVEPOINT invalid_interpretation'); }
    expect(await allocation()).toEqual(a);
  });
  it('defensively ignores invalid transfer rules in both import and pending application',async()=>{
    // Simulate corrupted legacy rules locally; this DDL rolls back with the test.
    await db.exec('ALTER TABLE public.eco_classification_rules DROP CONSTRAINT finance_rule_no_internal_transfer');
    await db.query("INSERT INTO public.eco_classification_rules(organization_id,name,pattern,target_economic_type) VALUES($1,'Invalid synthetic rule','SHOP','INTERNAL_TRANSFER')",[org]);
    await confirm();const a=await allocation();expect(a).toMatchObject({economic_type:'UNCLASSIFIED',classification_status:'PENDING'});
    expect((await browser('SELECT public.rpc_apply_finance_rules($1) n',[org]))[0].n).toBe(0);
    expect(await allocation()).toEqual(a);
  });
});
