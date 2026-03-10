
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Loader2 } from 'lucide-react';

interface PdfViewerProps {
    url: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [pdf, setPdf] = useState<any>(null);
    const [pageNum, setPageNum] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.5);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let loadingTask: any = null;
        let isCancelled = false;

        const loadPdf = async () => {
            if (!url || isCancelled) return;
            setIsLoading(true);
            try {
                const pdfjsLib = (window as any).pdfjsLib;
                if (!pdfjsLib) {
                    console.error("PDF.js not loaded");
                    return;
                }

                // Configurar worker
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

                loadingTask = pdfjsLib.getDocument(url);
                const loadedPdf = await loadingTask.promise;
                if (!isCancelled) {
                    setPdf(loadedPdf);
                    setNumPages(loadedPdf.numPages);
                    setPageNum(1);
                }
            } catch (error: any) {
                if (!isCancelled) {
                    console.error("Error loading PDF:", error);
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadPdf();

        return () => {
            isCancelled = true;
            if (loadingTask) {
                loadingTask.destroy();
            }
        };
    }, [url]);

    useEffect(() => {
        let isCancelled = false;
        let renderTask: any = null;

        const renderPage = async () => {
            if (!pdf || !canvasRef.current || isCancelled) return;

            try {
                const page = await pdf.getPage(pageNum);
                if (isCancelled) return;

                const viewport = page.getViewport({ scale });
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                if (!context) return;

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                // Cancelar tarea previa si existe
                if (renderTask) {
                    renderTask.cancel();
                }

                renderTask = page.render(renderContext);
                await renderTask.promise;
            } catch (error: any) {
                if (error.name === 'RenderingCancelledException') {
                    // Ignorar errores de cancelación
                    return;
                }
                console.error("Error rendering page:", error);
            }
        };

        renderPage();

        return () => {
            isCancelled = true;
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [pdf, pageNum, scale]);

    const changePage = (offset: number) => {
        setPageNum(prev => Math.min(Math.max(1, prev + offset), numPages));
    };

    return (
        <div className="flex flex-col w-full h-full bg-gray-200 overflow-hidden">
            {/* Toolbar interna */}
            <div className="bg-gray-800 text-white p-2 flex items-center justify-between shadow-lg z-20">
                <div className="flex items-center gap-4 ml-2">
                    <div className="flex items-center bg-gray-700 rounded-lg overflow-hidden border border-gray-600">
                        <button
                            onClick={() => changePage(-1)}
                            disabled={pageNum <= 1}
                            className="p-1.5 hover:bg-gray-600 disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="px-3 py-1 text-sm font-bold border-x border-gray-600 min-w-[80px] text-center">
                            {pageNum} / {numPages}
                        </span>
                        <button
                            onClick={() => changePage(1)}
                            disabled={pageNum >= numPages}
                            className="p-1.5 hover:bg-gray-600 disabled:opacity-30 transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 mr-2">
                    <button
                        onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Reducir"
                    >
                        <ZoomOut size={18} />
                    </button>
                    <span className="text-xs font-mono w-12 text-center">{(scale * 100).toFixed(0)}%</span>
                    <button
                        onClick={() => setScale(s => Math.min(3, s + 0.2))}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Aumentar"
                    >
                        <ZoomIn size={18} />
                    </button>
                    <div className="w-px h-4 bg-gray-600 mx-1"></div>
                    <button
                        onClick={() => setScale(1.5)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Reset"
                    >
                        <Maximize size={18} />
                    </button>
                </div>
            </div>

            {/* Area de scroll */}
            <div className="flex-1 overflow-auto p-8 flex justify-center items-start relative box-shadow-inner custom-scrollbar">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10 font-bold text-gray-800">
                        <Loader2 className="animate-spin mr-2" /> Cargando documento...
                    </div>
                )}

                <div className="shadow-2xl border border-gray-300 bg-white">
                    <canvas ref={canvasRef} />
                </div>
            </div>
        </div>
    );
};
