/**
 * Servicio para interactuar con Google Sheets API
 */

import { googleAuth } from './googleAuth';

const getAccessToken = (): string => {
  const token = googleAuth.getAccessToken();
  if (!token) {
    throw new Error('No hay token de acceso. Por favor inicia sesión.');
  }
  return token;
};

/**
 * Agrega una fila al final de una hoja de cálculo de Google Sheets
 * @param spreadsheetId ID de la hoja de cálculo
 * @param values Array de valores para cada columna
 */
export const appendLogRow = async (
  spreadsheetId: string,
  values: string[]
): Promise<void> => {
  if (!spreadsheetId || spreadsheetId.trim() === '') {
    throw new Error('ID de hoja de cálculo no proporcionado');
  }

  const token = getAccessToken();

  // Para append, el formato correcto según la documentación de Google Sheets API es:
  // /values/{range}:append donde {range} es el nombre de la hoja seguido de ! y el rango
  // La hoja se llama "LOGS"
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/LOGS!A:A:append?valueInputOption=USER_ENTERED`;

  console.log('[Sheets API] Intentando escribir en:', spreadsheetId);
  console.log('[Sheets API] Valores:', values);
  console.log('[Sheets API] URL:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [values],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: { message: response.statusText } };
    }
    
    console.error('[Sheets API] Error completo:', errorData);
    
    const errorMessage = errorData.error?.message || `Error al escribir en la hoja de cálculo: ${response.statusText}`;
    
    // Si el error indica que la API no está habilitada, proporcionar un mensaje más útil
    if (errorMessage.includes('has not been used') || errorMessage.includes('is disabled') || errorMessage.includes('Enable it')) {
      const projectMatch = errorMessage.match(/project\s+(\d+)/);
      const projectId = projectMatch ? projectMatch[1] : 'tu-proyecto';
      const enableUrl = `https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=${projectId}`;
      
      throw new Error(
        `La API de Google Sheets no está habilitada en tu proyecto.\n\n` +
        `Por favor, habilítala visitando:\n${enableUrl}\n\n` +
        `O visita: https://console.cloud.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId}\n\n` +
        `Después de habilitarla, espera unos minutos y vuelve a intentar.`
      );
    }
    
    throw new Error(errorMessage);
  }

  const result = await response.json();
  console.log('[Sheets API] Éxito:', result);
  return result;
};
