// Synthetic provider boundary only. No network or hosted credentials.
import {bankRead,bankRpc} from './financeService';
export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}},error:null})},rpc:bankRpc,from(table){
 const filters={};let inside,start=0,end=499;
 const q={select(){return q;},eq(key,value){filters[key]=value;return q;},in(_key,values){inside=values;return q;},order(){return q;},range(a,b){start=a;end=b;return q;},maybeSingle(){return Promise.resolve({data:bankRead(table,filters,inside,start,end)[0]||null,error:null});},then(resolve,reject){return Promise.resolve({data:bankRead(table,filters,inside,start,end),error:null}).then(resolve,reject);}};return q;
}};
