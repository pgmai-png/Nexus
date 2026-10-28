var SB='https://wusqkenwwxaglpifrhtf.supabase.co';
var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1c3FrZW53d3hhZ2xwaWZyaHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjE4NjYsImV4cCI6MjA5Nzc5Nzg2Nn0.PrzYWg_us2r4tnDE0bx6YrorcbrALUVI1-EnPhnjrlA';
var LVL=[0,500,1200,2500,4500,7000,10000,13500,17500,22000,27000,32500,38500,45000,52000,59500,67500,76000,85000,95000];
var LVL_N=['Novato','Aprendiz','Guerrero','Veterano','Élite','Maestro','Gran Maestro','Leyenda','Mito','Dios','Inmortal','Trascendente','Omnipotente','Absoluto','Infinito','Eterno','Supremo','Divino','Cósmico','NEXUS'];
var ACHS=[
  {id:'first_mission',name:'Despegue',desc:'Completa tu primera misión',icon:'🚀'},
  {id:'week_streak',name:'En llamas',desc:'7 días de racha',icon:'🔥'},
  {id:'month_perfect',name:'Disciplina de diamante',desc:'Todas las misiones en 30 días',icon:'💎'},
  {id:'monthly_winner',name:'Campeón del mes',desc:'Gana el marcador mensual',icon:'🏆'},
  {id:'double_win',name:'Intratable',desc:'Gana con el doble de XP',icon:'👑'},
  {id:'bonded',name:'Vinculados',desc:'3 meses en el mismo grupo',icon:'🤝'},
  {id:'night_owl',name:'Búho nocturno',desc:'Misión tras medianoche',icon:'🌙'},
  {id:'momentum',name:'Imparable',desc:'3 misiones mensuales en un mes',icon:'⚡'}
];
var U=null,P=null,G=null,F=null,Members=[],AllGroups=[],UA=[],editId=null,wAngle=0,wItems=[];

