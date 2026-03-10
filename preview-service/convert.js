import fs from 'fs';
import path from 'path';
import { IDMLTools } from 'idmltools';

/**
 * CLI simple: node convert.js input.idml output.pdf
 */
async function main() {
  const [,, inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Uso: node convert.js <input.idml> <output.pdf>');
    process.exit(1);
  }
  const inFile = path.resolve(inputPath);
  const outFile = path.resolve(outputPath);

  if (!fs.existsSync(inFile)) {
    console.error(`No existe el archivo: ${inFile}`);
    process.exit(1);
  }

  try {
    const tools = new IDMLTools();
    // Cargar IDML
    const project = await tools.load(inFile);
    // Exportar a PDF
    await project.exportPDF(outFile);
    console.log('PDF generado en', outFile);
  } catch (err) {
    console.error('Error convirtiendo IDML:', err);
    process.exit(1);
  }
}

main();
