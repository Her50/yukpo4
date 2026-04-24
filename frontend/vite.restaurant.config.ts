import { makeLiteConfig } from './vite.lite.factory';

export default makeLiteConfig({
  app: 'restaurant',
  outDir: 'dist-restaurant',
  entryHtml: 'index-restaurant.html',
  manifestSrc: 'public/manifests/restaurant.json',
  port: 3013,
});
