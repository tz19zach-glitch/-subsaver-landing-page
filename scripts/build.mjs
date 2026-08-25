import {cp, mkdir, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(projectRoot, 'dist');
const publicFiles = [
  'index.html',
  'privacy.html',
  'terms.html',
  '_headers',
  '_routes.json'
];

await rm(outputDir, {recursive: true, force: true});
await mkdir(outputDir, {recursive: true});

await Promise.all(publicFiles.map(file => cp(
  path.join(projectRoot, file),
  path.join(outputDir, file)
)));

console.log(`Built ${publicFiles.length} public files in ${outputDir}`);
