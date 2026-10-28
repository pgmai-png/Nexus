// NEXUS · Personaje
// Dibuja el personaje en SVG por capas a partir de profiles.avatar:
//   {sex:'m'|'f'|'x', age:'teen'|'young'|'adult'|'senior', skin:0-5, hair:0-6,
//    equip:{ropa,cabeza,gafas,extra,fondo}}
// Los nombres, precios y niveles de los objetos vienen de la tabla shop_items;
// aquí solo está cómo se dibuja cada uno.

var SKINS=['#F6D5BC','#EAB792','#CF946B','#A36B47','#70452F','#F3C49B'];
var HAIRS=['#1E1916','#55331F','#9A4E27','#DDAA5C','#C9452E','#6C7AE0','#ECE7DC'];
var SLOTS=[
  {id:'ropa',name:'Ropa'},{id:'cabeza',name:'Cabeza'},{id:'gafas',name:'Gafas'},
  {id:'extra',name:'Extra'},{id:'fondo',name:'Fondo'}];
var DEFAULT_AVATAR={sex:'x',age:'young',skin:1,hair:1,equip:{ropa:'ropa_sudadera',fondo:'fondo_liso'}};
var _cid=0;

function mixHex(a,b,t){
  var pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);
  var r=Math.round(((pa>>16)&255)*(1-t)+((pb>>16)&255)*t);
  var g=Math.round(((pa>>8)&255)*(1-t)+((pb>>8)&255)*t);
  var bl=Math.round((pa&255)*(1-t)+(pb&255)*t);
  return '#'+((1<<24)|(r<<16)|(g<<8)|bl).toString(16).slice(1);
}
function darker(c,t){return mixHex(c,'#000000',t||0.25);}

// ─── Fondos ───
var BG={
  fondo_liso:function(){return '<rect width="200" height="220" fill="#24241F"/><circle cx="100" cy="118" r="78" fill="#2E2E28"/>';},
  fondo_lima:function(){return '<rect width="200" height="220" fill="#CBEA5B"/><circle cx="30" cy="40" r="46" fill="#B9DA44"/><circle cx="178" cy="180" r="60" fill="#B9DA44"/>';},
  fondo_atardecer:function(id){return '<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB36B"/><stop offset=".55" stop-color="#FF6584"/><stop offset="1" stop-color="#6B4BD8"/></linearGradient></defs><rect width="200" height="220" fill="url(#'+id+')"/><circle cx="100" cy="128" r="58" fill="#FFD27A" opacity=".55"/>';},
  fondo_cuadricula:function(){var l='';for(var i=10;i<220;i+=20)l+='<path d="M0 '+i+'H200M'+i+' 0V220" stroke="#fff" stroke-opacity=".07"/>';return '<rect width="200" height="220" fill="#1B2A3C"/>'+l;},
  fondo_estrellas:function(){var s='',pts=[[24,30,2],[60,18,1.5],[150,26,2.5],[178,64,1.5],[30,92,1.5],[172,120,2],[16,150,2.5],[120,14,1.5],[86,40,1]];pts.forEach(function(p){s+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+p[2]+'" fill="#FFF6D6"/>';});return '<rect width="200" height="220" fill="#151938"/><circle cx="160" cy="54" r="18" fill="#FFF6D6" opacity=".9"/><circle cx="168" cy="48" r="16" fill="#151938"/>'+s;},
  fondo_oro:function(id){var r='';for(var a=0;a<360;a+=30)r+='<path d="M100 118 L'+(100+200*Math.cos(a*Math.PI/180)).toFixed(1)+' '+(118+200*Math.sin(a*Math.PI/180)).toFixed(1)+' L'+(100+200*Math.cos((a+12)*Math.PI/180)).toFixed(1)+' '+(118+200*Math.sin((a+12)*Math.PI/180)).toFixed(1)+'Z" fill="#fff" opacity=".18"/>';return '<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE38A"/><stop offset="1" stop-color="#DA9A1C"/></linearGradient></defs><rect width="200" height="220" fill="url(#'+id+')"/>'+r;}
};

