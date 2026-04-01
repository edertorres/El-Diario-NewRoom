
import { useState, useEffect, useRef } from 'react';
import { typstRendererService } from '../services/typstRenderer';

export function useTypstLive(generator: () => string, deps: any[], delay: number = 400) {
    const [svg, setSvg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Debounce
        if (timerRef.current) clearTimeout(timerRef.current);

        // No poner isLoading(true) inmediatamente para evitar rero de UI en cada tecla
        timerRef.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                // Generar el código Typed SÓLO después del debounce
                const code = generator();

                if (!code.trim()) {
                    setSvg(null);
                    return;
                }

                const resultSvg = await typstRendererService.renderToSvg(code);
                setSvg(resultSvg);
                setError(null);
            } catch (err: any) {
                setError(err.message || "Error al renderizar Typst");
            } finally {
                setIsLoading(false);
            }
        }, delay);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [...deps, delay]);

    return { svg, isLoading, error };
}
