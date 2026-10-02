import { describe,it,expect } from 'vitest';
import { authFlowForLocation } from '../../src/context/authCallback';
describe('Secure setup callback flow selection',()=>{
 it.each(['invite','recovery'])('accepts server-initiated %s callback on the setup route',type=>expect(authFlowForLocation({pathname:'/reset-password',hash:'#type='+type+'&access_token=synthetic'})).toBe('implicit'));
 it.each([null,{pathname:'/',hash:'#type=invite&access_token=synthetic'},{pathname:'/reset-password',hash:'#type=invite'},{pathname:'/reset-password',hash:'#type=signup&access_token=synthetic'},{pathname:'/reset-password',hash:'',search:'?code=synthetic'}])('preserves PKCE for ordinary or incomplete callbacks',location=>expect(authFlowForLocation(location)).toBe('pkce'));
});