// ─── Torso por silueta ───
function torsoPath(sex){
  return sex==='f'?'M52 222 C52 184 72 164 100 164 C128 164 148 184 148 222 Z'
                  :'M40 222 C40 180 62 162 100 162 C138 162 160 180 160 222 Z';
}

// ─── Ropa ───
var CLOTHES={
  ropa_sudadera:{color:'#4A5163',draw:function(c){return '<path d="M80 164 Q100 184 120 164" fill="none" stroke="'+darker(c,.3)+'" stroke-width="5" stroke-linecap="round"/><path d="M93 178v16M107 178v16" stroke="#E9E6DD" stroke-width="2.5" stroke-linecap="round"/>';}},
  ropa_deporte:{color:'#E3654F',draw:function(){return '<path d="M60 176 L72 222M140 176 L128 222" stroke="#fff" stroke-width="6" opacity=".9"/><path d="M86 164 Q100 174 114 164" fill="none" stroke="#fff" stroke-width="4"/>';}},
  ropa_chaqueta:{color:'#2F6FDE',draw:function(c){return '<path d="M100 170V222" stroke="'+darker(c,.35)+'" stroke-width="3"/><path d="M84 164 L100 182 L116 164" fill="none" stroke="'+darker(c,.3)+'" stroke-width="5" stroke-linejoin="round"/><rect x="118" y="196" width="18" height="4" rx="2" fill="'+darker(c,.3)+'"/>';}},
  ropa_traje:{color:'#232837',draw:function(){return '<path d="M86 163 L100 194 L114 163 Z" fill="#F2F0EA"/><path d="M97 170 H103 L106 198 L100 206 L94 198 Z" fill="#D2423A"/><path d="M86 163 L100 194 L80 222M114 163 L100 194 L120 222" fill="none" stroke="#151821" stroke-width="3"/>';}},
  ropa_capa:{color:'#2A2A2A',behind:'<path d="M26 222 C30 176 60 148 100 148 C140 148 170 176 174 222 Z" fill="#C83A3A"/><path d="M60 158 Q100 140 140 158" fill="none" stroke="#9E2626" stroke-width="5"/>',
    draw:function(){return '<circle cx="100" cy="196" r="13" fill="#CBEA5B"/><path d="M102.5 186 L94 198 H100 L97.5 207 L106 195 H100 Z" fill="#151807"/>';}}
};

// ─── Pelo ───
function hairBack(sex,c){
  if(sex==='f')return '<path d="M54 98 C50 58 76 42 100 42 C126 42 152 58 148 98 L154 178 C142 186 126 182 122 168 L78 168 C74 182 58 186 46 178 Z" fill="'+c+'"/>';
  if(sex==='x')return '<path d="M54 98 C50 58 76 42 100 42 C126 42 152 58 148 98 L150 140 C140 148 128 144 126 132 L74 132 C72 144 60 148 50 140 Z" fill="'+c+'"/>';
  return '';
}
function hairFront(sex,age,c){
  if(sex==='m'&&age==='senior')
    return '<path d="M56 102 C54 82 58 70 66 64 L70 96 Z M144 102 C146 82 142 70 134 64 L130 96 Z" fill="'+c+'"/><path d="M70 66 C82 56 118 56 130 66" fill="none" stroke="'+c+'" stroke-width="5" stroke-linecap="round" opacity=".7"/>';
  if(sex==='m')
    return '<path d="M56 102 C52 60 76 44 100 44 C126 44 150 60 144 102 C140 86 128 76 118 72 C112 80 98 78 92 72 C78 74 62 84 56 102 Z" fill="'+c+'"/>';
  return '<path d="M56 100 C54 60 78 46 100 46 C124 46 146 60 144 100 C134 82 118 74 106 72 C96 86 74 90 56 100 Z" fill="'+c+'"/>';
}

