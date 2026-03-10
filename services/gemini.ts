
import { GoogleGenAI } from "@google/genai";

export interface AiConfig {
  tone: string;
  glossary: string;
}

export type AiProvider = 'gemini' | 'deepseek';

// Función helper para llamar a DeepSeek API
const callDeepSeek = async (prompt: string): Promise<string> => {
  const apiKey = process.env.DEEPSEEK_API_KEY || import.meta.env.VITE_DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DeepSeek API key no configurada');
  }

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `DeepSeek API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
};

export const rewriteContent = async (
  text: string, 
  label: string, 
  instructions: string, 
  config?: AiConfig,
  provider: AiProvider = 'deepseek'
): Promise<string> => {
  const prompt = `
    Eres un experto editor de contenidos para documentos de InDesign.
    
    CONTEXTO GLOBAL DEL PROYECTO:
    - Tono de voz: ${config?.tone || "Profesional y preciso"}
    - Glosario/Reglas: ${config?.glossary || "Ninguna"}

    ELEMENTO ACTUAL:
    - Texto Original: "${text}"
    - Etiqueta de Script (Ubicación): ${label || "Sin etiqueta"}
    
    INSTRUCCIONES ESPECÍFICAS: ${instructions}
    
    RESTRICCIÓN CRÍTICA: Mantén una extensión de palabras similar al original (${text.split(/\s+/).length} palabras aprox) para evitar desbordamientos.
    Devuelve ÚNICAMENTE el texto reescrito final.
  `;

  // Intentar con el proveedor seleccionado, si falla intentar con el otro
  if (provider === 'deepseek') {
    try {
      return await callDeepSeek(prompt);
    } catch (error) {
      console.error("DeepSeek rewrite failed, trying Gemini:", error);
      // Fallback a Gemini
      provider = 'gemini';
    }
  }

  if (provider === 'gemini') {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("No API key available for Gemini");
      return text;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text?.trim() || text;
    } catch (error) {
      console.error("Gemini rewrite failed:", error);
      return text;
    }
  }

  return text;
};

export const smartTrim = async (
  text: string, 
  maxWords: number, 
  config?: AiConfig,
  provider: AiProvider = 'deepseek'
): Promise<string> => {
  const prompt = `
    El siguiente texto para un documento de InDesign es demasiado largo y se desborda del marco.
    
    Texto: "${text}"
    Límite máximo permitido: ${maxWords} palabras.
    Tono a mantener: ${config?.tone || "Profesional"}
    
    TAREA: Reduce la longitud del texto para que tenga exactamente o menos de ${maxWords} palabras, manteniendo el mensaje esencial y el tono.
    Devuelve ÚNICAMENTE el texto recortado.
  `;

  // Intentar con el proveedor seleccionado, si falla intentar con el otro
  if (provider === 'deepseek') {
    try {
      return await callDeepSeek(prompt);
    } catch (error) {
      console.error("DeepSeek smartTrim failed, trying Gemini:", error);
      // Fallback a Gemini
      provider = 'gemini';
    }
  }

  if (provider === 'gemini') {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("No API key available for Gemini");
      return text;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text?.trim() || text;
    } catch (error) {
      console.error("Gemini smartTrim failed:", error);
      return text;
    }
  }

  return text;
};
