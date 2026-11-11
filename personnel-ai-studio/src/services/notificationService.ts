/**
 * Personnel Notification Service & WhatsApp Port
 * 
 * ARCHITECTURE PRINCIPLE:
 * Do not hardcode a specific WhatsApp vendor (Twilio, Meta Cloud API, 360dialog)
 * into visual UI components. Provide a clean port that composes verified templates,
 * logs notification audits, and can optionally launch a WhatsApp deep-link (`https://wa.me/...`)
 * or route to official API workers in production.
 */

import { NotificationChannel, NotificationRecord, NotificationTemplateType } from '../types/personnel';

export interface SendNotificationParams {
  employeeId: string;
  recipientName: string;
  recipientPhone: string;
  channel: NotificationChannel;
  templateType: NotificationTemplateType;
  customMessage?: string;
  templateData?: Record<string, string>;
  createdBy?: string;
}

export interface PersonnelNotificationPort {
  composeMessage(type: NotificationTemplateType, recipientName: string, data?: Record<string, string>): string;
  generateWhatsAppLink(phone: string, text: string): string;
  sendNotification(params: SendNotificationParams): Promise<NotificationRecord>;
}

export class PersonnelNotificationService implements PersonnelNotificationPort {
  /**
   * Generates friendly, respectful Spanish HORECA messages according to Spanish labor customs.
   */
  composeMessage(type: NotificationTemplateType, recipientName: string, data?: Record<string, string>): string {
    const name = recipientName.split(' ')[0] || recipientName;

    switch (type) {
      case 'ABSENCE_APPROVED': {
        const absenceType = data?.absenceType || 'vacaciones';
        const start = data?.startDate || 'fecha indicada';
        const end = data?.endDate || 'fecha indicada';
        return `Hola ${name}, te informamos de que tu solicitud de ${absenceType.toLowerCase()} del ${start} al ${end} ha sido aprobada. ¡Un saludo del equipo!`;
      }

      case 'ABSENCE_REJECTED': {
        const absenceType = data?.absenceType || 'ausencia';
        const reason = data?.reason ? ` Motivo: ${data.reason}.` : '';
        return `Hola ${name}, tu solicitud de ${absenceType.toLowerCase()} no ha podido ser aprobada.${reason} Por favor, ponte en contacto con administración si tienes dudas.`;
      }

      case 'DOCUMENT_RECEIVED': {
        const docTitle = data?.docTitle || 'la documentación';
        return `Hola ${name}, te confirmamos que hemos recibido y validado correctamente ${docTitle} en tu expediente de personal. Muchas gracias.`;
      }

      case 'INCIDENT_ALERT': {
        const date = data?.date || 'tu jornada reciente';
        const incidentType = data?.incidentType || 'un aviso de fichaje';
        return `Hola ${name}, se ha registrado una incidencia (${incidentType.toLowerCase()}) en relación con tu jornada del ${date}. Por favor, revísalo con tu responsable de turno.`;
      }

      case 'SCHEDULE_CHANGE': {
        const date = data?.date || 'esta semana';
        const shift = data?.shift || 'tu turno';
        return `Hola ${name}, se ha actualizado tu cuadrante de trabajo para el ${date}: nuevo horario ${shift}. Puedes consultarlo con tu responsable.`;
      }

      case 'CUSTOM':
      default:
        return `Hola ${name}, te escribimos desde el departamento de personal de HORECA Modular.`;
    }
  }

  /**
   * Builds clean international wa.me URL for Spain (+34 default)
   */
  generateWhatsAppLink(phone: string, text: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('34') ? cleanPhone : `34${cleanPhone}`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
  }

  async sendNotification(params: SendNotificationParams): Promise<NotificationRecord> {
    const body = params.customMessage || this.composeMessage(params.templateType, params.recipientName, params.templateData);

    const record: NotificationRecord = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      employeeId: params.employeeId,
      recipientName: params.recipientName,
      recipientPhone: params.recipientPhone,
      channel: params.channel,
      templateType: params.templateType,
      messageBody: body,
      sentAt: new Date().toISOString(),
      status: 'SIMULADO',
      createdBy: params.createdBy || 'Administrador de Personal',
    };

    return record;
  }
}

export const notificationService = new PersonnelNotificationService();
