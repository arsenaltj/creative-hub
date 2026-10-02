import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const index=process.argv.indexOf('--domain'),domain=process.argv[index+1];
if(index<0||!domain||! /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)){
 console.error('Usage: npm run relay:init -- --domain vibedock.example.com');process.exit(1);
}
const file=new URL('../deploy/.env',import.meta.url);
try{await writeFile(file,`VIBEDOCK_DOMAIN=${domain}\nVIBEDOCK_PUBLIC_ORIGIN=https://${domain}\nVIBEDOCK_RELAY_HOST_KEY=${randomBytes(48).toString('base64url')}\n`,{flag:'wx',mode:0o600});console.log('Created deploy/.env. Keep it private; copy the connection key into your PC settings locally.')}catch(e){console.error(e.code==='EEXIST'?'deploy/.env already exists; it was not overwritten.':'Could not create deployment configuration.');process.exitCode=1}
