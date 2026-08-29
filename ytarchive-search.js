let A=null;const $=s=>document.querySelector(s);
const GROUP_GAP_SECONDS=30;
const DISPLAY_PADDING_SEGMENTS=1;

function norm(s=""){return s.normalize("NFKC").replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/ـ/g,"").toLowerCase().replace(/\s+/g," ").trim()}
function esc(s=""){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function parse(q){q=norm(q);if(!q)return null;return q.split(/\s+or\s+/i).map(g=>g.split(/\s+and\s+/i).map(x=>x.trim().replace(/^["']|["']$/g,"")).filter(Boolean)).filter(g=>g.length)}
function match(t,g){return g&&g.some(a=>a.every(term=>t.includes(term)))}
function time(s){s=Math.max(0,Math.floor(s||0));let h=Math.floor(s/3600),m=Math.floor((s%3600)/60),z=s%60;return h?`${h}:${String(m).padStart(2,"0")}:${String(z).padStart(2,"0")}`:`${m}:${String(z).padStart(2,"0")}`}
function at(url,s){return `${url}${url.includes("?")?"&":"?"}t=${Math.floor(s)}s`}
function arabic(s){return /[\u0600-\u06FF]/.test(s||"")}

function queryWords(groups){
  if(!groups) return [];
  const words=[];
  for(const andGroup of groups){
    for(const term of andGroup){
      for(const w of term.split(/\s+/)){
        const n=norm(w);
        if(n && !words.includes(n)) words.push(n);
      }
    }
  }
  return words;
}

function highlightText(text, groups){
  const wanted=queryWords(groups);
  if(!wanted.length) return esc(text);

  // Highlight word-like chunks while preserving punctuation and the original caption text.
  // Comparison uses the same Arabic normalization as search, so common alif/tashkil
  // differences can still be highlighted.
  const parts=(text||"").split(/(\s+)/);
  return parts.map(part=>{
    if(/^\s+$/.test(part)) return part;

    // Strip leading/trailing punctuation only for matching; display original text unchanged.
    const core=part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,"");
    const n=norm(core);

    const hit=wanted.some(w => n===w || (w.length>=3 && n.includes(w)));
    return hit ? `<mark>${esc(part)}</mark>` : esc(part);
  }).join("");
}

function findHitIndexes(v,groups){
  const hits=[];
  for(let i=0;i<v.segments.length;i++){
    const windowText=[
      v.segments[i-1]?.search||"",
      v.segments[i]?.search||"",
      v.segments[i+1]?.search||""
    ].join(" ");
    if(match(windowText,groups)) hits.push(i);
  }
  return hits;
}

function groupHitIndexes(v, hitIndexes){
  if(!hitIndexes.length) return [];
  const groups=[];
  let current=[hitIndexes[0]];

  for(let n=1;n<hitIndexes.length;n++){
    const prevIndex=current[current.length-1];
    const nextIndex=hitIndexes[n];
    const prevTime=v.segments[prevIndex].start||0;
    const nextTime=v.segments[nextIndex].start||0;

    if(nextTime-prevTime<=GROUP_GAP_SECONDS){
      current.push(nextIndex);
    }else{
      groups.push(current);
      current=[nextIndex];
    }
  }
  groups.push(current);
  return groups;
}

function passageForGroup(v,group){
  const firstHit=group[0];
  const lastHit=group[group.length-1];
  const from=Math.max(0,firstHit-DISPLAY_PADDING_SEGMENTS);
  const to=Math.min(v.segments.length-1,lastHit+DISPLAY_PADDING_SEGMENTS);
  const text=v.segments.slice(from,to+1).map(x=>x.text).join(" ");
  return {
    firstHit,
    lastHit,
    start:v.segments[firstHit].start||0,
    end:(v.segments[lastHit].start||0)+(v.segments[lastHit].duration||0),
    text
  };
}

function search(){
  const q=$("#query").value.trim();
  const channel=$("#channel").value;
  const groups=parse(q);

  if(!q){
    $("#status").textContent=`${A.videos.length.toLocaleString()} videos in archive · enter a search above`;
    $("#results").innerHTML="";
    return;
  }

  const passages=[];
  const videosSeen=new Set();

  for(const v of A.videos){
    if(v.transcript_status!=="available") continue;
    if(channel&&(v.channel_id||v.channel)!==channel) continue;

    const hitIndexes=findHitIndexes(v,groups);
    if(!hitIndexes.length) continue;

    const clustered=groupHitIndexes(v,hitIndexes);
    for(const g of clustered){
      passages.push({v,...passageForGroup(v,g)});
      videosSeen.add(v.id);
      if(passages.length>=300) break;
    }
    if(passages.length>=300) break;
  }

  $("#status").textContent =
    `${passages.length.toLocaleString()} matching passage${passages.length===1?"":"s"} in ` +
    `${videosSeen.size.toLocaleString()} video${videosSeen.size===1?"":"s"}` +
    (passages.length>=300?" · first 300 shown":"");

  if(!passages.length){
    $("#results").innerHTML=`<div class="empty">No matching passages found.</div>`;
    return;
  }

  $("#results").innerHTML=passages.map(p=>{
    const v=p.v;
    const dir=arabic(p.text)?"rtl":"ltr";
    const titleDir=arabic(v.title)?"rtl":"ltr";
    const d=v.upload_date&&v.upload_date.length===8
      ?`${v.upload_date.slice(0,4)}-${v.upload_date.slice(4,6)}-${v.upload_date.slice(6,8)}`
      :"";
    const range=(Math.floor(p.end)>Math.floor(p.start)+2)
      ?`<span class="passage-range">passage ${time(p.start)}–${time(p.end)}</span>`
      :"";

    return `<article class="result">
      <h2 dir="${titleDir}">${esc(v.title)}</h2>
      <div class="meta">
        ${esc(v.channel)} · ${time(p.start)}
        ${range}
        ${d?` · ${d}`:""}
        ${v.caption_language?` · ${esc(v.caption_language)}`:""}
        ${v.caption_kind?` ${esc(v.caption_kind)}`:""}
      </div>
      <p class="transcript" dir="${dir}">${highlightText(p.text,groups)}</p>
      <a class="watch" href="${at(v.url,p.start)}" target="_blank" rel="noopener">
        Watch on YouTube at ${time(p.start)} →
      </a>
    </article>`;
  }).join("");
}

async function init(){
  try{
    const r=await fetch("ytarchive-data.json",{cache:"no-store"});
    if(!r.ok) throw Error(r.status);
    A=await r.json();

    for(const ch of A.channels||[]){
      const o=document.createElement("option");
      o.value=ch.id||ch.name;
      o.textContent=`${ch.name} (${ch.searchable_count??ch.video_count})`;
      $("#channel").appendChild(o);
    }

    const n=A.videos.filter(v=>v.transcript_status==="available").length;
    const u=A.videos.length-n;
    $("#status").textContent=
      `${n.toLocaleString()} searchable videos${u?` · ${u.toLocaleString()} without YouTube captions`:""}`;
  }catch(e){
    $("#status").textContent="Could not load ytarchive-data.json. Run the Python archiver first, then serve this folder through a local web server.";
    console.error(e);
  }
}

$("#go").onclick=search;
$("#query").addEventListener("keydown",e=>{if(e.key==="Enter")search()});
$("#channel").onchange=()=>{if($("#query").value.trim())search()};
init();
