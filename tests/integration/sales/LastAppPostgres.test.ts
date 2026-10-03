import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { mapLastAppSale } from '../../../src/application/sales/services/LastAppSalesMapper';

describe('Sales canonical migration, tenant constraints and trusted persistence in PostgreSQL',()=>{
  let db:PGlite;
  const org='10000000-0000-0000-0000-000000000001';
  const foreign='10000000-0000-0000-0000-000000000002';
  const unit='20000000-0000-0000-0000-000000000001';
  const location='30000000-0000-0000-0000-000000000001';
  const run='40000000-0000-0000-0000-000000000001';
  const tab='50000000-0000-0000-0000-000000000001';
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
      CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
    for(const file of ['20260926000000_horeca_core_baseline.sql','20260927000000_ccr_fin_001_core_authorization.sql',
      '20260928010000_finance_atomic_bank_import.sql','20261001000000_finance_classification_workflow.sql',
      '20261002000000_core_tenant_administration.sql','20261002010000_core_secure_provisioning.sql','20261002020000_core_legacy_fail_closed.sql',
      '20261002030000_core_module_entitlement_registry.sql',
      '20261003000000_core_saas_ux.sql',
      '20261003100000_canonical_sales_schema.sql','20261003110000_lastapp_sales_ingestion.sql']) {
      await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
    }
    await db.query(`INSERT INTO public.eco_organizations(id,code,name) VALUES($1,'A','Tenant A'),($2,'B','Tenant B')`,[org,foreign]);
    await db.query(`INSERT INTO public.eco_operational_units(id,organization_id,code,name,unit_type) VALUES($1,$2,'A','Local','LOCAL')`,[unit,org]);
    await db.query(`INSERT INTO public.sales_location_mappings VALUES($1,$2,$3,$4,'EUR',true)`,[org,location,foreign,unit]);
    await db.query(`INSERT INTO public.sales_sync_runs(id,organization_id,external_location_id,operational_unit_id,mode,status) VALUES($1,$2,$3,$4,'RECONCILIATION','PROCESSING')`,[run,org,location,unit]);
  },60000);
  afterAll(async()=>{await db?.close();});
  function candidate(total=1200,observedAt='2026-10-02T10:00:00Z') {
    return mapLastAppSale({id:tab,locationId:location,creationTime:'2026-10-01T10:00:00Z',closeTime:'2026-10-01T11:00:00Z',
      products:[{id:'line-1',name:'Burger',quantity:1,price:1200}],bills:[{id:'60000000-0000-0000-0000-000000000001',number:'A1',creationTime:'2026-10-01T11:00:00Z',total,products:[],payments:[]}]},
      {organizationId:org,operationalUnitId:unit,externalLocationId:location,currency:'EUR',syncRunId:run,observedAt,products:new Map()});
  }
  async function persist(c=candidate(), lines:unknown=c.lines.map(l=>l.toJSON())) {
    return (await db.query<{result:string}>('SELECT public.sales_persist_canonical($1::jsonb,$2::jsonb,$3::jsonb) AS result',
      [JSON.stringify(c.sale.toJSON()),JSON.stringify(lines),JSON.stringify(c.bills)])).rows[0].result;
  }
  it('deduplicates repeated observations and updates changed source state in one Sale',async()=>{
    expect(await persist()).toBe('created'); expect(await persist()).toBe('unchanged');
    const changed=candidate(2500,'2026-10-02T10:01:00Z'); expect(await persist(changed)).toBe('updated');
    const rows=(await db.query<{total:string;external_sale_id:string}>('SELECT total,external_sale_id FROM public.sales')).rows;
    expect(rows).toEqual([{total:'25.00',external_sale_id:tab}]);
    expect((await db.query('SELECT * FROM public.sales_source_bills')).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM public.sales_changes')).rows).toHaveLength(2);
  });
  it('does not let an older observation overwrite the latest persisted refresh',async()=>{
    expect(await persist(candidate(1200,'2026-10-02T09:00:00Z'))).toBe('unchanged');
    expect((await db.query<{total:string}>('SELECT total FROM public.sales')).rows[0].total).toBe('25.00');
  });
  it('undefined lines preserve current lines; [] intentionally clears them',async()=>{
    const changed=candidate(2600,'2026-10-02T10:02:00Z');
    await persist(changed,null); expect((await db.query('SELECT * FROM public.sale_lines')).rows).toHaveLength(1);
    await persist(candidate(2700,'2026-10-02T10:03:00Z'),[]); expect((await db.query('SELECT * FROM public.sale_lines')).rows).toHaveLength(0);
  });
  it('rolls back a header correction when child persistence fails',async()=>{
    const c=candidate(9999,'2026-10-02T10:04:00Z');
    await expect(persist(c,[{...c.lines[0].toJSON(),organizationId:foreign}])).rejects.toThrow('line tenant mismatch');
    expect((await db.query<{total:string}>('SELECT total FROM public.sales')).rows[0].total).toBe('27.00');
  });
  it('rejects cross-tenant operational units',async()=>{
    await expect(db.query(`INSERT INTO public.sales_location_mappings VALUES($1,$2,$3,$4,'EUR',true)`,
      [foreign,'30000000-0000-0000-0000-000000000002',foreign,unit])).rejects.toThrow(/foreign key/);
  });
  it('denies arbitrary browser mutation and trusted RPC execution',async()=>{
    const rows=await db.query<{relname:string;write:boolean;rls:boolean}>(`SELECT c.relname,c.relrowsecurity AS rls,
      has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') AS write FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND (c.relname LIKE 'sales%' OR c.relname='sale_lines')`);
    for(const row of rows.rows){expect(row.write,row.relname).toBe(false);expect(row.rls,row.relname).toBe(true);}
    await db.exec('SET ROLE authenticated');
    try {
      await expect(persist()).rejects.toThrow(/permission denied/);
      expect((await db.query('SELECT * FROM public.sales')).rows).toHaveLength(0);
    }finally {await db.exec('RESET ROLE');}
  });
  it('provides durable event identity, exclusive claims, replay and independent Sale identity',async()=>{
    const event={org,location};
    await db.query(`INSERT INTO public.sales_lastapp_inbox(organization_id,external_location_id,source_event_id,event_type,external_tab_id,source_created_at,payload_hash)
      VALUES($1,$2,'event-1','tab:closed',$3,now(),'hash') ON CONFLICT(organization_id,source_event_id) DO NOTHING`,[event.org,event.location,tab]);
    await db.query(`INSERT INTO public.sales_lastapp_inbox(organization_id,external_location_id,source_event_id,event_type,external_tab_id,source_created_at,payload_hash)
      VALUES($1,$2,'event-1','tab:closed',$3,now(),'hash') ON CONFLICT(organization_id,source_event_id) DO NOTHING`,[event.org,event.location,tab]);
    const id=(await db.query<{id:string}>('SELECT id FROM public.sales_lastapp_inbox')).rows[0].id;
    expect((await db.query('SELECT * FROM public.sales_claim_lastapp_event($1,$2)',[org,id])).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM public.sales_claim_lastapp_event($1,$2)',[org,id])).rows).toHaveLength(0);
    await db.query(`UPDATE public.sales_lastapp_inbox SET status='FAILED' WHERE id=$1`,[id]);
    expect((await db.query('SELECT * FROM public.sales_claim_lastapp_event($1,$2)',[org,id])).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM public.sales_lastapp_inbox')).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM public.sales')).rows).toHaveLength(1);
  });
  it('isolates the same source Tab UUID and location across different tenant configurations',async()=>{
    const unitB='20000000-0000-0000-0000-000000000002',runB='40000000-0000-0000-0000-000000000002';
    await db.query(`INSERT INTO public.eco_operational_units(id,organization_id,code,name,unit_type) VALUES($1,$2,'B','Other local','LOCAL')`,[unitB,foreign]);
    await db.query(`INSERT INTO public.sales_location_mappings VALUES($1,$2,$3,$4,'EUR',true)`,[foreign,location,foreign,unitB]);
    await db.query(`INSERT INTO public.sales_sync_runs(id,organization_id,external_location_id,operational_unit_id,mode,status) VALUES($1,$2,$3,$4,'RECONCILIATION','PROCESSING')`,[runB,foreign,location,unitB]);
    const isolated=mapLastAppSale({id:tab,locationId:location,creationTime:'2026-10-01T10:00:00Z',closeTime:'2026-10-01T11:00:00Z',products:[],bills:[]},
      {organizationId:foreign,operationalUnitId:unitB,externalLocationId:location,currency:'EUR',syncRunId:runB,observedAt:'2026-10-02T10:00:00Z',products:new Map()});
    expect(await persist(isolated)).toBe('created');
    expect((await db.query('SELECT * FROM public.sales WHERE external_sale_id=$1',[tab])).rows).toHaveLength(2);
    expect((await db.query<{total:string}>('SELECT total FROM public.sales WHERE organization_id=$1',[org])).rows[0].total).toBe('27.00');
  });
});
