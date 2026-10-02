import {deflateSync} from 'node:zlib';
import {writeFile} from 'node:fs/promises';
function crc(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1}return (crc^0xffffffff)>>>0}
function chunk(type,bytes){const name=Buffer.from(type),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(bytes.length);checksum.writeUInt32BE(crc(Buffer.concat([name,bytes])));return Buffer.concat([length,name,bytes,checksum])}
for(const size of [192,512]){
 const raw=Buffer.alloc((size*4+1)*size),colors=[[205,182,111],[124,181,208],[167,203,138],[212,141,125]];
 for(let y=0;y<size;y++){raw[y*(size*4+1)]=0;for(let x=0;x<size;x++){const px=x/size,py=y/size,r=Math.hypot(px-.5,py-.5);let color=[20,36,26];if(r<.34&&Math.abs(px-.5)>.015&&Math.abs(py-.5)>.015)color=colors[(py>.5?2:0)+(px>.5?1:0)];if(r<.085)color=[225,239,184];const at=y*(size*4+1)+1+x*4;raw.set([...color,255],at)}}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
 await writeFile(new URL(`../public/icon-${size}.png`,import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
console.log('Built VibeDock app icons');
