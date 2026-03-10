import React, { useState } from 'react';
import { 
  X, 
  BookOpen, 
  Tag, 
  Zap, 
  ImageIcon, 
  Eye, 
  Download, 
  Cloud,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface UserManualProps {
  isOpen: boolean;
  onClose: () => void;
}

type Section = 'preparacion' | 'editor' | 'imagenes' | 'preview' | 'exportacion';

export const UserManual: React.FC<UserManualProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<Section>('preparacion');

  if (!isOpen) return null;

  const sections = [
    { id: 'preparacion', title: '1. Preparación InDesign', icon: <Tag size={18} /> },
    { id: 'editor', title: '2. Editor Batch (##)', icon: <Zap size={18} /> },
    { id: 'imagenes', title: '3. Manejo de Imágenes', icon: <ImageIcon size={18} /> },
    { id: 'preview', title: '4. Previsualización', icon: <Eye size={18} /> },
    { id: 'exportacion', title: '5. Exportación y Drive', icon: <Download size={18} /> },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'preparacion':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Tag className="text-indigo-600" /> Preparación de la Plantilla
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Para que el inyector reconozca dónde debe ir cada texto, es necesario marcar los marcos de texto en InDesign usando <strong>Script Labels</strong> (Etiquetas de Script).
            </p>
            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-lg">
              <h4 className="font-bold text-indigo-900 mb-2">Pasos en InDesign:</h4>
              <ol className="list-decimal list-inside space-y-2 text-indigo-800 text-sm">
                <li>Abre el panel: <strong>Ventana {' > '} Utilidades {' > '} Etiqueta de script</strong>.</li>
                <li>Selecciona un marco de texto.</li>
                <li>Escribe el nombre de la etiqueta (ej: <code className="bg-white px-1 rounded border">TITULO1</code>, <code className="bg-white px-1 rounded border">TEXTO1</code>).</li>
                <li>Guarda el documento como <strong>IDML</strong>.</li>
              </ol>
            </div>
            <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-lg text-amber-800 text-sm">
              <Info className="shrink-0" size={18} />
              <p>Evita usar espacios o caracteres especiales en las etiquetas. Usa nombres simples y claros.</p>
            </div>
          </div>
        );
      case 'editor':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Zap className="text-yellow-500" /> Dominando el Editor Batch
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Esta es la herramienta principal para los periodistas. Permite volcar todo el contenido del periódico de forma fluida y con control total sobre la extensión.
            </p>
            
            <div className="space-y-4">
              <div className="border border-indigo-100 rounded-xl p-5 bg-indigo-50/50">
                <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-indigo-600" /> ¿Cómo funciona la Inyección?
                </h4>
                <p className="text-sm text-indigo-800 mb-3">
                  El sistema busca cada etiqueta <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-bold">##NOMBRE</code> y toma **todo el texto que escribas debajo** de ella hasta encontrar la siguiente etiqueta.
                </p>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono shadow-inner leading-relaxed">
                  <span className="text-gray-500 italic"># Ejemplo de flujo correcto:</span><br/>
                  <span className="text-indigo-400 font-bold">##TITULO1</span><br/>
                  Los migrantes se reinventan en Colombia<br/><br/>
                  <span className="text-indigo-400 font-bold">##TEXTO1</span><br/>
                  Cientos de venezolanos han logrado establecer...
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <h5 className="font-bold text-sm text-gray-900 mb-2 flex items-center gap-2">
                    <Zap size={16} className="text-yellow-500" /> Autocompletado Inteligente
                  </h5>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Al escribir <code className="text-indigo-600 font-bold">##</code>, aparecerá un menú con todas las etiquetas disponibles en la plantilla IDML. Puedes navegar con las flechas y pulsar <strong>Enter</strong> para insertar una.
                  </p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <h5 className="font-bold text-sm text-gray-900 mb-2 flex items-center gap-2">
                    <Info size={16} className="text-blue-500" /> Métricas en Tiempo Real
                  </h5>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Al lado de cada etiqueta aparece un indicador: <code className="text-indigo-600 font-bold italic">Límite → Escrito (±%)</code>. <br/><br/>
                    <span className="text-red-500">● Rojo:</span> Te has pasado del límite de InDesign.<br/>
                    <span className="text-green-600">● Verde:</span> El texto cabe perfectamente.
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                <h4 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-2">
                  <AlertCircle size={18} /> Consejos para Redactores:
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-amber-800 font-medium">
                  <li>No te preocupes por el orden; puedes poner las etiquetas en cualquier secuencia.</li>
                  <li>Usa **negrita** para resaltar partes importantes; el inyector las respetará.</li>
                  <li>El botón <strong>"Validar Documento"</strong> te avisará si has olvidado alguna etiqueta importante o si hay errores de formato antes de exportar.</li>
                </ul>
              </div>
            </div>
          </div>
        );
      case 'imagenes':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ImageIcon className="text-purple-600" /> Manejo de Imágenes
            </h3>
            <p className="text-gray-600">
              Puedes vincular imágenes a marcos de fotos específicos marcados previamente en InDesign.
            </p>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                <p className="text-sm text-gray-700">Selecciona la pestaña <strong>Imágenes</strong> en el sidebar izquierdo.</p>
              </li>
              <li className="flex gap-3">
                <div className="shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                <p className="text-sm text-gray-700">Arrastra tus fotos al área de carga o usa el botón de selección.</p>
              </li>
              <li className="flex gap-3">
                <div className="shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                <p className="text-sm text-gray-700">Asigna un nombre a la imagen que coincida con la etiqueta de InDesign (ej: <code className="text-purple-600 font-bold">FOTO1</code>).</p>
              </li>
            </ul>
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <p className="text-xs text-purple-800 leading-relaxed italic">
                * Las imágenes se subirán automáticamente a Google Drive en una carpeta junto con el archivo IDML inyectado.
              </p>
            </div>
          </div>
        );
      case 'preview':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Eye className="text-blue-600" /> Previsualización del Resultado
            </h3>
            <p className="text-gray-600">
              Antes de exportar el archivo definitivo, puedes generar una previsualización técnica para revisar cómo queda el texto inyectado.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <Eye className="text-blue-600" size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 text-sm">Botón "Ver preview del resultado"</h4>
                  <p className="text-xs text-blue-700">Ubicado a la izquierda de "Validar Documento".</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="text-green-500" size={16} />
                  <span>Se abre automáticamente en una <strong>pestaña nueva</strong>.</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="text-green-500" size={16} />
                  <span>Resolución de <strong>150 DPI</strong> (nítido y rápido).</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="text-green-500" size={16} />
                  <span>Permite revisar <strong>fuentes y flujos de texto</strong>.</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'exportacion':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Download className="text-green-600" /> Exportación y Google Drive
            </h3>
            <p className="text-gray-600">
              Una vez el texto es correcto, tienes dos formas de obtener el archivo final.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border-2 border-green-100 rounded-xl bg-white hover:border-green-200 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Cloud className="text-purple-600" size={20} />
                  <h4 className="font-bold text-gray-900">Enviar a Diagramación</h4>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Sube el IDML y las imágenes directamente a la carpeta compartida en Google Drive. Registra automáticamente quién hizo el cambio.
                </p>
              </div>
              <div className="p-4 border-2 border-indigo-100 rounded-xl bg-white hover:border-indigo-200 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="text-indigo-600" size={20} />
                  <h4 className="font-bold text-gray-900">Exportar IDML</h4>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Descarga el archivo IDML modificado directamente a tu computadora para abrirlo manualmente en InDesign.
                </p>
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg flex items-start gap-3 border border-red-100">
              <AlertCircle className="text-red-500 shrink-0" size={18} />
              <p className="text-xs text-red-800">
                <strong>Importante:</strong> El proceso de inyección no modifica el diseño original, solo reemplaza el texto y actualiza los vínculos de imagen.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-200">
        {/* Sidebar del Manual */}
        <aside className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-6">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <BookOpen size={20} />
              <span className="font-black text-xs uppercase tracking-widest">Guía de Usuario</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Ayuda IDML</h2>
          </div>
          
          <nav className="flex-1 px-3 space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as Section)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeSection === section.id 
                    ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  {section.icon}
                  {section.title}
                </div>
                {activeSection === section.id && <ChevronRight size={16} />}
              </button>
            ))}
          </nav>

          <div className="p-6 border-t border-gray-200 bg-white/50">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 text-center">Soporte Técnico</p>
            <div className="text-center text-[11px] text-gray-500 leading-relaxed font-medium">
              Desarrollado para redactores y diagramadores del diario.
            </div>
          </div>
        </aside>

        {/* Contenido Principal */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="px-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sección actual</span>
              <p className="text-sm font-black text-gray-900">
                {sections.find(s => s.id === activeSection)?.title}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-10">
            <div className="max-w-2xl mx-auto">
              {renderContent()}
            </div>
          </div>

          <footer className="p-6 border-t bg-gray-50 flex justify-between items-center shrink-0">
            <p className="text-xs text-gray-500 font-medium">© 2025 IDML Injector Pro - Guía Rápida</p>
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-all active:scale-95"
            >
              Entendido, volver al trabajo
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
};
