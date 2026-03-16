
import { JSDOM } from 'jsdom';

// Mock DOMParser and XMLSerializer BEFORE importing anything else
const dom = new JSDOM();
(global as any).DOMParser = dom.window.DOMParser;
(global as any).XMLSerializer = dom.window.XMLSerializer;
(global as any).document = dom.window.document;
(global as any).Node = dom.window.Node;
(global as any).Element = dom.window.Element;

import { IDMLEngine } from '../services/idmlEngine';

async function testRelink() {
  console.log("Starting Relink Test...");
  const engine = new IDMLEngine();

  // Create a mock spread XML
  const mockXml = `
    <Spread Self="u123">
      <Rectangle Self="u456">
        <Image>
          <Link LinkResourceURI="file:/Network/OldFolder/image1.jpg" />
        </Image>
      </Rectangle>
      <Rectangle Self="u789">
        <Image>
          <Link LinkResourceURI="file:/Network/OldFolder/subfolder/image2.png" />
        </Image>
      </Rectangle>
      <Rectangle Self="u111">
        <Image>
          <Link LinkResourceURI="file:/Network/OtherFolder/image3.jpg" />
        </Image>
      </Rectangle>
      <Rectangle Self="u222">
        <Image>
          <Link LinkResourceURI="file:SÁBADO_2026-03-14%20%3E%2004%20OPINIÓN%20/FOTO1.jpg" />
        </Image>
      </Rectangle>
      <Rectangle Self="u333">
        <Image>
          <Link LinkResourceURI="file:C:\\Windows\\Path\\image_with_backslashes.jpg" />
        </Image>
      </Rectangle>
    </Spread>
  `;

  // Set up the engine state
  engine['spreads'].set("Spreads/Spread_u123.xml", {
    id: "Spreads/Spread_u123.xml",
    name: "Spreads/Spread_u123.xml",
    originalXml: mockXml,
    frames: [],
    imageFrames: [],
    genericFrames: [],
    pages: []
  });

  // Configure automatic relinking
  engine.setAutomaticRelink(true, "FinalPhotos");

  // Mock zip
  engine['zip'] = {
    file: (path: string, content: string) => {
      if (path === "Spreads/Spread_u123.xml") {
        console.log("Verified: Spread XML was updated in ZIP.");
        if (content.includes("file:FinalPhotos/image1.jpg") &&
          content.includes("file:FinalPhotos/image2.png") &&
          content.includes("file:FinalPhotos/image3.jpg") &&
          content.includes("file:FinalPhotos/FOTO1.jpg") &&
          content.includes("file:FinalPhotos/image_with_backslashes.jpg")) {
          console.log("SUCCESS: URIs were correctly transformed to relative paths.");
        } else {
          console.error("FAILURE: URIs were NOT correctly transformed.");
          console.log("Modified XML:", content);
          process.exit(1);
        }
      }
    },
    generateAsync: async () => new Blob([])
  };

  // Run generateBlob
  await engine.generateBlob([]);

  console.log("Relink Test completed successfully.");
}

testRelink().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