async function req(path,method,body,token){
  var h={'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+(token||KEY)};
  var o={method:method||'GET',headers:h};
  if(body) o.body=JSON.stringify(body);
  var r=await fetch(SB+path,o);
  var t=await r.text();
  try{return{ok:r.ok,status:r.status,data:t?JSON.parse(t):null};}
  catch(e){return{ok:r.ok,status:r.status,data:t};}
}
function db(path,method,body){return req('/rest/v1'+path,method,body,U&&U.access_token);}
// Funciones de servidor (supabase/migrations/001_seguridad.sql): XP, logros y cierre de mes
function rpc(name,args){return db('/rpc/'+name,'POST',args||{});}
function rpcErr(r,fallback){return(r.data&&r.data.message)||fallback;}
// private_title no es legible por columnas; el dueño lo obtiene con my_private_titles()
var MIS_COLS='id,group_id,user_id,xp_value,approved_by,period_start,created_at,private,title,description,type';
// Perfil sin avatar_url: el avatar va en base64 y se pedía cada 30 s para todo el grupo
var PROF_COLS='id,username,xp,level,streak,last_active,friend_code,avatar_color,created_at';
async function withPrivateTitles(list){
  if(!list.some(function(m){return m.private&&m.user_id===P.id;}))return list;
  var r=await rpc('my_private_titles');
  var map={};(r.data||[]).forEach(function(x){map[x.id]=x.private_title;});
  list.forEach(function(m){if(map[m.id])m.private_title=map[m.id];});
  return list;
}
async function authR(path,body){
  var r=await fetch(SB+'/auth/v1'+path,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify(body)});
  return r.json();
}
function showErr(id,msg){var e=document.getElementById(id);if(e){e.textContent=msg;e.className=(e.className.replace(' show','')||e.className)+' show';}}
function hideErr(id){var e=document.getElementById(id);if(e)e.classList.remove('show');}
function showOk(id,msg){var e=document.getElementById(id);if(e){e.textContent=msg;e.className=(e.className.replace(' show','')||e.className)+' show';}}
// Escapa texto de usuario antes de meterlo en innerHTML (evita XSS)
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
// Solo acepta imágenes base64 o URLs https sin caracteres que rompan el atributo/CSS
function safeImg(u){return typeof u==='string'&&/^(data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+\/=]+|https:\/\/[^\s"'()<>\\]+)$/i.test(u)?u:'';}
// Fecha YYYY-MM-DD en hora local (toISOString usa UTC y desplaza el día en España)
function localDate(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function weekStart(){var n=new Date();var ws=new Date(n);ws.setDate(n.getDate()-(n.getDay()||7)+1);return localDate(ws);}

function switchTab(t){
  document.getElementById('tab-in').classList.toggle('active',t==='in');
  document.getElementById('tab-up').classList.toggle('active',t==='up');
  document.getElementById('form-in').classList.toggle('hidden',t!=='in');
  document.getElementById('form-up').classList.toggle('hidden',t!=='up');
}

async function doLogin(){
  var email=document.getElementById('in-email').value.trim();
  var pass=document.getElementById('in-pass').value;
  hideErr('in-err');
  if(!email||!pass){showErr('in-err','Rellena todos los campos');return;}
  var btn=document.getElementById('in-btn');
  btn.textContent='Entrando...';btn.disabled=true;
  try{
    var r=await authR('/token?grant_type=password',{email:email,password:pass});
    if(r.error){showErr('in-err',r.error.message||'Email o contraseña incorrectos');return;}
    U=r;localStorage.setItem('nx_s',JSON.stringify(r));
    await loadApp();
  }finally{btn.textContent='Entrar';btn.disabled=false;}
}

async function doRegister(){
  var username=document.getElementById('up-user').value.trim();
  var email=document.getElementById('up-email').value.trim();
  var pass=document.getElementById('up-pass').value;
  hideErr('up-err');
  if(!username||!email||!pass){showErr('up-err','Rellena todos los campos');return;}
  if(pass.length<6){showErr('up-err','La contraseña debe tener al menos 6 caracteres');return;}
  var btn=document.getElementById('up-btn');
  btn.textContent='Creando...';btn.disabled=true;
  try{
    var r=await authR('/signup',{email:email,password:pass});
    if(r.error){showErr('up-err',r.error.message||'Error al registrarse');return;}
    var login=await authR('/token?grant_type=password',{email:email,password:pass});
    if(login.error||!login.access_token){showErr('up-err','Cuenta creada. Usa "Entrar" con tus datos.');return;}
    U=login;localStorage.setItem('nx_s',JSON.stringify(login));
    var pr=await db('/profiles','POST',{id:login.user.id,username:username});
    if(!pr.ok){showErr('up-err','Nombre ya en uso. Prueba otro.');U=null;localStorage.removeItem('nx_s');return;}
    await loadApp();
  }finally{btn.textContent='Crear cuenta';btn.disabled=false;}
}

async function refreshToken(){
  try{
    var s=localStorage.getItem('nx_s');
    if(!s)return false;
    var session=JSON.parse(s);
    if(!session.refresh_token)return false;
    var r=await fetch(SB+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({refresh_token:session.refresh_token})});
    var data=await r.json();
    if(data.access_token){U=data;localStorage.setItem('nx_s',JSON.stringify(data));return true;}
    return false;
  }catch(e){return false;}
}

setInterval(async function(){if(U)await refreshToken();},50*60*1000);

async function loadApp(){
  var pr=await db('/profiles?id=eq.'+U.user.id+'&select=*');
  if(!pr.ok||!pr.data||!pr.data.length){
    switchTab('up');
    document.getElementById('up-email').value=U.user.email||'';
    showErr('up-err','Completa tu registro con un nombre de usuario.');
    showAuth();return;
  }
  P=pr.data[0];
  await loadFriend();
  var gm=await db('/group_members?user_id=eq.'+P.id+'&select=group_id');
  if(gm.data&&gm.data.length){
    var gids=gm.data.map(function(x){return x.group_id;});
    var gd=await db('/groups?id=in.('+gids.join(',')+')'+'&select=*&order=created_at.asc');
    AllGroups=gd.data||[];
    var savedGid=localStorage.getItem('nx_gid');
    G=null;
    for(var i=0;i<AllGroups.length;i++){if(AllGroups[i].id===savedGid){G=AllGroups[i];break;}}
    if(!G&&AllGroups.length>0)G=AllGroups[0];
    if(G){
      // Con misiones propias (o un rival que ya las tiene) se entra directo; si no, a definir objetivos
      var anyMis=await db('/missions?user_id=eq.'+P.id+'&select=id&limit=1');
      if(anyMis.data&&anyMis.data.length){showApp();return;}
      await loadAllMembers();
      if(Members.length>0){
        var fMis=await db('/missions?group_id=eq.'+G.id+'&user_id=eq.'+Members[0].id+'&select=id&limit=1');
        if(fMis.data&&fMis.data.length){showApp();return;}
      }
      // No missions at all — ask for goals
      showSetup(4);renderGoals();return;
    }
  }
  // No group — go directly to app in solo mode
  G=null; AllGroups=[]; Members=[];
  showApp();
}

async function loadFriend(){
  var fs=await db('/friendships?or=(requester_id.eq.'+P.id+',receiver_id.eq.'+P.id+')&status=eq.accepted&select=*');
  if(!fs.data||!fs.data.length)return;
  var fid=fs.data[0].requester_id===P.id?fs.data[0].receiver_id:fs.data[0].requester_id;
  var fp=await db('/profiles?id=eq.'+fid+'&select='+PROF_COLS);
  if(fp.data&&fp.data.length)F=fp.data[0];
}

async function loadAllMembers(){
  if(!G)return;
  var gm=await db('/group_members?group_id=eq.'+G.id+'&select=user_id');
  var ids=(gm.data||[]).map(function(m){return m.user_id;}).filter(function(id){return id!==P.id;});
  if(!ids.length){Members=[];return;}
  var mps=await db('/profiles?id=in.('+ids.join(',')+')'+'&select='+PROF_COLS);
  Members=mps.data||[];
  if(Members.length>0)F=Members[0];
}


function showSetup(n){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('setup-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.querySelectorAll('.setup-step').forEach(function(s){s.classList.remove('active');});
  var el=document.getElementById('setup-'+n);
  if(el)el.classList.add('active');
  if(n===2)renderS2();
}

function goS(n){showSetup(n);}

async function renderS2(){
  var pr=await db('/friendships?receiver_id=eq.'+P.id+'&status=eq.pending&select=*,requester:profiles!requester_id(username)');
  var el=document.getElementById('s2-reqs');
  if(el)el.innerHTML=(pr.data||[]).map(function(f){
    return '<div class="card-sm" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between"><div><div style="font-weight:700">'+esc(f.requester.username)+'</div><div style="font-size:12px;color:var(--t2)">quiere ser tu rival</div></div><button class="btn btn-sm btn-primary" onclick="acceptFR(\''+f.id+'\',\''+f.requester_id+'\')">Aceptar</button></div>';
  }).join('');
  var acc=await db('/friendships?or=(requester_id.eq.'+P.id+',receiver_id.eq.'+P.id+')&status=eq.accepted&select=*');
  if(acc.data&&acc.data.length){
    await loadFriend();
    document.getElementById('s2-main').classList.add('hidden');
    document.getElementById('s2-ok').classList.remove('hidden');
    document.getElementById('s2-ok-name').textContent='¡Conectado con '+(F?F.username:'tu rival')+'!';
  }
}

async function sendFR(){
  var code=document.getElementById('s2-code').value.trim().toLowerCase();
  hideErr('s2-err');
  if(!code){showErr('s2-err','Introduce un código');return;}
  if(code===P.friend_code){showErr('s2-err','Ese es tu propio código');return;}
  var r=await db('/profiles?friend_code=eq.'+code+'&select=id,username');
  if(!r.data||!r.data.length){showErr('s2-err','Código no encontrado');return;}
  var friend=r.data[0];
  await db('/friendships','POST',{requester_id:P.id,receiver_id:friend.id,status:'pending'});
  var e=document.getElementById('s2-err');
  e.textContent='¡Solicitud enviada a '+friend.username+'!';e.style.color='var(--green)';e.classList.add('show');
}

async function acceptFR(fid,rid){
  await db('/friendships?id=eq.'+fid,'PATCH',{status:'accepted'});
  await loadFriend();renderS2();
}

async function createGrp(){
  var name=document.getElementById('s3-name').value.trim();
  hideErr('s3-err');
  if(!name){showErr('s3-err','Ponle un nombre al grupo');return;}
  if(!F){showErr('s3-err','Primero vincula a tu rival');return;}
  var btn=document.getElementById('s3-btn');
  btn.disabled=true;btn.textContent='Creando...';
  try{
    // Si el rival ya tiene grupo, el servidor te une a él (comprueba plazas)
    var jr=await rpc('join_group_by_code',{p_code:F.friend_code});
    var noGroup=!jr.ok&&/no tiene grupo/.test(rpcErr(jr,''));
    if(!jr.ok&&!noGroup){showErr('s3-err',rpcErr(jr,'Error uniéndote al grupo de tu rival'));return;}
    if(jr.ok){
      var gid=jr.data;
      showJoinToast('Te has unido al grupo de tu rival automáticamente');
      var gd2=await db('/groups?id=eq.'+gid+'&select=*');
      G=gd2.data[0];
      AllGroups=[G];
      showSetup(4);renderGoals();return;
    }
    var gr=await db('/groups','POST',{name:name,created_by:P.id});
    if(!gr.ok){showErr('s3-err','Error creando el grupo');return;}
    var gd=await db('/groups?created_by=eq.'+P.id+'&order=created_at.desc&limit=1&select=*');
    G=gd.data[0];AllGroups=[G];
    await db('/group_members','POST',{group_id:G.id,user_id:P.id});
    await db('/group_members','POST',{group_id:G.id,user_id:F.id});
    showSetup(4);renderGoals();
  }finally{btn.disabled=false;btn.textContent='Crear →';}
}

function renderGoals(){
  document.getElementById('s4-goals').innerHTML='';
  for(var i=0;i<3;i++)addGoal();
}
function addGoal(){
  var el=document.getElementById('s4-goals');
  var d=document.createElement('div');d.className='goal-row';
  d.innerHTML='<input type="text" placeholder="Ej: Ponerme en forma" maxlength="100"><button class="goal-rm" onclick="this.parentElement.remove()">×</button>';
  el.appendChild(d);
}

async function saveGoals(){
  var inputs=document.querySelectorAll('#s4-goals input');
  var goals=Array.from(inputs).map(function(i){return i.value.trim();}).filter(Boolean);
  if(!goals.length){alert('Añade al menos un objetivo');return;}
  for(var i=0;i<goals.length;i++)await db('/goals','POST',{user_id:P.id,group_id:G.id,text:goals[i]});
  genMissions(goals);showSetup(5);
}

function genMissions(goals){
  var g=goals[0]||'tu objetivo';
  var daily=[{t:'Dedicar 30 min a '+g,x:80},{t:'Completar una tarea pendiente',x:60},{t:'Aprender algo nuevo (20 min)',x:50}];
  var monthly=[{t:'Alcanzar un hito clave en: '+g,x:400},{t:'Completar un reto de 30 días',x:500},{t:'Mantener racha de 20 días',x:450}];
  var dEl=document.getElementById('s5-daily'),mEl=document.getElementById('s5-monthly');
  dEl.innerHTML=daily.map(function(m,i){return '<div class="card-sm" style="margin-bottom:8px"><input type="text" value="'+esc(m.t)+'" id="dm-'+i+'" style="margin-bottom:6px"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:var(--t2)">XP:</span><input type="number" value="'+m.x+'" id="dm-xp-'+i+'" style="width:80px"></div></div>';}).join('');
  mEl.innerHTML=monthly.map(function(m,i){return '<div class="card-sm" style="margin-bottom:8px"><input type="text" value="'+esc(m.t)+'" id="mm-'+i+'" style="margin-bottom:6px"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:var(--t2)">XP:</span><input type="number" value="'+m.x+'" id="mm-xp-'+i+'" style="width:80px"></div></div>';}).join('');
}

async function saveMissions(){
  var btn=document.getElementById('s5-btn');btn.disabled=true;btn.textContent='Guardando...';
  try{
    var today=localDate();
    for(var i=0;i<3;i++){
      var t=document.getElementById('dm-'+i)?document.getElementById('dm-'+i).value.trim():'';
      var x=parseInt(document.getElementById('dm-xp-'+i)?document.getElementById('dm-xp-'+i).value:80)||80;
      if(t)await db('/missions','POST',{group_id:G.id,user_id:P.id,title:t,xp_value:x,type:'daily',period_start:today,approved_by:P.id});
    }
    for(var i=0;i<3;i++){
      var t=document.getElementById('mm-'+i)?document.getElementById('mm-'+i).value.trim():'';
      var x=parseInt(document.getElementById('mm-xp-'+i)?document.getElementById('mm-xp-'+i).value:400)||400;
      if(t)await db('/missions','POST',{group_id:G.id,user_id:P.id,title:t,xp_value:x,type:'monthly',period_start:today,approved_by:P.id});
    }
    showApp();
  }finally{btn.disabled=false;btn.textContent='Empezar →';}
}

function showJoinToast(msg){
  var t=document.getElementById('join-toast');
  if(!t)return;t.textContent=msg;t.style.transform='translateY(0)';
  setTimeout(function(){t.style.transform='translateY(-120px)';},3500);
}

function getLv(xp){for(var i=LVL.length-1;i>=0;i--)if(xp>=LVL[i])return i+1;return 1;}
function getProg(xp){var lv=getLv(xp);var curr=LVL[lv-1]||0;var next=LVL[lv]||curr+2000;return{pct:Math.min(100,((xp-curr)/(next-curr))*100),needed:next-xp,lv:lv};}
function getCurrentPeriod(){var n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');}

async function showApp(){hideLo();
  registerSW();
  // Renueva la suscripción push en cada arranque (cambio de clave o de dirección web)
  if(typeof Notification!=='undefined'&&Notification.permission==='granted')subscribePush();
  updateNotifBtn();
  startNotifPolling();
  setTimeout(checkIncomingNotifs,2000);
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  await loadUA();
  await checkMonthlyClose();
  await refreshDash();
  // Un solo temporizador aunque se cierre e inicie sesión varias veces
  clearInterval(window._dashTimer);
  window._dashTimer=setInterval(async function(){
    if(!document.hidden&&!document.getElementById('page-dashboard').classList.contains('hidden')&&Members.length>0){
      await loadAllMembers();refreshDash();
    }
  },30000);
}

async function loadUA(){var r=await db('/user_achievements?user_id=eq.'+P.id+'&select=achievement_id');UA=(r.data||[]).map(function(a){return a.achievement_id;});}

async function checkMonthlyClose(){
  if(!G)return;
  // El servidor cierra el mes de forma atómica (resultado, reinicio de misiones y periodo);
  // devuelve el resultado solo al primero que lo ejecuta, null si no había nada que cerrar
  var cm=await rpc('close_month',{p_group:G.id});
  if(!cm.ok)return;
  await loadAllMembers();
  var res=cm.data;
  if(res){
    var stored=res.period;
    var won=res.winner_id===P.id;
    if(won){
      await unlockAch('monthly_winner');
      if(res.winner_xp>=res.loser_xp*2&&res.loser_xp>0)await unlockAch('double_win');
    }
    // Spin wheel if enabled and loser
    var wi=[];
    if(!won&&G.wheel_enabled){
      var wir=await db('/wheel_items?group_id=eq.'+G.id+'&select=*');
      wi=wir.data||[];
    }
    var punishment=null;
    if(wi.length>0){punishment=wi[Math.floor(Math.random()*wi.length)].text;}
    // Show results screen
    document.getElementById('mr-emoji').textContent=won?'1º':'—';
    document.getElementById('mr-title').textContent=won?'¡Ganaste el mes!':'Este mes ganó otro';
    document.getElementById('mr-sub').textContent='Periodo: '+stored;
    if(punishment){
      document.getElementById('mr-wheel').classList.remove('hidden');
      document.getElementById('mr-punishment').textContent=punishment;
    }else{
      document.getElementById('mr-wheel').classList.add('hidden');
    }
    document.getElementById('monthres-overlay').classList.add('show');
  }
}

function closeMR(){document.getElementById('monthres-overlay').classList.remove('show');}

function showPage(pg){
  ['dashboard','missions','group','trophies','profile'].forEach(function(p){
    document.getElementById('page-'+p).classList.toggle('hidden',p!==pg);
    document.getElementById('nav-'+p).classList.toggle('active',p===pg);
  });
  if(pg==='dashboard')refreshDash();
  if(pg==='missions')refreshMis();
  if(pg==='group')refreshGrp();
  if(pg==='trophies')refreshTr();
  if(pg==='profile')refreshProf();
}

async function refreshDash(){
  var pr=await db('/profiles?id=eq.'+P.id+'&select='+PROF_COLS);
  if(pr.data&&pr.data.length)Object.assign(P,pr.data[0]); // conserva avatar_url ya cargado
  var h=new Date().getHours();
  var g=h<6?'Buenas noches':h<14?'Buenos días':h<21?'Buenas tardes':'Buenas noches';
  document.getElementById('d-greeting').textContent=g+', '+P.username;
  var dateStr=new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  document.getElementById('d-date').textContent=dateStr.charAt(0).toUpperCase()+dateStr.slice(1);
  var prog=getProg(P.xp);
  document.getElementById('d-level').textContent=prog.lv;
  var lvName=document.getElementById('d-level-name');if(lvName)lvName.textContent=LVL_N[prog.lv-1]||'';
  document.getElementById('d-xp').innerHTML=P.xp.toLocaleString('es-ES')+'<small>xp</small>';
  document.getElementById('d-xp-bar').style.width=prog.pct+'%';
  document.getElementById('d-xp-next').textContent=prog.needed.toLocaleString('es-ES')+' para nivel '+(prog.lv+1);
  document.getElementById('d-streak').innerHTML='racha <b>'+P.streak+'</b> '+(P.streak===1?'día':'días');

  // Show join/create group card when no group
  // Sin grupo no hay misiones: se ocultan sus títulos vacíos
  document.getElementById('page-dashboard').classList.toggle('no-group',!G);
  var joinEl=document.getElementById('d-join-group');
  if(joinEl){
    if(!G){
      joinEl.style.display='block';
      joinEl.innerHTML='<div class="card" style="padding:20px 18px">'+
        '<div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;margin-bottom:6px">Todavía no compites con nadie</div>'+
        '<div style="font-size:14px;color:var(--t2);margin-bottom:16px;line-height:1.5">Crea un grupo y pásale tu código a quien quieras retar, o únete al de un amigo.</div>'+
        '<div style="display:flex;gap:8px">'+
        '<button onclick="openCreateGroupModal()" class="btn btn-primary btn-sm" style="flex:1">Crear grupo</button>'+
        '<button onclick="openJoinGroupModal()" class="btn btn-secondary btn-sm" style="flex:1">Unirse</button>'+
        '</div></div>';
    }else{
      joinEl.style.display='none';
    }
  }
  if(G){
    var today=localDate();
    var mis=await db('/missions?group_id=eq.'+G.id+'&user_id=eq.'+P.id+'&approved_by=not.is.null&select='+MIS_COLS);
    if(mis.data)await withPrivateTitles(mis.data);
    var comps=await db('/mission_completions?user_id=eq.'+P.id+'&completed_date=eq.'+today+'&select=mission_id');
    var allC=await db('/mission_completions?user_id=eq.'+P.id+'&select=mission_id');
    var doneT=new Set((comps.data||[]).map(function(c){return c.mission_id;}));
    var doneA=new Set((allC.data||[]).map(function(c){return c.mission_id;}));
    var daily=(mis.data||[]).filter(function(m){return m.type==='daily';});
    var monthly=(mis.data||[]).filter(function(m){return m.type==='monthly';});
    var todayDone=daily.filter(function(m){return doneT.has(m.id);}).length;
    var todayXp=daily.filter(function(m){return doneT.has(m.id);}).reduce(function(s,m){return s+m.xp_value;},0);
    var dayProg=document.getElementById('d-day-prog');
    if(daily.length>0){
      dayProg.style.display='flex';
      document.getElementById('d-prog-text').innerHTML='<b>'+todayDone+' de '+daily.length+'</b> hechas hoy';
      document.getElementById('d-prog-xp').textContent='+'+todayXp+' xp';
      document.getElementById('d-prog-segs').innerHTML=daily.map(function(m){return '<span class="dp-seg'+(doneT.has(m.id)?' on':'')+'"></span>';}).join('');
    }else{dayProg.style.display='none';}
    document.getElementById('d-daily').innerHTML=renderMis(daily,doneT,'var(--purple3)');
    var weekly=(mis.data||[]).filter(function(m){return m.type==='weekly';});
    var wsStr=weekStart();
    var wkDone=new Set((allC.data||[]).filter(function(c){return c.completed_date>=wsStr;}).map(function(c){return c.mission_id;}));
    var wEl=document.getElementById('d-weekly');
    if(wEl)wEl.innerHTML=renderMis(weekly,wkDone,'#10B981');
    document.getElementById('d-monthly').innerHTML=renderMis(monthly,doneA,'var(--gold)');
  }
}

function renderMis(missions,doneSet,color){
  if(!missions.length)return '<div class="empty">Nada por aquí. Añade una desde Misiones.</div>';
  return '<div class="stagger">'+missions.map(function(m){
    var done=doneSet.has(m.id);
    var isOwn=m.user_id===P.id;
    var showPrivate=m.private&&!isOwn;
    var displayTitle=showPrivate?'Misión privada':(isOwn&&m.private_title?m.private_title:m.title);
    var html='<div class="mission'+(done?' done':'')+'">';
    html+='<button class="mission-check '+(done?'done':'')+'" aria-label="'+(done?'Desmarcar':'Marcar como hecha')+'" onclick="toggleM(\''+m.id+'\','+done+')">';
    html+='<svg viewBox="0 0 24 24" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></button>';
    html+='<div class="mission-body"><div class="mission-title'+(done?' done-text':'')+'">'+esc(displayTitle)+'</div>';
    html+='<div class="mission-meta"><span class="xp">+'+esc(m.xp_value)+' xp</span>'+(m.private?'<span>privada</span>':'')+'</div></div>';
    html+=isOwn?'<button class="mission-edit" aria-label="Editar misión" onclick="openEdit(\''+m.id+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button>':'';
    html+='</div>';
    return html;
  }).join('')+'</div>';
}


// ─── NOTIFICACIONES ──────────────────────────────────────────────────────────
// Clave pública VAPID (la privada está solo en los secretos de la Edge Function send-push)
var VAPID_PUB='BCRX0nYMGv7wTEo9cJAsZM3jUWK6EpaB_XKU-eGRbZqMbOcpdEAmY-KMno5zrI2WsNuBal9Kr5bODH7EWX84V4s';
var EDGE_FN='https://wusqkenwwxaglpifrhtf.supabase.co/functions/v1/send-push';

function urlB64ToUint8(b){
  var pad='='.repeat((4-b.length%4)%4);
  var base64=(b+pad).replace(/-/g,'+').replace(/_/g,'/');
  var raw=window.atob(base64);
  var out=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}

async function enableNotifications(){
  if(typeof Notification==='undefined'){
    alert('Tu navegador no soporta notificaciones.');return;
  }
  var perm=await Notification.requestPermission();
  if(perm!=='granted'){
    alert('Permiso denegado. Ve a Ajustes > NEXUS y activa las notificaciones.');
    return;
  }
  await subscribePush();
  updateNotifBtn();
  showNotifToast('Notificaciones activadas','level_up');
}

async function subscribePush(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window))return;
  try{
    var reg=await navigator.serviceWorker.ready;
    var existing=await reg.pushManager.getSubscription();
    // Si la suscripción se hizo con otra clave VAPID ya no sirve: se rehace
    if(existing&&existing.options&&existing.options.applicationServerKey){
      var cur=new Uint8Array(existing.options.applicationServerKey),want=urlB64ToUint8(VAPID_PUB);
      if(cur.length!==want.length||cur.some(function(b,i){return b!==want[i];})){await existing.unsubscribe();existing=null;}
    }
    var sub=existing||await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlB64ToUint8(VAPID_PUB)
    });
    // Upsert subscription
    var existing_db=await db('/push_subscriptions?user_id=eq.'+P.id+'&select=id');
    if(existing_db.data&&existing_db.data.length){
      await db('/push_subscriptions?user_id=eq.'+P.id,'PATCH',{subscription:sub.toJSON()});
    }else{
      await db('/push_subscriptions','POST',{user_id:P.id,subscription:sub.toJSON()});
    }
  }catch(e){console.log('Push sub error:',e);}
}