// ─── Cabeza (gorros) ───
var HATS={
  cabeza_gorra:function(){return '<path d="M54 90 C54 54 78 40 100 40 C124 40 146 54 146 90 C128 84 72 84 54 90 Z" fill="#E3654F"/><path d="M118 86 C140 84 164 88 172 97 C160 103 138 101 118 96 Z" fill="#B84A38"/><circle cx="100" cy="42" r="4.5" fill="#B84A38"/>';},
  cabeza_gorro:function(){return '<path d="M52 92 C52 50 76 34 100 34 C124 34 148 50 148 92 Z" fill="#5B8DEF"/><path d="M76 40 V90M100 34V90M124 40V90" stroke="#4A78D4" stroke-width="4"/><rect x="48" y="80" width="104" height="18" rx="7" fill="#3F67BF"/><circle cx="100" cy="31" r="11" fill="#F2F0E8"/>';},
  cabeza_diadema:function(){return '<path d="M58 84 C70 56 130 56 142 84" fill="none" stroke="#FF5E7E" stroke-width="7" stroke-linecap="round"/><path d="M118 58 L132 50 L130 66 Z M118 58 L104 50 L106 66 Z" fill="#FF5E7E"/><circle cx="118" cy="58" r="4" fill="#E04466"/>';},
  cabeza_auriculares:function(){return '<path d="M54 104 C50 44 150 44 146 104" fill="none" stroke="#26262B" stroke-width="8" stroke-linecap="round"/><rect x="42" y="90" width="18" height="30" rx="8" fill="#CBEA5B"/><rect x="140" y="90" width="18" height="30" rx="8" fill="#CBEA5B"/>';},
  cabeza_corona:function(){return '<path d="M64 66 L72 32 L88 54 L100 26 L112 54 L128 32 L136 66 Z" fill="#F5C542" stroke="#D49A1C" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="52" r="5" fill="#E3654F"/><circle cx="80" cy="58" r="3.5" fill="#5B8DEF"/><circle cx="120" cy="58" r="3.5" fill="#5B8DEF"/>';}
};

// ─── Gafas ───
var GLASSES={
  gafas_redondas:function(){return '<g fill="rgba(255,255,255,.12)" stroke="#2A2622" stroke-width="3"><circle cx="84" cy="105" r="11"/><circle cx="116" cy="105" r="11"/></g><path d="M95 104 Q100 100 105 104M73 102 L58 98M127 102 L142 98" fill="none" stroke="#2A2622" stroke-width="3" stroke-linecap="round"/>';},
  gafas_sol:function(){return '<rect x="70" y="96" width="27" height="17" rx="7" fill="#141414"/><rect x="103" y="96" width="27" height="17" rx="7" fill="#141414"/><path d="M97 102 H103M70 100 L58 97M130 100 L142 97" stroke="#141414" stroke-width="3" stroke-linecap="round"/><path d="M75 101 L82 101M108 101 L115 101" stroke="#fff" stroke-opacity=".5" stroke-width="2.5" stroke-linecap="round"/>';},
  gafas_lima:function(){return '<g fill="rgba(203,234,91,.14)" stroke="#CBEA5B" stroke-width="4"><rect x="70" y="95" width="27" height="19" rx="6"/><rect x="103" y="95" width="27" height="19" rx="6"/></g><path d="M97 103 H103M70 100 L58 97M130 100 L142 97" stroke="#CBEA5B" stroke-width="4" stroke-linecap="round"/>';}
};

// ─── Extras en el pecho ───
var EXTRAS={
  extra_pin:function(){return '<circle cx="74" cy="190" r="9" fill="#CBEA5B" stroke="#151807" stroke-width="1.5"/><path d="M75.8 183 L70 191.5 H74.5 L72.5 197.5 L78.5 189 H74 Z" fill="#151807"/>';},
  extra_medalla:function(){return '<path d="M90 162 L100 186 L110 162" fill="none" stroke="#2F6FDE" stroke-width="6" stroke-linejoin="round"/><circle cx="100" cy="194" r="11" fill="#F5C542" stroke="#D49A1C" stroke-width="3"/><path d="M100 188 l2 4 4.5 .6-3.3 3.1.8 4.5-4-2.2-4 2.2.8-4.5-3.3-3.1 4.5-.6z" fill="#D49A1C"/>';}
};

