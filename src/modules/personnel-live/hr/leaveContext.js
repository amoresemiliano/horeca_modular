// Read-only overlay. Punches, corrections and original schedules remain authoritative facts.
export function leaveProjection(row,approved){
 const leave=approved.some(l=>l.employeeId===row.employee.id&&row.schedule.date>=l.start&&row.schedule.date<=l.end);
 if(!leave||row.clockIn||row.clockOut||row.corrected)return row;
 return {...row,status:'APPROVED_LEAVE',late:false,approvedLeave:true};
}
