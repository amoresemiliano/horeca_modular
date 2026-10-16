import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductionWorkspace } from '../../../src/modules/produccion/ui/ProductionWorkspace';
import type { ProductionAccess, ProductionCommandPort, ProductionReadPort, BatchDetail, ExecutionSnapshot, OwnerContext } from '../../../src/modules/produccion/application/readModels';
import type { ExecutionDeclaration, ProductionCommand, ProductionOutboxEvent, WasteDeclaration } from '../../../src/modules/produccion/domain/contracts';
import { packagedQuantity } from '../../../src/modules/produccion/domain/quantities';
import { detailFixture, ownerFixture, scope, product, line } from '../../fixtures/productionUx';

// Test doubles only: this entry cannot reach Supabase and is absent from the app bundle.
const params=new URLSearchParams(location.search),scenario=params.get('scenario')||'owner';
const control={commands:[] as ProductionCommand[],failNext:'',failReads:false};
Object.assign(window,{productionTest:control});
const store=new Map<string,BatchDetail>();
function normalize(body:ExecutionDeclaration):ExecutionSnapshot {return {mode:body.mode,effective_date:body.effective_date,shift:body.shift,notes:body.notes,
  outputs:body.outputs.map(o=>({...o,package_id:o.mode==='PACKAGED'?o.package_id:null,package_version:o.mode==='PACKAGED'?o.package_version:null,unit_count:o.mode==='PACKAGED'?o.count:null,quantity:o.mode==='PACKAGED'?packagedQuantity(o.count,'1.5'):o.quantity,unit:'kg',conversion_snapshot:o.mode==='PACKAGED'?{net_quantity:'1.500000'}:{}})),consumptions:body.consumptions};}
