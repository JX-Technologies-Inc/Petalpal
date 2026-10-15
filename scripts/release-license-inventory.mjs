// Local package metadata/license text only; does not read environment or app data.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('release-artifacts');await mkdir(out,{recursive:true});
const rows=[],notices=[];
for(const root of ['.','mobile']){
 const lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
 for(const [relative,entry] of Object.entries(lock.packages??{})){
  if(!relative||entry.dev||!relative.startsWith('node_modules/')||relative.includes('..'))continue;
  const folder=path.join(root,relative);let pkg;
  try{pkg=JSON.parse(await readFile(path.join(folder,'package.json'),'utf8'));}catch{rows.push({scope:root,path:relative,status:'PACKAGE_NOT_INSTALLED'});continue;}
  const files=(await readdir(folder)).filter(f=>/^(licen[cs]e|copying|notice)([.-].*)?$/i.test(f));
  rows.push({scope:root,name:pkg.name,version:pkg.version,license:pkg.license??'UNDECLARED',noticeFiles:files});
  for(const file of files){try{const body=await readFile(path.join(folder,file),'utf8');notices.push(`${root}: ${pkg.name}@${pkg.version} / ${file}\n${body}`);}catch{}}
 }
}
await writeFile(path.join(out,'dependency-license-inventory.json'),JSON.stringify(rows,null,2)+'\n');
await writeFile(path.join(out,'dependency-notices.txt'),'UNREVIEWED LOCAL LICENSE TEXT COLLECTION. Metadata is not a commercial-rights determination. Check all obligations and missing notices before distribution.\n\n'+notices.join('\n\n----------------------------------------\n\n'));
console.log(JSON.stringify({packages:rows.length,missingOrUndeclared:rows.filter(r=>r.status||r.license==='UNDECLARED').length,withoutNoticeFiles:rows.filter(r=>!r.noticeFiles?.length).length,noticeTexts:notices.length}));
