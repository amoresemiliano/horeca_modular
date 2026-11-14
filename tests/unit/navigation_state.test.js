import { afterEach, describe, it, expect, vi } from 'vitest';
import { readContext,saveContext,clearContext,readRoute,saveRoute } from '../../src/context/navigationState';
afterEach(()=>vi.unstubAllGlobals());
function setup(){const entries=new Map();vi.stubGlobal('localStorage',{getItem:k=>entries.get(k),setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)});vi.stubGlobal('window',{location:{href:'https://example.invalid/'}});vi.stubGlobal('history',{replaceState:vi.fn()});return entries;}
describe('Non-authoritative navigation preferences',()=>{
 it('preserves organization/unit/module/section through new component lifetimes, scoped to identity',()=>{setup();saveContext('a',{organizationId:'org',unitId:'unit',navigationScope:'organization'});saveRoute('a','Personal','Horarios');expect(readContext('a')).toMatchObject({organizationId:'org',unitId:'unit'});expect(readRoute('a')).toEqual({module:'Personal',section:'Horarios'});expect(readContext('b')).toEqual({});});
 it('clears protected context and route on logout and tolerates blocked storage',()=>{const entries=setup();saveRoute('a','Personal','Fichaje');clearContext('a');expect(entries.size).toBe(0);expect(history.replaceState).toHaveBeenLastCalledWith(null,'','/');vi.stubGlobal('localStorage',{getItem:()=>{throw Error('blocked')}});expect(readContext('a')).toEqual({});});
});
