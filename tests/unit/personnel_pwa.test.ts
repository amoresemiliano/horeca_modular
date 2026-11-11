import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('Personnel PWA artifact and isolation contract',()=>{
 it('provides standalone manifest, real PNG sizes, install scope and iOS metadata',()=>{
  const manifest=JSON.parse(readFileSync('public/personal/fichaje/manifest.webmanifest','utf8'));
  expect(manifest.display).toBe('standalone');expect(manifest.start_url).toBe('/personal/fichaje/');expect(manifest.scope).toBe('/personal/fichaje/');
  for(const icon of manifest.icons){const data=readFileSync('public'+icon.src);const size=Number(icon.sizes.split('x')[0]);expect(data.readUInt32BE(16)).toBe(size);expect(data.readUInt32BE(20)).toBe(size);}
  const html=readFileSync('personal/fichaje/index.html','utf8');expect(html).toContain('apple-mobile-web-app-capable');expect(html).toContain('no-referrer');
 });
 it('keeps the standalone entry out of Auth and prototype graphs',()=>{
  const entry=readFileSync('src/modules/personnel-live/punchMain.jsx','utf8');expect(entry).not.toContain("from '../../App");expect(entry).not.toContain('AuthProvider');
  expect(existsSync('public/personal/fichaje/sw.js')).toBe(true);
  const sw=readFileSync('public/personal/fichaje/sw.js','utf8');expect(sw).toContain("event.request.method !== 'GET'");expect(sw).toContain("event.request.mode !== 'navigate'");expect(sw).not.toContain('indexedDB');
 });
});