function updateNotifBtn(){
  var btn=document.getElementById('notif-btn');
  if(!btn)return;
  if(typeof Notification==='undefined'){btn.style.display='none';return;}
  if(Notification.permission==='granted'){
    btn.textContent='Notificaciones activadas';
    btn.style.background='var(--green-dim)';
    btn.style.color='var(--green)';
    btn.style.borderColor='var(--green)';
    btn.onclick=null;
    btn.style.opacity='0.7';
  }else{
    btn.textContent='Activar notificaciones';
    btn.onclick=enableNotifications;
  }
}

async function sendNotif(toUserId,type,message){
  if(!toUserId||!P||!G)return;
  await db('/notifications','POST',{group_id:G.id,from_user_id:P.id,to_user_id:toUserId,type:type,message:message});
  try{
    await fetch(EDGE_FN,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+(U&&U.access_token||'')},
      body:JSON.stringify({to_user_id:toUserId,message:message,type:type})
    });
  }catch(e){}
}

async function checkIncomingNotifs(){
  if(!P)return;
  var r=await db('/notifications?to_user_id=eq.'+P.id+'&read=eq.false&select=*&order=created_at.desc&limit=10');
  if(!r.data||!r.data.length)return;
  for(var i=0;i<r.data.length;i++){
    var n=r.data[i];
    showNotifToast(n.message,n.type);
    await db('/notifications?id=eq.'+n.id,'PATCH',{read:true});
  }
}

