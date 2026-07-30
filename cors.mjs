import fs from 'node:fs'
for(const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^"|"$/g,'')}
const SB=process.env.NEXT_PUBLIC_SUPABASE_URL, KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
for(const [path,label] of [['/rest/v1/app_quotes?select=id&limit=1','app_quotes'],['/rest/v1/tickets?select=id&limit=1','tickets'],['/auth/v1/health','auth health']]){
  try{
    const t=Date.now()
    const r=await fetch(SB+path,{headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,Origin:'https://apps.sensetho.com'}})
    const acao=r.headers.get('access-control-allow-origin')
    console.log(`${label.padEnd(12)} http=${r.status} ${Date.now()-t}ms | Access-Control-Allow-Origin: ${acao ?? '(absent ❌)'}`)
    if(!r.ok) console.log('   corps:',(await r.text()).slice(0,150))
  }catch(e){console.log(`${label.padEnd(12)} ❌ ÉCHEC RÉSEAU : ${e.message}`)}
}
