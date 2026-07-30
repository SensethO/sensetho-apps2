import fs from 'node:fs'
for(const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^"|"$/g,'')}
const SB=process.env.NEXT_PUBLIC_SUPABASE_URL, SR=process.env.SUPABASE_SERVICE_ROLE_KEY
for(let i=1;i<=4;i++){
  const t=Date.now()
  try{const r=await fetch(`${SB}/rest/v1/profiles?select=id&limit=1`,{headers:{apikey:SR,Authorization:`Bearer ${SR}`}})
    console.log(`essai ${i}: http=${r.status} ${Date.now()-t}ms`)}
  catch(e){console.log(`essai ${i}: ❌ ${e.message}`)}
  await new Promise(z=>setTimeout(()=>z(),3000))
}
