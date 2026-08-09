import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const GAP=.02;
let models=JSON.parse(localStorage.getItem('lp_models')||'null')||[
 {id:'local-1',name:'NoFrost 60',l:.60,w:.65,h:1.85},
 {id:'local-2',name:'Compact 55',l:.55,w:.60,h:1.70},
 {id:'local-3',name:'Side by Side',l:.90,w:.75,h:1.80}
];
let placements=[], result=null, supabase=null, user=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2600)}
function saveLocal(){localStorage.setItem('lp_models',JSON.stringify(models));localStorage.setItem('lp_truck',JSON.stringify({l:+$('truckL').value,w:+$('truckW').value,h:+$('truckH').value}));localStorage.setItem('lp_pal',JSON.stringify({l:+$('palL').value,w:+$('palW').value}));renderAll()}
function loadLocal(){
 const t=JSON.parse(localStorage.getItem('lp_truck')||'null')||{l:13.6,w:2.45,h:2.7},p=JSON.parse(localStorage.getItem('lp_pal')||'null')||{l:1.2,w:.8};
 $('truckL').value=t.l;$('truckW').value=t.w;$('truckH').value=t.h;$('palL').value=p.l;$('palW').value=p.w;
}
function renderModels(){
 $('modelRows').innerHTML=models.map((m,i)=>`<tr><td><span class="modelDot"></span><b>${esc(m.name)}</b></td><td>${m.l.toFixed(2)} × ${m.w.toFixed(2)} × ${m.h.toFixed(2)} м</td><td><button class="btn danger" onclick="window.delModel(${i})">Удалить</button></td></tr>`).join('')||'<tr><td colspan="3">Каталог пуст.</td></tr>';
 $('loadRows').innerHTML=models.map((m,i)=>`<tr><td><b>${esc(m.name)}</b></td><td>${m.l.toFixed(2)} × ${m.w.toFixed(2)} × ${m.h.toFixed(2)}</td><td><input class="qtyInput" id="q${i}" type="number" min="0" value="0"></td></tr>`).join('');
}
function addModel(){
 const name=$('mName').value.trim(),l=+$('mL').value,w=+$('mW').value,h=+$('mH').value;
 if(!name||!(l>0)||!(w>0)||!(h>0))return toast('Заполните название и размеры');
 models.push({id:crypto.randomUUID(),name,l,w,h});['mName','mL','mW','mH'].forEach(x=>$(x).value='');saveLocal();syncModel(models.at(-1));toast('Модель сохранена');
}
function delModel(i){const m=models[i];models.splice(i,1);saveLocal();if(user&&supabase&&m.id&&!m.id.startsWith('local-'))supabase.from('fridge_models').delete().eq('id',m.id).eq('user_id',user.id).then(()=>{});toast('Модель удалена')}
function clearModels(){if(!confirm('Удалить весь каталог?'))return;models=[];saveLocal();toast('Каталог очищен')}
window.addModel=addModel;window.delModel=delModel;window.clearModels=clearModels;

