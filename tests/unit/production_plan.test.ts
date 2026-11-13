import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalMigrationText, compileBootstrap, migrationBundle, validateConfig } from '../../scripts/production-foundation/bootstrap.mjs';

describe('Production offline review package',()=>{
 const example=JSON.parse(readFileSync('scripts/production-foundation/customer.example.json','utf8'));
 it('keeps example incomplete instead of inventing project or Auth identities',()=>{
  expect(()=>validateConfig(example)).toThrow('projectRef');
  expect(()=>validateConfig({...example,projectRef:'vmxjqwlfwnphorthhcwu'})).toThrow('projectRef');
 });
 it('includes ten reviewed migrations with required Finance schema dependencies but no optional push',()=>{
  const bundle=migrationBundle();expect(bundle).toHaveLength(10);
  expect(bundle.at(-1)?.file).toBe('20261110090000_personnel_attendance_foundation.sql');
  expect(bundle.some((m:{file:string})=>/push|canonical_sales|production_execution/.test(m.file))).toBe(false);
  expect(canonicalMigrationText('BEGIN;\r\nCOMMIT;\r\n')).toBe(canonicalMigrationText('BEGIN;\nCOMMIT;\n'));
  expect(bundle.every((m:{sql:string})=>!m.sql.includes('\r\n'))).toBe(true);
 });
 it('generates a separate workdir package offline and refuses overwrite or apply commands',()=>{
  const directory=mkdtempSync(join(tmpdir(),'horeca-foundation-'));
  const identities={platformAdmin:{authUserId:'10000000-0000-4000-8000-000000000001',email:'owner@example.invalid'},tenantOwner:{authUserId:'10000000-0000-4000-8000-000000000001',email:'owner@example.invalid'},personnelAdmin:{authUserId:'10000000-0000-4000-8000-000000000002',email:'hr@example.invalid'}};
  const config={...example,projectRef:'p'.repeat(20),identities},file=join(directory,'config.json'),output=join(directory,'package');writeFileSync(file,JSON.stringify(config));
  const run=(args:string[])=>spawnSync(process.execPath,['scripts/production-foundation/plan.mjs',...args],{encoding:'utf8',windowsHide:true});
  const result=run([file,output]);expect(result.status).toBe(0);expect(JSON.parse(result.stdout).networkUsed).toBe(false);
  expect(existsSync(join(output,'supabase/.temp/project-ref'))).toBe(false);
  expect(readFileSync(join(output,'bootstrap.sql'),'utf8')).toBe(compileBootstrap(config));
  expect(run([file,output]).status).not.toBe(0);expect(run([file,join(directory,'unused'),'--apply']).status).not.toBe(0);
 },15000);
 it('fails a hosted production build before artifact emission when it receives preview configuration',()=>{
  const output=join(mkdtempSync(join(tmpdir(),'horeca-build-boundary-')),'unwritten');
  const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir',output],{encoding:'utf8',windowsHide:true,env:{...process.env,VERCEL_ENV:'production',VITE_APP_ENV:'uat'}});
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('Production deployment requires production configuration');expect(existsSync(output)).toBe(false);
 },15000);
});
