import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
await import('./build.mjs');
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const target=path.resolve('..',`listening-archive-v${version}.zip`);
// Windows' libarchive tar emits normalized ZIP entry paths accepted by Folia.
const result=spawnSync('tar',['-a','-cf',target,'-C',path.resolve('dist'),'listening-archive'],{stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)throw new Error('打包失败');
const bytes=fs.readFileSync(target),sha256=createHash('sha256').update(bytes).digest('hex');
fs.writeFileSync(target+'.sha256',sha256+'  '+path.basename(target)+'\n');
console.log(JSON.stringify({file:target,bytes:bytes.length,sha256},null,2));
