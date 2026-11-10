import fs from 'node:fs/promises';
import { runLive } from '../lib/live.js';

const OUT='public/live-evaluation-bifrost-freequery-v1.json';
const MAX_NEW_TAVILY=39; // 11 previously documented + at most 39 = 50 total
const cases=[
  {id:'support-py312-distutils',text:'Python 3.12 removed the distutils package from the standard library.',label:'지지',url:'https://docs.python.org/3/whatsnew/3.12.html',quote:'the `distutils` package has been removed from the standard library',reason:'Python 3.12 official What’s New page directly says the package was removed.'},
  {id:'support-node20-lts-transition',text:'Node.js v20.9.0 moved the Node.js 20.x line into Active LTS.',label:'지지',url:'https://nodejs.org/en/blog/release/v20.9.0',quote:'The 20.x release line now moves into "Active LTS"',reason:'Official Node.js v20.9.0 release announcement directly states the LTS transition.'},
  {id:'refute-node20-codename',text:'The codename of Node.js 20 is Argon.',label:'반박',url:'https://nodejs.org/en/about/previous-releases',quote:'| [v20](/en/download/archive/v20.20.2) | Iron |',reason:'Official Node.js releases table identifies v20 as Iron, contradicting Argon.'},
  {id:'refute-py312-distutils-retained',text:'Python 3.12 retained distutils in the standard library.',label:'반박',url:'https://docs.python.org/3/whatsnew/3.12.html',quote:'the `distutils` package has been removed from the standard library',reason:'Official Python 3.12 page says distutils was removed, contradicting retained.'},
  {id:'insufficient-node-download-size',text:'The Node.js v20.9.0 announcement says the release reduced the installed runtime size by 40%.',label:'근거 부족',url:'https://nodejs.org/en/blog/release/v20.9.0',quote:null,reason:'Directly inspected official v20.9.0 release page; it gives no installed-size reduction percentage, so this source cannot establish the numeric claim.'},
  {id:'insufficient-py312-user-count',text:'The official Python 3.12 release notes report exactly 50 million active users.',label:'근거 부족',url:'https://docs.python.org/3/whatsnew/3.12.html',quote:null,reason:'Directly inspected official Python 3.12 What’s New page; it contains no active-user count, so this source cannot establish the claim.'},
];
const model=String(process.env.GEMINI_MODEL||'gemini-3.5-flash-lite').replace(/^models\//,'');
const baseUrl='http://127.0.0.1:18081';
const vk=(await fs.readFile('/tmp/claimclock-bifrost-vk2','utf8')).trim();
if(!process.env.TAVILY_API_KEY||!process.env.GEMINI_API_KEY)throw new Error('required key missing');
let tavilyTotal=0;
const results=[];
const startedAt=new Date().toISOString();
for(const item of cases){
  const env={...process.env,BIFROST_BASE_URL:baseUrl,GEMINI_MODEL:model};
  const actualQueries=[];
  const fetchImpl=async(url,init={})=>{
    const u=String(url);
    if(u==='https://api.tavily.com/search'){
      if(tavilyTotal>=MAX_NEW_TAVILY)throw new Error('global Tavily budget stop');
      tavilyTotal++;
      const body=JSON.parse(init.body||'{}');
      // Execute an unrestricted natural-language query derived from the claim. No site:, URL, or answer-page hint.
      const query=item.text.replace(/["“”]/g,' ').replace(/\s+/g,' ').trim();
      if(/\bsite\s*:/i.test(query)||/https?:\/\//i.test(query))throw new Error('unconstrained query guard failed');
      body.query=query;body.search_depth='basic';body.topic='general';body.max_results=5;
      actualQueries.push(query);
      return fetch(url,{...init,body:JSON.stringify(body)});
    }
    if(u.startsWith(baseUrl+'/v1/')){
      const headers=new Headers(init.headers||{});headers.set('x-bf-vk',vk);
      headers.delete('x-goog-api-key');headers.delete('authorization');
      return fetch(url,{...init,headers});
    }
    return fetch(url,init);
  };
  const run=await runLive({text:item.text,authoredDate:'2026-01-15',env,fetchImpl});
  const claim=run.claims[0]||null;
  const modelLabel=claim?.relation||'근거 부족';
  const generatedQueries=(run.runLog?.tavily||[]).map(t=>t.query);
  for(let i=0;i<(run.runLog?.tavily||[]).length;i++){const t=run.runLog.tavily[i];t.generatedQuery=t.query;t.query=actualQueries[i]||t.query;t.querySource='input-claim-text';}
  const sample={id:item.id,input:item.text,authoredDate:'2026-01-15',goldLabel:item.label,goldBasis:{url:item.url,quote:item.quote,reason:item.reason},modelLabel,matched:modelLabel===item.label,executionPath:'bifrost-virtual-key',queryMode:'input claim text sent directly; no site: filter, answer URL, or domain; model-generated candidate retained separately',executedQueries:actualQueries,queryAudit:actualQueries.map((sentQuery,i)=>({generatedQuery:generatedQueries[i]||null,sentQuery,source:'input-claim-text override'})),run};
  results.push(sample);
}
const matched=results.filter(x=>x.matched).length;
const byClass={};for(const label of ['지지','반박','근거 부족']){const rs=results.filter(x=>x.goldLabel===label);byClass[label]={n:rs.length,matched:rs.filter(x=>x.matched).length,agreement:rs.length?rs.filter(x=>x.matched).length/rs.length:null};}
const data={schemaVersion:1,mode:'recorded-live-evaluation-bifrost-freequery',actualExternalRun:true,promptVersion:'existing lib/live.js EXTRACT_SYSTEM + JUDGE_SYSTEM, unmodified',executionPath:'Bifrost v2.5.0 with virtual key; direct-key bypass disabled',startedAt,finishedAt:new Date().toISOString(),newTavilyCalls:tavilyTotal,previouslyDocumentedTavilyCalls:11,cumulativeTavilyCalls:11+tavilyTotal,totalSamples:results.length,matched,accuracy:matched/results.length,byClass,note:'Fresh claims; labels fixed from direct inspection of official original URLs before run. The evaluation transport wrapper sent each original claim sentence as Tavily query; Gemini-generated candidate queries are retained separately in run.runLog.tavily[].generatedQuery. Sent queries contain no site: or answer URLs. Insufficient means official page examined does not establish the specified quantitative claim, not a claim of objective falsity. This new set is separate from live-evaluation-pre.json; no prompt/rule tuning.',results};
const json=JSON.stringify(data,null,2)+'\n';
for(const secret of [process.env.GEMINI_API_KEY,process.env.TAVILY_API_KEY,vk])if(secret&&json.includes(secret))throw new Error('secret redaction guard failed');
await fs.writeFile(OUT,json,{mode:0o644});
console.log(JSON.stringify({samples:results.length,matched,total:results.length,accuracy:data.accuracy,byClass,newTavilyCalls:tavilyTotal,cumulativeTavilyCalls:data.cumulativeTavilyCalls,siteQueries:results.filter(r=>r.executedQueries.some(q=>/\bsite\s*:/i.test(q))).length,out:OUT}));
