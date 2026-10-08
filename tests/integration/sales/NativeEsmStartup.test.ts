import { it, expect } from 'vitest';
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

it('starts both Sales handlers under native Node ESM and denies an anonymous request before network access', () => {
  const root = process.cwd();
  const scratchRoot = path.resolve(root, '.local-data');
  fs.mkdirSync(scratchRoot, { recursive: true });
  const output = fs.mkdtempSync(path.join(scratchRoot, 'sales-native-esm-'));
  const files = new Set<string>();
  function collect(file: string) {
    file = path.resolve(file);
    if (files.has(file)) return;
    files.add(file);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        if (specifier.startsWith('.')) {
          const resolved = path.resolve(path.dirname(file), specifier);
          const target = [resolved, resolved.replace(/\.js$/, '.ts'), resolved + '.ts', path.join(resolved, 'index.ts')]
            .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
          if (!target) throw new Error(`Missing server dependency: ${specifier}`);
          if (target.endsWith('.ts')) collect(target);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  try {
    collect(path.join(root, 'api/sales.ts'));
    collect(path.join(root, 'api/sales-webhook.ts'));
    fs.writeFileSync(path.join(output, 'package.json'), '{"type":"module"}');
    for (const file of files) {
      const target = path.join(output, path.relative(root, file).replace(/\.ts$/, '.js'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText);
    }
    const script = path.join(output, 'verify.mjs');
    fs.writeFileSync(script, `import assert from 'node:assert/strict';
globalThis.fetch = async () => { throw new Error('NETWORK_FORBIDDEN'); };
const {default:handler} = await import(${JSON.stringify(pathToFileURL(path.join(output, 'api/sales.js')).href)});
await import(${JSON.stringify(pathToFileURL(path.join(output, 'api/sales-webhook.js')).href)});
let code, body;
const response = {status(value){code=value;return this;},json(value){body=value;},end(){}};
await handler({method:'POST',headers:{},body:{action:'health',organizationId:'HORECA_TEST_ORG_A'}},response);
assert.equal(code,403);assert.equal(body.error,'DENIED');
process.stdout.write('PASS');
`);
    const result = execFileSync(process.execPath, [script], {
      encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    expect(result).toBe('PASS');
  } finally {
    if (!path.resolve(output).startsWith(scratchRoot + path.sep)) throw new Error('Unsafe ESM test cleanup path');
    fs.rmSync(output, { recursive: true, force: true });
  }
}, 30000);
