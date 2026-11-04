// Synthetic child for boundary tests. No model, git, or repository execution.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const arg = name => process.argv[process.argv.indexOf(name) + 1];
const job = JSON.parse(fs.readFileSync(arg('--job')));
const report = JSON.parse(fs.readFileSync(arg('--request'))).report;
const controlPath = path.join(__dirname,'control.json');
const control = fs.existsSync(controlPath) ? JSON.parse(fs.readFileSync(controlPath)) : {};
if (process.env.INKSPECT_GITHUB_READ_TOKEN !== 'read-token') process.exit(2);
if (control.credential_length) {
  const credential=JSON.parse(fs.readFileSync(0,'utf8'));
  if (credential.provider !== 'openai' || credential.api_key.length !== control.credential_length) process.exit(2);
  if (JSON.stringify(process.env).includes(credential.api_key) || process.argv.join(' ').includes(credential.api_key)) process.exit(3);
}
const files=[{path:'src/math.ts',content:'fixed'}];
const hash=crypto.createHash('sha256');
for(const value of [job.run_id,job.head_sha,report.run.id,...files.flatMap(f=>[f.path,f.content])]) {
  const bytes=Buffer.from(value),length=Buffer.alloc(8);length.writeBigUInt64BE(BigInt(bytes.length));hash.update(length).update(bytes);
}
const digest=hash.digest('hex');
const attempts=control.mode==='exhausted'?3:control.mode==='over_limit'?4:control.mode==='stale_verdict'?2:(control.attempts||1);
const output={run_id:job.run_id,head:job.head_sha,tests_run:false,files,verification:{version:2,attempts,status:'passed',run_id:job.run_id,head:job.head_sha,
  source_review:report.run.id,candidate_sha256:digest,findings:report.findings.map(f=>({id:f.id,status:'resolved',evidence:[{path:'src/math.ts',start_line:1,end_line:1}]}))}};
const events=Array.from({length:attempts},(_,i)=>{
  const attempt=i+1, candidate=attempt===attempts?digest:String(attempt).repeat(64);
  return [{kind:'model.started',id:i*2+1,phase:'generation',attempt},{kind:'model.usage',id:i*2+1,input_tokens:100,output_tokens:20},
    {kind:'fix.verification.started',attempt,candidate_sha256:candidate},{kind:'model.started',id:i*2+2,phase:'fix_verification',attempt},
    {kind:'model.usage',id:i*2+2,input_tokens:150,output_tokens:30},
    {kind:attempt===attempts?'fix.verification.passed':'fix.verification.rejected',attempt,candidate_sha256:candidate}];
}).flat();
if(control.mode==='stale_verdict') output.verification.attempts=1;
if(control.mode==='exhausted') events[events.length-1].kind='fix.verification.rejected';
if(control.mode==='missing') delete output.verification;
if(control.mode==='tampered') output.files[0].content='changed after verification';
if(control.mode==='unresolved'||control.mode==='uncertain') output.verification.findings[0].status=control.mode;
if(control.mode==='single_call') events.splice(2);
if(control.mode==='verifier_error'||control.mode==='exhausted') {if(control.mode==='verifier_error') events.pop();events.push({kind:'engine.failed',code:'fix.verification_failed'});}
fs.writeFileSync(process.env.INKSPECT_USAGE_FILE,events.map(e=>JSON.stringify(e)).join('\n')+'\n');
if(control.mode==='verifier_error'||control.mode==='exhausted') process.exit(1);
fs.writeFileSync(arg('--out'),JSON.stringify(output));