function calculate(){
 const TL=+$('truckL').value,TW=+$('truckW').value,TH=+$('truckH').value,PL=+$('palL').value,PW=+$('palW').value;
 if(!(TL>0&&TW>0&&TH>0&&PL>0&&PW>0))return toast('Проверьте размеры');
 let items=[];models.forEach((m,i)=>{const q=+$('q'+i)?.value||0;for(let n=0;n<q;n++)items.push({...m,uid:i+'-'+n})});
 if(!items.length)return toast('Укажите количество холодильников');
 if(items.some(x=>x.h>TH))return toast('Есть холодильник выше грузового отсека');
 items.sort((a,b)=>Math.max(b.l,b.w)*Math.min(b.l,b.w)-Math.max(a.l,a.w)*Math.min(a.l,a.w));
 let rows=[],out=[];
 for(const item of items){
   let best=null;
   for(let ri=0;ri<rows.length;ri++){
    const r=rows[ri];
    for(let ori=0;ori<2;ori++){
      const iw=ori?item.l:item.w, il=ori?item.w:item.l, x=r.used+(r.used?GAP:0);
      if(iw<=TW+1e-8&&x+iw<=TW+1e-8&&il<=r.depth+1e-8){const score=(TW-(x+iw))*r.depth;if(!best||score<best.score)best={ri,iw,il,x,y:r.y,ori,score}}
    }
   }
   if(!best){
    const y=rows.reduce((s,r)=>s+r.depth+(s?GAP:0),0);
    for(let ori=0;ori<2;ori++){const iw=ori?item.l:item.w,il=ori?item.w:item.l;if(iw<=TW+1e-8&&y+il<=TL+1e-8){const score=(TL-y)*TW;if(!best||score<best.score)best={ri:-1,iw,il,x:0,y,ori,score}}}
   }
   if(!best)return toast('Все холодильники не помещаются в фуру');
   if(best.ri<0)rows.push({y:best.y,depth:best.il,used:best.iw});else{const r=rows[best.ri];r.used=best.x+best.iw;r.depth=Math.max(r.depth,best.il)}
   out.push({item,x:best.x,y:best.y,w:best.iw,d:best.il,ori:best.ori});
 }
 placements=out;const usedL=Math.max(...out.map(p=>p.y+p.d)),usedW=Math.max(...out.map(p=>p.x+p.w)),area=usedL*usedW,pal=area/(PL*PW),fill=area/(TL*TW)*100;
 result={count:items.length,usedL,usedW,area,pal,fill};renderResult();renderTruck(TL,TW,out);savePlanLocal();syncPlan();
}
function renderResult(){
 if(!result)return;
 $('sCount').textContent=result.count;$('sPallet').textContent=result.pal.toFixed(1);$('sFill').textContent=Math.min(100,result.fill).toFixed(0)+'%';$('sTruck').textContent=$('truckL').value+' × '+$('truckW').value+' м';
 $('rL').textContent=result.usedL.toFixed(2)+' м';$('rW').textContent=result.usedW.toFixed(2)+' м';$('rArea').textContent=result.area.toFixed(2)+' м²';$('rPal').textContent=result.pal.toFixed(1);$('rBar').style.width=Math.min(100,result.fill)+'%';$('rFillTxt').textContent=Math.min(100,result.fill).toFixed(1)+'%';
 $('usedDims').textContent=result.usedL.toFixed(2)+' × '+result.usedW.toFixed(2)+' м';$('resultText').innerHTML=`<b>${result.count}</b> холодильников требуют зону <b>${result.usedL.toFixed(2)} × ${result.usedW.toFixed(2)} м</b>. Эквивалент — <b>${result.pal.toFixed(1)} условных палет</b>.`;
 $('emptyMsg').style.display='none';
}
function renderTruck(TL,TW,arr){
 const tr=$('trailer');tr.innerHTML='';
 for(let x=0;x<TW;x+=+$('palW').value){const d=document.createElement('i');d.style.cssText=`position:absolute;top:0;bottom:0;left:${x/TW*100}%;border-left:1px dashed #cfd5df`;tr.appendChild(d)}
 for(let y=0;y<TL;y+=+$('palL').value){const d=document.createElement('i');d.style.cssText=`position:absolute;left:0;right:0;top:${y/TL*100}%;border-top:1px dashed #cfd5df`;tr.appendChild(d)}
 arr.forEach((p,i)=>{const d=document.createElement('div');d.className='loadBox '+(p.ori?'long':'cross');d.style.left=p.x/TW*100+'%';d.style.top=p.y/TL*100+'%';d.style.width=p.w/TW*100+'%';d.style.height=p.d/TL*100+'%';d.textContent=p.item.name+' #'+(i+1);d.title=p.item.name;tr.appendChild(d)})
}
function savePlanLocal(){localStorage.setItem('lp_result',JSON.stringify({result,placements}))}
function restoreResult(){const x=JSON.parse(localStorage.getItem('lp_result')||'null');if(x){result=x.result;placements=x.placements||[];renderResult();if(result)renderTruck(+$('truckL').value,+$('truckW').value,placements)}}
function go(page){
 document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===page));document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
 $('pageTitle').textContent={dashboard:'Dashboard',plan:'Погрузка',models:'Холодильники',settings:'Настройки'}[page]||'Dashboard';
}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));

