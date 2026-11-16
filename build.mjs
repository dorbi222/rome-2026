import { build } from 'esbuild'; import { execSync } from 'child_process'; import fs from 'fs';
await build({ entryPoints: ['src/app.jsx'], bundle: true, minify: true, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, outfile: 'dist/app.js', target: ['es2019'] });
execSync('npx tailwindcss -i src/input.css -o dist/app.css --minify', { stdio: 'inherit' });
const js = fs.readFileSync('dist/app.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('dist/app.css', 'utf8');
const html = fs.readFileSync('template.html', 'utf8').replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
fs.writeFileSync('dist/index.html', html); console.log('size', (html.length / 1024).toFixed(0) + 'KB');