function showNotifToast(msg,type){
  var el=document.getElementById('notif-toast');
  if(!el)return;
  // Marca de color en vez de emoji; el texto ya dice qué ha pasado
  el.innerHTML='<span style="width:8px;height:8px;border-radius:2px;background:var(--accent);margin-right:12px;flex-shrink:0"></span>'+esc(msg);
  el.style.transform='translateY(0)';el.style.opacity='1';
  clearTimeout(window._nt);
  window._nt=setTimeout(function(){el.style.transform='translateY(-80px)';el.style.opacity='0';},4500);
}

async function registerSW(){
  if(!('serviceWorker' in navigator))return;
  try{await navigator.serviceWorker.register('/Nexus/sw.js');}catch(e){console.log('SW:',e);}
}

var _np=null;
function startNotifPolling(){
  if(_np)clearInterval(_np);
  _np=setInterval(checkIncomingNotifs,15000);
}


// ─── AÑADIR MISIÓN ────────────────────────────────────────────────────────────
var _amType = 'daily';
function openAddMission(){
  document.getElementById('am-title').value='';
  document.getElementById('am-xp').value='80';
  document.getElementById('am-err').textContent='';
  selectMisType('daily');
  document.getElementById('add-mission-overlay').classList.add('show');
}

function selectMisType(type){
  _amType=type;
  document.getElementById('am-daily-btn').className='btn btn-'+(type==='daily'?'primary':'secondary')+' btn-sm';
  document.getElementById('am-weekly-btn').className='btn btn-'+(type==='weekly'?'primary':'secondary')+' btn-sm';
  document.getElementById('am-monthly-btn').className='btn btn-'+(type==='monthly'?'primary':'secondary')+' btn-sm';
  document.getElementById('am-xp').value=type==='daily'?80:type==='weekly'?200:400;
}

async function saveNewMission(){
  var title=document.getElementById('am-title').value.trim();
  var xp=Math.min(2000,Math.max(0,parseInt(document.getElementById('am-xp').value)||80)); // límite de la BD
  var err=document.getElementById('am-err');
  err.textContent='';
  if(!title){err.textContent='Escribe un título';return;}
  if(!G){err.textContent='No hay grupo activo';return;}
  var today=localDate();
  var isPrivate=document.getElementById('am-private')?document.getElementById('am-private').checked:false;
  var r=await db('/missions','POST',{
    group_id:G.id,
    user_id:P.id,
    title:isPrivate?'Misión privada':title, // el título real solo va en private_title
    type:_amType,
    xp_value:xp,
    approved_by:P.id,
    period_start:today,
    private:isPrivate,
    private_title:isPrivate?title:null
  });
  if(!r.ok){err.textContent='Error al guardar';return;}
  document.getElementById('add-mission-overlay').classList.remove('show');
  await refreshMis();
  await refreshDash();
}

// ─── FOTO DE PERFIL ───────────────────────────────────────────────────────────
function triggerAvatarUpload(){
  document.getElementById('avatar-input').click();
}

async function uploadAvatar(event){
  var file=event.target.files[0];
  event.target.value='';
  if(!file)return;
  if(file.size>15*1024*1024){alert('La imagen es demasiado grande. Máximo 15MB.');return;}
  try{
    var dataUrl=await shrinkImage(file,256);
    var r=await db('/profiles?id=eq.'+P.id,'PATCH',{avatar_url:dataUrl});
    if(!r.ok)throw new Error(rpcErr(r,'Error al guardar'));
    P.avatar_url=dataUrl;
    renderAvatar(document.getElementById('p-av'), P);
    showNotifToast('Foto actualizada','level_up');
  }catch(e){alert('No se pudo actualizar la foto: '+e.message);}
}

// Recorta al centro y reduce a size×size antes de guardar en base64:
// una foto de móvil pasa de ~2MB a ~15-30KB
async function shrinkImage(file,size){
  var bmp=await createImageBitmap(file);
  var side=Math.min(bmp.width,bmp.height);
  var c=document.createElement('canvas');c.width=c.height=size;
  c.getContext('2d').drawImage(bmp,(bmp.width-side)/2,(bmp.height-side)/2,side,side,0,0,size,size);
  bmp.close&&bmp.close();
  var url=c.toDataURL('image/webp',0.85);
  if(url.indexOf('data:image/webp')!==0)url=c.toDataURL('image/jpeg',0.85); // Safari antiguo no codifica webp
  return url;
}

function renderAvatar(el, profile){
  if(!el)return;
  if(profile&&safeImg(profile.avatar_url)){
    el.style.backgroundImage='url("'+safeImg(profile.avatar_url)+'")';
    el.style.backgroundSize='cover';
    el.style.backgroundPosition='center';
    el.textContent='';
  }else{
    el.style.backgroundImage='';
    el.textContent=(profile&&profile.username)?profile.username[0].toUpperCase():'?';
  }
}


function openCreateGroupModal(){
  document.getElementById('cg-name').value='';
  document.getElementById('cg-err').textContent='';
  document.getElementById('create-grp-overlay').classList.add('show');
}

async function createGroupFromDash(){
  var name=document.getElementById('cg-name').value.trim();
  var err=document.getElementById('cg-err');
  err.textContent='';
  if(!name){err.textContent='Ponle un nombre al grupo';return;}
  var gr=await db('/groups','POST',{name:name,created_by:P.id});
  if(!gr.ok){err.textContent='Error creando el grupo';return;}
  var gd=await db('/groups?created_by=eq.'+P.id+'&order=created_at.desc&limit=1&select=*');
  G=gd.data[0];
  AllGroups.push(G);
  localStorage.setItem('nx_gid',G.id);
  await db('/group_members','POST',{group_id:G.id,user_id:P.id});
  document.getElementById('create-grp-overlay').classList.remove('show');
  await refreshDash();
  showNotifToast('Grupo "'+name+'" creado','level_up');
}

function openJoinGroupModal(){
  var el=document.getElementById('jg-code');
  if(el)el.textContent=P.friend_code||'——';
  document.getElementById('jg-msg').style.display='none';
  document.getElementById('join-grp-overlay').classList.add('show');
}

function copyJoinCode(){
  var code=P&&P.friend_code||'';
  if(navigator.clipboard)navigator.clipboard.writeText(code);
  showNotifToast('Código copiado: '+code,'level_up');
}

