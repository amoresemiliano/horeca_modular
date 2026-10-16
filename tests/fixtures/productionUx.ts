import type { BatchDetail, BatchRecord, OwnerContext, ProductionScope } from '../../src/modules/produccion/application/readModels';
import { businessToday } from '../../src/modules/produccion/application/workflow';

// Isolated UI/application doubles only; never imported by the runtime entry or persisted hosted.
export const scope:ProductionScope={organizationId:'f7f6da70-f7dc-4b1a-aa23-f5612174dcbc',operationalUnitId:'30000000-0000-4000-8000-000000000001'};
export const product='50000000-0000-4000-8000-000000000001',pack='60000000-0000-4000-8000-000000000001',version='60000000-0000-4000-8000-000000000002';
export const location='70000000-0000-4000-8000-000000000001',line='80000000-0000-4000-8000-000000000001',batchId='90000000-0000-4000-8000-000000000001';
export function ownerFixture():OwnerContext {return {available:true,
  products:[{id:product,organization_id:scope.organizationId,approved:true,label:'Preparación sintética DEV LAB',base_unit:'kg',loose_allowed:true}],
  packages:[{id:pack,version,organization_id:scope.organizationId,approved:true,product_id:product,label:'Envase sintético 1,5 kg',net_quantity:'1.500000',unit:'kg'}],
  locations:[{id:location,organization_id:scope.organizationId,operational_unit_id:scope.operationalUnitId,approved:true,label:'Destino sintético DEV LAB'}],recipes:[],stock:[],
};}
export function batchFixture():BatchRecord {return {
  id:batchId,organization_id:scope.organizationId,operational_unit_id:scope.operationalUnitId,effective_date:businessToday(),recorded_at:'2026-10-16T10:00:00+00:00',actor_profile_id:'20000000-0000-4000-8000-000000000001',status:'DRAFT',revision:1,current_execution_id:null,execution:null,
  draft:{mode:'MANUAL_OUTPUT',effective_date:businessToday(),shift:'Mañana',notes:'Synthetic UI test only',outputs:[{line_id:line,product_id:product,mode:'PACKAGED',package_id:pack,package_version:version,unit_count:20,quantity:'30.000000',unit:'kg',conversion_snapshot:{net_quantity:'1.500000'},destination_location_id:location}],consumptions:[]},
};}
export function detailFixture():BatchDetail {return {batch:batchFixture(),executions:[],wastes:[],outbox:[],truncated:false};}
