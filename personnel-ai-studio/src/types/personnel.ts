/**
 * HORECA Modular - Personnel & Attendance Domain Types
 * Designed for multi-tenant SaaS, strictly separating expected schedules from actual attendance,
 * and maintaining Employee != User separation.
 */

export type TenantId = string;
export type OrganizationId = string;
export type OperationalUnitId = string;
export type EmployeeId = string;

export interface Organization {
  id: OrganizationId;
  name: string;
  code: string;
  brandName: string;
  taxId: string; // CIF / NIF
}

export interface OperationalUnit {
  id: OperationalUnitId;
  organizationId: OrganizationId;
  name: string;
  code: string;
  type: 'RESTAURANTE' | 'SUCURSAL' | 'OBRADOR' | 'CENTRAL';
  address: string;
  city: string;
  timezone: string; // e.g. 'Europe/Madrid'
  contactPhone: string;
}

export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
export type ContractType = 'INDEFINIDO' | 'TEMPORAL' | 'FIJO_DISCONTINUO' | 'PRACTICAS' | 'FORMACION';
export type PinStatus = 'CONFIGURED' | 'PENDING' | 'LOCKED';

export interface EmployeePersonalInfo {
  firstName: string;
  lastName: string;
  preferredName?: string;
  documentId: string; // DNI / NIE / Pasaporte
  phone: string;
  email: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  avatarUrl?: string;
}

export interface EmployeeEmploymentInfo {
  position: string; // Cocina, Sala, Obrador, Barra, Reparto, etc.
  primaryOperationalUnitId: OperationalUnitId;
  operationalUnitIds: OperationalUnitId[]; // Multi-unit capability
  startDate: string; // YYYY-MM-DD
  employmentStatus: EmploymentStatus;
  contractType: ContractType;
  weeklyContractedHours: number;
  hourlyCost?: number;
  monthlyGrossSalary?: number;
}

export interface EmployeeOperationalInfo {
  pinStatus: PinStatus;
  hasPin: boolean;
  pinFailedAttempts?: number;
  pinLockedUntil?: string; // ISO string if throttled
}

export interface Employee {
  id: EmployeeId;
  organizationId: OrganizationId;
  personalInfo: EmployeePersonalInfo;
  employmentInfo: EmployeeEmploymentInfo;
  operationalInfo: EmployeeOperationalInfo;
  createdAt: string;
  updatedAt: string;
}

/**
 * SCHEDULE: The expected shift assigned to an employee by management.
 */
export interface EmployeeSchedule {
  id: string;
  employeeId: EmployeeId;
  operationalUnitId: OperationalUnitId;
  date: string; // YYYY-MM-DD
  expectedStartTime: string; // HH:mm
  expectedEndTime: string; // HH:mm
  breakMinutes?: number;
  notes?: string;
  createdAt: string;
}

export type PunchType = 'CLOCK_IN' | 'CLOCK_OUT';
export type PunchDevice = 'KIOSK' | 'MOBILE' | 'MANUAL_ADMIN';

export interface AttendancePunch {
  id: string;
  attendanceRecordId: string;
  type: PunchType;
  timestamp: string; // ISO timestamp
  timeFormatted: string; // HH:mm in unit timezone
  deviceType: PunchDevice;
  verifiedByPin: boolean;
  observation?: string;
}

export type AttendanceStatus =
  | 'A_TIEMPO'
  | 'RETRASO'
  | 'PENDIENTE'
  | 'AUSENTE'
  | 'INCIDENCIA'
  | 'FINALIZADO'
  | 'EN_CURSO';

/**
 * ATTENDANCE: Actual punches recorded by employee or audited by manager.
 * Differences from expected schedule are DERIVED.
 */
export interface AttendanceRecord {
  id: string;
  employeeId: EmployeeId;
  operationalUnitId: OperationalUnitId;
  date: string; // YYYY-MM-DD
  expectedScheduleId?: string;
  
  // Actual punch timestamps
  actualClockIn?: string; // ISO timestamp
  actualClockOut?: string; // ISO timestamp
  clockInTimeFormatted?: string; // HH:mm
  clockOutTimeFormatted?: string; // HH:mm
  
