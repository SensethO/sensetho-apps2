import fs from 'node:fs'
for(const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^"|"$/g,'')}
const SB=process.env.NEXT_PUBLIC_SUPABASE_URL, SR=process.env.SUPABASE_SERVICE_ROLE_KEY, ANON=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
async function one(i,url,key){const t=Date.now();try{const r=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`}});return `${i}:${r.status}/${Date.now()-t}ms`}catch(e){return `${i}:ERR`}}
console.log('=== 1 requête isolée ===')
console.log(' ',await one(1,`${SB}/rest/v1/profiles?select=id&limit=1`,SR))
console.log('=== 6 requêtes SIMULTANÉES (profiles) ===')
console.log(' ',(await Promise.all([...Array(6)].map((_,i)=>one(i+1,`${SB}/rest/v1/profiles?select=id&limit=1`,SR)))).join('  '))
console.log('=== 6 requêtes SIMULTANÉES (auth) ===')
console.log(' ',(await Promise.all([...Array(6)].map((_,i)=>one(i+1,`${SB}/auth/v1/health`,ANON)))).join('  '))
console.log('=== rafale mixte (comme un chargement de page) ===')
const mix=[...Array(4)].map((_,i)=>one('p'+i,`${SB}/rest/v1/profiles?select=id&limit=1`,SR))
  .concat([...Array(4)].map((_,i)=>one('a'+i,`${SB}/auth/v1/health`,ANON)))
console.log(' ',(await Promise.all(mix)).join('  '))
