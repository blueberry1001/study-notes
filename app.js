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
    const h=line.match(/^(#{2,4})\s+(.+)/);
    if(h){flush();endList();if(details && h[1].length<=3){html+='</div></details>';details=false;} const title=cleanTitle(h[2]);const id=`part-${headings.length}`; headings.push({id,title});
      if(h[1]==='###' && /(解説|解答|答え|ヒント)/.test(title)){html+=`<details id="${id}"><summary>${inline(title)}</summary><div class="details-content">`;details=true;}else{const level=h[1].length;html+=`<h${level} id="${id}">${inline(title)}</h${level}>`;}
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
const narrow=window.matchMedia('(max-width: 700px)');
function syncMenu(){const open=$('reader').classList.contains('menu-open');$('sidebar').inert=narrow.matches&&!open;$('menu').setAttribute('aria-expanded',String(open));$('menu').setAttribute('aria-label',open?'目次を閉じる':'目次を開く');}
function closeMenu(restoreFocus=false){const wasOpen=$('reader').classList.contains('menu-open');$('reader').classList.remove('menu-open');syncMenu();if(restoreFocus&&wasOpen&&narrow.matches)$('menu').focus();}
narrow.addEventListener('change',()=>{if(!narrow.matches)$('reader').classList.remove('menu-open');syncMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu(true);return;}if(e.key!=='Tab'||!narrow.matches||!$('reader').classList.contains('menu-open'))return;const items=[$('menu'),...$('sidebar').querySelectorAll('button,input,select,a[href]')].filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);if(!items.length)return;const i=items.indexOf(document.activeElement);if(e.shiftKey&&(i<=0)){e.preventDefault();items[items.length-1].focus();}else if(!e.shiftKey&&(i===items.length-1||i<0)){e.preventDefault();items[0].focus();}});
function readSaved(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
function updateBookmark(){const c=state.courses[state.course],s=current(),mark=readSaved('study-bookmark'),marked=mark?.course===c.id&&mark?.section===s.id;$('bookmark').textContent=marked?'しおりを解除':'しおりを付ける';$('bookmark').setAttribute('aria-pressed',String(marked));const ci=state.courses.findIndex(course=>course.id===mark?.course),found=ci>=0&&state.courses[ci].sections.some(section=>section.id===mark?.section);$('go-bookmark').hidden=!found;}

function savePosition(){localStorage.setItem('study-position',JSON.stringify({course:state.courses[state.course].id,section:current().id}));}
function selectSection(index){state.section=Math.max(0,Math.min(index,state.courses[state.course].sections.length-1));savePosition();render();window.scrollTo({top:0,behavior:'instant'});closeMenu();$('chapter-title').focus({preventScroll:true});}
function renderSearch(){
 const term=$('search').value.trim().toLocaleLowerCase(), results=$('search-results');$('clear-search').hidden=!term;$('toc').hidden=!!term;results.hidden=!term;$('nav-title').textContent=term?'検索結果':'目次';
 if(!term){$('section-count').textContent=`${state.courses[state.course].sections.length} ページ`;results.innerHTML='';return;}
 const matches=[];state.courses.forEach((course,ci)=>course.sections.forEach((section,si)=>{const haystack=(section.title+'\n'+section.markdown).toLocaleLowerCase(),at=haystack.indexOf(term);if(at<0)return;const raw=section.title+'\n'+section.markdown;const snippet=raw.slice(Math.max(0,at-28),Math.min(raw.length,at+term.length+45)).replace(/[#*$\n]+/g,' ').trim();matches.push({ci,si,title:section.title,course:course.title,snippet});}));
 $('section-count').textContent=`${matches.length} 件`;results.innerHTML=matches.length?matches.map(x=>`<button class="search-result" data-course="${x.ci}" data-section="${x.si}"><span>${inline(x.course)} / ${inline(cleanTitle(x.title))}</span><small>${inline(x.snippet)}</small></button>`).join(''):'<p class="no-results">見つかりませんでした。別の言葉で検索してください。</p>';
 results.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.course=Number(b.dataset.course);selectSection(Number(b.dataset.section));}));
}
function render(){
 const course=state.courses[state.course], section=current(); $('course').value=String(state.course); $('section-count').textContent=`${course.sections.length} ページ`;
 $('toc').innerHTML=course.sections.map((s,i)=>`<button class="toc-item ${i===state.section?'active':''}" ${i===state.section?'aria-current="page"':''} data-index="${i}">${inline(cleanTitle(s.title))}</button>`).join('');
 $('toc').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>selectSection(Number(b.dataset.index))));
 $('breadcrumb').textContent=course.title; $('chapter-title').textContent=cleanTitle(section.title);document.title=`${cleanTitle(section.title)} | 講義ノート`;
 const rendered=renderMarkdown(section.markdown); $('content').innerHTML=rendered.html;
 $('in-page').innerHTML=rendered.headings.map(h=>`<a href="#${h.id}">${inline(h.title)}</a>`).join('');
 $('in-page').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{const el=document.querySelector(a.getAttribute('href'));if(el?.tagName==='DETAILS')el.open=true;else if(el?.closest('details'))el.closest('details').open=true;}));
 $('previous').disabled=state.section===0; $('next').disabled=state.section===course.sections.length-1; $('previous').textContent=state.section>0?'← '+cleanTitle(course.sections[state.section-1].title):'← 前へ';$('next').textContent=state.section<course.sections.length-1?cleanTitle(course.sections[state.section+1].title)+' →':'次へ →';$('progress').textContent=`${state.section+1} / ${course.sections.length}`; $('outline').hidden=!rendered.headings.length; $('outline').open=false; updateBookmark();
 renderQuiz(section.quizzes||[]);renderSearch();
}
function renderQuiz(quizzes){
 const root=$('quiz');
 if(!quizzes.length){root.innerHTML='';return;}
 root.innerHTML=`<section class="quiz"><h2>確認問題</h2>${quizzes.map((q,i)=>`<form data-quiz="${i}"><fieldset><legend>${i+1}. ${inline(q.question)}</legend>${q.options.map((o,j)=>`<label><input type="radio" name="answer" value="${j}" required> ${inline(o)}</label>`).join('')}</fieldset><div class="quiz-actions"><button type="submit">答えを確認</button><button type="button" class="reveal-answer">答えと解説を見る</button></div><div class="feedback" role="status" aria-live="polite"></div></form>`).join('')}</section>`;
 const value=x=>Array.isArray(x)?x.join('、'):x;
 const guidance=q=>[['ヒント',q.hint],['復習する場所',q.review],['調べる言葉',q.keywords],['使う公式',q.formula]].filter(([,text])=>typeof value(text)==='string'&&value(text).trim()).map(([label,text])=>`<p><strong>${label}：</strong>${inline(value(text))}</p>`).join('');
 root.querySelectorAll('form').forEach(f=>{
   const q=quizzes[Number(f.dataset.quiz)],feedback=f.querySelector('.feedback');
   const reveal=()=>{feedback.innerHTML=`<p><strong>答え：${inline(q.options[q.answer])}</strong></p>${q.explanation?`<p>${inline(q.explanation)}</p>`:''}${guidance(q)}`;};
   f.addEventListener('submit',e=>{e.preventDefault();const choice=Number(new FormData(f).get('answer'));if(choice===q.answer){reveal();feedback.insertAdjacentHTML('afterbegin','<p><strong>正解です。</strong></p>');}else feedback.innerHTML=`<p><strong>もう一度考えてみましょう。</strong></p>${guidance(q)}`;});
   f.querySelector('.reveal-answer').addEventListener('click',reveal);
 });
}
$('unlock-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;button.textContent='開いています…';$('error').textContent='';try{const payload=await unlockPayload($('password').value);if(!Array.isArray(payload.courses)||!payload.courses.length)throw new Error('empty');state.courses=payload.courses;state.assets=payload.assets||{};$('course').innerHTML=state.courses.map((c,i)=>`<option value="${i}">${inline(c.title)}</option>`).join('');const position=readSaved('study-position');const ci=state.courses.findIndex(c=>c.id===position?.course);if(ci>=0){state.course=ci;const si=state.courses[ci].sections.findIndex(s=>s.id===position?.section);if(si>=0)state.section=si;}$('unlock').hidden=true;$('reader').hidden=false;$('lock').hidden=false;$('menu').hidden=false;$('password').value='';render();syncMenu();$('chapter-title').focus({preventScroll:true});}catch(err){console.error(err);$('error').textContent='開けませんでした。パスワードまたは教材ファイルを確認してください。';}finally{button.disabled=false;button.textContent='開く →';}});
$('search').addEventListener('input',renderSearch);$('clear-search').addEventListener('click',()=>{$('search').value='';renderSearch();$('search').focus();});
$('course').addEventListener('change',e=>{state.course=Number(e.target.value);selectSection(0);});$('previous').addEventListener('click',()=>selectSection(state.section-1));$('next').addEventListener('click',()=>selectSection(state.section+1));
$('bookmark').addEventListener('click',()=>{const c=state.courses[state.course],s=current(),mark=readSaved('study-bookmark');if(mark?.course===c.id&&mark?.section===s.id)localStorage.removeItem('study-bookmark');else localStorage.setItem('study-bookmark',JSON.stringify({course:c.id,section:s.id}));updateBookmark();});
$('go-bookmark').addEventListener('click',()=>{const mark=readSaved('study-bookmark'),ci=state.courses.findIndex(c=>c.id===mark?.course);if(ci<0)return;const si=state.courses[ci].sections.findIndex(s=>s.id===mark.section);if(si<0)return;state.course=ci;selectSection(si);});
$('lock').addEventListener('click',()=>location.reload());$('menu').addEventListener('click',()=>{$('reader').classList.toggle('menu-open');syncMenu();if($('reader').classList.contains('menu-open'))$('course').focus();});$('scrim').addEventListener('click',()=>closeMenu(true));
if(localStorage.getItem('study-theme')==='dark')document.body.classList.add('dark');$('theme').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('study-theme',document.body.classList.contains('dark')?'dark':'light');});
