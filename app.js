import { unlockPayload } from './crypto.js';
const $ = id => document.getElementById(id);
const state = {courses:[],assets:{},course:0,section:0};
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanTitle = s => s.replace(/\s*\{#[^}]+\}\s*$/,'').trim();
function inline(s){return esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');}
function formula(tex){tex=tex.replace(/\\operatorname\{/g, "\\mathrm{").replace(/\{\\rm\s+([^}]+)\}/g, "{\\mathrm{$1}}");try{return window.katex.renderToString(tex,{displayMode:true,throwOnError:false,strict:false});}catch{return esc(tex);}}
function renderMarkdown(raw){
  const lines=raw.replace(/\r/g,'').split('\n'); let html='',paragraph=[],details=false,list=false; const headings=[];
  const flush=()=>{if(paragraph.length){html+=`<p>${inline(paragraph.join(' '))}</p>`;paragraph=[];}};
  const endList=()=>{if(list){html+='</ul>';list=false;}};
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(!line){flush();endList();continue;}
    const h=line.match(/^(#{2,3})\s+(.+)/);
    if(h){flush();endList();if(details){html+='</div></details>';details=false;} const title=cleanTitle(h[2]);const id=`part-${headings.length}`; headings.push({id,title});
      if(h[1]==='###' && /^(解説|解答|答え)/.test(title)){html+=`<details id="${id}"><summary>${inline(title)}</summary><div class="details-content">`;details=true;}else{const level=h[1].length;html+=`<h${level} id="${id}">${inline(title)}</h${level}>`;}
      continue;
    }
    if(line.startsWith('$$')){flush();endList();let tex=line.slice(2);if(tex.endsWith('$$'))tex=tex.slice(0,-2);else{while(++i<lines.length&&!lines[i].includes('$$'))tex+='\n'+lines[i];if(i<lines.length)tex+='\n'+lines[i].split('$$')[0];}html+=`<div class="equation">${formula(tex)}</div>`;continue;}
    const fig=line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if(fig){flush();endList();const key=fig[2].replace(/^\.\//,'').replace(/^data\//,'');const image=state.assets[key];html+=image?`<figure><img src="${esc(image)}" alt="${esc(fig[1])}" loading="lazy"><figcaption>${inline(fig[1])}</figcaption></figure>`:`<p>${inline(fig[1])}</p>`;continue;}
    if(/^[-*] /.test(line)){flush();if(!list){html+='<ul>';list=true;}html+=`<li>${inline(line.slice(2))}</li>`;continue;}
    endList();paragraph.push(line);
  }
  flush();endList();if(details)html+='</div></details>';return {html,headings};
}
function current(){return state.courses[state.course].sections[state.section];}
function closeMenu(){$('reader').classList.remove('menu-open');$('menu').setAttribute('aria-expanded','false');}
function savePosition(){localStorage.setItem('study-position',JSON.stringify({course:state.courses[state.course].id,section:current().id}));}
function selectSection(index){state.section=Math.max(0,Math.min(index,state.courses[state.course].sections.length-1));savePosition();render();window.scrollTo({top:0,behavior:'instant'});closeMenu();}
function render(){
 const course=state.courses[state.course], section=current(); $('course').value=String(state.course); $('section-count').textContent=`${course.sections.length} 章`;
 $('toc').innerHTML=course.sections.map((s,i)=>`<button class="toc-item ${i===state.section?'active':''}" ${i===state.section?'aria-current="page"':''} data-index="${i}">${inline(cleanTitle(s.title))}</button>`).join('');
 $('toc').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>selectSection(Number(b.dataset.index))));
 $('breadcrumb').textContent=course.title; $('chapter-title').textContent=cleanTitle(section.title);document.title=`${cleanTitle(section.title)} | 講義ノート`;
 const rendered=renderMarkdown(section.markdown); $('content').innerHTML=rendered.html;
 $('in-page').innerHTML=rendered.headings.map(h=>`<a href="#${h.id}">${inline(h.title)}</a>`).join('');
 $('in-page').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{const el=document.querySelector(a.getAttribute('href'));if(el?.tagName==='DETAILS')el.open=true;}));
 $('previous').disabled=state.section===0; $('next').disabled=state.section===course.sections.length-1; $('progress').textContent=`${state.section+1} / ${course.sections.length}`;
 const mark=JSON.parse(localStorage.getItem('study-bookmark')||'null');const marked=mark?.course===course.id&&mark?.section===section.id;$('bookmark').textContent=marked?'★　しおりを解除':'☆　しおりを付ける';
 renderQuiz(section.quizzes||[]);
}
function renderQuiz(quizzes){const root=$('quiz');if(!quizzes.length){root.innerHTML='';return;}root.innerHTML=`<section class="quiz"><h2>確認問題</h2>${quizzes.map((q,i)=>`<form data-quiz="${i}"><fieldset><legend>${i+1}. ${inline(q.question)}</legend>${q.options.map((o,j)=>`<label><input type="radio" name="answer" value="${j}" required> ${inline(o)}</label>`).join('')}</fieldset><button type="submit">答えを確認</button><p class="feedback" role="status"></p></form>`).join('')}</section>`;root.querySelectorAll('form').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();const q=quizzes[Number(f.dataset.quiz)],choice=Number(new FormData(f).get('answer'));f.querySelector('.feedback').textContent=(choice===q.answer?'正解。':'もう一度考えてみましょう。')+' '+q.explanation;}));}
$('unlock-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;$('error').textContent='';try{const payload=await unlockPayload($('password').value);if(!Array.isArray(payload.courses)||!payload.courses.length)throw new Error('empty');state.courses=payload.courses;state.assets=payload.assets||{};$('course').innerHTML=state.courses.map((c,i)=>`<option value="${i}">${inline(c.title)}</option>`).join('');const position=JSON.parse(localStorage.getItem('study-position')||'null');const ci=state.courses.findIndex(c=>c.id===position?.course);if(ci>=0){state.course=ci;const si=state.courses[ci].sections.findIndex(s=>s.id===position?.section);if(si>=0)state.section=si;}$('unlock').hidden=true;$('reader').hidden=false;$('lock').hidden=false;$('password').value='';render();}catch(err){console.error(err);$('error').textContent='開けませんでした。パスワードまたは教材ファイルを確認してください。';}finally{button.disabled=false;}});
$('course').addEventListener('change',e=>{state.course=Number(e.target.value);selectSection(0);});$('previous').addEventListener('click',()=>selectSection(state.section-1));$('next').addEventListener('click',()=>selectSection(state.section+1));
$('bookmark').addEventListener('click',()=>{const c=state.courses[state.course],s=current(),mark=JSON.parse(localStorage.getItem('study-bookmark')||'null');if(mark?.course===c.id&&mark?.section===s.id)localStorage.removeItem('study-bookmark');else localStorage.setItem('study-bookmark',JSON.stringify({course:c.id,section:s.id}));render();});
$('lock').addEventListener('click',()=>location.reload());$('menu').addEventListener('click',()=>{const isOpen=$('reader').classList.toggle('menu-open');$('menu').setAttribute('aria-expanded',String(isOpen));});$('scrim').addEventListener('click',closeMenu);
if(localStorage.getItem('study-theme')==='dark')document.body.classList.add('dark');$('theme').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('study-theme',document.body.classList.contains('dark')?'dark':'light');});
