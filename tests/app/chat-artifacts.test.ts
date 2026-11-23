import test from "node:test";
import {build} from "esbuild";
import {mkdir,mkdtemp,rm} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {join} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
test("chat source cards render stored diagrams and company-rule references safely",async()=>{
 const root=fileURLToPath(new URL("../../",import.meta.url));
 const local=join(root,".local");await mkdir(local,{recursive:true});const dir=await mkdtemp(join(local,"artifact-test-"));
 try {
  const out=join(dir,"render.mjs");
  await build({absWorkingDir:root,entryPoints:["tests/app/fixtures/chat-artifacts-render.ts"],bundle:true,platform:"node",target:"node22",format:"esm",external:["linkedom","@aws-sdk/client-s3","@aws-sdk/client-sesv2","@better-auth/core","@better-auth/passkey","@fontsource-variable/manrope","@pubb/sdk","@smithy/eventstream-codec","@smithy/util-utf8","better-auth","class-variance-authority","cmdk","cn","lucide-react","next","nodemailer","pg","radix-ui","react","react-dom","react-markdown","react-qr-code","remark-gfm","remark-parse","sharp","tw-animate-css","unified","@hono/node-server","hono"],jsx:"automatic",outfile:out,logLevel:"silent"});
  await promisify(execFile)(process.execPath,["--test",out]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
