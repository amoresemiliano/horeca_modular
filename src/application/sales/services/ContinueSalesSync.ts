/** Client orchestration only; offsets and checkpoint ownership stay on the server. */
export interface SyncContinuationResult {
  id:string;status:string;continuationVersion:number;continuationRequired:boolean;records_fetched:number;retryAfterMs?:number;
}
export async function continueSalesSyncUntilSettled<T extends SyncContinuationResult>(initial:T,
  invoke:(input:{action:string;organizationId:string;runId:string;version:number})=>Promise<T>,
  organizationId:string,onProgress:(result:T)=>void,isActive:()=>boolean,
  wait:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))) {
  let result=initial;
  while(isActive()) {
    onProgress(result);
    if(!result.continuationRequired||result.status==='FAILED')break;
    if(result.retryAfterMs)await wait(Math.min(result.retryAfterMs,5000));
    if(!isActive())break;
    result=await invoke({action:'continue',organizationId,runId:result.id,version:result.continuationVersion});
  }
  return result;
}