async function requestJoinGroup(){
  var code=document.getElementById('jg-code-input').value.trim().toLowerCase();
  var msg=document.getElementById('jg-msg');
  msg.style.display='none';
  if(!code){msg.textContent='Introduce un código';msg.style.color='var(--red)';msg.style.display='block';return;}
  // El servidor busca el grupo del dueño del código, comprueba plazas y te une
  var r=await rpc('join_group_by_code',{p_code:code});
  if(!r.ok){msg.textContent=rpcErr(r,'Error al unirse');msg.style.color='var(--red)';msg.style.display='block';return;}
  var gid=r.data;
  if(AllGroups.some(function(g){return g.id===gid;})){msg.textContent='Ya estás en ese grupo';msg.style.color='var(--text2)';msg.style.display='block';return;}
  var gd=await db('/groups?id=eq.'+gid+'&select=*');
  G=gd.data[0];
  AllGroups.push(G);
  localStorage.setItem('nx_gid',G.id);
  await loadAllMembers();
  document.getElementById('join-grp-overlay').classList.remove('show');
  await refreshDash();
  showNotifToast('Te uniste a "'+G.name+'"','level_up');
}


// ─── LOGROS PERSONALIZADOS ────────────────────────────────────────────────────
var _currentAwardAch = null;

function openCreateAch(){
  if(!G){ alert('Necesitas estar en un grupo para crear logros.'); return; }
  document.getElementById('ca-name').value='';
  document.getElementById('ca-desc').value='';
  document.getElementById('ca-xp').value='0';
  document.getElementById('ca-img').value='';
  document.getElementById('ca-err').textContent='';
  document.getElementById('create-ach-overlay').classList.add('show');
}

async function saveCustomAch(){
  var name=document.getElementById('ca-name').value.trim();
  var desc=document.getElementById('ca-desc').value.trim();
  var xp=Math.min(500,Math.max(0,parseInt(document.getElementById('ca-xp').value)||0)); // límite de la BD
  var imgFile=document.getElementById('ca-img').files[0];
  var err=document.getElementById('ca-err');
  err.textContent='';
  if(!name){err.textContent='Ponle un nombre al logro';return;}
  var btn=document.getElementById('ca-save-btn');
  btn.disabled=true;btn.textContent='Guardando...';
  try{
    var iconUrl=null;
    if(imgFile){
      if(imgFile.size>15*1024*1024){err.textContent='Imagen demasiado grande (máx 15MB)';return;}
      try{iconUrl=await shrinkImage(imgFile,128);}
      catch(e){err.textContent='No se pudo leer la imagen';return;}
    }
    var body={group_id:G.id,created_by:P.id,name:name,description:desc,xp_bonus:xp};
    if(iconUrl)body.icon_url=iconUrl;
    var result=await db('/custom_achievements','POST',body);
    if(!result.ok){err.textContent='Error al guardar';return;}
    document.getElementById('create-ach-overlay').classList.remove('show');
    showNotifToast('Logro "'+name+'" creado','level_up');
    await refreshTr();
  }finally{
    btn.disabled=false;btn.textContent='Crear logro';
  }
}

async function openAwardAch(achId){
  if(!G)return;
  var r=await db('/custom_achievements?id=eq.'+achId+'&select=*');
  if(!r.data||!r.data.length)return;
  var ach=r.data[0];
  _currentAwardAch=ach;
  var iconEl=document.getElementById('award-ach-icon');
  if(safeImg(ach.icon_url)){
    iconEl.innerHTML='<img src="'+safeImg(ach.icon_url)+'" style="width:56px;height:56px;border-radius:10px;object-fit:cover">';
  }else{
    iconEl.textContent='★';
  }
  document.getElementById('award-ach-name').textContent=ach.name;
  document.getElementById('award-ach-desc').textContent=ach.description||'';
  document.getElementById('award-err').textContent='';
  // Load group members
  await loadAllMembers();
  var allM=[P,...Members];
  // Check who already has it
  var unlocks=await db('/custom_achievement_unlocks?achievement_id=eq.'+achId+'&select=user_id');
  var unlockedIds=new Set((unlocks.data||[]).map(function(u){return u.user_id;}));
  var listEl=document.getElementById('award-members-list');
  var listHtml='';
  allM.forEach(function(m){
    var has=unlockedIds.has(m.id);
    listHtml+='<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:0.5px solid var(--border)">';
    listHtml+='<div style="display:flex;align-items:center;gap:10px">';
    listHtml+='<div class="avatar avatar-sm avatar-purple" style="width:32px;height:32px;font-size:13px">'+esc(m.username[0].toUpperCase())+'</div>';
    listHtml+='<div style="font-size:14px;font-weight:600">'+esc(m.username)+(m.id===P.id?' (Tú)':'')+'</div>';
    listHtml+='</div>';
    if(has){
      listHtml+='<span class="badge badge-gold">lo tiene</span>';
    }else{
      listHtml+='<button data-acid="'+achId+'" data-uid="'+m.id+'" data-uname="'+encodeURIComponent(m.username)+'" onclick="awardAchToBtn(this)" class="btn btn-sm btn-secondary" style="font-size:12px">Otorgar</button>';
    }
    listHtml+='</div>';
  });
  listEl.innerHTML=listHtml;
  document.getElementById('award-ach-overlay').classList.add('show');
}

async function awardAchToBtn(btn){
  var achId=btn.getAttribute('data-acid');
  var userId=btn.getAttribute('data-uid');
  var username=decodeURIComponent(btn.getAttribute('data-uname'));
  awardAchTo(achId,userId,username);
}

async function awardAchTo(achId, userId, username){
  var err=document.getElementById('award-err');
  err.textContent='';
  // El servidor comprueba que ambos sois del grupo, registra el logro y suma el bonus de XP
  var r=await rpc('award_custom_achievement',{p_ach:achId,p_user:userId});
  if(!r.ok){
    err.textContent=/duplicate|unique/i.test(rpcErr(r,''))?'Ya tiene este logro.':rpcErr(r,'Error al otorgar.');
    return;
  }
  if(_currentAwardAch&&_currentAwardAch.xp_bonus>0&&userId!==P.id){
    await sendNotif(userId,'level_up','Te han dado el logro "'+(_currentAwardAch.name)+'"'+(+_currentAwardAch.xp_bonus>0?' (+'+_currentAwardAch.xp_bonus+' XP)':''));
  }
  showNotifToast('Logro otorgado a '+username,'level_up');
  // Refresh award modal
  await openAwardAch(achId);
  await refreshTr();
}

async function refreshCustomAch(){
  var gridEl=document.getElementById('tr-custom-grid');
  var labelEl=document.getElementById('custom-ach-label');
  if(!gridEl)return;
  if(!G){gridEl.innerHTML='';if(labelEl)labelEl.style.display='none';return;}
  var r=await db('/custom_achievements?group_id=eq.'+G.id+'&select=*&order=created_at.asc');
  var achs=r.data||[];
  if(!achs.length){gridEl.innerHTML='<div style="padding:12px 0;font-size:12px;color:var(--t3);text-align:center;grid-column:1/-1">Sin logros de grupo aún. ¡Crea el primero!</div>';if(labelEl)labelEl.style.display='block';return;}
  // Get user's unlocks
  var unlocks=await db('/custom_achievement_unlocks?user_id=eq.'+P.id+'&select=achievement_id');
  var myUnlocks=new Set((unlocks.data||[]).map(function(u){return u.achievement_id;}));
  if(labelEl)labelEl.style.display='block';
  var gridHtml='';
  achs.forEach(function(a){
    var has=myUnlocks.has(a.id);
    gridHtml+='<div class="trophy-card-custom '+(has?'unlocked':'')+'" onclick="openAwardAch('+JSON.stringify(a.id)+')">';
    if(safeImg(a.icon_url)){
      gridHtml+='<img src="'+safeImg(a.icon_url)+'" class="trophy-icon-img">';
    }else{
      gridHtml+='<div class="trophy-icon" style="color:var(--accent)">★</div>';
    }
    gridHtml+='<div class="trophy-name">'+esc(a.name)+'</div>';
    gridHtml+='<div class="trophy-desc">'+esc(a.description)+'</div>';
    if(has){
      gridHtml+='<div class="badge badge-gold">tuyo</div>';
    }else{
      gridHtml+='<div style="font-size:12px;color:var(--t3);margin-top:8px">Toca para darlo</div>';
    }
    if(a.xp_bonus>0)gridHtml+='<div class="mono" style="font-size:12px;color:var(--accent);margin-top:4px">+'+a.xp_bonus+' xp</div>';
    gridHtml+='</div>';
  });
  gridEl.innerHTML=gridHtml;
}


