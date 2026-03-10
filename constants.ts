import { ProcessingQuestion } from "./types";

export const INITIAL_QUESTIONS: ProcessingQuestion[] = [
  {
    id: 'q1',
    question: "Lógica de Fuente de Datos",
    context: "¿De dónde proviene el nuevo texto? (ej. Un archivo JSON, una hoja de Excel o Entrada Manual)",
    critical: true
  },
  {
    id: 'q2',
    question: "Estrategia de Mapeo",
    context: "¿Cómo sabemos qué texto va en qué caja? ¿Tus marcos de texto tienen 'Etiquetas de Script' o debemos llenarlos en orden?",
    critical: true
  },
  {
    id: 'q3',
    question: "Manejo de Desbordamiento",
    context: "Si el nuevo texto es más largo que la caja existente, ¿qué debería pasar? (Redimensionar texto, Añadir páginas o Mostrar advertencia)",
    critical: true
  },
  {
    id: 'q4',
    question: "Restricciones de Estilo",
    context: "¿Necesitas cambiar los estilos de párrafo dinámicamente (ej. Negrita para títulos) o heredar estrictamente el estilo que ya está en el IDML?",
    critical: false
  }
];

export const MOCK_STORY_XML = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0">
  <Story Self="u123" UserInteractionLevel="GenerateUserInteraction">
    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Header">
      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
        <Content>Welcome to the Annual Report</Content>
      </CharacterStyleRange>
    </ParagraphStyleRange>
    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Body">
      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
        <Content>This year has been exceptional for our growth metrics.</Content>
      </CharacterStyleRange>
    </ParagraphStyleRange>
  </Story>
</idPkg:Story>
`;