function appendExecution(detail:BatchDetail,action:'CONFIRM'|'CORRECT'|'REVERSE',snapshot:ExecutionSnapshot,reason?:string) {
  const original=detail.batch.current_execution_id,id=crypto.randomUUID();
  detail.executions.unshift({id,batch_revision:detail.batch.revision,action,snapshot:structuredClone(snapshot),supersedes_execution_id:original,reason:reason||null,actor_profile_id:detail.batch.actor_profile_id,recorded_at:new Date().toISOString()});
  detail.batch.current_execution_id=id;detail.batch.execution={snapshot:structuredClone(snapshot)};
  const event=(type:ProductionOutboxEvent['event_type'])=>({event_id:crypto.randomUUID(),schema_version:1,event_type:type,organization_id:scope.organizationId,operational_unit_id:scope.operationalUnitId,batch_id:detail.batch.id,batch_revision:detail.batch.revision,line_id:line,command_id:crypto.randomUUID(),effective_date:snapshot.effective_date,occurred_at:new Date().toISOString(),actor_profile_id:detail.batch.actor_profile_id,correlation_id:detail.batch.id,payload:{},supersedes_event_id:null,delivery_state:'PENDING'} as ProductionOutboxEvent);
  if(original)detail.outbox.push(event('EXECUTION_COMPENSATION_REQUIRED'));
  if(snapshot.outputs.length)detail.outbox.push(event('OUTPUT_CONFIRMED'));
}
if(scenario!=='operator'&&scenario!=='unavailable'){
  const detail=detailFixture();detail.batch.draft.consumptions=[{line_id:'80000000-0000-4000-8000-000000000002',product_id:product,quantity:'35.000000',unit:'kg',source_location_id:ownerFixture().locations[0].id}];
  if(scenario==='reader'){detail.batch.status='CONFIRMED';detail.batch.revision=2;appendExecution(detail,'CONFIRM',detail.batch.draft);}
  store.set(detail.batch.id,detail);
}
const policy={id:'a0000000-0000-4000-8000-000000000001',product_id:product,stock_scope:{location_ids:ownerFixture().locations.map(l=>l.id)},minimum:'30',maximum:'100',unit:'kg' as const,revision:1};
const reads:ProductionReadPort={
  async history(request,filter){if(control.failReads)throw Error('PRODUCTION_READ_FAILED');return {items:[...store.values()].map(d=>structuredClone(d.batch)).filter(b=>b.organization_id===request.organizationId&&b.operational_unit_id===request.operationalUnitId&&(!filter.date||b.effective_date===filter.date)&&(!filter.status||b.status===filter.status)&&(!filter.productId||(b.execution?.snapshot||b.draft).outputs.some(o=>o.product_id===filter.productId))),next:undefined};},
  async policies(){return {items:[structuredClone(policy)]};},
  async detail(request,id){const d=store.get(id);if(!d||d.batch.organization_id!==request.organizationId||d.batch.operational_unit_id!==request.operationalUnitId)throw Error('PRODUCTION_READ_FAILED');return structuredClone(d);},
};
const owners={async load():Promise<OwnerContext>{const refs=ownerFixture();
  if(scenario==='unavailable')return {...refs,available:false,products:[],packages:[],locations:[],stock:[]};
  if(scenario==='unknown')refs.packages[0].net_quantity='';
  if(params.has('actual'))refs.stock=[{policyId:policy.id,actual:params.get('actual')||null,unit:'kg',organization_id:scope.organizationId,operational_unit_id:scope.operationalUnitId,observedAt:'2026-10-16T10:00:00Z',version:'isolated-v1'}];
  return refs;
}};
const commands:ProductionCommandPort={async execute(request){
  control.commands.push(structuredClone(request));await new Promise(resolve=>setTimeout(resolve,120));
  if(control.failNext){const error=control.failNext;control.failNext='';throw Error(error);}
  let detail=store.get(request.entity_id);
  if(request.command==='create_draft'){
    detail=detailFixture();detail.batch.id=request.entity_id;detail.batch.draft=normalize(request.body as ExecutionDeclaration);detail.batch.effective_date=detail.batch.draft.effective_date;detail.batch.revision=1;store.set(request.entity_id,detail);
  }else if(request.command==='save_policy')return {entity_id:request.entity_id,revision:1,status:'POLICY_SAVED'};
  else {
    if(!detail||detail.batch.revision!==request.expected_revision)throw Error('STALE_REVISION');
    detail.batch.revision++;
    if(request.command==='update_draft'){detail.batch.draft=normalize(request.body as ExecutionDeclaration);detail.batch.effective_date=detail.batch.draft.effective_date;}
    if(request.command==='confirm_batch'){detail.batch.status='CONFIRMED';appendExecution(detail,'CONFIRM',normalize(request.body as ExecutionDeclaration));}
    if(request.command==='correct_batch'){const body=request.body as {reason:string;execution:ExecutionDeclaration};detail.batch.status='CORRECTED';const snapshot=normalize(body.execution);detail.batch.effective_date=snapshot.effective_date;appendExecution(detail,'CORRECT',snapshot,body.reason);}
    if(request.command==='reverse_batch'){detail.batch.status='REVERSED';appendExecution(detail,'REVERSE',{...detail.batch.execution!.snapshot,outputs:[],consumptions:[]},(request.body as {reason:string}).reason);}
    if(request.command==='cancel_draft')detail.batch.status='CANCELLED';
    if(request.command==='log_waste'){const body=request.body as WasteDeclaration;detail.wastes.push({...body,id:body.waste_id,execution_id:detail.batch.current_execution_id!,actor_profile_id:detail.batch.actor_profile_id,recorded_at:new Date().toISOString(),confirmed:false});}
    if(request.command==='confirm_waste'){const waste=detail.wastes.find(w=>w.id===(request.body as {waste_id:string}).waste_id);if(waste)waste.confirmed=true;}
  }
  return {entity_id:request.entity_id,revision:detail!.batch.revision,status:request.command==='log_waste'?'WASTE_LOGGED':request.command==='confirm_waste'?'WASTE_CONFIRMED':detail!.batch.status};
}};
const access:ProductionAccess={view:scenario!=='denied',log:scenario!=='reader',confirm:scenario!=='reader'&&scenario!=='operator',correct:scenario!=='reader'&&scenario!=='operator',plan:scenario!=='reader',wasteLog:scenario!=='reader',wasteConfirm:scenario!=='reader'&&scenario!=='operator'};
function Fixture(){const [unit,setUnit]=useState(scope.operationalUnitId);return <main style={{padding:16,fontFamily:'system-ui',background:'#f7f8fa',minHeight:'100vh'}}><p>HORECA DEV LAB · isolated UI test</p><button onClick={()=>setUnit('30000000-0000-4000-8000-000000000002')}>Test scope switch</button><ProductionWorkspace key={unit} scope={{...scope,operationalUnitId:unit}} unitLabel="Cocina sintética DEV LAB" access={access} reads={reads} commands={commands} owners={owners}/></main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
