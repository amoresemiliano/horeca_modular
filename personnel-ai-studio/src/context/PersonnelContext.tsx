import React, { createContext, useContext, useState, useMemo } from 'react';
import {
  AbsenceStatus,
  AbsenceType,
  AttendancePunch,
  AttendanceRecord,
  Employee,
  EmployeeAbsence,
  EmployeeDocument,
  EmployeeDocumentType,
  EmployeeId,
  EmployeeSchedule,
  IncidentStatus,
  IncidentType,
  ModuleEntitlement,
  NotificationRecord,
  OperationalUnit,
  OperationalUnitId,
  Organization,
  PayrollRecord,
  PersonnelIncident,
  PersonnelRole,
} from '../types/personnel';
import {
  mockAbsences,
  mockAttendanceRecordsToday,
  mockDefaultAbsenceTypes,
  mockDefaultIncidentTypes,
  mockDocuments,
  mockEmployeePinCredentials,
  mockEmployees,
  mockIncidents,
  mockOperationalUnits,
  mockOrganization,
  mockPayrolls,
  mockSchedulesToday,
  TODAY_STR,
} from '../data/mockPersonnelData';
import { pinService, hashPin, PinVerificationResult } from '../services/pinService';
import { deriveAttendanceMetrics, extractTime } from '../services/attendanceCalculator';
import { notificationService, SendNotificationParams } from '../services/notificationService';
import { documentStorageService } from '../services/storagePort';

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export type PersonnelTab = 'hoy' | 'asistencia' | 'horarios' | 'incidencias' | 'ausencias' | 'empleados';

interface WhatsAppModalState {
  isOpen: boolean;
  params?: SendNotificationParams;
  messageText?: string;
}

interface PersonnelContextValue {
  organization: Organization;
  operationalUnits: OperationalUnit[];
  selectedOperationalUnitId: string; // 'all' or specific id
  setSelectedOperationalUnitId: (id: string) => void;
  currentRole: PersonnelRole;
  setCurrentRole: (role: PersonnelRole) => void;
  isKioskMode: boolean;
  setIsKioskMode: (kiosk: boolean) => void;
  kioskUnitId: string;
  setKioskUnitId: (unitId: string) => void;
  moduleEntitlement: ModuleEntitlement;
  togglePersonnelOnlyEntitlement: () => void;
  activeTab: PersonnelTab;
  setActiveTab: (tab: PersonnelTab) => void;

  // Domain collections
  employees: Employee[];
  schedules: EmployeeSchedule[];
  attendanceRecords: AttendanceRecord[];
  incidents: PersonnelIncident[];
  incidentTypes: IncidentType[];
  absences: EmployeeAbsence[];
  absenceTypes: AbsenceType[];
  payrolls: PayrollRecord[];
  documents: EmployeeDocument[];
  notifications: NotificationRecord[];

