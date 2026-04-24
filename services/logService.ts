/**
 * Servicio para interactuar con el sistema de logs local (SQLite)
 */

interface LogEntry {
    id?: number;
    timestamp?: string;
    user_email: string;
    category: string;
    template: string;
    destination: string;
}

interface LogResponse {
    total: number;
    logs: LogEntry[];
}

const API_BASE = '/api-preview';

export const logService = {
    /**
     * Registra una nueva operación en el log
     */
    async appendLog(entry: LogEntry): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(entry),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Error al guardar log: ${error}`);
            }
        } catch (error) {
            console.error('[Log Service] Error:', error);
            // No bloqueamos el flujo principal si el log falla
        }
    },

    /**
     * Obtiene el historial de logs
     */
    async getLogs(limit = 100, offset = 0, startDate?: string, endDate?: string): Promise<LogResponse> {
        let url = `${API_BASE}/logs?limit=${limit}&offset=${offset}`;
        if (startDate) url += `&start_date=${startDate}`;
        if (endDate) url += `&end_date=${endDate}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Error al obtener el historial de logs');
        }
        return await response.json();
    },

    /**
     * Obtiene la URL para descargar el reporte CSV
     */
    getExportUrl(startDate?: string, endDate?: string): string {
        let url = `${API_BASE}/logs/export?`;
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        return url + params.toString();
    }
};
