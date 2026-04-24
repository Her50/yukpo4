import { makeLiteConfig } from './vite.lite.factory';

export default makeLiteConfig({
  app: 'bourse',
  outDir: 'dist-bourse',
  entryHtml: 'index-bourse.html',
  manifestSrc: 'public/manifests/bourse.json',
  port: 3011,
});
