
import { idmlEngine } from './services/idmlEngine.ts';
import * as fs from 'fs';
import * as path from 'path';

async function test() {
    const idmlPath = '/home/eder/Proyectos/idml-injector-pro/4.idml';
    if (!fs.existsSync(idmlPath)) {
        console.error('File not found:', idmlPath);
        return;
    }

    console.log('Parsing IDML...');
    const result = await idmlEngine.parseIDML(idmlPath);
    if (!result) {
        console.error('Failed to parse IDML');
        return;
    }

    console.log('Exporting to JSON...');
    // We need to pass stories as well, idmlEngine keeps track of them but exportToJSON takes them as arg
    const stories = Array.from(idmlEngine['stories'].values());
    const jsonData = idmlEngine.exportToJSON(stories);

    const outPath = '/home/eder/Proyectos/idml-injector-pro/preview-service/debug_4.json';
    fs.writeFileSync(outPath, JSON.stringify(jsonData, null, 2));
    console.log('Exported to:', outPath);

    // Check some stats
    console.log('Spread count:', jsonData.spreads.length);
    jsonData.spreads.forEach((s, i) => {
        console.log(`Spread ${i}: Pages: ${s.pages.length}, Frames: ${s.frames.length}`);
        s.frames.slice(0, 3).forEach(f => {
            console.log(`  Frame ${f.id}: Bounds=${f.bounds}, pageId=${f.pageId}`);
        });
    });
}

test().catch(console.error);
