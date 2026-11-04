import {cp,mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),stage=await mkdtemp(join(tmpdir(),'inkspect-pack-'));
try {
 const pkg=JSON.parse(await readFile(root+'/package.json','utf8'));
 for(const name of Object.keys(pkg.dependencies))if(name.startsWith('@inkspect/'))pkg.dependencies[name]='0.1.0';
 pkg.scripts={}; delete pkg.devDependencies;
 await writeFile(stage+'/package.json',JSON.stringify(pkg,null,2));
 for(const name of ['src','migrations','README.md','LICENSE','CHANGELOG.md','CONTRIBUTING.md','CODE_OF_CONDUCT.md','SECURITY.md','SUPPORT.md'])await cp(root+'/'+name,stage+'/'+name,{recursive:true}).catch(e=>{if(e.code!=='ENOENT'||name==='LICENSE')throw e;});
 await mkdir(root+'/.artifacts',{recursive:true});
 execFileSync('npm',['pack','--ignore-scripts','--pack-destination',root+'/.artifacts'],{cwd:stage,stdio:'inherit'});
}finally{await rm(stage,{recursive:true,force:true});}
