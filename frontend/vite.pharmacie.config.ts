import { makeLiteConfig } from './vite.lite.factory';

export default makeLiteConfig({
  app: 'pharmacie',
  outDir: 'dist-pharmacie',
  entryHtml: 'index-pharmacie.html',
  manifestSrc: 'public/manifests/pharmacie.json',
  port: 3012,
});
