'use strict';
const $ = id => document.getElementById(id);
const CATEGORY = {data:'数据与环境',training:'训练 / RL',benchmark:'Benchmark 评测',distillation:'数据与知识蒸馏',models:'模型与 Showcases'};
const TOPIC={
  'video-editing':{name:'视频剪辑',sub:'VIDEO EDITING',icon:'01',description:'剪辑 Agent、素材理解、时间线编辑与长视频叙事'},
  'code2video':{name:'Code2Video',sub:'CODE → VIDEO',icon:'02',description:'用代码生成可编辑视频，关注规划、渲染与视觉反馈'},
  'code2motion':{name:'Code2Motion',sub:'CODE → MOTION',icon:'03',description:'网页动效、Manim、Remotion、GSAP 与程序化动画'},
  'code2-3d':{name:'Code2 3D',sub:'CODE → 3D',icon:'04',description:'Blender 脚本、Three.js、程序化场景与 CAD'}
};
const briefFor=r=>r.paperBrief||r.projectBrief;
const topicList=r=>(r.topics||[]).filter(t=>TOPIC[t]);
const SOURCE = {arxiv:'arXiv',huggingface:'Hugging Face',x:'X / Twitter',official:'官方动态'};
const state={view:'feed',topic:'all',category:'all',query:'',source:'all',reading:'all',sort:'insight',limit:12,records:[],status:{},saved:new Set(),failed:[],ready:false};
try { state.saved=new Set(JSON.parse(localStorage.getItem('agentic-insights-saved')||'[]')); } catch {}
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const textValue=v=>Array.isArray(v)?v.join('；'):typeof v==='object'&&v!==null?JSON.stringify(v):String(v||'');
const safeURL = v => {try{const u=new URL(v,location.href);return ['https:','http:'].includes(u.protocol)?u.href:'#';}catch{return '#';}};
const fmtDate=v=>v&&/^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,10).replaceAll('-','.'):'日期未提供';
const fmtTime=v=>{if(!v)return '尚无运行记录';if(/^\d{4}-\d{2}-\d{2}$/.test(v))return fmtDate(v);const d=new Date(v);return isNaN(d)?esc(v):d.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});};
const sourceName=r=>SOURCE[r.sourceType]||r.sourceType||'公开来源';
const isCurated=r=>r._collection==='curated';
const short=(v,n=170)=>{const s=textValue(v);return s.length>n?s.slice(0,n)+'…':s;};
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2200);}
async function fetchData(name){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(`data/${name}.json`,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('Data unavailable');return await response.json();}
  finally{clearTimeout(timer);}
}
async function load(){
  $('refresh').disabled=true;
  const names=['curated','live','status','editorial-status'];
  const results=await Promise.allSettled(names.map(fetchData));
  state.failed=[];state.aliases={};let records=[];
  results.forEach((res,i)=>{if(res.status!=='fulfilled'){state.failed.push(names[i]);return;}const data=res.value;if(names[i]==='editorial-status'){state.editorial=data;return;}if(names[i]==='status'){state.status=data;return;}const rows=Array.isArray(data)?data:(data.items||data.records||[]);records.push(...rows.map(r=>({...r,_collection:names[i]})));});
  const seen=new Map();
  function canonical(r){try{const u=new URL(r.url||r.originUrl);const paper=u.pathname.match(/^\/(?:abs|pdf|papers)\/(\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?\/?$/);if(paper&&['arxiv.org','export.arxiv.org','huggingface.co'].includes(u.hostname))return 'arxiv:'+paper[1];if(['x.com','twitter.com'].includes(u.hostname)&&u.pathname.includes('/status/'))return 'x:'+u.pathname.split('/status/')[1];return u.hostname+u.pathname.replace(/\/$/,'');}catch{return r.id;}}
  for(const r of records){if(!r.id)continue;const key=canonical(r);if(!seen.has(key)){seen.set(key,r);continue;}const first=seen.get(key);state.aliases[r.id]=first.id;first.topics=[...new Set([...topicList(first),...topicList(r)])];const links=[...(first.sources||[]),...(r.sources||[])];first.sources=links.filter((s,i)=>s.url&&links.findIndex(t=>t.url===s.url)===i);if(state.saved.has(r.id))state.saved.add(first.id);}
  state.records=[...seen.values()];
  state.ready=true;$('refresh').disabled=false;render();route();
}
function getFiltered(){return state.records.filter(r=>{
  if(state.view==='creative'&&(!topicList(r).length||(state.topic!=='all'&&!topicList(r).includes(state.topic))))return false;
  if(state.view==='papers'&&!r.paperBrief)return false;
  if(state.view==='saved'&&!state.saved.has(r.id))return false;
  if(state.category!=='all'&&r.category!==state.category)return false;
  if(state.reading==='brief'&&!briefFor(r))return false;
  if(state.reading==='pending'&&(r.paperBrief||!arxivId(r)))return false;
  if(state.source!=='all'&&r.sourceType!==state.source&&!(r.sources||[]).some(s=>state.source==='arxiv'?/https?:\/\/(?:export\.)?arxiv\.org\//.test(s.url):state.source==='huggingface'?/https?:\/\/huggingface\.co\//.test(s.url):state.source==='x'?/https?:\/\/(?:x|twitter)\.com\//.test(s.url):false))return false;
  const q=state.query.trim().toLowerCase();return !q||[r.title,r.summary,r.insight,briefFor(r)?.tldr,briefFor(r)?.motivation,...(briefFor(r)?.method||[]),...(r.tags||[]),...topicList(r).map(t=>TOPIC[t].name),r.organization,sourceName(r)].join(' ').toLowerCase().includes(q);
}).sort((a,b)=>{if(state.sort==='insight'){const d=Number(isCurated(b))-Number(isCurated(a));if(d)return d;}return String(b.date||'').localeCompare(String(a.date||''))||a.title.localeCompare(b.title);});}
function card(r){const b=briefFor(r);const saved=state.saved.has(r.id);return `<article class="card"><div class="card-top"><span class="category-label ${esc(r.category)}">${esc(CATEGORY[r.category]||'研究动态')}</span><button class="save-button ${saved?'saved':''}" data-save="${esc(r.id)}" aria-label="${saved?'取消收藏':'收藏'}：${esc(r.title)}" aria-pressed="${saved}">${saved?'▣':'▱'}</button></div><h3><button data-detail="${esc(r.id)}">${esc(r.title)}</button></h3><p class="card-summary">${esc(short(b?.tldr||r.summary,230))}</p><div class="insight-box"><b>${b?'↳ 研究启发':isCurated(r)?'↳ INSIGHT':'↳ 待解读信号'}</b><span>${esc(short(b?.inspirations?.[0]||r.insight||'自动收录，待人工解读。',200))}</span></div><div class="paper-actions">${b?`<button data-detail="${esc(r.id)}">${r.projectBrief?'项目五段解读':'五段中文解读'} →</button>`:""}${arxivId(r)?`<a href="https://hjfy.top/arxiv/${esc(arxivId(r))}" target="_blank" rel="noopener noreferrer">${r.translation?.status==="ready"?"中文全文 ↗":"幻觉翻译 ↗"}</a>`:""}</div><div class="topic-tags">${topicList(r).map(t=>`<button data-topic="${esc(t)}">${esc(TOPIC[t].name)} ↗</button>`).join('')}</div><div class="tags">${(r.tags||[]).slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="card-foot"><div><span class="card-source">${esc(sourceName(r))} <span>↗</span></span><span class="card-evidence">${esc(r.evidence||(r.verified?'原始来源已核验':'自动收录·待解读'))}</span></div><time datetime="${esc(r.date||'')}">${/更新/.test(r.dateLabel||'')?'更新 ':''}${fmtDate(r.date||r.capturedAt)}</time></div></article>`;}
function render(){
  const publicItems=state.records;
  $('creative-count').textContent=publicItems.filter(r=>topicList(r).length).length;
  $('paper-count').textContent=state.records.filter(r=>r.paperBrief).length;$('stat-public').textContent=publicItems.length;$('stat-curated').textContent=state.records.filter(isCurated).length;$('stat-topics').textContent=publicItems.filter(r=>topicList(r).length).length;$('total-count').textContent=publicItems.length;$('saved-count').textContent=state.records.filter(r=>state.saved.has(r.id)).length;
  document.querySelectorAll('[data-count]').forEach(el=>el.textContent=publicItems.filter(r=>r.category===el.dataset.count).length);
  const feedLast=state.status.completedAt||state.status.finishedAt||state.status.lastRunAt||state.status.generatedAt||state.status.updatedAt||state.status.lastRun;const last=[feedLast,state.editorial?.lastCheckedAt].filter(Boolean).sort().pop();
  $('refresh-label').textContent=state.failed.length?'部分资料暂不可用':`${state.status.errorCount?'部分来源失败 · ':''}更新于 ${fmtTime(last)}`;$('footer-date').textContent=last?`数据更新 ${fmtTime(last)} · 北京时间`:'';
  const label=state.view==='creative'?(TOPIC[state.topic]?.name||'视频与代码创作'):state.view==='papers'?'论文精读':state.view==='saved'?'我的阅读清单':state.view==='sources'?'来源与更新':CATEGORY[state.category]||'研究发现';
  $('breadcrumb').textContent=label;$('section-title').firstChild.textContent=label+' ';
  $('section-kicker').textContent=state.view==='creative'?'FOLLOWED TOPIC · 持续关注':state.view==='papers'?'PAPER BRIEFINGS':state.view==='saved'?'YOUR READING LIST':state.view==='sources'?'SOURCES & PROVENANCE':'EXPLORE THE SIGNALS';
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.category?state.view==='feed'&&state.category===el.dataset.category:el.dataset.view===state.view&&(state.view!=='feed'||state.category==='all')));
  document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===state.category));
  const home=state.view==='feed'&&state.category==='all'&&!state.query&&state.source==='all'&&state.reading==='all';
  $('intro').hidden=!home;$('stats').hidden=!home;$('featured').hidden=!home;$('filterbar').hidden=state.view==='sources';$('cards').hidden=state.view==='sources';$('source-panel').hidden=state.view!=='sources';document.querySelector('.search').hidden=state.view==='sources';$('source-filter').hidden=false;$('reading-filter').hidden=false;
  $('creative-intro').hidden=state.view!=='creative';if(state.view==='creative')renderCreative(publicItems);
  if(home)renderFeature();
  const filtered=getFiltered();$('result-count').textContent=state.view==='sources'?'':filtered.length;
  $('context-note').textContent=state.failed.length?`以下资料在 15 秒内未能载入：${state.failed.map(name=>({'curated':'精选解读','live':'研究动态','status':'采集状态','editorial-status':'解读状态'}[name]||name)).join('、')}。可点击右上角刷新重试。`:state.view==='creative'?'精选论文提供五段中文解读；自动采集线索标注待解读。关注可执行代码、可编辑产物与真实创作流程，四条研究线可交叉归属。':state.view==='papers'?'先读五段中文解读，再看原论文和中文全文：TLDR · Motivation · Pipeline / Method · Novelty · 启发。':state.view==='saved'?'阅读清单保存在当前浏览器，可通过底部「导出当前列表」保存。':state.view==='sources'?'':'精选解读优先展示。自动采集记录保留原始摘要，等待进一步解读；卡片注明发表或修订日期；缺失日期不会用采集时间代替。';
  if(state.view==='sources'){renderSources();$('load-more').hidden=true;return;}
  $('cards').innerHTML=filtered.length?filtered.slice(0,state.limit).map(card).join(''):state.failed.includes('curated')&&state.failed.includes('live')?'<div class="empty"><strong>研究数据暂时无法载入</strong><span>可能是网络连接或更新尚未完成。请点击右上角刷新重试。</span></div>':`<div class="empty"><strong>${state.view==='saved'?'把值得细读的内容留在这里':'没有找到匹配的内容'}</strong><span>${state.view==='saved'?'点击卡片右上角的收藏图标，建立你的研究清单。':'试试更短的关键词，或调整分类与来源。'}</span><br><button class="secondary" id="reset-filters">返回全部研究</button></div>`;
  $('load-more').hidden=filtered.length<=state.limit;$('load-more').innerHTML=`加载更多 <span>↓</span> <small>已显示 ${Math.min(state.limit,filtered.length)} / ${filtered.length}</small>`;
}
function renderCreative(items){
  const total=items.filter(r=>topicList(r).length),briefs=total.filter(r=>r.paperBrief);
  $('creative-intro').innerHTML=`<div class="creative-head"><div><div class="eyebrow">CREATIVE INTELLIGENCE · 已关注</div><h1>让代码成为<br><em>创作的语言。</em></h1><p>从一条可编辑的时间线，到能运行、能修改的动效与三维世界。</p><div class="creative-meta"><span>计划每 6 小时更新</span><span>${briefs.length} 篇中文精读</span><span>${total.length} 条研究线索</span></div></div><div class="creative-symbol" aria-hidden="true"><span>{</span><b>▶</b><span>}</span><small>EDIT · RENDER · REFINE</small></div></div><div class="topic-tracks">${Object.entries(TOPIC).map(([key,t])=>`<button data-topic="${key}" class="topic-track ${state.topic===key?'selected':''}" aria-pressed="${state.topic===key}"><div><small>${t.icon} / ${t.sub}</small><span>${items.filter(r=>topicList(r).includes(key)).length} ↗</span></div><h2>${t.name}</h2><p>${t.description}</p></button>`).join('')}</div>${state.topic!=='all'?'<button class="topic-all" data-topic="all">← 查看整个专题</button>':''}`;
}
function renderFeature(){const featured=state.records.filter(isCurated).find(r=>r.featured)||state.records.find(isCurated);if(!featured){$('featured').innerHTML='';return;}$('featured').innerHTML=`<article class="feature-main"><div class="eyebrow">EDITOR'S PICK · 本期精选</div><h2>${esc(featured.title)}</h2><p>${esc(short(featured.insight||featured.summary,145))}</p><div class="feature-bottom"><button class="text-link" data-detail="${esc(featured.id)}">阅读完整洞察 <span>↗</span></button><small>${esc(sourceName(featured))} · ${fmtDate(featured.date)}</small></div></article><article class="feature-aside"><div class="eyebrow">FOLLOW THE EVIDENCE</div><h3>把分散的信息，连成研究线索。</h3><div class="source-chips"><span class="source-chip">α arXiv</span><span class="source-chip">🤗 Hugging Face</span><span class="source-chip">𝕏 Twitter</span><span class="source-chip">↗ 官方发布</span></div><p>关注数据如何构造、Agent 如何训练、能力如何评测，以及模型在真实场景中的表现。</p><button class="text-link" data-view="sources">查看来源与采集状态 <span>↗</span></button></article>`;}
function renderSources(){
  let rows=state.status.sources||[];if(!Array.isArray(rows))rows=[];
  const statusNames={ok:'采集成功',success:'采集成功',error:'暂时失败',failed:'暂时失败',unconfigured:'未配置',disabled:'未启用',skipped:'本轮跳过',partial:'部分成功'};
  $('source-panel').innerHTML=`<div class="source-intro"><h3>以原始证据为起点，保留不确定性。</h3><p>公开精选：读取原论文、作者发布或官方资料后编写中文洞察，保留方法、出处与实验局限。自动收录：保留公开摘要并标注「待解读」。来源核验不代表独立复现实验。</p><p>计划每 6 小时更新，以页面显示的最近成功更新时间为准。来源不可用时保留已有研究，不把本轮无新增解释为没有新进展。X 线索仅在公开来源可核验时补充。</p><p>关注专题：视频剪辑、Code2Video、Code2Motion 与 Code2 3D。以可编辑工作流和可执行代码为筛选重点，跨 arXiv、Hugging Face 与作者 / 官方发布持续追踪。</p><p>最近解读核验：${fmtTime(state.editorial?.lastCheckedAt||state.editorial?.checkedAt)} · 当前 ${state.records.filter(isCurated).length} 条精选。</p><p>最近成功采集：${fmtTime(state.status.completedAt||state.status.finishedAt||state.status.generatedAt||state.status.updatedAt)}（北京时间）</p></div><div class="source-table-wrap"><table class="source-table"><thead><tr><th>来源</th><th>最近状态</th><th>本轮收录</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.label||r.name||r.id||'公开来源')}<small>${esc(SOURCE[r.sourceType]||'')}</small></td><td><span class="state-tag ${esc(Object.prototype.hasOwnProperty.call(statusNames,r.status)?r.status:'unknown')}">${esc(statusNames[r.status]||'未运行')}</span></td><td>${Number.isFinite(r.accepted??r.count)?esc(r.accepted??r.count):'—'}</td></tr>`).join('')||'<tr><td colspan="3">暂未取得采集状态。已收录内容仍可阅读。</td></tr>'}</tbody></table></div>`;
}
function arxivId(r){for(const url of [r.url,r.originUrl,...(r.sources||[]).map(s=>s.url)]){const m=String(url||'').match(/(?:arxiv\.org\/(?:abs|pdf|html)|huggingface\.co\/papers)\/(\d{4}\.\d{4,5})/);if(m)return m[1];}return null;}
function paragraphSection(number,label,title,body,kind=''){return `<section class="paper-section ${kind}"><div class="paper-section-head"><span>${number}</span><div><small>${label}</small><h3>${title}</h3></div></div>${body}</section>`;}
function paperSections(r){const b=briefFor(r);return paragraphSection('01','TL;DR','一句话看懂',`<p>${esc(b.tldr)}</p>`,'tldr')+paragraphSection('02','MOTIVATION','为什么要做',`<p>${esc(b.motivation)}</p>`)+paragraphSection('03','PIPELINE / METHOD','方法怎么走',`<ol class="method-steps">${(b.method||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`)+paragraphSection('04','NOVELTY','新在哪里',`<p>${esc(b.novelty)}</p>`)+paragraphSection('05','TAKEAWAYS','对我们的启发',`<ul class="takeaways">${(b.inspirations||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`);}
function translationBlock(r){const id=arxivId(r);if(!id)return '';const ready=r.translation?.status==='ready';return `<div class="translation-block"><div><b>中文全文与双语对照</b><small>${ready?'已在幻觉翻译核验译文阅读页':'打开幻觉翻译可查看缓存或发起翻译；可能需要登录与等待'}</small></div><a href="https://hjfy.top/arxiv/${esc(id)}" target="_blank" rel="noopener noreferrer">${ready?'阅读中文全文':'在幻觉翻译打开'} ↗</a></div>`;}
function showDetail(id){
 const r=state.records.find(r=>r.id===(state.aliases?.[id]||id));const b=r&&briefFor(r);if(!r){toast('未找到这条记录');return;}
 const sources=r.sources?.length?r.sources:[{label:'查看原始来源',url:r.url||r.originUrl}];const dateLabel=r.dateLabel||'发表日期';
 const standard=`<section class="detail-section"><h3>研究摘要</h3><p>${esc(textValue(r.summary))}</p></section><section class="detail-section insight"><h3>${isCurated(r)?'INSIGHT · 为什么值得关注':'自动收录 · 解读状态'}</h3><p>${esc(textValue(r.insight||'自动收录，待人工解读。'))}</p></section>`;
 $('detail-content').innerHTML=`<span class="category-label ${esc(r.category)}">${esc(CATEGORY[r.category]||'研究')}</span><h2 class="detail-title">${esc(r.title)}</h2><div class="detail-meta"><span>${esc(sourceName(r))}</span><span>${esc(dateLabel.includes('20')||dateLabel.includes('日期未')?dateLabel:dateLabel+' · '+fmtDate(r.date||r.capturedAt))}</span><span>${esc(r.evidence||'待解读')}</span></div>${translationBlock(r)}${b?`<div class="paper-brief">${paperSections(r)}</div>`:standard}<section class="detail-section limit"><h3>证据边界与下一步</h3><p>${esc(textValue(b?.limits||r.limits||'以原始来源所描述的实验与设置为准，尚未在本地独立复现实验。'))}</p>${b?.evidenceScope?`<p class="reading-scope">阅读范围：${esc(b.evidenceScope)}</p>`:''}</section><div class="detail-meta" style="margin-top:20px">${b?.reviewedAt?`<span>解读更新：${fmtTime(b.reviewedAt)}</span>`:r.checkedAt?`<span>核验 / 采集时间：${fmtTime(r.checkedAt)}</span>`:''}</div><div class="detail-links">${sources.filter(s=>s.url).map(s=>`<a href="${esc(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.label||'原始来源')} ↗</a>`).join('')}<button data-save="${esc(r.id)}">${state.saved.has(r.id)?'已加入阅读清单 ✓':'加入阅读清单 ＋'}</button><button id="copy-link">复制本站链接</button></div>`;
 if(!$('detail').open)$('detail').showModal();
}

function viewHash(){if(state.view==='creative')return `#creative${state.topic!=='all'||state.category!=='all'?'/'+state.topic:''}${state.category!=='all'?'/'+state.category:''}`;return `#${state.view}${state.category!=='all'?'/'+state.category:''}`;}
function selectView(view,category='all',topic='all'){state.view=view;state.category=category;state.topic=TOPIC[topic]?topic:'all';state.source='all';state.reading='all';$('reading-filter').value='all';state.limit=12;state.query='';$('search').value='';$('source-filter').value='all';history.replaceState(null,'',viewHash());render();window.scrollTo({top:0,behavior:'instant'});}
function route(){if(!state.ready)return;const hash=decodeURIComponent(location.hash.slice(1));if(hash.startsWith('item/')){showDetail(hash.slice(5));return;}const [view,category,topicCategory]=hash.split('/');if(['feed','creative','papers','saved','sources'].includes(view)){state.view=view;state.category=state.view==='creative'?(CATEGORY[topicCategory]?topicCategory:'all'):(CATEGORY[category]?category:'all');state.topic=state.view==='creative'&&TOPIC[category]?category:'all';render();}}
function save(id){if(state.saved.has(id))state.saved.delete(id);else state.saved.add(id);try{localStorage.setItem('agentic-insights-saved',JSON.stringify([...state.saved]));}catch{toast('浏览器未允许保存；可导出列表');}render();if($('detail').open)showDetail(id);toast(state.saved.has(id)?'已加入阅读清单':'已从阅读清单移除');}
document.addEventListener('click',async e=>{const t=e.target.closest('button,a');if(!t)return;if(t.dataset.topic){selectView('creative','all',t.dataset.topic);return;}if(t.dataset.view){selectView(t.dataset.view);return;}if(t.dataset.category){selectView('feed',t.dataset.category);return;}if(t.dataset.tab){state.category=t.dataset.tab;state.limit=12;history.replaceState(null,'',viewHash());render();return;}if(t.dataset.detail){history.replaceState(null,'',`#item/${encodeURIComponent(t.dataset.detail)}`);showDetail(t.dataset.detail);return;}if(t.dataset.save){save(t.dataset.save);return;}if(t.id==='reset-filters')selectView('feed');if(t.id==='copy-link'){try{await navigator.clipboard.writeText(location.href);toast('链接已复制');}catch{const input=document.createElement('textarea');input.value=location.href;$('detail').append(input);input.select();const ok=document.execCommand('copy');input.remove();toast(ok?'链接已复制':'请从地址栏复制链接');}}});
$('search').addEventListener('input',e=>{state.query=e.target.value;state.limit=12;render();});
$('source-filter').addEventListener('change',e=>{state.source=e.target.value;state.limit=12;render();});
$('reading-filter').addEventListener('change',e=>{state.reading=e.target.value;state.limit=12;render();});
$('sort').addEventListener('change',e=>{state.sort=e.target.value;render();});
$('load-more').addEventListener('click',()=>{state.limit+=12;render();});
$('refresh').addEventListener('click',async()=>{await safeLoad();toast(state.failed.length?'部分数据暂不可用，请稍后重试':'已重新读取站点数据');});
$('close-detail').addEventListener('click',()=>$('detail').close());
$('detail').addEventListener('click',e=>{if(e.target===$('detail')){const r=$('detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('detail').close();}});
$('detail').addEventListener('close',()=>{if(location.hash.startsWith('#item/'))history.replaceState(null,'',viewHash());});
$('export-data').addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(getFiltered().map(({_collection,...r})=>r),null,2)],{type:'application/json'}));a.download=`agentic-insights-${state.view}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('已导出当前列表');});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('detail').open){e.preventDefault();if(state.view==='sources')selectView('feed');$('search').focus();}});
window.addEventListener('hashchange',route);
async function safeLoad(){try{await load();}catch{state.failed=['curated','live'];$('refresh').disabled=false;$('refresh-label').textContent='资料加载失败';$('context-note').textContent='暂时无法载入研究资料，请点击右上角刷新重试。';$('cards').innerHTML='<div class="empty"><strong>暂时无法载入研究资料</strong><span>请检查网络连接后重试。</span></div>';}}
safeLoad();
