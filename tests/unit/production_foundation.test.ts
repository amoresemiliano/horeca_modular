import { describe, it, expect } from 'vitest';
import { decimalAtoms, decimalString, packagedQuantity } from '../../src/modules/produccion/domain/quantities';
import { evaluateRequirement } from '../../src/modules/produccion/domain/planning';
import { ProductionService } from '../../src/modules/produccion/application/ProductionService';
import type { ProductionCommand } from '../../src/modules/produccion/domain/contracts';

describe('Production exact quantities and planning projections', () => {
  it('keeps 20 packages x 1.5 kg exactly 30 kg', () => expect(packagedQuantity(20, '1.5')).toBe('30.000000'));
  it('does not accumulate binary-float error', () => expect(packagedQuantity(3, '0.1')).toBe('0.300000'));
  it.each([0, -1, 0.5, NaN, Infinity, 2_147_483_648])('rejects invalid count %s', count => expect(() => packagedQuantity(count, '1.5')).toThrow());
  it.each(['', 'unknown', 'NaN', 'Infinity', '1e3', '1,5', '0.0000001'])('rejects unknown/unsafe conversion %s', value => expect(() => packagedQuantity(20, value)).toThrow());
  it.each(['0', '-1'])('rejects nonpositive net quantity %s', value => expect(() => packagedQuantity(20, value)).toThrow());
  it('preserves signed stock for planning rather than silently clamping it', () => {
    expect(decimalString(decimalAtoms('-0.1'))).toBe('-0.100000');
    expect(evaluateRequirement('30', '100', '-5')).toEqual({ state: 'CRITICAL', suggestedQuantity: '105.000000' });
  });
  it.each([['29','CRITICAL','71.000000'],['30','NECESSARY','70.000000'],['47.5','OPTIMAL','0.000000'],['100','OPTIMAL','0.000000'],['101','EXCESS','0.000000']])('approved planning boundary %s', (actual, state, suggestedQuantity) => expect(evaluateRequirement('30','100',actual)).toEqual({ state, suggestedQuantity }));
  it('handles equal limits without division and missing stock without inventing zero', () => {
    expect(evaluateRequirement('30','30','30').state).toBe('OPTIMAL');
    expect(evaluateRequirement('30','100',null)).toEqual({ state: 'UNKNOWN', suggestedQuantity: null });
  });
  it.each([['-1','30'],['31','30']])('rejects invalid limits %s / %s', (min,max) => expect(() => evaluateRequirement(min,max,'0')).toThrow());
  it('rejects output overflow', () => expect(() => packagedQuantity(2,'99999999999999')).toThrow('QUANTITY_OVERFLOW'));
});

describe('Production RPC boundary', () => {
  it('sends commands exclusively to the trusted RPC, without direct table writes', async () => {
    const request = { request_id:'synthetic' } as ProductionCommand;
    const result = { entity_id:'synthetic',revision:1,status:'DRAFT' };
    const service = new ProductionService({ rpc: async (name,args) => {
      expect(name).toBe('production_execute_command'); expect(args.request).toBe(request);
      return {data:result,error:null};
    }});
    expect(await service.execute(request)).toEqual(result);
  });
  it('does not surface internal database errors', async () => {
    const service = new ProductionService({rpc:async()=>({data:null,error:{code:'42501',message:'Private details'}})});
    await expect(service.execute({} as ProductionCommand)).rejects.toThrow('PRODUCTION_ACCESS_DENIED');
  });
});
