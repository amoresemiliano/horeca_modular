import {describe,it,expect} from 'vitest';
import {pageWindow} from '../../src/modules/personnel-live/Pagination';
describe('Personnel pagination windows',()=>{
 it('defaults to ten rows and calculates final-page counts',()=>{expect(pageWindow(37)).toMatchObject({page:1,pages:4,offset:0,end:10,size:10});expect(pageWindow(37,4)).toMatchObject({offset:30,end:37});});
 it.each([[25,2,25],[50,1,37],['all',1,37]])('supports page size %s', (size,pages,end)=>expect(pageWindow(37,1,size)).toMatchObject({pages,end,size}));
 it('bounds stale, empty and invalid preferences without dropping records',()=>{expect(pageWindow(0,9)).toMatchObject({page:1,offset:0,end:0});expect(pageWindow(3,9,25)).toMatchObject({page:1,offset:0,end:3});expect(pageWindow(37,-2,12)).toMatchObject({page:1,size:10});expect(pageWindow(37,2.5)).toMatchObject({page:2,offset:10});});
});
