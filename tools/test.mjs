import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
fs.mkdirSync('.test-build',{recursive:true});
await build({entryPoints:['test/core.test.ts','test/canvas-playback.test.ts'],bundle:true,platform:'node',format:'esm',target:'node22',outdir:'.test-build',outExtension:{'.js':'.mjs'}});
const temp=path.resolve('.test-build/tmp');fs.mkdirSync(temp,{recursive:true});
const result=spawnSync(process.execPath,['--test','.test-build/core.test.mjs','.test-build/canvas-playback.test.mjs'],{stdio:'inherit',env:{...process.env,TZ:'Asia/Shanghai',TEMP:temp,TMP:temp}});process.exit(result.status||0);