// ─── PERFIL DE MIEMBRO ────────────────────────────────────────────────────────
async function openMemberProfile(userId){
  document.getElementById('member-profile-overlay').classList.add('show');
  // Reset
  document.getElementById('mp-avatar').textContent='...';
  document.getElementById('mp-name').textContent='Cargando...';
  document.getElementById('mp-daily').innerHTML='';
  document.getElementById('mp-weekly').innerHTML='';
  document.getElementById('mp-monthly').innerHTML='';

  // Load profile
  var pr=await db('/profiles?id=eq.'+userId+'&select=*');
  if(!pr.data||!pr.data.length)return;
  var member=pr.data[0];
  var prog=getProg(member.xp);

  // Render avatar
  var avEl=document.getElementById('mp-avatar');
  if(safeImg(member.avatar_url)){
    avEl.style.backgroundImage='url("'+safeImg(member.avatar_url)+'")';
    avEl.style.backgroundSize='cover';
    avEl.style.backgroundPosition='center';
    avEl.textContent='';
  }else{
    avEl.style.backgroundImage='';
    avEl.textContent=member.username[0].toUpperCase();
  }
  document.getElementById('mp-name').textContent=member.username;
  document.getElementById('mp-level').textContent='Nivel '+prog.lv+' · '+LVL_N[prog.lv-1];
  document.getElementById('mp-xp').textContent=member.xp.toLocaleString('es-ES')+' xp';
  document.getElementById('mp-streak').textContent=member.streak+' d';

  if(!G)return;
  // Load their missions
  var mis=await db('/missions?group_id=eq.'+G.id+'&user_id=eq.'+userId+'&approved_by=not.is.null&select='+MIS_COLS);
  var comps=await db('/mission_completions?user_id=eq.'+userId+'&select=mission_id,completed_date');
  var today=localDate();
  var wsStr=weekStart();
  var doneToday=new Set((comps.data||[]).filter(function(x){return x.completed_date===today;}).map(function(x){return x.mission_id;}));
  var doneWeek=new Set((comps.data||[]).filter(function(x){return x.completed_date>=wsStr;}).map(function(x){return x.mission_id;}));
  var doneAll=new Set((comps.data||[]).map(function(x){return x.mission_id;}));

  var daily=(mis.data||[]).filter(function(m){return m.type==='daily';});
  var weekly=(mis.data||[]).filter(function(m){return m.type==='weekly';});
  var monthly=(mis.data||[]).filter(function(m){return m.type==='monthly';});

  function renderMemberMis(missions, doneSet, color, isOwner){
    if(!missions.length) return '<div style="font-size:12px;color:var(--t3);padding:8px 0">Sin misiones</div>';
    return missions.map(function(m){
      var done=doneSet.has(m.id);
      return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:0.5px solid var(--border)">'+
        '<div style="width:20px;height:20px;border-radius:5px;border:2px solid '+(done?color:'var(--border)')+';background:'+(done?color:'transparent')+';flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px">'+(done?'✓':'')+'</div>'+
        '<div style="flex:1">'+
          '<div style="font-size:13px;font-weight:500;'+(done?'text-decoration:line-through;color:var(--t3)':'')+'">'+((m.private&&!isOwner)?'Misión privada':esc(m.title))+'</div>'+
          '<div class="mono" style="font-size:12px;color:var(--t3);margin-top:2px">+'+esc(m.xp_value)+' xp</div>'+
        '</div>'+
      '</div>';
    }).join('');
  }

  document.getElementById('mp-daily').innerHTML=renderMemberMis(daily,doneToday,'var(--purple3)',false);
  document.getElementById('mp-weekly').innerHTML=renderMemberMis(weekly,doneWeek,'#10B981',false);
  document.getElementById('mp-monthly').innerHTML=renderMemberMis(monthly,doneAll,'var(--gold)',false);
}

async function toggleM(id,isDone){
  var today=localDate();
  var now=new Date();
  // OPTIMISTIC UPDATE — flip checkbox immediately
  var checkEl=document.querySelector('[onclick*="toggleM(\''+id+'\'"],.mission-check[onclick*="'+id+'"]');
  var allChecks=document.querySelectorAll('.mission-check');
  allChecks.forEach(function(el){
    if(el.getAttribute('onclick')&&el.getAttribute('onclick').includes(id)){
      if(isDone){el.classList.remove('done');}else{el.classList.add('done');}
      var title=el.parentElement&&el.parentElement.querySelector('.mission-title');
      if(title){if(isDone)title.classList.remove('done-text');else title.classList.add('done-text');}
    }
  });
  var m=await db('/missions?id=eq.'+id+'&select=xp_value,type,title,private');
  if(!m.data||!m.data.length)return;
  var mission=m.data[0];
  // XP, racha y marcador mensual los calcula el servidor; el navegador ya no los escribe
  var oldXp=P.xp;
  var r=await rpc(isDone?'uncomplete_mission':'complete_mission',{p_mission:id});
  if(!r.ok||!r.data){
    allChecks.forEach(function(el){
      if(el.getAttribute('onclick')&&el.getAttribute('onclick').includes(id)){
        if(isDone)el.classList.add('done');else el.classList.remove('done');
      }
    });
    showNotifToast(rpcErr(r,'No se pudo guardar. Inténtalo de nuevo.'),'level_up');
    return;
  }
  P.xp=r.data.xp;P.streak=r.data.streak;
  if(!isDone&&r.data.added>0){
    var oldLv=getLv(oldXp),newLv=getLv(P.xp),newStreak=P.streak;
    if(now.getHours()<6)await unlockAch('night_owl');
    await unlockAch('first_mission');
    if(newStreak>=7)await unlockAch('week_streak');
    if(newLv>oldLv)showLU(newLv);
    if(mission.type==='monthly'){
      var mc=await db('/mission_completions?user_id=eq.'+P.id+'&select=mission_id');
      var mm=await db('/missions?group_id=eq.'+G.id+'&user_id=eq.'+P.id+'&type=eq.monthly&select=id');
      var done=new Set((mc.data||[]).map(function(c){return c.mission_id;}));
      if((mm.data||[]).filter(function(x){return done.has(x.id);}).length>=3)await unlockAch('momentum');
    }
  }
  if(!isDone&&r.data.added>0&&Members&&Members.length>0){
    var mTitle=(mission.private)?'una mision privada':(mission.title||'una mision');
    var oLv=getLv(P.xp-mission.xp_value),nLv=getLv(P.xp);
    for(var ni=0;ni<Members.length;ni++){
      var rv=Members[ni];
      var notifTitle=mission.private?'una mision privada':'"'+mTitle+'"';
      await sendNotif(rv.id,'mission_complete',P.username+' completo '+notifTitle+' (+'+mission.xp_value+' XP)');
      if(P.xp>rv.xp&&(P.xp-mission.xp_value)<=rv.xp)await sendNotif(rv.id,'xp_overtake',P.username+' te adelanto en XP');
      if(nLv>oLv)await sendNotif(rv.id,'level_up',P.username+' subio al nivel '+nLv);
    }
  }
  // Refresh UI in background — don't await
  refreshDash();
  if(!document.getElementById('page-missions').classList.contains('hidden'))refreshMis();
}

async function unlockAch(id){
  if(UA.indexOf(id)>-1)return;
  var r=await db('/user_achievements','POST',{user_id:P.id,achievement_id:id});
  if(r.ok){
    UA.push(id);
    var def=ACHS.filter(function(a){return a.id===id;})[0];
    if(def){
      document.getElementById('ach-icon').textContent=def.icon;
      document.getElementById('ach-title').textContent='¡'+def.name+'!';
      document.getElementById('ach-desc').textContent=def.desc;
      var t=document.getElementById('ach-toast');t.classList.add('show');
      setTimeout(function(){t.classList.remove('show');},4000);
    }
  }
}

function showLU(lv){
  document.getElementById('lu-num').textContent=lv;
  document.getElementById('lu-title').textContent=LVL_N[lv-1]||'Nivel '+lv;
  document.getElementById('lu-sub').textContent='Has alcanzado el nivel '+lv;
  var c=document.getElementById('lu-particles');c.innerHTML='';
  var cols=['#CBEA5B','#CBEA5B','#EFEDE4','#6B695F'];
  for(var i=0;i<30;i++){
    var p=document.createElement('div');p.className='particle';
    p.style.cssText='left:'+Math.random()*100+'%;background:'+cols[Math.floor(Math.random()*cols.length)]+';animation-delay:'+Math.random()*1.5+'s;animation-duration:'+(1.5+Math.random())+'s';
    c.appendChild(p);
  }
  document.getElementById('lu-overlay').classList.add('show');
}
function closeLU(){document.getElementById('lu-overlay').classList.remove('show');}

async function refreshMis(){
  if(!G)return;
  var today=localDate();
  var mis=await db('/missions?group_id=eq.'+G.id+'&user_id=eq.'+P.id+'&approved_by=not.is.null&select='+MIS_COLS);
  if(mis.data)await withPrivateTitles(mis.data);
  var comps=await db('/mission_completions?user_id=eq.'+P.id+'&select=mission_id,completed_date');
  var doneT=new Set((comps.data||[]).filter(function(c){return c.completed_date===today;}).map(function(c){return c.mission_id;}));
  var doneA=new Set((comps.data||[]).map(function(c){return c.mission_id;}));
  var weekStartStr=weekStart();
  var weekDoneIds=new Set((comps.data||[]).filter(function(c){return c.completed_date>=weekStartStr;}).map(function(c){return c.mission_id;}));
  var daily=(mis.data||[]).filter(function(m){return m.type==='daily';});
  var weekly=(mis.data||[]).filter(function(m){return m.type==='weekly';});
  var monthly=(mis.data||[]).filter(function(m){return m.type==='monthly';});
  document.getElementById('m-daily').innerHTML=renderMis(daily,doneT,'var(--purple3)');
  document.getElementById('m-weekly').innerHTML=renderMis(weekly,weekDoneIds,'#10B981');
  document.getElementById('m-monthly').innerHTML=renderMis(monthly,doneA,'var(--gold)');
}

function misTab(t){
  document.querySelectorAll('.tabs .tab').forEach(function(x,i){
    x.classList.toggle('active',(t==='daily'&&i===0)||(t==='weekly'&&i===1)||(t==='monthly'&&i===2));
  });
  document.getElementById('m-daily').classList.toggle('hidden',t!=='daily');
  document.getElementById('m-weekly').classList.toggle('hidden',t!=='weekly');
  document.getElementById('m-monthly').classList.toggle('hidden',t!=='monthly');
}

