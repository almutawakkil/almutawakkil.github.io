'use strict';

const list=document.getElementById('projectList');
const statusElement=document.getElementById('libraryStatus');
const errorElement=document.getElementById('libraryError');
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const arabicDigits=value=>String(value??'').replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[Number(d)]);

function validEntry(entry){
  return entry&&typeof entry.id==='string'&&/^[a-z0-9][a-z0-9_-]*$/i.test(entry.id)&&typeof entry.title==='string'&&entry.title.trim()&&typeof entry.file==='string'&&!entry.file.includes('..')&&!/^(?:[a-z]+:|\/)/i.test(entry.file);
}

function render(entries){
  list.replaceChildren();
  if(!entries.length){
    list.innerHTML='<div class="library-card empty">لا توجد مشجّرات منشورة في الفهرس بعد.</div>';
    statusElement.textContent='';
    return;
  }
  for(const entry of entries){
    const card=document.createElement('article');
    card.className='project-card';
    const count=Number.isInteger(entry.routeCount)&&entry.routeCount>=0?`<div class="project-meta">${arabicDigits(entry.routeCount)} طرق مسجلة</div>`:'';
    card.innerHTML=`<div><h3>${escapeHtml(entry.title)}</h3>${entry.description?`<p>${escapeHtml(entry.description)}</p>`:''}${count}</div><a class="button-link" href="viewer.html?project=${encodeURIComponent(entry.id)}">عرض المشجّر</a>`;
    list.append(card);
  }
  statusElement.textContent=`${arabicDigits(entries.length)} مشجّرات منشورة`;
}

async function init(){
  try{
    const response=await fetch('data/index.json',{cache:'no-store'});
    if(!response.ok)throw Error(`تعذّر تحميل فهرس المكتبة (${response.status}).`);
    const data=await response.json();
    const entries=Array.isArray(data)?data:Array.isArray(data.projects)?data.projects:[];
    if(entries.some(entry=>!validEntry(entry)))throw Error('يحتوي فهرس المكتبة على مدخل غير صالح. راجع data/index.json.');
    render(entries);
  }catch(error){
    statusElement.textContent='';
    errorElement.textContent=error instanceof SyntaxError?'تعذّر قراءة فهرس المكتبة لأنه ليس JSON صالحًا.':error.message;
    errorElement.classList.remove('hidden');
  }
}

init();
