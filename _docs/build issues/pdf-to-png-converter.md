---
link: https://t3.chat/chat/e970d10a-9002-4fca-b033-a4b3ed25dd82
---

pdf-to-png-converter works in Electron, but you need to tick four boxes that don’t exist in a plain Node.js build:

1. Put it in production dependencies  
   ```bash
   npm i pdf-to-png-converter --save
   ```

2. Rebuild its native addon (canvas) for Electron’s ABI  
   The library depends on node-canvas, a C++ addon that must be
   re-compiled against Electron’s custom Node version.  
   - One-shot:
     ```bash
     npx electron-rebuild -f -w canvas
     ```
   - Persistent (package.json):
     ```json
     {
       "scripts": {
         "postinstall": "electron-rebuild -f -w canvas"
       }
     }
     ```

3. Tell your bundler not to inline it  
   (otherwise the whole directory disappears from node_modules in the
   asar archive)

   ```js
   // vite.config.js
   import { defineConfig } from 'vite';

   export default defineConfig({
     build: {
       rollupOptions: {
         external: ['pdf-to-png-converter']
       }
     }
   });
   ```

4. Unpack the runtime assets shipped with pdfjs-dist  
   The converter asks pdfjs for CMaps and fallback fonts **via fs** at
   runtime. Those files must live outside the asar bundle.

   ```json
   {
     "build": {
       "asarUnpack": [
         "**/node_modules/pdfjs-dist/cmaps/**",
         "**/node_modules/pdfjs-dist/standard_fonts/**"
       ]
     }
   }
   ```
   (electron-builder syntax; adjust for Forge/Packager if you use those)

Quick smoke test inside Electron’s main or preload:

```ts
import { convert } from 'pdf-to-png-converter';

(async () => {
  const pages = await convert('/absolute/path/to/file.pdf', {
    viewportScale: 2,
    useSystemFonts: true,      // avoids font files inside asar
    disableFontFace: true
  });
  console.log('PNG paths:', pages.map(p => p.path));
})();
```

After rebuilding and repackaging:

- …/app.asar.unpacked/node_modules/canvas/**/*.node  
- …/app.asar.unpacked/node_modules/pdfjs-dist/{cmaps,standard_fonts}/…  

will exist, and `require('pdf-to-png-converter')` resolves without the
“Cannot find module” exception.