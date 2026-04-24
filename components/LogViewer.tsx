import React, { useState, useEffect } from 'react';
import { logService } from '../services/logService';
import {
    Loader2,
    Download,
    X,
    Search,
    ClipboardList,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Calendar,
    FilterX
} from 'lucide-react';

interface Props {
    onClose: () => void;
}

const LogViewer: React.FC<Props> = ({ onClose }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const limit = 20;

    useEffect(() => {
        loadLogs();
    }, [page, startDate, endDate]);

    const loadLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await logService.getLogs(limit, page * limit, startDate || undefined, endDate || undefined);
            setLogs(data.logs);
            setTotal(data.total);
        } catch (err: any) {
            console.error('Error cargando logs:', err);
            setError('No se pudo cargar el historial de operaciones.');
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
        setPage(0);
    };

    const filteredLogs = logs.filter(log =>
        log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.template?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.destination?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <ClipboardList size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Historial de Operaciones</h2>
                            <p className="text-sm text-gray-500">Registro local de inyecciones IDML</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={logService.getExportUrl(startDate, endDate)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-sm hover:shadow-md text-sm font-medium"
                            download
                        >
                            <Download size={18} />
                            Exportar CSV
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-gray-100 bg-white flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative flex-1 min-w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por usuario, plantilla o carpeta..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-2 px-2 text-gray-500 border-r border-gray-200 mr-1">
                                <Calendar size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Fecha</span>
                            </div>
                            <input
                                type="date"
                                className="bg-transparent border-none text-xs font-medium focus:ring-0 text-gray-700 p-1"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                            />
                            <span className="text-gray-300">-</span>
                            <input
                                type="date"
                                className="bg-transparent border-none text-xs font-medium focus:ring-0 text-gray-700 p-1"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                            />
                        </div>

                        {(searchTerm || startDate || endDate) && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <FilterX size={16} />
                                Limpiar filtros
                            </button>
                        )}

                        <div className="ml-auto text-sm text-gray-500 font-medium whitespace-nowrap">
                            Resultados: <span className="text-indigo-600 font-bold">{total}</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="animate-spin text-indigo-600" size={40} />
                            <p className="text-gray-500 animate-pulse">Cargando registros...</p>
                        </div>
                    ) : error ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center">
                            <div className="p-4 bg-red-50 text-red-500 rounded-full mb-4">
                                <AlertCircle size={48} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{error}</h3>
                            <button
                                onClick={loadLogs}
                                className="text-indigo-600 font-semibold hover:underline"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="p-20 flex flex-col items-center justify-center text-center text-gray-500">
                            <ClipboardList size={64} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium">No se encontraron registros</p>
                            <p className="text-sm">Intenta ajustar los filtros de búsqueda o fecha.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-gray-50 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Fecha / Hora</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Usuario</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Plantilla</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Destino</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                                            {log.timestamp}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-900">{log.user_email?.split('@')[0]}</span>
                                                <span className="text-xs text-gray-500">{log.user_email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-gray-900 font-medium">{log.template}</span>
                                                <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-tight">{log.category}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <span className="truncate max-w-[200px]">{log.destination}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer / Pagination */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        Mostrando <span className="font-bold text-gray-900">{filteredLogs.length}</span> de <span className="font-bold text-gray-900">{total}</span> registros
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            disabled={page === 0 || loading}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="flex items-center px-4 gap-2">
                            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                let pageNum = i;
                                if (totalPages > 5) {
                                    if (page > 2) pageNum = page - 2 + i;
                                    if (pageNum >= totalPages) pageNum = totalPages - 5 + i;
                                }
                                if (pageNum < 0 || pageNum >= totalPages) return null;

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPage(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${page === pageNum
                                            ? 'bg-indigo-600 text-white shadow-md scale-110'
                                            : 'text-gray-500 hover:bg-gray-200'
                                            }`}
                                    >
                                        {pageNum + 1}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            disabled={page >= totalPages - 1 || loading}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogViewer;
