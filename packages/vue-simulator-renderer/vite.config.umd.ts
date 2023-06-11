import {defineConfig} from 'vite';
import Vue from '@vitejs/plugin-vue';
import VueJsx from '@vitejs/plugin-vue-jsx';
import {resolve} from 'path'

const outputDir = resolve(__dirname, '../engine-demo/public/ts/')
console.log(outputDir, '-------------------------------')
console.log(outputDir)
export default defineConfig({
  plugins: [Vue(), VueJsx()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    // 'process.env.NODE_ENV': JSON.stringify('development'),
  },
  build: {
    outDir: outputDir,
    target: 'ES2018',
    sourcemap: 'inline',//true,
    lib: {
      name: 'LCVueSimulatorRenderer',
      entry: 'src/index.ts',
      fileName: () => 'vue-simulator-renderer.js',
      formats: ['umd'],
    },
    terserOptions: {
      compress: {
        // warnings: false,
        drop_console: false,  //打包时删除console
        drop_debugger: false, //打包时删除 debugger
        // pure_funcs: ['console.log'],
      },
      output: {
        // 去掉注释内容
        comments: false,
      },
    },
    emptyOutDir: false,
    rollupOptions: {
      external: [
        'vue',
        // '@knxcloud/lowcode-vue-renderer'
      ],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          // LCVueRenderer: 'LCVueRenderer',
          // '@knxcloud/lowcode-vue-renderer': 'LCVueRenderer'
        },
        assetFileNames({name}) {
          return name === 'style.css' ? 'vue-simulator-renderer.css' : name!;
        },
      },
    },
  },
});