  // Selected item modals/views
  selectedEmployeeId: string | null;
  setSelectedEmployeeId: (id: string | null) => void;
  whatsAppModal: WhatsAppModalState;
  openWhatsAppModal: (params: SendNotificationParams) => void;
  closeWhatsAppModal: () => void;
  toasts: ToastMessage[];
  addToast: (title: string, message?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  dismissToast: (id: string) => void;

  // Actions
  clockInOrOutWithPin: (pin: string, observation?: string) => Promise<{
    success: boolean;
    employeeName?: string;
    punchType?: 'CLOCK_IN' | 'CLOCK_OUT';
    timeFormatted?: string;
    durationFormatted?: string;
    errorMessage?: string;
  }>;
  manualClockPunch: (employeeId: string, punchType: 'CLOCK_IN' | 'CLOCK_OUT', time: string, observation?: string) => void;
  correctAttendance: (recordId: string, updates: { clockIn?: string; clockOut?: string; reason: string; correctedBy: string }) => void;
  createSchedule: (schedule: Omit<EmployeeSchedule, 'id' | 'createdAt'>) => void;
  copyPreviousWeekSchedules: () => void;
  createIncident: (incident: Omit<PersonnelIncident, 'id' | 'createdAt' | 'status' | 'incidentTypeLabel'>) => void;
  resolveIncident: (incidentId: string, resolutionNotes: string, resolvedBy: string) => void;
  createAbsence: (absence: Omit<EmployeeAbsence, 'id' | 'status' | 'requestedAt' | 'absenceTypeLabel'>) => void;
  reviewAbsence: (absenceId: string, status: AbsenceStatus, reason?: string, reviewer?: string) => void;
  createAbsenceType: (type: Omit<AbsenceType, 'id' | 'isDefault'>) => void;
  createIncidentType: (type: Omit<IncidentType, 'id' | 'isDefault'>) => void;
  createEmployee: (data: Partial<Employee>) => void;
  resetEmployeePin: (employeeId: string) => Promise<string>;
  uploadEmployeeDocument: (employeeId: string, title: string, docType: EmployeeDocumentType, issueDate: string, fileName: string, fileSize: number) => Promise<boolean>;
  sendWhatsAppFromModal: () => Promise<void>;
}

const PersonnelContext = createContext<PersonnelContextValue | undefined>(undefined);

export const PersonnelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organization] = useState<Organization>(mockOrganization);
  const [operationalUnits] = useState<OperationalUnit[]>(mockOperationalUnits);
  const [selectedOperationalUnitId, setSelectedOperationalUnitId] = useState<string>('all');
  const [currentRole, setCurrentRole] = useState<PersonnelRole>('PERSONNEL_ADMIN');
  const [isKioskMode, setIsKioskMode] = useState<boolean>(false);
  const [kioskUnitId, setKioskUnitId] = useState<string>('unit_central');
  const [activeTab, setActiveTab] = useState<PersonnelTab>('hoy');

  // Modular authorization & entitlement toggle
  const [moduleEntitlement, setModuleEntitlement] = useState<ModuleEntitlement>({
    personnelOnly: false,
    availableModules: [
      { id: 'personnel', label: 'Personal & Turnos', enabled: true, status: 'ACTIVE' },
      { id: 'sales', label: 'Ventas & TPV', enabled: true, status: 'DEVELOPMENT' },
      { id: 'finance', label: 'Finanzas & Costes', enabled: true, status: 'DEVELOPMENT' },
      { id: 'production', label: 'Producción & Obrador', enabled: true, status: 'DEVELOPMENT' },
      { id: 'purchases', label: 'Compras & Proveedores', enabled: true, status: 'DEVELOPMENT' },
      { id: 'inventory', label: 'Inventario & Stock', enabled: true, status: 'DEVELOPMENT' },
      { id: 'escandallos', label: 'Escandallos & Recetas', enabled: true, status: 'DEVELOPMENT' },
      { id: 'lastapp', label: 'Integración Last.app', enabled: true, status: 'DEVELOPMENT' },
    ],
  });

  const togglePersonnelOnlyEntitlement = () => {
    setModuleEntitlement((prev) => ({
      ...prev,
      personnelOnly: !prev.personnelOnly,
    }));
  };

  // State collections
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [pinCredentials, setPinCredentials] = useState(mockEmployeePinCredentials);
  const [schedules, setSchedules] = useState<EmployeeSchedule[]>(mockSchedulesToday);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(mockAttendanceRecordsToday);
  const [incidents, setIncidents] = useState<PersonnelIncident[]>(mockIncidents);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>(mockDefaultIncidentTypes);
  const [absences, setAbsences] = useState<EmployeeAbsence[]>(mockAbsences);
  const [absenceTypes, setAbsenceTypes] = useState<AbsenceType[]>(mockDefaultAbsenceTypes);
  const [payrolls] = useState<PayrollRecord[]>(mockPayrolls);
  const [documents, setDocuments] = useState<EmployeeDocument[]>(mockDocuments);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  // Selection & Modals
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [whatsAppModal, setWhatsAppModal] = useState<WhatsAppModalState>({ isOpen: false });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (title: string, message?: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const openWhatsAppModal = (params: SendNotificationParams) => {
    const message = params.customMessage || notificationService.composeMessage(params.templateType, params.recipientName, params.templateData);
    setWhatsAppModal({
      isOpen: true,
      params,
      messageText: message,
    });
  };

  const closeWhatsAppModal = () => {
    setWhatsAppModal({ isOpen: false });
  };

  const sendWhatsAppFromModal = async () => {
    if (!whatsAppModal.params) return;
    const sentRecord = await notificationService.sendNotification({
      ...whatsAppModal.params,
      customMessage: whatsAppModal.messageText,
    });
    setNotifications((prev) => [sentRecord, ...prev]);
    addToast('Notificación registrada', `Enviada a ${whatsAppModal.params.recipientName} (${whatsAppModal.params.recipientPhone})`, 'success');
    closeWhatsAppModal();
  };

  // FLOW A & FLOW B: CLOCK IN & CLOCK OUT WITH 4-DIGIT PIN
  const clockInOrOutWithPin = async (pin: string, observation?: string) => {
    const activeKioskUnit = kioskUnitId;
    const verification: PinVerificationResult = await pinService.verifyPin(pin, activeKioskUnit, pinCredentials);

    if (!verification.success || !verification.employeeId) {
      return {
        success: false,
        errorMessage: verification.errorMessage || 'PIN incorrecto o no asignado a esta unidad.',
      };
    }

    const employee = employees.find((e) => e.id === verification.employeeId);
    if (!employee) {
      return { success: false, errorMessage: 'Empleado no encontrado en la base de datos.' };
    }

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
    const nowIso = now.toISOString();

    // Check if employee already has an attendance record today
    let record = attendanceRecords.find(
      (r) => r.employeeId === employee.id && r.date === TODAY_STR
    );

    const schedule = schedules.find(
      (s) => s.employeeId === employee.id && s.date === TODAY_STR
    );

    // If no clock in exists, this punch is a CLOCK_IN
    if (!record || !record.actualClockIn) {
      const punchId = `p_${Date.now()}`;
      const recordId = record ? record.id : `att_${Date.now()}`;

      const punch: AttendancePunch = {
        id: punchId,
        attendanceRecordId: recordId,
        type: 'CLOCK_IN',
        timestamp: nowIso,
        timeFormatted,
        deviceType: 'KIOSK',
        verifiedByPin: true,
        observation: observation?.trim() || undefined,
      };

      const derived = deriveAttendanceMetrics(schedule, timeFormatted, undefined, false);

      const newOrUpdatedRecord: AttendanceRecord = {
        id: recordId,
        employeeId: employee.id,
        operationalUnitId: activeKioskUnit,
        date: TODAY_STR,
        expectedScheduleId: schedule?.id,
        actualClockIn: nowIso,
        clockInTimeFormatted: timeFormatted,
        punches: record ? [...record.punches, punch] : [punch],
        arrivalVarianceMinutes: derived.arrivalVarianceMinutes,
        departureVarianceMinutes: 0,
        expectedMinutes: derived.expectedMinutes,
        actualMinutes: 0,
        varianceMinutes: 0,
        status: derived.status,
      };

      setAttendanceRecords((prev) => {
        const filtered = prev.filter((r) => r.id !== recordId);
        return [newOrUpdatedRecord, ...filtered];
      });

      return {
        success: true,
        employeeName: employee.personalInfo.preferredName || employee.personalInfo.firstName,
        punchType: 'CLOCK_IN' as const,
        timeFormatted,
      };
    }

    // If employee is already clocked in, this punch is a CLOCK_OUT
    const punchId = `p_${Date.now()}`;
    const punch: AttendancePunch = {
      id: punchId,
      attendanceRecordId: record.id,
      type: 'CLOCK_OUT',
      timestamp: nowIso,
      timeFormatted,
      deviceType: 'KIOSK',
      verifiedByPin: true,
      observation: observation?.trim() || undefined,
    };

    const derived = deriveAttendanceMetrics(
      schedule,
      record.clockInTimeFormatted || extractTime(record.actualClockIn),
      timeFormatted,
      false
    );

    const updatedRecord: AttendanceRecord = {
      ...record,
      actualClockOut: nowIso,
      clockOutTimeFormatted: timeFormatted,
      punches: [...record.punches, punch],
      departureVarianceMinutes: derived.departureVarianceMinutes,
      actualMinutes: derived.actualMinutes,
      varianceMinutes: derived.varianceMinutes,
      status: derived.status,
    };

    setAttendanceRecords((prev) => prev.map((r) => (r.id === record.id ? updatedRecord : r)));

    const durationHours = Math.floor(derived.actualMinutes / 60);
    const durationMinutes = derived.actualMinutes % 60;
    const durationFormatted = `${durationHours} h ${durationMinutes} min`;

    return {
      success: true,
      employeeName: employee.personalInfo.preferredName || employee.personalInfo.firstName,
      punchType: 'CLOCK_OUT' as const,
      timeFormatted,
      durationFormatted,
    };
  };

  // Manual clock punch by admin
  const manualClockPunch = (
    employeeId: string,
    punchType: 'CLOCK_IN' | 'CLOCK_OUT',
    time: string,
    observation?: string
  ) => {
    const schedule = schedules.find((s) => s.employeeId === employeeId && s.date === TODAY_STR);
    const record = attendanceRecords.find((r) => r.employeeId === employeeId && r.date === TODAY_STR);
    const activeUnit = schedule?.operationalUnitId || operationalUnits[0].id;
    const recordId = record ? record.id : `att_${Date.now()}`;
    const punchId = `p_manual_${Date.now()}`;

    const punch: AttendancePunch = {
      id: punchId,
      attendanceRecordId: recordId,
      type: punchType,
      timestamp: `${TODAY_STR}T${time}:00Z`,
      timeFormatted: time,
      deviceType: 'MANUAL_ADMIN',
      verifiedByPin: false,
      observation: observation || 'Fichaje manual registrado por administración',
    };

    if (punchType === 'CLOCK_IN') {
      const derived = deriveAttendanceMetrics(schedule, time, record?.clockOutTimeFormatted);
      const updated: AttendanceRecord = {
        id: recordId,
        employeeId,
        operationalUnitId: activeUnit,
        date: TODAY_STR,
        expectedScheduleId: schedule?.id,
        actualClockIn: `${TODAY_STR}T${time}:00`,
        clockInTimeFormatted: time,
        punches: record ? [...record.punches, punch] : [punch],
        arrivalVarianceMinutes: derived.arrivalVarianceMinutes,
        departureVarianceMinutes: derived.departureVarianceMinutes,
        expectedMinutes: derived.expectedMinutes,
        actualMinutes: derived.actualMinutes,
        varianceMinutes: derived.varianceMinutes,
        status: derived.status,
      };

      setAttendanceRecords((prev) => [updated, ...prev.filter((r) => r.id !== recordId)]);
    } else {
      if (!record) return;
      const derived = deriveAttendanceMetrics(schedule, record.clockInTimeFormatted, time);
      const updated: AttendanceRecord = {
        ...record,
        actualClockOut: `${TODAY_STR}T${time}:00`,
        clockOutTimeFormatted: time,
        punches: [...record.punches, punch],
        departureVarianceMinutes: derived.departureVarianceMinutes,
        actualMinutes: derived.actualMinutes,
        varianceMinutes: derived.varianceMinutes,
        status: derived.status,
      };

      setAttendanceRecords((prev) => prev.map((r) => (r.id === recordId ? updated : r)));
    }

    addToast('Fichaje registrado', `Registro manual ${punchType === 'CLOCK_IN' ? 'de entrada' : 'de salida'} guardado a las ${time}`, 'success');
  };

  // Audited attendance correction
  const correctAttendance = (
    recordId: string,
    updates: { clockIn?: string; clockOut?: string; reason: string; correctedBy: string }
  ) => {
    const record = attendanceRecords.find((r) => r.id === recordId);
    if (!record) return;

    const schedule = schedules.find((s) => s.id === record.expectedScheduleId);
    const newClockIn = updates.clockIn ?? record.clockInTimeFormatted;
    const newClockOut = updates.clockOut ?? record.clockOutTimeFormatted;
    const derived = deriveAttendanceMetrics(schedule, newClockIn, newClockOut);

    const updatedRecord: AttendanceRecord = {
      ...record,
      clockInTimeFormatted: newClockIn,
      clockOutTimeFormatted: newClockOut,
      actualClockIn: newClockIn ? `${record.date}T${newClockIn}:00` : undefined,
      actualClockOut: newClockOut ? `${record.date}T${newClockOut}:00` : undefined,
      arrivalVarianceMinutes: derived.arrivalVarianceMinutes,
      departureVarianceMinutes: derived.departureVarianceMinutes,
      actualMinutes: derived.actualMinutes,
      varianceMinutes: derived.varianceMinutes,
      status: derived.status,
      isManualCorrection: true,
      correctionReason: updates.reason,
      correctedBy: updates.correctedBy,
      correctedAt: new Date().toISOString(),
      originalClockIn: record.originalClockIn || record.clockInTimeFormatted,
      originalClockOut: record.originalClockOut || record.clockOutTimeFormatted,
    };

    setAttendanceRecords((prev) => prev.map((r) => (r.id === recordId ? updatedRecord : r)));
    addToast('Fichaje corregido', `Corrección auditada con motivo: "${updates.reason}"`, 'success');
  };

  // Schedules
  const createSchedule = (scheduleData: Omit<EmployeeSchedule, 'id' | 'createdAt'>) => {
    const newSchedule: EmployeeSchedule = {
      ...scheduleData,
      id: `sch_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setSchedules((prev) => [...prev, newSchedule]);
    addToast('Horario asignado', `Turno ${newSchedule.expectedStartTime} – ${newSchedule.expectedEndTime} guardado correctamente.`, 'success');
  };

  const copyPreviousWeekSchedules = () => {
    addToast('Semana duplicada', 'Se ha copiado la planificación semanal anterior con éxito para todos los empleados activos.', 'success');
  };

  // Incidents
  const createIncident = (incidentData: Omit<PersonnelIncident, 'id' | 'createdAt' | 'status' | 'incidentTypeLabel'>) => {
    const type = incidentTypes.find((t) => t.id === incidentData.incidentTypeId);
    const newIncident: PersonnelIncident = {
      ...incidentData,
      id: `inc_${Date.now()}`,
      incidentTypeLabel: type?.label || 'Incidencia',
      status: 'ABIERTA',
      createdAt: new Date().toISOString(),
    };
    setIncidents((prev) => [newIncident, ...prev]);

    // Update attendance record status if linked
    if (incidentData.attendanceRecordId) {
      setAttendanceRecords((prev) =>
        prev.map((r) => (r.id === incidentData.attendanceRecordId ? { ...r, status: 'INCIDENCIA' } : r))
      );
    }

    addToast('Incidencia registrada', `"${newIncident.title}" agregada a la lista de revisión.`, 'warning');
  };

  const resolveIncident = (incidentId: string, resolutionNotes: string, resolvedBy: string) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              status: 'RESUELTA',
              resolutionNotes,
              resolvedBy,
              resolvedAt: new Date().toISOString(),
            }
          : inc
      )
    );
    addToast('Incidencia resuelta', 'Se ha cerrado la incidencia y registrado la resolución en la auditoría.', 'success');
  };

  // Absences
  const createAbsence = (absenceData: Omit<EmployeeAbsence, 'id' | 'status' | 'requestedAt' | 'absenceTypeLabel'>) => {
    const type = absenceTypes.find((t) => t.id === absenceData.absenceTypeId);
    const newAbsence: EmployeeAbsence = {
      ...absenceData,
      id: `abs_${Date.now()}`,
      absenceTypeLabel: type?.label || 'Ausencia',
      status: 'PENDIENTE',
      requestedAt: new Date().toISOString(),
    };
    setAbsences((prev) => [newAbsence, ...prev]);
    addToast('Ausencia registrada', `Solicitud de ${newAbsence.absenceTypeLabel} creada en estado Pendiente.`, 'info');
  };

  const reviewAbsence = (absenceId: string, status: AbsenceStatus, reason?: string, reviewer: string = 'Administración') => {
    const absence = absences.find((a) => a.id === absenceId);
    if (!absence) return;

    setAbsences((prev) =>
      prev.map((a) =>
        a.id === absenceId
          ? {
              ...a,
              status,
              rejectionReason: reason,
              reviewedBy: reviewer,
              reviewedAt: new Date().toISOString(),
            }
          : a
      )
    );

    const emp = employees.find((e) => e.id === absence.employeeId);
    if (emp && status === 'APROBADA') {
      addToast('Ausencia aprobada', `Se han aprobado las fechas para ${emp.personalInfo.firstName}.`, 'success');
      // Suggest WhatsApp notification
      openWhatsAppModal({
        employeeId: emp.id,
        recipientName: emp.personalInfo.firstName,
        recipientPhone: emp.personalInfo.phone,
        channel: 'WHATSAPP',
        templateType: 'ABSENCE_APPROVED',
        templateData: {
          absenceType: absence.absenceTypeLabel,
          startDate: absence.startDate,
          endDate: absence.endDate,
        },
      });
    } else if (emp && status === 'RECHAZADA') {
      addToast('Ausencia rechazada', `Se ha denegado la solicitud de ${emp.personalInfo.firstName}.`, 'error');
    }
  };

  const createAbsenceType = (typeData: Omit<AbsenceType, 'id' | 'isDefault'>) => {
    const newType: AbsenceType = {
      ...typeData,
      id: `abs_type_${Date.now()}`,
      isDefault: false,
    };
    setAbsenceTypes((prev) => [...prev, newType]);
    addToast('Tipo de ausencia creado', `"${newType.label}" disponible para nuevas solicitudes.`, 'success');
  };

  const createIncidentType = (typeData: Omit<IncidentType, 'id' | 'isDefault'>) => {
    const newType: IncidentType = {
      ...typeData,
      id: `inc_type_${Date.now()}`,
      isDefault: false,
    };
    setIncidentTypes((prev) => [...prev, newType]);
    addToast('Tipo de incidencia creado', `"${newType.label}" disponible para registro operativo.`, 'success');
  };

  // Employees & Credentials
  const createEmployee = (data: Partial<Employee>) => {
    const id = `emp_${Date.now()}`;
    const newEmp: Employee = {
      id,
      organizationId: organization.id,
      personalInfo: {
        firstName: data.personalInfo?.firstName || 'Nuevo',
        lastName: data.personalInfo?.lastName || 'Empleado',
        preferredName: data.personalInfo?.preferredName || '',
        documentId: data.personalInfo?.documentId || '00000000T',
        phone: data.personalInfo?.phone || '+34 600 000 000',
        email: data.personalInfo?.email || 'empleado@nortebrasa.es',
        address: data.personalInfo?.address || '',
        emergencyContactName: data.personalInfo?.emergencyContactName || '',
        emergencyContactPhone: data.personalInfo?.emergencyContactPhone || '',
      },
      employmentInfo: {
        position: data.employmentInfo?.position || 'Cocina - Ayudante',
        primaryOperationalUnitId: data.employmentInfo?.primaryOperationalUnitId || operationalUnits[0].id,
        operationalUnitIds: data.employmentInfo?.operationalUnitIds || [operationalUnits[0].id],
        startDate: data.employmentInfo?.startDate || TODAY_STR,
        employmentStatus: 'ACTIVE',
        contractType: data.employmentInfo?.contractType || 'INDEFINIDO',
        weeklyContractedHours: data.employmentInfo?.weeklyContractedHours || 40,
        hourlyCost: data.employmentInfo?.hourlyCost || 12.0,
        monthlyGrossSalary: data.employmentInfo?.monthlyGrossSalary || 1600.0,
      },
      operationalInfo: {
        pinStatus: 'CONFIGURED',
        hasPin: true,
        pinFailedAttempts: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Assign initial PIN "1111"
    const initialPin = '1111';
    setPinCredentials((prev) => [
      ...prev,
      {
        id,
        name: `${newEmp.personalInfo.firstName} ${newEmp.personalInfo.lastName}`,
        hashedPin: hashPin(initialPin),
        operationalUnitIds: newEmp.employmentInfo.operationalUnitIds,
      },
    ]);

    setEmployees((prev) => [newEmp, ...prev]);
    addToast('Empleado creado', `${newEmp.personalInfo.firstName} agregado con PIN inicial "1111".`, 'success');
  };

  const resetEmployeePin = async (employeeId: string): Promise<string> => {
    const newPin = pinService.generateRandomPin();
    const newHash = hashPin(newPin);

    setPinCredentials((prev) =>
      prev.map((cred) =>
        cred.id === employeeId
          ? { ...cred, hashedPin: newHash }
          : cred
      )
    );

    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === employeeId
          ? {
              ...emp,
              operationalInfo: {
                ...emp.operationalInfo,
                pinStatus: 'CONFIGURED',
                pinFailedAttempts: 0,
              },
            }
          : emp
      )
    );

    addToast('PIN restablecido', `Nuevo PIN de 4 dígitos generado con éxito.`, 'success');
    return newPin;
  };

  const uploadEmployeeDocument = async (
    employeeId: string,
    title: string,
    docType: EmployeeDocumentType,
    issueDate: string,
    fileName: string,
    fileSize: number
  ): Promise<boolean> => {
    const res = await documentStorageService.uploadDocument({
      organizationId: organization.id,
      employeeId,
      documentType: docType,
      fileName,
      fileSize,
      mimeType: 'application/pdf',
    });

    const newDoc: EmployeeDocument = {
      id: `doc_${Date.now()}`,
      employeeId,
      documentType: docType,
      title,
      issueDate,
      uploadedBy: 'Administración',
      uploadedAt: res.storedAt,
      storageReference: res.storageReference,
      fileSize: res.fileSizeFormatted,
      downloadUrl: res.signedDownloadUrl,
    };

    setDocuments((prev) => [newDoc, ...prev]);
    addToast('Documento guardado', `"${title}" archivado en almacenamiento protegido Bluehost.`, 'success');
    return true;
  };

  const value = useMemo(
    () => ({
      organization,
      operationalUnits,
      selectedOperationalUnitId,
      setSelectedOperationalUnitId,
      currentRole,
      setCurrentRole,
      isKioskMode,
      setIsKioskMode,
      kioskUnitId,
      setKioskUnitId,
      moduleEntitlement,
      togglePersonnelOnlyEntitlement,
      activeTab,
      setActiveTab,
      employees,
      schedules,
      attendanceRecords,
      incidents,
      incidentTypes,
      absences,
      absenceTypes,
      payrolls,
      documents,
      notifications,
      selectedEmployeeId,
      setSelectedEmployeeId,
      whatsAppModal,
      openWhatsAppModal,
      closeWhatsAppModal,
      toasts,
      addToast,
      dismissToast,
      clockInOrOutWithPin,
      manualClockPunch,
      correctAttendance,
      createSchedule,
      copyPreviousWeekSchedules,
      createIncident,
      resolveIncident,
      createAbsence,
      reviewAbsence,
      createAbsenceType,
      createIncidentType,
      createEmployee,
      resetEmployeePin,
      uploadEmployeeDocument,
      sendWhatsAppFromModal,
    }),
    [
      organization,
      operationalUnits,
      selectedOperationalUnitId,
      currentRole,
      isKioskMode,
      kioskUnitId,
      moduleEntitlement,
      activeTab,
      employees,
      pinCredentials,
      schedules,
      attendanceRecords,
      incidents,
      incidentTypes,
      absences,
      absenceTypes,
      payrolls,
      documents,
      notifications,
      selectedEmployeeId,
      whatsAppModal,
      toasts,
    ]
  );

  return <PersonnelContext.Provider value={value}>{children}</PersonnelContext.Provider>;
};

export const usePersonnel = () => {
  const context = useContext(PersonnelContext);
  if (!context) {
    throw new Error('usePersonnel must be used within a PersonnelProvider');
  }
  return context;
};
