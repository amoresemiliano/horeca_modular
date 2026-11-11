/**
 * Attendance Calculation Service
 * 
 * DOMAIN SEMANTICS:
 * - Expected schedule is NOT actual attendance.
 * - Variances, durations, and status calculations are DERIVED from canonical data.
 * - Spain reference timezone: Europe/Madrid by default, but parameterized by operational unit timezone.
 */

import { AttendanceRecord, AttendanceStatus, EmployeeSchedule } from '../types/personnel';

export interface VarianceCalculation {
  arrivalVarianceMinutes: number; // positive = late, negative = early
  departureVarianceMinutes: number; // positive = stayed later, negative = left earlier
  expectedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number; // actualMinutes - expectedMinutes
  status: AttendanceStatus;
  readableArrival: string;
  readableDeparture: string;
  readableTotal: string;
}

/**
 * Parses time string "HH:mm" into minutes since midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Formats minutes into human-readable Spanish hospitality string (e.g., "7 h 15 min" or "6 h 56 min")
 */
export function formatMinutesToHours(minutes: number): string {
  const isNegative = minutes < 0;
  const absMin = Math.abs(minutes);
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;

  let str = '';
  if (h > 0) str += `${h} h`;
  if (m > 0 || h === 0) str += `${h > 0 ? ' ' : ''}${m} min`;
  return isNegative ? `-${str}` : str;
}

/**
 * Derives variances and status given an expected schedule and actual punches
 */
export function deriveAttendanceMetrics(
  schedule?: EmployeeSchedule,
  actualClockIn?: string, // e.g. "10:12" or ISO
  actualClockOut?: string, // e.g. "17:08" or ISO
  hasOpenIncident?: boolean
): VarianceCalculation {
  if (hasOpenIncident) {
    return {
      arrivalVarianceMinutes: 0,
      departureVarianceMinutes: 0,
      expectedMinutes: schedule ? timeStringToMinutes(schedule.expectedEndTime) - timeStringToMinutes(schedule.expectedStartTime) : 0,
      actualMinutes: 0,
      varianceMinutes: 0,
      status: 'INCIDENCIA',
      readableArrival: 'Incidencia registrada',
      readableDeparture: 'Incidencia',
      readableTotal: '0 h',
    };
  }

  // If no schedule exists, derive purely from punches
  if (!schedule) {
    const inMin = actualClockIn ? timeStringToMinutes(extractTime(actualClockIn)) : 0;
    const outMin = actualClockOut ? timeStringToMinutes(extractTime(actualClockOut)) : 0;
    const actualMin = actualClockIn && actualClockOut ? Math.max(0, outMin - inMin) : 0;

    return {
      arrivalVarianceMinutes: 0,
      departureVarianceMinutes: 0,
      expectedMinutes: 0,
      actualMinutes: actualMin,
      varianceMinutes: actualMin,
      status: actualClockOut ? 'FINALIZADO' : actualClockIn ? 'EN_CURSO' : 'PENDIENTE',
      readableArrival: actualClockIn ? extractTime(actualClockIn) : 'Sin horario',
      readableDeparture: actualClockOut ? extractTime(actualClockOut) : 'En curso',
      readableTotal: formatMinutesToHours(actualMin),
    };
  }

  const expectedStartMin = timeStringToMinutes(schedule.expectedStartTime);
  const expectedEndMin = timeStringToMinutes(schedule.expectedEndTime);
  const expectedTotal = Math.max(0, expectedEndMin - expectedStartMin);

  // If employee has not clocked in yet
  if (!actualClockIn) {
    // Check if shift is in the future or already missed
    return {
      arrivalVarianceMinutes: 0,
      departureVarianceMinutes: 0,
      expectedMinutes: expectedTotal,
      actualMinutes: 0,
      varianceMinutes: -expectedTotal,
      status: 'PENDIENTE',
      readableArrival: 'Pendiente de entrada',
      readableDeparture: 'Pendiente',
      readableTotal: `Esperado: ${formatMinutesToHours(expectedTotal)}`,
    };
  }

  const actualStartMin = timeStringToMinutes(extractTime(actualClockIn));
  const arrivalVariance = actualStartMin - expectedStartMin; // positive = late

  // If currently clocked in but not clocked out yet
  if (!actualClockOut) {
    const isLate = arrivalVariance > 5; // tolerance of 5 minutes in hospitality
    return {
      arrivalVarianceMinutes: arrivalVariance,
      departureVarianceMinutes: 0,
      expectedMinutes: expectedTotal,
      actualMinutes: 0,
      varianceMinutes: 0,
      status: isLate ? 'RETRASO' : 'EN_CURSO',
      readableArrival: arrivalVariance > 0 ? `+${arrivalVariance} min tarde` : arrivalVariance < 0 ? `${Math.abs(arrivalVariance)} min antes` : 'Puntual',
      readableDeparture: 'Turno en curso',
      readableTotal: 'En curso...',
    };
  }

  // Both clock in and clock out are present
  const actualEndMin = timeStringToMinutes(extractTime(actualClockOut));
  const departureVariance = actualEndMin - expectedEndMin; // positive = stayed later
  const actualTotal = Math.max(0, actualEndMin - actualStartMin);
  const totalVariance = actualTotal - expectedTotal;

  let finalStatus: AttendanceStatus = 'FINALIZADO';
  if (arrivalVariance > 5) {
    finalStatus = 'RETRASO';
  } else if (arrivalVariance <= 5 && arrivalVariance >= -5) {
    finalStatus = 'A_TIEMPO';
  }

  return {
    arrivalVarianceMinutes: arrivalVariance,
    departureVarianceMinutes: departureVariance,
    expectedMinutes: expectedTotal,
    actualMinutes: actualTotal,
    varianceMinutes: totalVariance,
    status: finalStatus,
    readableArrival: arrivalVariance > 0 ? `+${arrivalVariance} min tarde` : arrivalVariance < 0 ? `${Math.abs(arrivalVariance)} min antes` : 'A tiempo',
    readableDeparture: departureVariance > 0 ? `+${departureVariance} min` : departureVariance < 0 ? `${departureVariance} min` : 'A tiempo',
    readableTotal: formatMinutesToHours(actualTotal),
  };
}

export function extractTime(timeOrIso: string): string {
  if (!timeOrIso) return '';
  if (timeOrIso.includes('T')) {
    const date = new Date(timeOrIso);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return timeOrIso.substring(0, 5);
}
