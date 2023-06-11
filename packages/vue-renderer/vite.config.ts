import { defineConfig } from 'vite';
import LibTypes from 'vite-plugin-lib-types';
import VueJsx from '@vitejs/plugin-vue-jsx';
import pkg from './package.json';
import {resolve} from 'path'
const outputDir = resolve(__dirname,'../engine-demo/public/ts/')
console.log('outputDir------------------------')
console.log(outputDir)

export default defineConfig({
  plugins: [VueJsx(), LibTypes({ fileName: 'vue-renderer.d.ts' })],
  build: {
    target: 'ES2018',
    sourcemap: true,
    lib: {
      entry: 'src/index.ts',
      fileName: () => 'vue-renderer.mjs',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        ...Object.keys(pkg.dependencies),
        ...Object.keys(pkg.peerDependencies),
      ].filter((item) => !item.includes('@alilc')),
    },
  },
});