  punches: AttendancePunch[];
  
  // Derived metrics
  arrivalVarianceMinutes: number; // positive = late, negative = early
  departureVarianceMinutes: number;
  expectedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number; // actual - expected
  
  status: AttendanceStatus;
  
  // Auditable correction trail
  isManualCorrection?: boolean;
  correctionReason?: string;
  correctedBy?: string;
  correctedAt?: string;
  originalClockIn?: string;
  originalClockOut?: string;
}

export interface IncidentType {
  id: string;
  code: string;
  label: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  severity: 'BAJA' | 'MEDIA' | 'ALTA';
}

export type IncidentStatus = 'ABIERTA' | 'REVISADA' | 'RESUELTA';

export interface PersonnelIncident {
  id: string;
  employeeId: EmployeeId;
  operationalUnitId: OperationalUnitId;
  date: string; // YYYY-MM-DD
  incidentTypeId: string;
  incidentTypeLabel: string;
  title: string;
  description: string;
  attendanceRecordId?: string;
  supportingDocumentId?: string;
  status: IncidentStatus;
  createdBy: string;
  createdAt: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface AbsenceType {
  id: string;
  code: string;
  label: string;
  color: string;
  requiresApproval: boolean;
  requiresDocument: boolean;
  isPaid: boolean;
  isActive: boolean;
  isDefault: boolean;
}

export type AbsenceStatus = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';

export interface EmployeeAbsence {
  id: string;
  employeeId: EmployeeId;
  absenceTypeId: string;
  absenceTypeLabel: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isPartialDay: boolean;
  partialHours?: number;
  reasonNotes?: string;
  documentUrl?: string;
  documentName?: string;
  status: AbsenceStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: EmployeeId;
  month: number; // 1-12
  year: number;
  grossSalary: number;
  netSalary: number;
  employerCost: number;
  socialSecurityCompany: number;
  otherDeductions?: number;
  documentPdfName: string;
  documentPdfUrl: string;
  storageReference: string;
  notes?: string;
  paidAt?: string;
}

export type EmployeeDocumentType =
  | 'CONTRATO'
  | 'NOMINA'
  | 'BAJA_MEDICA'
  | 'ALTA_MEDICA'
  | 'DNI_NIE'
  | 'CERTIFICADO_MEDICO'
  | 'FORMACION_ALERGENOS'
  | 'MANIPULADOR_ALIMENTOS'
  | 'PERMISO_TRABAJO'
  | 'OTRO';

export interface EmployeeDocument {
  id: string;
  employeeId: EmployeeId;
  documentType: EmployeeDocumentType;
  title: string;
  issueDate: string;
  expiryDate?: string;
  notes?: string;
  uploadedBy: string;
  uploadedAt: string;
  storageReference: string; // points to simulated Bluehost secure path
  fileSize: string;
  downloadUrl?: string;
}

export type NotificationChannel = 'WHATSAPP' | 'EMAIL';
export type NotificationTemplateType =
  | 'ABSENCE_APPROVED'
  | 'ABSENCE_REJECTED'
  | 'DOCUMENT_RECEIVED'
  | 'INCIDENT_ALERT'
  | 'SCHEDULE_CHANGE'
  | 'CUSTOM';

export interface NotificationRecord {
  id: string;
  employeeId: EmployeeId;
  recipientPhone: string;
  recipientName: string;
  channel: NotificationChannel;
  templateType: NotificationTemplateType;
  messageBody: string;
  sentAt?: string;
  status: 'BORRADOR' | 'ENVIADO' | 'SIMULADO';
  createdBy: string;
}

/**
 * Access capabilities & role context
 */
export type PersonnelRole = 'PERSONNEL_ADMIN' | 'KIOSK_TERMINAL' | 'PLATFORM_SUPERADMIN';

export interface ModuleEntitlement {
  personnelOnly: boolean;
  availableModules: {
    id: string;
    label: string;
    enabled: boolean;
    status: 'ACTIVE' | 'DEVELOPMENT';
  }[];
}
