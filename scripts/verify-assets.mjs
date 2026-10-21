import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root='/home/hermes/projects/riddle-diary/dist';
const base=process.env.DIARY_URL||'https://riddle-diary-ten.vercel.app';
const files=[];
async function walk(dir){for(const ent of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())await walk(p);else files.push(p);}}
await walk(root);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let n=0;const failed=[];
for(let i=0;i<files.length;i+=4) await Promise.all(files.slice(i,i+4).map(async file=>{
 const rel=path.relative(root,file);const url=base+'/'+(rel==='index.html'?'':rel);
 const response=await fetch(url);
 if(!response.ok){failed.push([rel,response.status]);return;}
 const local=await fs.readFile(file),remote=Buffer.from(await response.arrayBuffer());
 if(hash(local)!==hash(remote))failed.push([rel,'hash mismatch']);else n++;
}));
console.log(JSON.stringify({base,files:files.length,matched:n,failed},null,2));
if(failed.length)process.exit(1);
