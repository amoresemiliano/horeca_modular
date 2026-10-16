import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ProductionService } from './application/ProductionService';
import { ProductionReadService } from './application/ProductionReadService';
import { ProductionWorkspace } from './ui/ProductionWorkspace';

const commands=new ProductionService(supabase);
const reads=new ProductionReadService(supabase);

export default function ProduccionApp({tabActiva}) {
  const {user,organizationId,activeOperationalUnit,can,isModuleEnabled}=useAuth();
  const unitId=activeOperationalUnit?.id;
  const entitled=Boolean(organizationId&&unitId&&isModuleEnabled('produccion'));
  const allowed=code=>entitled&&can(code,unitId);
  const access={view:allowed('production.view'),log:allowed('production.batch.log'),confirm:allowed('production.batch.confirm'),
    correct:allowed('production.batch.correct'),plan:allowed('production.plan.manage'),wasteLog:allowed('production.waste.log'),wasteConfirm:allowed('production.waste.confirm')};
  return <ProductionWorkspace key={`${user?.id}/${organizationId}/${unitId}`} scope={{organizationId:organizationId||'',operationalUnitId:unitId||''}}
    unitLabel={activeOperationalUnit?.name||'Unidad operativa'} access={access} reads={reads} commands={commands} initialTab={tabActiva}/>;
}
