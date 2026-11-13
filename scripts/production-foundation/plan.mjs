import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { compileBootstrap, compileVerification, migrationBundle, validateConfig } from './bootstrap.mjs';

// Intentionally no --apply command. Operator authorization/target verification
// and reviewed Supabase execution are separate from generating this package.
const [configFile,output,...extra]=process.argv.slice(2);
if (!configFile || !output || extra.length) { console.error('Usage: node scripts/production-foundation/plan.mjs <non-secret-config.json> <new-output-directory>');process.exitCode=1; }
else {
 try {
  const config=validateConfig(JSON.parse(readFileSync(configFile,'utf8'))),bundle=migrationBundle(),directory=resolve(output);
  if (existsSync(directory)) throw new Error('Output directory already exists; choose a new review package');
  const bootstrap=compileBootstrap(config),verify=compileVerification(config);
  mkdirSync(join(directory,'supabase/migrations'),{recursive:true});
  for(const m of bundle)writeFileSync(join(directory,'supabase/migrations',m.file),m.sql);
  writeFileSync(join(directory,'supabase/config.toml'),'project_id = "horeca-production-foundation"\n');
  writeFileSync(join(directory,'bootstrap.sql'),bootstrap);writeFileSync(join(directory,'verify.sql'),verify);
  writeFileSync(join(directory,'manifest.json'),JSON.stringify({projectRef:config.projectRef,origin:config.origin,mode:'OFFLINE_REVIEW_ONLY',sqlEncoding:'UTF-8',sqlLineEndings:'LF',migrations:bundle.map(({file,sha256})=>({file,sha256})),operationalDataIncluded:false},null,2));
  console.log(JSON.stringify({status:'PREPARED_OFFLINE',migrations:bundle.length,output:directory,networkUsed:false,databaseChanged:false}));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