function renderCharacter(cfg,opts){
  cfg=cfg||DEFAULT_AVATAR;opts=opts||{};
  var eq=Object.assign({},DEFAULT_AVATAR.equip,cfg.equip||{});
  var sex=cfg.sex||'x',age=cfg.age||'young';
  var skin=SKINS[cfg.skin]!=null?SKINS[cfg.skin]:SKINS[1];
  var hair=HAIRS[cfg.hair]!=null?HAIRS[cfg.hair]:HAIRS[1];
  if(age==='senior')hair=mixHex(hair,'#D9D5CD',.7);
  else if(age==='adult')hair=mixHex(hair,'#9A958C',.12);
  var id='g'+(++_cid);
  var cl=CLOTHES[eq.ropa]||CLOTHES.ropa_sudadera;
  var s='';
  if(opts.bg!==false)s+=(BG[eq.fondo]||BG.fondo_liso)(id);
  if(cl.behind)s+=cl.behind;
  s+=hairBack(sex,hair);
  s+='<rect x="90" y="138" width="20" height="30" rx="8" fill="'+darker(skin,.12)+'"/>';
  s+='<path d="'+torsoPath(sex)+'" fill="'+cl.color+'"/>'+cl.draw(cl.color);
  if(EXTRAS[eq.extra])s+=EXTRAS[eq.extra]();
  // Cabeza
  s+='<circle cx="57" cy="106" r="9" fill="'+darker(skin,.06)+'"/><circle cx="143" cy="106" r="9" fill="'+darker(skin,.06)+'"/>';
  s+='<ellipse cx="100" cy="100" rx="44" ry="48" fill="'+skin+'"/>';
  // Cara: los ojos más grandes en adolescentes; arrugas suaves en mayores
  var ey=age==='teen'?7.5:6.5;
  s+='<ellipse cx="84" cy="106" rx="5.2" ry="'+ey+'" fill="#1E1916"/><ellipse cx="116" cy="106" rx="5.2" ry="'+ey+'" fill="#1E1916"/>';
  s+='<circle cx="86" cy="103" r="1.8" fill="#fff"/><circle cx="118" cy="103" r="1.8" fill="#fff"/>';
  s+='<path d="M76 92 Q84 88 92 91M108 91 Q116 88 124 92" fill="none" stroke="'+darker(hair,.2)+'" stroke-width="3" stroke-linecap="round"/>';
  s+='<circle cx="74" cy="120" r="7" fill="#FF7A7A" opacity=".18"/><circle cx="126" cy="120" r="7" fill="#FF7A7A" opacity=".18"/>';
  s+='<path d="M90 124 Q100 133 110 124" fill="none" stroke="#6B3A2A" stroke-width="3" stroke-linecap="round"/>';
  if(age==='senior')s+='<path d="M84 74 Q100 70 116 74M88 80 Q100 77 112 80M70 106 L66 104M130 106 L134 104" fill="none" stroke="'+darker(skin,.35)+'" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>';
  if(age==='adult')s+='<path d="M78 113 Q84 116 90 113M110 113 Q116 116 122 113" fill="none" stroke="'+darker(skin,.3)+'" stroke-width="1.5" stroke-linecap="round" opacity=".4"/>';
  if(sex==='m'&&(age==='adult'||age==='senior'))s+='<path d="M64 112 C66 140 84 148 100 148 C116 148 134 140 136 112 C128 132 116 138 100 138 C84 138 72 132 64 112 Z" fill="'+hair+'" opacity=".16"/>';
  if(!HATS[eq.cabeza]||eq.cabeza==='cabeza_diadema'||eq.cabeza==='cabeza_auriculares')s+=hairFront(sex,age,hair);
  else if(sex==='f'||sex==='x')s+='<path d="M56 100 C58 92 62 90 66 92 L64 104 Z M144 100 C142 92 138 90 134 92 L136 104 Z" fill="'+hair+'"/>';
  if(GLASSES[eq.gafas])s+=GLASSES[eq.gafas]();
  if(HATS[eq.cabeza])s+=HATS[eq.cabeza]();
  var vb=opts.head?'40 26 120 120':'0 0 200 220';
  var cls=opts.cls?' class="'+opts.cls+'"':'';
  return '<svg'+cls+' viewBox="'+vb+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Personaje">'+s+'</svg>';
}