async function openEdit(id){
  editId=id;
  // Título y XP se leen de la BD en vez de pasarlos por el onclick (evita inyección vía título)
  var m=await db('/missions?id=eq.'+id+'&select=id,user_id,title,xp_value,private');
  if(!m.data||!m.data.length)return;
  await withPrivateTitles(m.data);
  document.getElementById('edit-title').value=m.data[0].title||'';
  document.getElementById('edit-xp').value=m.data[0].xp_value;
  var isPriv=m.data[0].private;
  var privTitle=m.data[0].private_title;
  var cb=document.getElementById('edit-private');
  if(cb)cb.checked=!!isPriv;
  // If private, show the real title
  if(isPriv&&privTitle)document.getElementById('edit-title').value=privTitle;
  document.getElementById('edit-overlay').classList.add('show');
}
async function saveEdit(){
  var t=document.getElementById('edit-title').value.trim();
  var x=Math.min(2000,Math.max(0,parseInt(document.getElementById('edit-xp').value)||100)); // límite de la BD
  if(!t)return;
  var isPriv=document.getElementById('edit-private')&&document.getElementById('edit-private').checked;
  await db('/missions?id=eq.'+editId,'PATCH',{
    title:isPriv?'Misión privada':t,
    xp_value:x,
    private:isPriv,
    private_title:isPriv?t:null
  });
  document.getElementById('edit-overlay').classList.remove('show');
  await refreshMis();await refreshDash();
}

async function deleteMission(){
  if(!editId)return;
  if(!confirm('¿Borrar esta misión?'))return;
  // El servidor borra la misión y sus completados, y descuenta el XP si estaba hecha hoy
  var r=await rpc('delete_mission',{p_mission:editId});
  if(!r.ok){alert(rpcErr(r,'No se pudo borrar la misión'));return;}
  if(r.data&&typeof r.data.xp==='number')P.xp=r.data.xp;
  document.getElementById('edit-overlay').classList.remove('show');
  await refreshMis();
  await refreshDash();
}

async function refreshGrp(){
  if(!G)return;
  document.getElementById('g-title').textContent=G.name;
  var now=new Date();
  var last=new Date(now.getFullYear(),now.getMonth()+1,0);
  var diff=Math.ceil((last-now)/(1000*60*60*24));
  document.getElementById('g-cd').textContent=diff+' día'+(diff===1?'':'s');
  var period=getCurrentPeriod();
  var mxp=await db('/monthly_xp?group_id=eq.'+G.id+'&period=eq.'+period+'&select=*');
  await loadAllMembers();
  var allMs=[P].concat(Members);
  var xpMap={};
  (mxp.data||[]).forEach(function(x){xpMap[x.user_id]=x.xp;});
  // La clasificación es la del mes (lo que decide quién gana); el XP total va como contexto
  var ranked=allMs.map(function(m){return{id:m.id,name:m.username,xp:xpMap[m.id]||0,total:m.xp,isMe:m.id===P.id};})
    .sort(function(a,b){return b.xp-a.xp||b.total-a.total;});
  var leader=ranked[0];
  var bannerHtml='<div class="monthly-banner">';
  if(ranked.length>1&&leader.xp>0){
    var gap=leader.xp-ranked[1].xp;
    bannerHtml+='<div class="sb-label">Va primero este mes</div>';
    bannerHtml+='<div style="font-size:34px;font-weight:700;letter-spacing:-0.05em;line-height:1.05;margin:8px 0 6px">'+(leader.isMe?'Tú':esc(leader.name))+'</div>';
    bannerHtml+='<div style="font-size:14px;color:var(--t2)">'+(gap>0?'Con <span class="mono" style="color:var(--accent)">'+gap.toLocaleString('es-ES')+'</span> xp de ventaja':'Empate en cabeza')+'</div>';
  }else{
    bannerHtml+='<div class="sb-label">Mes recién empezado</div>';
    bannerHtml+='<div style="font-size:22px;font-weight:700;letter-spacing:-0.03em;margin-top:8px">Nadie ha puntuado todavía</div>';
  }
  document.getElementById('g-banner').innerHTML=bannerHtml+'</div>';
  var maxXp=ranked.reduce(function(mx,r){return Math.max(mx,r.xp);},1);
  document.getElementById('g-members').innerHTML='<div class="stagger">'+ranked.map(function(r,rank){
    var p=getProg(r.total);
    var html='<div class="player-card"'+(r.isMe?'':' onclick="openMemberProfile(\''+r.id+'\')" style="cursor:pointer"')+'>';
    html+='<div class="player-header">';
    html+='<div class="mono" style="font-size:13px;color:'+(rank===0&&r.xp>0?'var(--accent)':'var(--t3)')+';width:20px;flex-shrink:0">'+(rank+1)+'</div>';
    html+='<div class="avatar avatar-md '+(r.isMe?'avatar-purple':'avatar-gold')+'">'+esc(r.name[0].toUpperCase())+'</div>';
    html+='<div class="player-info"><div class="player-name">'+esc(r.name)+(r.isMe?' <span style="font-weight:400;color:var(--t3)">· tú</span>':'')+'</div><div class="player-level">Nv '+p.lv+' · '+r.total.toLocaleString('es-ES')+' total</div></div>';
    html+='<div class="player-xp">'+r.xp.toLocaleString('es-ES')+'</div></div>';
    html+='<div class="xp-bar-wrap" style="height:4px"><div class="xp-bar-fill '+(r.isMe?'':'xp-bar-gold')+'" style="width:'+Math.round(r.xp/maxXp*100)+'%"></div></div>';
    html+='</div>';
    return html;
  }).join('')+'</div>';
  var gd=await db('/groups?id=eq.'+G.id+'&select=wheel_enabled');
  if(gd.data&&gd.data.length){
    document.getElementById('wh-toggle').checked=gd.data[0].wheel_enabled;
    document.getElementById('wh-section').classList.toggle('hidden',!gd.data[0].wheel_enabled);
  }
  var wi=await db('/wheel_items?group_id=eq.'+G.id+'&select=*');
  document.getElementById('wh-items').innerHTML=(wi.data||[]).map(function(i){
    return '<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border)"><span style="flex:1;font-size:14px">'+esc(i.text)+'</span><button aria-label="Quitar castigo" onclick="removeWI(\''+i.id+'\')" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:20px;padding:4px 8px;line-height:1">×</button></div>';
  }).join('')||'<div style="font-size:13px;color:var(--t3);padding:6px 0">Todavía no hay castigos. Añade el primero.</div>';
  var hist=await db('/monthly_results?group_id=eq.'+G.id+'&order=period.desc&limit=6&select=*');
  var histEl=document.getElementById('g-history');
  if(histEl&&hist.data&&hist.data.length){
    var histHtml='';
    hist.data.forEach(function(h){
      var won=h.winner_id===P.id;
      var parts=h.period.split('-');
      var monthName=new Date(parseInt(parts[0]),parseInt(parts[1])-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});
      histHtml+='<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 2px;border-bottom:1px solid var(--border)">';
      histHtml+='<div><div style="font-size:14px;font-weight:500;text-transform:capitalize">'+monthName+'</div>';
      histHtml+='<div class="mono" style="font-size:12px;color:var(--t3);margin-top:2px">'+h.winner_xp.toLocaleString('es-ES')+' – '+h.loser_xp.toLocaleString('es-ES')+'</div></div>';
      histHtml+='<span class="badge '+(won?'badge-gold':'badge-purple')+'">'+(won?'ganaste':'perdiste')+'</span>';
      histHtml+='</div>';
    });
    histEl.innerHTML=histHtml;
  }else if(histEl){
    histEl.innerHTML='<div style="font-size:13px;color:var(--t3);padding:8px 2px">Aún no se ha cerrado ningún mes.</div>';
  }
}

async function toggleWheel(){await db('/groups?id=eq.'+G.id,'PATCH',{wheel_enabled:document.getElementById('wh-toggle').checked});document.getElementById('wh-section').classList.toggle('hidden',!document.getElementById('wh-toggle').checked);}
async function addWI(){var t=document.getElementById('wh-input').value.trim();if(!t)return;await db('/wheel_items','POST',{group_id:G.id,text:t,added_by:P.id});document.getElementById('wh-input').value='';refreshGrp();}
async function removeWI(id){await db('/wheel_items?id=eq.'+id,'DELETE');refreshGrp();}

