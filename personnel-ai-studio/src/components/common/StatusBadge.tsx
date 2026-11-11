import React from 'react';
import { AttendanceStatus, AbsenceStatus, IncidentStatus } from '../../types/personnel';
import { CheckCircle2, Clock, AlertTriangle, AlertCircle, XCircle, PlayCircle, Calendar } from 'lucide-react';

interface StatusBadgeProps {
  status: AttendanceStatus | AbsenceStatus | IncidentStatus | string;
  size?: 'sm' | 'md';
  customLabel?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', customLabel }) => {
  const isSm = size === 'sm';

  switch (status) {
    // Attendance Statuses
    case 'A_TIEMPO':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/70 rounded-md ${isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
          <CheckCircle2 className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
          <span>{customLabel || 'A tiempo'}</span>
        </span>
      );

    case 'RETRASO':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium text-amber-800 bg-amber-50 border border-amber-200/70 rounded-md ${isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
          <Clock className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
          <span>{customLabel || 'Retraso'}</span>
        </span>
      );

    case 'PENDIENTE':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium text-slate-600 bg-slate-100 border border-slate-200/70 rounded-md ${isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
          <Clock className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
          <span>{customLabel || 'Pendiente'}</span>
        </span>
      );

    case 'EN_CURSO':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium text-sky-700 bg-sky-50 border border-sky-200/70 rounded-md ${isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
          <PlayCircle className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
          <span>{customLabel || 'En curso'}</span>
        </span>
      );

    case 'AUSENTE':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium text-rose-700 bg-rose-50 border border-rose-200/70 rounded-md ${isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
          <XCircle className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
          <span>{customLabel || 'Ausente'}</span>
        </span>
      );

    case 'INCIDENCIA':
    case 'ABIERTA':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium text-amber-700 bg-amber-50 border border-amber-200/70 rounded-md ${isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
          <AlertTriangle className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
          <span>{customLabel || (status === 'ABIERTA' ? 'Abierta' : 'Incidencia')}</span>
        </span>
      );

    case 'FINALIZADO':
    case 'APROBADA':
    case 'RESUELTA':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium text-slate-700 bg-slate-100 border border-slate-200/80 rounded-md ${isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
          <CheckCircle2 className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
          <span>{customLabel || (status === 'APROBADA' ? 'Aprobada' : status === 'RESUELTA' ? 'Resuelta' : 'Finalizado')}</span>
        </span>
      );

    case 'REVISADA':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium text-blue-700 bg-blue-50 border border-blue-200/70 rounded-md ${isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
          <Clock className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
          <span>{customLabel || 'Revisada'}</span>
        </span>
      );

    case 'RECHAZADA':
    case 'CANCELADA':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-md ${isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
          <XCircle className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
          <span>{customLabel || (status === 'RECHAZADA' ? 'Rechazada' : 'Cancelada')}</span>
        </span>
      );

    default:
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-md ${isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
          <span>{customLabel || status}</span>
        </span>
      );
  }
};
