
import initCompiler, { TypstCompiler, TypstCompilerBuilder } from '@myriaddreamin/typst-ts-web-compiler';
import initRenderer, { TypstRenderer, TypstRendererBuilder } from '@myriaddreamin/typst-ts-renderer';

// Importar los archivos WASM como URLs (Vite)
import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';
import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';

export class TypstRendererService {
    private compiler: TypstCompiler | null = null;
    private renderer: TypstRenderer | null = null;
    private isInitialized = false;

    async init() {
        if (this.isInitialized) return;

        // Inicializar módulos WASM
        await initCompiler(compilerWasmUrl);
        await initRenderer(rendererWasmUrl);

        // Construir Compilador
        const compilerBuilder = new TypstCompilerBuilder();
        compilerBuilder.set_dummy_access_model();

        // Cargar Fuentes desde /fonts/
        const fonts = [
            'Austin-Bold.otf', 'Austin-Italic.otf', 'Austin-Roman.otf',
            'Heuristica-Regular.otf', 'Heuristica-Bold.otf',
            'PlayfairDisplay-Regular.otf', 'PlayfairDisplay-Bold.otf',
            'MyriadPro-Regular.otf', 'MyriadPro-Bold.otf'
        ];

        for (const font of fonts) {
            try {
                const response = await fetch(`/fonts/${font}`);
                const buffer = await response.arrayBuffer();
                await compilerBuilder.add_raw_font(new Uint8Array(buffer));
                console.log(`[TypstRenderer] Fuente preparada: ${font}`);
            } catch (err) {
                console.warn(`[TypstRenderer] No se pudo cargar la fuente ${font}:`, err);
            }
        }

        this.compiler = await compilerBuilder.build();

        // Construir Renderizador
        const rendererBuilder = new TypstRendererBuilder();
        this.renderer = await rendererBuilder.build();

        this.isInitialized = true;
        console.log("[TypstRenderer] Inicializado correctamente");
    }

    async renderToSvg(code: string): Promise<string> {
        if (!this.isInitialized) {
            await this.init();
        }

        try {
            // Usar una ruta absoluta para el entorno virtual de Typst
            const mainFile = '/main.typ';

            // Mapear el código al sistema de archivos virtual
            this.compiler!.add_source(mainFile, code);

            // Compilar usando la misma ruta
            const artifact = await this.compiler!.compile(mainFile, undefined, 'vector', 0);

            // Renderizar el artefacto a SVG
            const session = this.renderer!.session_from_artifact(artifact, 'vector');
            const svg = this.renderer!.svg_data(session);

            return svg;
        } catch (err) {
            console.error("[TypstRenderer] Error al renderizar:", err);
            throw err;
        }
    }
}

export const typstRendererService = new TypstRendererService();
