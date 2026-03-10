/**
 * Servicio para enviar notificaciones a Google Chat
 */

const CHAT_WEBHOOK_URL = import.meta.env.VITE_GOOGLE_CHAT_WEBHOOK_URL || '';
const DIAGRAMACION_EMAIL = import.meta.env.VITE_GOOGLE_CHAT_DIAGRAMACION_EMAIL || '';

interface NotificationData {
  userEmail: string;
  userName?: string;
  fileName: string;
  folderPath: string;
  imageCount?: number;
}

/**
 * Envía una notificación a Google Chat mencionando al usuario origen y al equipo de diagramación
 */
export const sendChatNotification = async (data: NotificationData): Promise<void> => {
  // Verificar que el webhook esté configurado
  if (!CHAT_WEBHOOK_URL || CHAT_WEBHOOK_URL.trim() === '') {
    console.warn('[Chat] Webhook de Google Chat no configurado (VITE_GOOGLE_CHAT_WEBHOOK_URL)');
    return;
  }

  // Verificar que el email de diagramación esté configurado
  if (!DIAGRAMACION_EMAIL || DIAGRAMACION_EMAIL.trim() === '') {
    console.warn('[Chat] Email de diagramación no configurado (VITE_GOOGLE_CHAT_DIAGRAMACION_EMAIL)');
    return;
  }

  try {
    // Construir el mensaje
    const fechaHora = new Date().toLocaleString('es-ES', {
      dateStyle: 'long',
      timeStyle: 'medium'
    });

    const userName = data.userName || data.userEmail.split('@')[0];
    const imageText = data.imageCount && data.imageCount > 0 
      ? `\n📷 ${data.imageCount} imagen${data.imageCount > 1 ? 'es' : ''} adjunta${data.imageCount > 1 ? 's' : ''}`
      : '';

    // Construir el mensaje con formato compatible con Google Chat
    // Las menciones en Google Chat se hacen con <users/email> o simplemente @email dependiendo de la versión
    const message = {
      text: `✅ *Nueva inyección de contenido completada*\n\n` +
            `👤 *Usuario:* <users/${data.userEmail}> (${userName})\n` +
            `📄 *Archivo:* ${data.fileName}\n` +
            `📁 *Carpeta:* ${data.folderPath}${imageText}\n` +
            `🕐 *Fecha/Hora:* ${fechaHora}\n\n` +
            `📋 *Notificar a:* <users/${DIAGRAMACION_EMAIL}>`
    };

    console.log('[Chat] Enviando notificación a Google Chat:', {
      userEmail: data.userEmail,
      fileName: data.fileName,
      folderPath: data.folderPath
    });

    const response = await fetch(CHAT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Chat] Error al enviar notificación:', response.status, errorText);
      throw new Error(`Error al enviar notificación a Google Chat: ${response.statusText}`);
    }

    console.log('[Chat] Notificación enviada exitosamente');
  } catch (error: any) {
    // No interrumpir el flujo si falla la notificación, solo loguear el error
    console.error('[Chat] Error al enviar notificación a Google Chat:', error);
    // No lanzar el error para no interrumpir el flujo principal
  }
};
