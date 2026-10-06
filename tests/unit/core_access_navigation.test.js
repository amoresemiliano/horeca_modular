import { describe,it,expect } from 'vitest';
import { ACCESS_PRESETS, MODULE_ACCESS, navigationAllowed, banksSectionAllowed, presetOverrides, visibleModules } from '../../src/application/tenancy/accessNavigation';
describe('Capability-driven navigation',()=>{
 it.each(['BANKS_FULL','BANKS_IMPORT','BANKS_READ','FINANCE_REVIEW'])('%s exposes only entitled Banks',key=>{
  const can=c=>ACCESS_PRESETS[key].grants.includes(c),enabled=()=>true;
  expect(Object.keys(MODULE_ACCESS).filter(m=>navigationAllowed(m,can,enabled))).toEqual(['Bancos']);
  expect(navigationAllowed('Config',can,enabled)).toBe(false);
  expect(navigationAllowed('PlatformAdmin',can,enabled)).toBe(false);
  expect(banksSectionAllowed('Consolidado',can)).toBe(true);
  expect(banksSectionAllowed('Resumen',can)).toBe(key!=='BANKS_IMPORT');
  expect(banksSectionAllowed('Gráficas',can)).toBe(key!=='BANKS_IMPORT');
 });
 it('entitlement without capability and capability without entitlement grant nothing',()=>{
  expect(navigationAllowed('Bancos',()=>false,()=>true)).toBe(false);
  expect(navigationAllowed('Bancos',()=>true,()=>false)).toBe(false);
  expect(navigationAllowed('unknown',()=>true,()=>true)).toBe(false);
 });
 it('platform catalog discovery never authorizes tenant module execution',()=>{
  const keys=[...Object.keys(MODULE_ACCESS),'PlatformAdmin','Config'];
  expect(visibleModules(keys,()=>false,()=>false,()=>true,'platform')).toEqual(keys);
  expect(navigationAllowed('Ventas',()=>false,()=>false,()=>true)).toBe(false);
  expect(visibleModules(keys,()=>false,()=>false,()=>true,'organization')).toEqual(['PlatformAdmin','Config']);
 });
 it('Banks-only access lands in Banks and tenant changes cannot retain Sales discovery',()=>{
  const keys=Object.keys(MODULE_ACCESS), banks=c=>ACCESS_PRESETS.BANKS_READ.grants.includes(c);
  expect(visibleModules(keys,banks,key=>key==='bancos',()=>false,'organization')).toEqual(['Bancos']);
  expect(visibleModules(keys,banks,()=>false,()=>false,'organization')).toEqual([]);
  expect(navigationAllowed('Bancos',c=>c==='banks.summary.view',()=>true)).toBe(false);
 });
 it('platform and tenant administrative entry points are independent',()=>{
  expect(navigationAllowed('PlatformAdmin',()=>false,()=>false,()=>true)).toBe(true);
  expect(navigationAllowed('Config',()=>false,()=>false,()=>true)).toBe(false);
  expect(navigationAllowed('PlatformAdmin',()=>true,()=>true,()=>false)).toBe(false);
 });
 it('preset denies unrelated inherited capabilities and explicitly grants only its allowlist',()=>{
  expect(presetOverrides('BANKS_IMPORT',[{code:'sales.view'},{code:'banks.consolidated.view'}])).toEqual([{capability:'sales.view',effect:'REVOKE'},{capability:'banks.consolidated.view',effect:'GRANT'}]);
 });
});