async function openWheel(){
  var wi=await db('/wheel_items?group_id=eq.'+G.id+'&select=*');
  wItems=wi.data||[];
  if(!wItems.length){alert('Añade castigos primero');return;}
  document.getElementById('wh-overlay').classList.add('show');
  document.getElementById('wh-result').classList.add('hidden');
  drawWheel();
}
function drawWheel(){
  var canvas=document.getElementById('wh-canvas'),ctx=canvas.getContext('2d'),cx=140,cy=140,r=130;
  var colors=['#7C3AED','#5B21B6','#A78BFA','#4C1D95','#6D28D9','#8B5CF6'];
  ctx.clearRect(0,0,280,280);
  var slice=(Math.PI*2)/wItems.length;
  wItems.forEach(function(item,i){
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,wAngle+i*slice,wAngle+(i+1)*slice);ctx.fillStyle=colors[i%colors.length];ctx.fill();ctx.strokeStyle='#0A0A0F';ctx.lineWidth=2;ctx.stroke();
    ctx.save();ctx.translate(cx,cy);ctx.rotate(wAngle+i*slice+slice/2);ctx.textAlign='right';ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';
    var txt=item.text.length>15?item.text.slice(0,15)+'…':item.text;ctx.fillText(txt,r-8,4);ctx.restore();
  });
  ctx.beginPath();ctx.arc(cx,cy,20,0,Math.PI*2);ctx.fillStyle='#0A0A0F';ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy,16,0,Math.PI*2);ctx.fillStyle='#7C3AED';ctx.fill();
  ctx.beginPath();ctx.moveTo(cx+r+10,cy);ctx.lineTo(cx+r-10,cy-10);ctx.lineTo(cx+r-10,cy+10);ctx.fillStyle='#F59E0B';ctx.fill();
}
function doSpin(){
  var btn=document.getElementById('wh-spin-btn');btn.disabled=true;
  var total=2000+Math.random()*2000,dur=4000,start=Date.now();
  function anim(){
    var el=Date.now()-start,prog=Math.min(1,el/dur),eased=1-Math.pow(1-prog,3);
    wAngle=(total*eased*(Math.PI/180))%(Math.PI*2);drawWheel();
    if(prog<1){requestAnimationFrame(anim);}else{
      var slice=(Math.PI*2)/wItems.length;
      var norm=((Math.PI*2)-(wAngle%(Math.PI*2)))%(Math.PI*2);
      var idx=Math.floor(norm/slice)%wItems.length;
      document.getElementById('wh-result').classList.remove('hidden');
      document.getElementById('wh-result-text').textContent=wItems[idx].text;
      btn.disabled=false;
    }
  }
  requestAnimationFrame(anim);
}

async function addMemberByCode(){
  var code=document.getElementById('inv-code').value.trim().toLowerCase();
  var msg=document.getElementById('inv-msg');
  msg.style.display='none';
  if(!code){msg.textContent='Introduce un código';msg.style.color='var(--red)';msg.style.display='block';return;}
  if(!G){msg.textContent='No hay grupo activo';msg.style.color='var(--red)';msg.style.display='block';return;}
  var cur=await db('/group_members?group_id=eq.'+G.id+'&select=user_id');
  if((cur.data||[]).length>=6){msg.textContent='Grupo lleno (6/6)';msg.style.color='var(--red)';msg.style.display='block';return;}
  var ur=await db('/profiles?friend_code=eq.'+code+'&select=id,username');
  if(!ur.data||!ur.data.length){msg.textContent='Código no encontrado';msg.style.color='var(--red)';msg.style.display='block';return;}
  var target=ur.data[0];
  if(target.id===P.id){msg.textContent='Ese es tu propio código';msg.style.color='var(--red)';msg.style.display='block';return;}
  var already=await db('/group_members?group_id=eq.'+G.id+'&user_id=eq.'+target.id+'&select=user_id');
  if(already.data&&already.data.length){msg.textContent=target.username+' ya está en el grupo';msg.style.color='var(--t2)';msg.style.display='block';return;}
  var r=await db('/group_members','POST',{group_id:G.id,user_id:target.id});
  if(!r.ok){msg.textContent='Error al añadir. Inténtalo de nuevo.';msg.style.color='var(--red)';msg.style.display='block';return;}
  msg.textContent=target.username+' ya está en el grupo';msg.style.color='var(--green)';msg.style.display='block';
  document.getElementById('inv-code').value='';
  await loadAllMembers();await refreshGrp();
}

async function openGrpSwitcher(){
  var el=document.getElementById('gs-list');
  el.innerHTML=AllGroups.map(function(g){
    var active=G&&G.id===g.id;
    return '<div onclick="switchGroup(\''+g.id+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:0.5px solid var(--border);cursor:pointer;background:'+(active?'var(--pdim)':'transparent')+'">'+'<div><div style="font-weight:600;font-size:14px;font-family:var(--font-display)">'+esc(g.name)+'</div><div style="font-size:12px;color:var(--t2);margin-top:2px">'+(active?'Grupo activo':'Toca para cambiar')+'</div></div>'+(active?'<div style="width:8px;height:8px;border-radius:50%;background:var(--purple3)"></div>':'')+'</div>';
  }).join('')+'<div onclick="createNewGroup()" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;color:var(--purple3)"><div style="width:36px;height:36px;border-radius:50%;background:var(--pdim);display:flex;align-items:center;justify-content:center;font-size:20px">+</div><div style="font-weight:600;font-size:14px;font-family:var(--font-display)">Crear nuevo grupo</div></div>';
  document.getElementById('gs-overlay').classList.add('show');
}

async function switchGroup(gid){
  for(var i=0;i<AllGroups.length;i++){if(AllGroups[i].id===gid){G=AllGroups[i];break;}}
  localStorage.setItem('nx_gid',G.id);
  await loadAllMembers();
  document.getElementById('gs-overlay').classList.remove('show');
  showPage('group');
}

async function createNewGroup(){
  var name=prompt('Nombre del nuevo grupo:');
  if(!name||!name.trim())return;
  var gr=await db('/groups','POST',{name:name.trim(),created_by:P.id});
  if(!gr.ok){alert('Error creando grupo');return;}
  var gd=await db('/groups?created_by=eq.'+P.id+'&order=created_at.desc&limit=1&select=*');
  var newG=gd.data[0];
  await db('/group_members','POST',{group_id:newG.id,user_id:P.id});
  AllGroups.push(newG);G=newG;
  localStorage.setItem('nx_gid',G.id);
  Members=[];F=null;
  document.getElementById('gs-overlay').classList.remove('show');
  showSetup(4);renderGoals();
}

async function refreshTr(){
  await loadUA();
  var got=ACHS.filter(function(a){return UA.indexOf(a.id)>-1;}).length;
  var trc=document.getElementById('tr-count');if(trc)trc.textContent=got+' de '+ACHS.length+' desbloqueados';
  document.getElementById('tr-grid').innerHTML=ACHS.map(function(a){
    var u=UA.indexOf(a.id)>-1;
    var html='<div class="trophy-card '+(u?'unlocked':'')+'">';
    html+='<div class="trophy-icon">'+a.icon+'</div>';
    html+='<div class="trophy-name">'+a.name+'</div>';
    html+='<div class="trophy-desc">'+a.desc+'</div>';
    if(u)html+='<div class="badge badge-gold">hecho</div>';
    html+='</div>';
    return html;
  }).join('');
  await refreshCustomAch();
}

async function refreshProf(){
  var pr=await db('/profiles?id=eq.'+P.id+'&select=*');
  if(pr.data&&pr.data.length)P=pr.data[0];
  var p=getProg(P.xp);
  renderAvatar(document.getElementById('p-av'), P);
  document.getElementById('p-user').textContent=P.username;
  document.getElementById('p-level').textContent='Nivel '+p.lv+' · '+LVL_N[p.lv-1];
  document.getElementById('p-code').textContent=P.friend_code;
  document.getElementById('st-xp').textContent=P.xp.toLocaleString('es-ES')+' xp';
  document.getElementById('st-lv').textContent=p.lv;
  document.getElementById('st-str').textContent=P.streak+(P.streak===1?' día':' días');
  var mc=await db('/mission_completions?user_id=eq.'+P.id+'&select=id');
  document.getElementById('st-mis').textContent=mc.data?mc.data.length:0;
}

function copyCode(){
  var code=P?P.friend_code:(document.getElementById('s1-code')?document.getElementById('s1-code').textContent:'');
  if(navigator.clipboard)navigator.clipboard.writeText(code);
  alert('Código copiado: '+code);
}

function doLogout(){
  clearInterval(window._dashTimer);clearInterval(_np);_np=null;
  // Invalida también la sesión en el servidor (si falla, se limpia igualmente en local)
  if(U&&U.access_token)fetch(SB+'/auth/v1/logout',{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+U.access_token}}).catch(function(){});
  localStorage.removeItem('nx_s');localStorage.removeItem('nx_gid');
  U=null;P=null;G=null;F=null;Members=[];AllGroups=[];UA=[];
  showAuth();
}


function setLP(p){var b=document.getElementById('ls-bar');if(b)b.style.width=p+'%';}
function hideLo(){
  setLP(100);
  var ls=document.getElementById('ls');
  if(!ls)return;
  setTimeout(function(){
    ls.classList.add('out');
    setTimeout(function(){ls.style.display='none';},400);
  },150);
}
function showAuth(){hideLo();document.getElementById('auth-screen').style.display='flex';document.getElementById('setup-screen').classList.add('hidden');document.getElementById('app').classList.add('hidden');}
window.addEventListener('load',async function(){
  setLP(20);
  var s=localStorage.getItem('nx_s');
  if(s){
    try{
      setLP(40);
      U=JSON.parse(s);
      if(U&&U.user&&U.user.id){
        var ok=await refreshToken();
        setLP(60);
        if(!ok&&!U.access_token){localStorage.removeItem('nx_s');showAuth();return;}
        var pr=await db('/profiles?id=eq.'+U.user.id+'&select=id');
        setLP(85);
        if(pr.ok&&pr.data&&pr.data.length){await loadApp();hideLo();return;}
      }
    }catch(e){}
    localStorage.removeItem('nx_s');
  }
  showAuth();
});
