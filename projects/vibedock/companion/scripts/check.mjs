import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=new URL('../',import.meta.url);
for(const directory of ['src','public','desktop','scripts'])for(const file of await readdir(new URL(directory+'/',root))){
 if(!/\.(?:m?js|cjs)$/.test(file))continue;
 const result=spawnSync(process.execPath,['--check',path.join(directory,file)],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
console.log('Syntax checks passed');