const savedUrl=localStorage.getItem('lp_sb_url')||'',savedKey=localStorage.getItem('lp_sb_key')||'';
$('sbUrl').value=savedUrl;$('sbKey').value=savedKey;
async function connectSupabase(){
 const url=$('sbUrl').value.trim(),key=$('sbKey').value.trim();if(!url||!key)return toast('Введите Supabase URL и anon key');
 try{supabase=createClient(url,key);const {data,error}=await supabase.auth.getSession();if(error)throw error;localStorage.setItem('lp_sb_url',url);localStorage.setItem('lp_sb_key',key);user=data.session?.user||null;setSyncUI();if(user)await pullCloud();toast('Supabase подключён')}catch(e){toast('Ошибка подключения: '+e.message)}
}
async function signIn(){if(!supabase)return toast('Сначала подключите Supabase');const {data,error}=await supabase.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)return toast(error.message);user=data.user;setSyncUI();await pullCloud();toast('Вход выполнен')}
async function signUp(){if(!supabase)return toast('Сначала подключите Supabase');const {data,error}=await supabase.auth.signUp({email:$('email').value.trim(),password:$('password').value});if(error)return toast(error.message);toast(data.session?'Аккаунт создан':'Проверьте email для подтверждения')}
async function signOut(){if(supabase)await supabase.auth.signOut();user=null;setSyncUI();toast('Вы вышли из аккаунта')}
function disconnectSupabase(){supabase=null;user=null;localStorage.removeItem('lp_sb_url');localStorage.removeItem('lp_sb_key');setSyncUI();toast('Supabase отключён')}
async function pullCloud(){
 if(!supabase||!user)return;
 const {data:ms,error}=await supabase.from('fridge_models').select('*').eq('user_id',user.id).order('created_at');
 if(!error&&ms){models=ms.map(m=>({id:m.id,name:m.name,l:+m.length_m,w:+m.width_m,h:+m.height_m}));localStorage.setItem('lp_models',JSON.stringify(models))}
 const {data:s}=await supabase.from('planner_settings').select('*').eq('user_id',user.id).maybeSingle();
 if(s){$('truckL').value=s.truck_length;$('truckW').value=s.truck_width;$('truckH').value=s.truck_height;$('palL').value=s.pallet_length;$('palW').value=s.pallet_width;saveLocal()}
 renderModels();toast('Данные синхронизированы')
}
async function syncModel(m){
 if(!supabase||!user)return;
 const row={id:m.id,user_id:user.id,name:m.name,length_m:m.l,width_m:m.w,height_m:m.h};
 const {error}=await supabase.from('fridge_models').upsert(row);if(error)console.warn(error);
}
async function syncSettings(){
 if(!supabase||!user)return;
 await supabase.from('planner_settings').upsert({user_id:user.id,truck_length:+$('truckL').value,truck_width:+$('truckW').value,truck_height:+$('truckH').value,pallet_length:+$('palL').value,pallet_width:+$('palW').value});
}
async function syncPlan(){if(!supabase||!user||!result)return;await supabase.from('load_plans').insert({user_id:user.id,name:'Последний расчёт',truck_length:+$('truckL').value,truck_width:+$('truckW').value,result_json:{result,placements}})}
function setSyncUI(){
 const ok=!!(supabase&&user);$('syncText').textContent=ok?'Синхронизация включена':'Локальный режим';$('userText').textContent=ok?user.email:'Подключите Supabase';$('topStatus').textContent=ok?'☁ Синхронизировано':'Локально';$('topStatus').className='status '+(ok?'ok':'');$('settingsStatus').textContent=ok?'Подключено':'Не подключено';$('settingsStatus').className='status '+(ok?'ok':'');$('accountInfo').textContent=ok?user.email:'Вход не выполнен';
}
function openLogin(){$('loginModal').classList.add('show')}function closeLogin(){$('loginModal').classList.remove('show')}window.openLogin=openLogin;window.closeLogin=closeLogin;window.go=go;window.calculate=calculate;window.connectSupabase=connectSupabase;window.disconnectSupabase=disconnectSupabase;window.signIn=signIn;window.signUp=signUp;window.signOut=signOut;

['truckL','truckW','truckH','palL','palW'].forEach(id=>$(id).addEventListener('change',()=>{saveLocal();syncSettings()}));

loadLocal();renderModels();restoreResult();setSyncUI();
if(savedUrl&&savedKey){try{connectSupabase()}catch(e){}}
