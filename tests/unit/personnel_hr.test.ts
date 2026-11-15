import {describe,it,expect} from 'vitest';
import {incidentPdf} from '../../server/personnel/hrPdf';
import {leaveProjection} from '../../src/modules/personnel-live/hr/leaveContext';
describe('HR document and leave integration',()=>{
 it('writes bounded multi-page PDF with escaped text and valid byte offsets',()=>{const pdf=incidentPdf(['Descripción (confidencial) \\ español',...Array.from({length:120},()=> 'Texto de seguimiento')]);expect(pdf.subarray(0,8).toString()).toBe('%PDF-1.4');const text=pdf.toString('latin1');expect(text).toContain('/Count 3');expect(text).toContain('\\(confidencial\\)');const xref=Number(text.match(/startxref\n(\d+)/)?.[1]);expect(text.slice(xref,xref+4)).toBe('xref');});
 it('marks approved leave without hiding real punches or mutating schedule facts',()=>{const row={employee:{id:'e'},schedule:{date:'2040-01-02'},clockIn:null,clockOut:null,status:'MISSING_CLOCK_IN',late:true};const leave=[{employeeId:'e',start:'2040-01-01',end:'2040-01-03'}];expect(leaveProjection(row,leave).status).toBe('APPROVED_LEAVE');expect(row.status).toBe('MISSING_CLOCK_IN');expect(leaveProjection({...row,clockIn:'actual'},leave).status).toBe('MISSING_CLOCK_IN');expect(leaveProjection(row,[])).toBe(row);});
});
