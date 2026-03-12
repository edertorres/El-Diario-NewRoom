
import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Loader2, Download, AlertCircle, CheckCircle2, Maximize2, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { IDMLStory, IDMLSpread, UploadedImage } from '../types';
import { typstGenerator } from '../services/typstGenerator';
import { idmlEngine } from '../services/idmlEngine';
import { storageManager } from '../services/storage/StorageManager';
import { PdfViewer } from './PdfViewer';

interface OverflowInfo {
    name: string;
    page: number;
    overflow_chars: number;
}

interface PreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    stories: IDMLStory[];
    spreads: IDMLSpread[];
    imagesFolderId?: string;
    uploadedImages?: UploadedImage[];
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, stories, spreads, imagesFolderId, uploadedImages = [] }) => {
    const [debugOverflow, setDebugOverflow] = useState(true);
    const [debugUnderflow, setDebugUnderflow] = useState(true);
    const [includeImages, setIncludeImages] = useState(uploadedImages.length > 0);

    // Sincronizar includeImages cuando cambian las imágenes cargadas
    useEffect(() => {
        if (uploadedImages.length > 0) {
            setIncludeImages(true);
        }
    }, [uploadedImages.length]);
    const [previewType, setPreviewType] = useState<'typst' | 'typst-pro' | 'scribus' | 'reportlab'>('scribus');
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [typstCode, setTypstCode] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [overflowFrames, setOverflowFrames] = useState<OverflowInfo[]>([]);

    useEffect(() => {
        if (isOpen) {
            generatePreview();
        } else {
            // Limpiar URL al cerrar para evitar fugas de memoria
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
                setPdfUrl(null);
            }
            setTypstCode("");
            setOverflowFrames([]);
        }
    }, [isOpen, debugOverflow, debugUnderflow, includeImages, imagesFolderId, previewType]);

    const generatePreview = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Resolver URL de la API de forma robusta
            const getApiUrl = () => {
                const envUrl = import.meta.env.VITE_PREVIEW_API_URL;
                // Si la variable de entorno tiene una URL absoluta, usarla
                if (envUrl && envUrl.startsWith('http')) return envUrl;
                // Si estamos en local, usar el proxy de Vite
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    return '/api-preview';
                }
                // En producción por defecto, ir directo al subdominio de la API (Bypass Nginx)
                return 'https://api-redaccion.rreditores.com';
            };

            const previewApiUrl = getApiUrl();
            console.log(`[Preview] Usando API en: ${previewApiUrl}`);

            if (previewType === 'typst-pro' || previewType === 'scribus') {
                // Lógica de Typst Pro o Scribus (ambos reciben IDML + Imágenes)
                setTypstCode(""); // Typst Pro genera el código en el servidor

                const idmlBlob = await idmlEngine.generateBlob(stories);
                const formData = new FormData();
                formData.append('file', idmlBlob, 'preview.idml');
                let totalSize = idmlBlob.size;

                // Adjuntar imágenes subidas
                if (includeImages && uploadedImages.length > 0) {
                    uploadedImages.forEach(img => {
                        let fileName = img.customName;
                        if (!fileName.includes('.')) fileName += '.jpg';
                        formData.append('images', img.file, fileName);
                        totalSize += img.file.size;
                    });
                }

                console.log(`[Preview] Enviando payload total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

                const authHeader = storageManager.activeProvider.getAuthHeader() || '';

                let response: Response;

                if (previewType === 'scribus') {
                    // Usar patrón async con polling para evitar timeout de Traefik (60s)
                    formData.append('show_overflows', String(debugOverflow));
                    const startResp = await fetch(`${previewApiUrl}/render`, {
                        method: 'POST',
                        headers: { 'Authorization': authHeader },
                        body: formData,
                    });
                    if (!startResp.ok) {
                        const errData = await startResp.json().catch(() => ({ detail: 'Error al iniciar el render' }));
                        throw new Error(errData.detail || 'Error al iniciar el render');
                    }
                    const { job_id } = await startResp.json();
                    console.log(`[Preview] Job iniciado: ${job_id}. Haciendo polling...`);

                    // Polling cada 3 segundos hasta que esté listo (máx. 5 min)
                    const maxAttempts = 100;
                    let attempts = 0;
                    while (attempts < maxAttempts) {
                        await new Promise(r => setTimeout(r, 3000));
                        attempts++;
                        const pollResp = await fetch(`${previewApiUrl}/result/${job_id}`, {
                            headers: { 'Authorization': authHeader },
                        });
                        if (!pollResp.ok) {
                            const errData = await pollResp.json().catch(() => ({ detail: 'Error en el servidor de Scribus' }));
                            throw new Error(errData.detail || 'Error en el servidor de Scribus');
                        }
                        const contentType = pollResp.headers.get('content-type') || '';
                        if (contentType.includes('application/pdf')) {
                            // ¡PDF listo!
                            response = pollResp;
                            break;
                        }
                        const status = await pollResp.json().catch(() => ({ status: 'pending' }));
                        console.log(`[Preview] Polling... intento ${attempts}: ${status.status}`);
                        if (status.status === 'error') {
                            throw new Error(status.detail || 'Error en el servidor de Scribus');
                        }
                    }
                    if (!response!) {
                        throw new Error('Timeout: Scribus tardó demasiado en responder');
                    }
                } else {
                    // Typst Pro: llamada directa (más rápida, sin riesgo de timeout)
                    if (imagesFolderId) {
                        formData.append('images_folder_id', imagesFolderId);
                    }
                    response = await fetch(`${previewApiUrl}/preview-typst-pro`, {
                        method: 'POST',
                        headers: { 'Authorization': authHeader },
                        body: formData,
                    });
                }

                if (!response!.ok) {
                    const motorName = previewType === 'typst-pro' ? 'Typst Pro' : 'Scribus';
                    const errData = await response.json().catch(() => ({ detail: `Error en el servidor de ${motorName}` }));
                    throw new Error(errData.detail || `Error al generar PDF con ${motorName}`);
                }

                // Parsear metadata de overflows
                if (previewType === 'scribus') {
                    const overflowHeader = response.headers.get('X-Overflow-Frames');
                    if (overflowHeader) {
                        try {
                            const parsed: OverflowInfo[] = JSON.parse(overflowHeader);
                            setOverflowFrames(parsed);
                        } catch {
                            setOverflowFrames([]);
                        }
                    } else {
                        setOverflowFrames([]);
                    }
                } else if (previewType === 'typst-pro') {
                    // Para Typst Pro, calculamos desbordes basados en conteo de palabras (como en el editor)
                    // ya que el motor Typst no reporta desbordes nativos fácilmente.
                    const countWordsShort = (text: string) => text.trim().split(/\s+/).filter(w => w.length > 0).length;

                    const proOverflows: OverflowInfo[] = stories
                        .filter(s => {
                            const current = s.content.length;
                            const limit = s.initialCharCount || 0;
                            return current > limit && s.scriptLabel;
                        })
                        .map(s => ({
                            name: s.scriptLabel || s.id,
                            page: 1,
                            overflow_chars: s.content.length - (s.initialCharCount || 0)
                        }));

                    setOverflowFrames(proOverflows);
                } else {
                    setOverflowFrames([]);
                }

                const blob = await response.blob();
                if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                const url = URL.createObjectURL(blob);
                setPdfUrl(url);
            } else {
                // Handle other preview types if necessary, or set default state
                setOverflowFrames([]);
                // For now, if not typst-pro or scribus, we don't generate a PDF
                // or we would need a different generation logic here.
                // For example, if 'typst' (local generation) was an option:
                // const typst = typstGenerator.generateTypst(stories, spreads);
                // setTypstCode(typst);
                // setPdfUrl(null); // No PDF generated for local typst code
                setError("Tipo de preview no soportado o no implementado.");
            }
        } catch (err: any) {
            console.error("Preview Error:", err);
            setError(err.message || 'Error desconocido al generar preview');
        } finally {
            setIsLoading(false);
        }
    };

    const downloadTypstSource = () => {
        if (!typstCode) return;
        const blob = new Blob([typstCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prensa_original.typ';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const copyToClipboard = async () => {
        if (!typstCode) return;
        try {
            await navigator.clipboard.writeText(typstCode);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={`bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 transition-all duration-300 ${isFullScreen ? 'w-full h-full' : 'w-[90vw] h-[90vh]'}`}>

                {/* Header */}
                <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 p-2 rounded-lg text-white">
                            <Eye size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">
                                {previewType === 'typst-pro' ? 'Alta Fidelidad (Typst Pro)' : 'PDF de Prensa (Scribus)'}
                            </h2>
                            <p className="text-xs text-gray-500 font-medium lowercase tracking-tight">
                                {previewType === 'typst-pro'
                                    ? 'Fidelidad visual total usando motor Pro'
                                    : 'Alta fidelidad CMYK - Renderizado real del IDML'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Selector de tipo de preview */}
                        <div className="flex bg-gray-200/50 rounded-xl p-1 mr-2 border border-gray-200">
                            <button
                                onClick={() => setPreviewType('scribus')}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${previewType === 'scribus' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Scribus
                            </button>
                            <button
                                onClick={() => setPreviewType('typst-pro')}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${previewType === 'typst-pro' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Typst Pro
                            </button>
                        </div>

                        {/* Toggles */}
                        {(previewType === 'typst' || previewType === 'typst-pro' || previewType === 'scribus') && (
                            <div className="flex bg-white rounded-xl border border-gray-200 p-1 shadow-inner">
                                <button
                                    onClick={() => setDebugOverflow(!debugOverflow)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${debugOverflow ? 'bg-red-50 text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {debugOverflow ? <CheckCircle2 size={14} /> : <EyeOff size={14} />} Desbordes
                                </button>
                                <button
                                    onClick={() => setIncludeImages(!includeImages)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${includeImages ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {includeImages ? <CheckCircle2 size={14} /> : <ImageIcon size={14} />} Imágenes
                                </button>
                            </div>
                        )}

                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                        <button
                            onClick={() => setIsFullScreen(!isFullScreen)}
                            className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                            title="Alternar pantalla completa"
                        >
                            <Maximize2 size={20} />
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-gray-400 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-gray-100 relative overflow-hidden flex flex-col items-center justify-center">
                    {isLoading && (
                        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                            <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                            <h3 className="text-xl font-bold text-gray-900">
                                {previewType === 'typst-pro' ? 'Generando Typst de Alta Fidelidad...' : 'Generando PDF con Scribus...'}
                            </h3>
                            <p className="text-gray-500 text-sm mt-2 max-w-xs">
                                {previewType === 'typst-pro'
                                    ? 'Traducción directa de IDML a Typst con máxima precisión.'
                                    : 'Esto usa Scribus en modo headless para máxima fidelidad (puede tardar más).'}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100 text-center animate-in zoom-in duration-300">
                            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Error de Generación</h3>
                            <p className="text-red-600 text-sm font-medium mb-6 leading-relaxed">{error}</p>
                            <button
                                onClick={generatePreview}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                            >
                                Reintentar
                            </button>
                        </div>
                    )}

                    {pdfUrl && !error && (
                        <PdfViewer url={pdfUrl} />
                    )}

                    {!pdfUrl && !isLoading && !error && (
                        <div className="text-center text-gray-400">
                            <Eye size={64} className="mx-auto mb-4 opacity-20" />
                            <p className="font-bold uppercase tracking-widest text-sm">Esperando generación...</p>
                        </div>
                    )}
                </div>

                {/* Panel de alertas de desborde (Scribus / Typst Pro) */}
                {(previewType === 'scribus' || previewType === 'typst-pro') && overflowFrames.length > 0 && (
                    <div className="px-5 py-3 bg-red-50 border-t border-red-200 shrink-0 animate-in slide-in-from-bottom duration-300">
                        <div className="flex items-start gap-3">
                            <div className="bg-red-100 p-1.5 rounded-lg text-red-600 mt-0.5">
                                <AlertTriangle size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-red-800 mb-1">
                                    {overflowFrames.length} {overflowFrames.length === 1 ? 'frame con desborde' : 'frames con desborde'} de texto
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {overflowFrames.map((of, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 border border-red-200 rounded-lg text-xs font-bold text-red-700"
                                        >
                                            <span className="font-black">{of.name}</span>
                                            <span className="text-red-400">|</span>
                                            <span>pág {of.page}</span>
                                            <span className="text-red-400">|</span>
                                            <span className="text-red-600">+{of.overflow_chars} chars</span>
                                        </span>
                                    ))}
                                </div>
                                <p className="text-[10px] text-red-500 mt-1.5 font-medium">
                                    Reduce el texto en los frames marcados con borde rojo en el PDF para evitar cortes en la impresión.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 shrink-0 flex justify-between items-center">
                    <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                            <span>Rojo: Desborde (Overflow)</span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-4">
                            <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                            <span>Verde: Espacio disponible (Underflow)</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {typstCode && (
                            <>
                                <button
                                    onClick={copyToClipboard}
                                    className={`flex items-center gap-2 px-3 py-2 border rounded-xl font-bold text-sm transition-all ${isCopied ? 'bg-green-50 border-green-200 text-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {isCopied ? <CheckCircle2 size={16} /> : <Eye size={16} />}
                                    {isCopied ? '¡Copiado!' : 'Copiar Código'}
                                </button>
                                <button
                                    onClick={downloadTypstSource}
                                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all"
                                >
                                    <Download size={16} /> Fuente .typ
                                </button>
                            </>
                        )}
                        {pdfUrl && (
                            <a
                                href={pdfUrl}
                                download="preview_prensa.pdf"
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-all active:scale-95"
                            >
                                <Download size={16} /> Descargar PDF
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
