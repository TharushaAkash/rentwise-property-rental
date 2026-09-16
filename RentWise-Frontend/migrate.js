import fs from 'fs';
import path from 'path';
import { transformFileSync } from '@babel/core';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
               // ignore d.ts
               if (!file.endsWith('.d.ts')) {
                   results.push(file);
               }
            }
        }
    });
    return results;
}

const srcDir = path.join(__dirname, 'src');
const files = walk(srcDir);

files.forEach(file => {
   const isTsx = file.endsWith('.tsx');
   const result = transformFileSync(file, {
       presets: [
           ['@babel/preset-typescript', { ignoreExtensions: true }]
       ],
       plugins: ['@babel/plugin-syntax-jsx'],
       filename: file,
       retainLines: true,
   });
   
   const newExt = isTsx ? '.jsx' : '.js';
   const newPath = file.replace(/\.tsx?$/, newExt);
   
   let code = result.code;
   
   // Sometimes Babel leaves empty export {} when stripping types
   code = code.replace(/export\s*\{\s*\};?/g, '');
   
   // Zod creates runtime variables, so those remain which is perfect!
   
   fs.writeFileSync(newPath, code);
   fs.unlinkSync(file);
   console.log(`Migrated: ${path.basename(file)} -> ${path.basename(newPath)}`);
});

console.log('Migration Complete.');
