(function(root){
'use strict';
const SIZE=64,DIR=[[1,0],[-1,0],[0,1],[0,-1]],distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),key=p=>p.x+','+p.y;
const TYPES={
 hall:{name:'Центральный склад',cost:{},color:'#bca879',h:34,slots:6,radius:0,capacity:0,job:'Перевозчики забирают грузы по дорогам'},
 guild:{name:'Гильдия',cost:{wood:35,stone:15},color:'#628b99',h:30,slots:0,radius:0,capacity:0,job:'Доска контрактов'},
 house:{name:'Дом',cost:{wood:20,stone:5},color:'#c3aa82',h:22,slots:0,radius:0,capacity:0,job:'Жильё для четырёх жителей'},
 farm:{name:'Ферма',cost:{wood:20},color:'#a3b56b',h:10,slots:4,radius:3,capacity:36,job:'Еда: 2 единицы за рабочий цикл'},
 lumber:{name:'Лесопилка',cost:{wood:15,stone:5},color:'#bd8b60',h:18,slots:2,radius:5,capacity:32,job:'Одно дерево: 6 дерева + 2 дров. Лес конечен'},
 mine:{name:'Шахта',cost:{wood:25,stone:10},color:'#8e9bab',h:21,slots:6,radius:4,capacity:48,job:'Камень и железо из конечных залежей'},
 forge:{name:'Кузница',cost:{wood:30,stone:20},color:'#b67c68',h:26,slots:2,radius:3,capacity:0,job:'Кузнецы ускоряют изготовление экипировки'},
 tavern:{name:'Таверна',cost:{wood:25,stone:10},color:'#b597bc',h:26,slots:3,radius:4,capacity:0,job:'Еда, отдых, общение и сбор отрядов'},
 well:{name:'Колодец',cost:{wood:10,stone:10},color:'#78b9be',h:14,slots:2,radius:4,capacity:30,job:'Вода на локальный склад; герои в радиусе могут попить'}
};
const TRAITS={brave:'Смелый',greedy:'Жадный',coward:'Осторожный',lazy:'Ленивый',social:'Общительная',lucky:'Удачливый'};
const MOBS={goblin:{name:'Гоблин',plural:'Гоблинов',hp:18,damage:1.6,color:'#89ae63'},orc:{name:'Орк',plural:'Орков',hp:32,damage:2.4,color:'#6c965c'},troll:{name:'Тролль',plural:'Троллей',hp:65,damage:3.5,color:'#7b9a8a'},skeleton:{name:'Скелет',plural:'Скелетов',hp:22,damage:2,color:'#d3cbb6'},lich:{name:'Лич',plural:'Личей',hp:58,damage:3.8,color:'#b294cc'},ghost:{name:'Призрак',plural:'Призраков',hp:25,damage:2.2,color:'#9acdd2'}};
const PLANTS={moonleaf:{name:'Лунолист',color:'#a8cbe1'},sunroot:{name:'Солнечный корень',color:'#efc779'},mushroom:{name:'Светящийся гриб',color:'#b4a0dc'},lavender:{name:'Дикая лаванда',color:'#c2a5d0'}};
class Game{
 constructor(seed=42){
  this.version=2;this.seed=seed;this.randomState=seed>>>0;this.time=0;this.nextId=100;this.spawnClock=0;
  this.resources={wood:150,stone:90,iron:25,food:100,water:100,firewood:60,gold:450,...Object.fromEntries(Object.keys(PLANTS).map(k=>[k,0]))};
  this.tiles=[];this.buildings=[];this.heroes=[];this.residents=[];this.mobs=[];this.plants=[];this.contracts=[];this.log=[];this.stats={contracts:0,crafted:0,boss:0,kills:0,trees:0,delivered:0,gathered:0};
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){let roll=this.random(),city=x>=7&&x<=17&&y>=8&&y<=18;let type=x<3&&y>21?'water':!city&&roll<.52?'tree':!city&&roll<.59?'rock':'grass';this.tiles.push({x,y,type,road:false,amount:type==='tree'?8:type==='rock'?40:0});}
  const initial=[['hall',12,13],['guild',14,10],['house',10,16],['house',12,17],['house',14,17],['house',16,16],['farm',8,12],['lumber',7,9],['mine',17,9],['forge',16,12],['tavern',15,15],['well',10,11]];
  initial.forEach(([type,x,y])=>this.buildings.push(this.makeBuilding(type,x,y)));
  for(const b of this.buildings){let x=b.x,y=b.y+1;this.clearTile(x,y);this.tile(x,y).road=true;while(x!==12){x+=Math.sign(12-x);if(!this.buildingAt(x,y)){this.clearTile(x,y);this.tile(x,y).road=true;}}while(y!==14){y+=Math.sign(14-y);if(!this.buildingAt(x,y)){this.clearTile(x,y);this.tile(x,y).road=true;}}}
  for(let y=8;y<=18;y++)for(let x=7;x<=18;x++)if((y===14||x===11||x===13)&&!this.buildingAt(x,y)){this.clearTile(x,y);this.tile(x,y).road=true;}
  for(let x=13;x<=17;x++){this.clearTile(x,11);this.tile(x,11).road=true;}
  for(const p of [{x:18,y:8},{x:19,y:10},{x:17,y:6},{x:6,y:8},{x:5,y:10},{x:6,y:6}]){this.tile(p.x,p.y).type=p.x>10?'rock':'tree';this.tile(p.x,p.y).amount=p.x>10?80:8;}
  this.sites=[{id:1,name:'Старая чаща',x:5,y:4,kind:'camp',hp:100,maxHp:100,power:26,cleared:false},{id:2,name:'Заброшенный форт',x:23,y:10,kind:'camp',hp:150,maxHp:150,power:38,cleared:false},{id:3,name:'Алтарь древнего',x:23,y:23,kind:'boss',hp:280,maxHp:280,power:62,cleared:false}];
  for(let s of this.sites)this.clearTile(s.x,s.y);
  const names=['Бран','Оскар','Тихон','Рудольф','Мира','Финн'];Object.keys(TRAITS).forEach((trait,i)=>this.heroes.push({id:i+1,name:names[i],trait,role:i===4?'Лекарь':i%2?'Следопыт':'Воин',x:13+i%3,y:14,hp:100,hunger:70,thirst:75,energy:75,social:50,gold:35,gear:0,hide:0,core:0,state:'idle',reason:'Осматривает город',path:[],timer:0,inside:null,contract:null,patrol:null,target:null,goal:null,cargo:{}}));
  for(let i=0;i<22;i++)this.residents.push({id:200+i,name:'Житель '+(i+1),x:11,y:14,assigned:null,state:'idle',path:[],timer:0,cargo:{},target:null,reason:'Свободен',release:false});
  for(const [type,n]of [['hall',4],['lumber',2],['mine',3],['farm',3],['well',2],['forge',1],['tavern',2]])for(let i=0;i<n;i++)this.assign(this.buildings.find(b=>b.type===type).id,1,false);
  for(let i=0;i<36;i++)this.spawnPlant(Object.keys(PLANTS)[i%4]);for(let i=0;i<22;i++)this.spawnMob(Object.keys(MOBS)[i%6]);
  this.event('Город ожил: ресурсы попадают в статистику только после доставки на центральный склад.');
 }
 random(){this.randomState=(this.randomState+0x6D2B79F5)>>>0;let x=this.randomState,t=Math.imul(x^x>>>15,1|x);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}
 event(text){this.log.unshift({time:this.time,text});this.log=this.log.slice(0,60);}
 tile(x,y){return x>=0&&y>=0&&x<SIZE&&y<SIZE?this.tiles[y*SIZE+x]:null;}
 clearTile(x,y){let t=this.tile(x,y);if(t){t.type='grass';t.amount=0;}}
 buildingAt(x,y){return this.buildings.find(b=>b.x===x&&b.y===y);}
 building(id){return this.buildings.find(b=>b.id===id);}
 count(type){return this.buildings.filter(b=>b.type===type).length;}
 workers(b){return this.residents.filter(w=>w.assigned===b.id&&!w.release);}
 workforce(b){return this.workers(b).filter(w=>w.state==='service'&&distance(w,b)<2).length;}
 total(stock){return Object.values(stock).reduce((a,b)=>a+b,0);}
 makeBuilding(type,x,y){this.clearTile(x,y);return {id:this.nextId++,type,x,y,stock:{},capacity:TYPES[type].capacity};}
 blocked(x,y){let t=this.tile(x,y);return !t||t.type==='water'||!!this.buildingAt(x,y);}
 path(a,b,options={}){
  let start={x:Math.round(a.x),y:Math.round(a.y)},isBuilding=!!b.type&&TYPES[b.type]!==undefined&&b.id!==undefined;
  const valid=p=>!this.blocked(p.x,p.y)&&(!options.roads||this.tile(p.x,p.y).road)&&(!options.area||distance(p,options.area)<=options.area.radius+.01);
  let goals=isBuilding?DIR.map(([dx,dy])=>({x:b.x+dx,y:b.y+dy})).filter(valid):[b].filter(valid);
  if(!goals.length)return null;let targets=new Set(goals.map(key)),queue=[start],prev=new Map([[key(start),null]]),head=0;
  while(head<queue.length){let p=queue[head++],k=key(p);if(targets.has(k)){let out=[];while(prev.get(k)!==null){let [x,y]=k.split(',').map(Number);out.push({x,y});k=prev.get(k);}return out.reverse();}for(let [dx,dy]of DIR){let q={x:p.x+dx,y:p.y+dy},qk=key(q);if(!prev.has(qk)&&valid(q)){prev.set(qk,k);queue.push(q);}}}return null;
 }
 roadConnected(b){this._roads=this._roads||{};if(this._roads[b.id]!==undefined)return this._roads[b.id];let hall=this.buildings.find(x=>x.type==='hall');if(!hall)return false;let entrances=DIR.map(([dx,dy])=>({x:hall.x+dx,y:hall.y+dy})).filter(p=>this.tile(p.x,p.y)?.road&&!this.blocked(p.x,p.y));return this._roads[b.id]=entrances.some(p=>this.path(p,b,{roads:true})!==null);}
 route(a,b,state,options={}){let p=this.path(a,b,options);if(p===null){a.reason=options.roads?'Нет дороги к зданию':'Нет доступного пути';a.path=[];return false;}a.path=p;a.state=state;a.timer=0;a.goal={x:b.x,y:b.y,id:b.id||null};return true;}
 advance(a,dt,speed=1.5){if(!a.path.length)return false;let p=a.path[0];if(this.blocked(p.x,p.y)){a.path=[];a.state=a.cargo&&this.total(a.cargo)>0?(a.assigned!==undefined?(this.building(a.assigned)?.type==='hall'?'haulBack':'returnWork'):'deliver'):'idle';return false;}let dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy),step=dt*speed*.4*(this.tile(p.x,p.y).road?1.25:1);if(d<=step){a.x=p.x;a.y=p.y;a.path.shift();}else{a.x+=dx/d*step;a.y+=dy/d*step;}return true;}
 affordable(cost){return Object.entries(cost).every(([k,v])=>this.resources[k]>=v);}
 placementError(type,x,y,ignore=null){let t=this.tile(x,y);if(!t||t.type==='water')return 'Здесь нельзя строить';if(t.type==='tree'||t.type==='rock')return 'Сначала добудьте дерево или залежь в этой клетке';if(this.buildings.some(b=>b.id!==ignore&&b.x===x&&b.y===y))return 'Клетка занята зданием';if(this.sites.some(s=>distance(s,{x,y})<2))return 'Слишком близко к особому месту';if(this.heroes.some(h=>!h.inside&&distance(h,{x,y})<.65)||this.residents.some(w=>distance(w,{x,y})<.65))return 'Клетка занята жителем';return null;}
 build(type,x,y){let spec=TYPES[type];if(!spec||type==='hall')return 'Недоступное здание';let err=this.placementError(type,x,y);if(err)return err;if(!this.affordable(spec.cost))return 'Не хватает ресурсов на центральном складе';for(let[k,v]of Object.entries(spec.cost))this.resources[k]-=v;this.tile(x,y).road=false;this.buildings.push(this.makeBuilding(type,x,y));this._roads={};this.event('Построено: '+spec.name+'. Подведите дорогу и назначьте работников.');return null;}
 moveBuilding(id,x,y){let b=this.building(id);if(!b)return 'Здание не найдено';if(x===b.x&&y===b.y)return null;let err=this.placementError(b.type,x,y,id);if(err)return err;b.x=x;b.y=y;this.tile(x,y).road=false;this._roads={};
  for(let w of this.residents){if(w.assigned===id||w.target===id){w.path=[];w.timer=0;w.rejoin=true;if(w.state==='haulBack')continue;if(this.total(w.cargo)>0&&this.building(w.assigned)?.type!=='hall')w.state='returnWork';else w.state='idle';}}
  for(let h of this.heroes){if(h.inside===id){h.x=x;h.y=y;}else if(h.goal?.id===id){h.path=[];h.state='idle';h.goal=null;}}
  this.event(TYPES[b.type].name+' перемещён. Запасы и назначения сохранены.');return null;
 }
 road(x,y,remove=false){let t=this.tile(x,y);if(!t||t.type!=='grass'||this.buildingAt(x,y))return 'Дороги можно прокладывать по свободной земле';if(t.road===!remove)return null;t.road=!remove;this._roads={};for(let w of this.residents){if(w.path.some(p=>p.x===x&&p.y===y)){w.path=[];w.state=this.total(w.cargo)>0?(this.building(w.assigned)?.type==='hall'?'haulBack':'returnWork'):'idle';}}return null;}
 assign(id,delta,announce=true){let b=this.building(id);if(!b)return 'Здание не найдено';let spec=TYPES[b.type],staff=this.workers(b);if(delta>0){if(staff.length>=spec.slots)return spec.slots?'Все рабочие места заняты':'У здания нет рабочих мест';let w=this.residents.find(w=>w.assigned===null&&!this.total(w.cargo));if(!w)return 'Нет свободных жителей';w.assigned=id;w.state='idle';w.path=[];w.release=false;}else{let w=staff[staff.length-1];if(!w)return 'Здесь нет работников';if(this.total(w.cargo)){w.release=true;w.path=[];w.state=b.type==='hall'?'haulBack':'returnWork';}else{w.assigned=null;w.state='idle';w.path=[];w.reason='Свободен';}}if(announce)this.event(TYPES[b.type].name+': работников '+this.workers(b).length+'/'+spec.slots);return null;}
 deposit(stock,cargo){for(let[k,v]of Object.entries(cargo))stock[k]=(stock[k]||0)+v;}
 serviceBuilding(type,from){return this.buildings.filter(b=>b.type===type).sort((a,b)=>distance(a,from)-distance(b,from))[0];}
 tickResident(w,dt){
  let b=this.building(w.assigned),hall=this.serviceBuilding('hall',w);if(!b){w.reason='Свободен';if(this.advance(w,dt))return;w.timer+=dt;if(w.timer>8){w.timer=0;let roads=this.tiles.filter(t=>t.road&&!this.blocked(t.x,t.y)&&distance(t,hall)<6);let t=roads[Math.floor(this.random()*roads.length)];if(t)this.route(w,t,'idle',{roads:true});}return;}
  if(w.path.length){this.advance(w,dt,1.5);return;}w.timer+=dt;
  // After relocation, join the connected road network before resuming work.
  if(w.rejoin){if(!this.roadConnected(b)){w.reason='После переноса нужна дорога к зданию';return;}let roads=this.tiles.filter(t=>t.road&&!this.blocked(t.x,t.y)).sort((a,c)=>distance(w,a)-distance(w,c));let next=null;for(let r of roads){if(this.path(r,b,{roads:true})!==null){let approach=this.path(w,r);if(approach!==null){next=approach;break;}}}if(next===null){w.reason='Нет прохода к дороге';return;}w.rejoin=false;w.path=next;if(next.length)return;}
  if(b.type==='hall'){
   if(w.state==='haulBack'){if(distance(w,hall)>1.1){this.route(w,hall,'haulBack',{roads:true});return;}this.stats.delivered+=this.total(w.cargo);this.deposit(this.resources,w.cargo);w.cargo={};w.target=null;w.state='idle';if(w.release){w.assigned=null;w.release=false;}return;}
   if(w.state==='haulOut'){let src=this.building(w.target);if(!src){w.state='idle';return;}if(distance(w,src)>1.1){this.route(w,src,'haulOut',{roads:true});return;}let room=10;for(let[k,v]of Object.entries(src.stock)){let n=Math.min(room,Math.floor(v));if(n>0){w.cargo[k]=n;src.stock[k]-=n;room-=n;}}w.reason='Везёт груз на центральный склад';w.state='haulBack';this.route(w,hall,'haulBack',{roads:true});return;}
   if(w.timer<1)return;w.timer=0;let available=this.buildings.filter(src=>src.id!==hall.id&&this.total(src.stock)>=2&&!this.residents.some(other=>other!==w&&other.target===src.id&&other.state==='haulOut')).sort((a,b)=>this.total(b.stock)-this.total(a.stock));
   for(let src of available){if(!this.roadConnected(src))continue;if(this.route(w,src,'haulOut',{roads:true})){w.target=src.id;w.reason='Забирает груз: '+TYPES[src.type].name;return;}}w.reason='Ожидает груз / соединение дорог';return;
  }
  if(w.state==='returnWork'){if(distance(w,b)>1.1){this.route(w,b,'returnWork');return;}let room=b.capacity-this.total(b.stock);for(let[k,v]of Object.entries(w.cargo)){let n=Math.min(room,v);b.stock[k]=(b.stock[k]||0)+n;w.cargo[k]-=n;room-=n;}if(this.total(w.cargo)>.001){w.reason='Локальный склад заполнен';return;}w.cargo={};w.target=null;w.state='idle';if(w.release){w.assigned=null;w.release=false;return;}}
  if(w.state==='harvest'){
   let t=this.tile(w.target?.x,w.target?.y);if(!t||distance(t,b)>TYPES[b.type].radius||t.amount<=0){w.state='returnWork';this.route(w,b,'returnWork');return;}if(distance(w,t)>.2){this.route(w,t,'harvest',{area:{...b,radius:TYPES[b.type].radius}});return;}if(w.timer<(b.type==='lumber'?5:4))return;w.timer=0;
   if(b.type==='lumber'&&t.type==='tree'){t.amount=0;t.type='grass';w.cargo={wood:6,firewood:2};this.stats.trees++;}else if(b.type==='mine'&&t.type==='rock'){let n=Math.min(3,t.amount);t.amount-=n;w.cargo={stone:n*2/3,iron:n/3};if(!t.amount)t.type='grass';}
   this.route(w,b,'returnWork',{area:{...b,radius:TYPES[b.type].radius}});w.reason='Несёт добычу в локальный склад';return;
  }
  if(!this.roadConnected(b)){w.reason='Здание не соединено со складом дорогой';w.state='idle';return;}
  if(distance(w,b)>1.1){this.route(w,b,'atWork',{roads:true});w.reason='Идёт на работу';return;}
  if(['forge','tavern'].includes(b.type)){w.state='service';w.reason=b.type==='forge'?'Работает в кузнице':'Обслуживает гостей';return;}
  if(this.total(b.stock)+this.residents.filter(a=>a.assigned===b.id).reduce((s,a)=>s+this.total(a.cargo),0)>=b.capacity-8){w.reason='Локальный склад полон — нужен перевозчик';return;}
  if(b.type==='lumber'||b.type==='mine'){const type=b.type==='lumber'?'tree':'rock';let targets=this.tiles.filter(t=>t.type===type&&t.amount>0&&distance(t,b)<=TYPES[b.type].radius&&!this.residents.some(a=>a!==w&&a.state==='harvest'&&a.target?.x===t.x&&a.target?.y===t.y)).sort((a,c)=>distance(w,a)-distance(w,c));for(let target of targets){if(this.route(w,target,'harvest',{area:{...b,radius:TYPES[b.type].radius}})){w.target={x:target.x,y:target.y};w.reason=b.type==='lumber'?'Рубит дерево':'Добывает руду';return;}}w.reason='В радиусе нет доступного ресурса';return;}
  if(w.timer>=5){w.timer=0;let resource=b.type==='farm'?'food':'water';b.stock[resource]=(b.stock[resource]||0)+2;w.reason=b.type==='farm'?'Собирает урожай':'Набирает воду';}w.state='produce';
 }
 protectedAt(p){return this.heroes.some(h=>h.patrol&&!h.inside&&['patrol','combat'].includes(h.state)&&distance(h,h.patrol)<=h.patrol.radius&&distance(p,h.patrol)<=h.patrol.radius);}
 spawnMob(kind=null){if(this.mobs.length>=60)return false;kind=kind||Object.keys(MOBS)[Math.floor(this.random()*6)];for(let attempt=0;attempt<100;attempt++){let p={x:Math.floor(this.random()*SIZE),y:Math.floor(this.random()*SIZE)};if(this.blocked(p.x,p.y)||distance(p,{x:12,y:13})<6||this.protectedAt(p)||this.mobs.some(m=>distance(m,p)<1))continue;let spec=MOBS[kind];this.mobs.push({id:this.nextId++,kind,...p,hp:spec.hp,path:[],timer:0,target:null});return true;}return false;}
 spawnPlant(kind){for(let attempt=0;attempt<100;attempt++){let p={x:Math.floor(this.random()*SIZE),y:Math.floor(this.random()*SIZE)};if(this.blocked(p.x,p.y)||this.tile(p.x,p.y).type!=='grass'||this.tile(p.x,p.y).road||this.plants.some(n=>distance(n,p)<1))continue;this.plants.push({id:this.nextId++,kind,...p,amount:8,regrow:0});return true;}return false;}
 postTask(kind,target,count,reward,partySize=1,stay=true){
  if(this.contracts.length>=8)return 'На доске уже 8 контрактов';if(!['kill','gather','clear','patrol'].includes(kind))return 'Неизвестное задание';if(!Number.isInteger(count)||count<1||count>500)return 'Количество: от 1 до 500';if(!Number.isFinite(reward)||reward<10||reward>5000)return 'Награда: от 10 до 5000';if(!Number.isInteger(partySize)||partySize<1||partySize>4)return 'Отряд: от 1 до 4';if(this.resources.gold<reward)return 'Не хватает золота';if(kind==='kill'&&!MOBS[target]||kind==='gather'&&!PLANTS[target])return 'Неизвестная цель';let site=this.sites.find(s=>s.id===Number(target));if(['clear','patrol'].includes(kind)&&!site)return 'Место не найдено';if(kind==='clear'&&site.cleared)return 'Это место уже зачищено навсегда';if(kind==='patrol'&&!site.cleared)return 'Сначала зачистите место';if(this.contracts.some(c=>c.kind===kind&&c.target===target))return 'Такой контракт уже размещён';
  this.resources.gold-=reward;this.contracts.push({id:this.nextId++,kind,target,count:['clear','patrol'].includes(kind)?1:count,reward,partySize:kind==='patrol'?1:partySize,stay,progress:0,members:[],status:'open',created:this.time,mark:null,ready:0});this.event('Новый контракт: '+this.taskName(this.contracts[this.contracts.length-1]));return null;
 }
 taskName(c){return c.kind==='kill'?'Убить '+c.count+' '+MOBS[c.target].plural.toLowerCase():c.kind==='gather'?'Собрать '+c.count+' · '+PLANTS[c.target].name:c.kind==='clear'?'Зачистить · '+this.sites.find(s=>s.id===Number(c.target)).name:'Патруль · '+this.sites.find(s=>s.id===Number(c.target)).name;}
 cancel(id){let c=this.contracts.find(c=>c.id===id);if(!c)return;this.resources.gold+=c.reward;for(let h of this.heroes.filter(h=>h.contract===id)){h.contract=null;h.target=null;h.path=[];if(!h.inside)h.state='idle';}this.contracts=this.contracts.filter(x=>x!==c);this.event('Контракт отменён. Награда возвращена; растения герои доставят на склад.');}
 trade(){if(this.resources.wood<30)return 'На центральном складе нужно 30 дерева';this.resources.wood-=30;this.resources.gold+=40;return null;}
 power(h){return 9+h.gear*6+(h.role==='Лекарь'?2:0);}
 leave(h){if(h.inside){let b=this.building(h.inside);if(b){let p=DIR.map(([dx,dy])=>({x:b.x+dx,y:b.y+dy})).find(p=>!this.blocked(p.x,p.y));if(p){h.x=p.x;h.y=p.y;}}h.inside=null;}h.path=[];h.state='idle';h.timer=0;}
 visit(h,purpose='rest'){let c=this.contracts.find(c=>c.id===h.contract),b=purpose==='gather'&&c?.tavernId?this.building(c.tavernId):this.serviceBuilding('tavern',h);if(!b){h.reason='Нужна таверна';return false;}if(purpose==='gather'&&c)c.tavernId=b.id;if(this.route(h,b,'toTavern')){h.visitPurpose=purpose;h.target=b.id;h.reason=purpose==='gather'?'Идёт в таверну к отряду':'Идёт в таверну отдыхать';return true;}return false;}
 startPatrol(h,site){this.leave(h);h.contract=null;h.patrol={siteId:site.id,x:site.x,y:site.y,radius:5};this.route(h,site,'toPatrol');h.reason='Занимает патрульный пост';}
 recall(id){let h=this.heroes.find(h=>h.id===id);if(!h)return;h.patrol=null;h.path=[];h.target=null;if(!h.inside)h.state='idle';h.reason='Патруль отозван';}
 complete(c){let members=this.heroes.filter(h=>h.contract===c.id);for(let h of members){h.gold+=c.reward/Math.max(1,members.length);h.contract=null;h.target=null;h.path=[];if(!h.inside)h.state='idle';}this.stats.contracts++;this.event('Выполнено: '+this.taskName(c)+'. Награда выплачена.');this.contracts=this.contracts.filter(k=>k!==c);if(c.kind==='clear'&&c.stay&&members.length)this.startPatrol(members[0],this.sites.find(s=>s.id===Number(c.target)));if(c.kind==='patrol'&&members.length)this.startPatrol(members[0],this.sites.find(s=>s.id===Number(c.target)));}
 killMob(m,h){if(!this.mobs.some(x=>x.id===m.id))return;this.mobs=this.mobs.filter(x=>x!==m);this.stats.kills++;h.hide++;h.gold+=2;if(h.trait==='lucky'&&this.stats.kills%3===0)h.hide++;let c=this.contracts.find(c=>c.id===h.contract&&c.kind==='kill'&&c.target===m.kind&&c.status==='active');if(c){c.progress++;if(c.progress>=c.count)this.complete(c);}h.target=null;h.state=h.patrol?'patrol':'idle';h.path=[];h.timer=0;}
 chooseTask(h){let options=this.contracts.filter(c=>c.status==='open'&&c.members.length<c.partySize).map(c=>{let risk=c.kind==='clear'?this.sites.find(s=>s.id===Number(c.target)).power/c.partySize:c.kind==='kill'?MOBS[c.target].damage*3:1;let score=c.reward/c.partySize/(h.trait==='greedy'?2:3)-risk*(h.trait==='coward'?2:h.trait==='brave'?.3:1)-(h.trait==='lazy'?c.count*.1:0);return {c,score};}).sort((a,b)=>b.score-a.score);if(options[0]?.score>0){let c=options[0].c;h.contract=c.id;c.members.push(h.id);this.visit(h,'gather');return true;}return false;}
 tickHero(h,dt){
  h.hunger=Math.max(0,h.hunger-dt*.10);h.thirst=Math.max(0,h.thirst-dt*.13);h.energy=Math.max(0,h.energy-dt*.08);h.social=Math.max(0,h.social-dt*.14);h.timer+=dt;
  if(h.inside){let b=this.building(h.inside);if(!b){this.leave(h);return;}let staff=this.workforce(b);h.reason=staff?'Отдыхает и общается в таверне':'В таверне нет работников';if(staff){h.energy=Math.min(100,h.energy+dt*2);h.hp=Math.min(100,h.hp+dt*2);h.social=Math.min(100,h.social+dt*3);if(h.hunger<90&&this.resources.food>=1){this.resources.food--;h.hunger=Math.min(100,h.hunger+18);let paid=Math.min(1,h.gold);h.gold-=paid;this.resources.gold+=paid;}if(h.thirst<90&&this.resources.water>=1){this.resources.water--;h.thirst=Math.min(100,h.thirst+22);}}
   let c=this.contracts.find(c=>c.id===h.contract);if(c&&c.status==='open'){h.reason='За столом: ждёт спутников на контракт';if(!staff&&h.timer>10)this.leave(h);return;}
   if(h.timer>=14&&h.hp>80&&h.energy>65&&h.hunger>30&&h.thirst>30){this.leave(h);return;}if(!staff&&h.timer>15)this.leave(h);return;
  }
  if(!['toTavern','drink','craft','deliver'].includes(h.state)&&(h.hp<25||h.energy<12||h.hunger<12||h.thirst<12)){h.path=[];h.target=null;this.visit(h);return;}
  if(h.path.length){this.advance(h,dt,h.trait==='lazy'?1.1:1.65);return;}
  if(h.state==='toTavern'){let b=this.building(h.target);if(b&&distance(h,b)<=1.1){h.inside=b.id;h.state='tavern';h.timer=0;h.x=b.x;h.y=b.y;}else h.state='idle';return;}
  if(h.state==='drink'){let b=this.building(h.target);if(b&&distance(h,b)<=TYPES.well.radius&&(b.stock.water||0)>=1){b.stock.water--;h.thirst=100;}h.state='idle';return;}
  if(h.state==='deliver'){let hall=this.serviceBuilding('hall',h);if(distance(h,hall)>1.1){this.route(h,hall,'deliver');return;}this.deposit(this.resources,h.cargo);h.cargo={};h.state='idle';return;}
  if(h.state==='craft'){let b=this.building(h.target);if(!b||distance(h,b)>1.1){h.state='idle';return;}let staff=this.workforce(b);h.reason=staff?'Кузнец улучшает снаряжение':'Ждёт кузнеца';if(!staff){if(h.timer>10)h.state='idle';return;}if(h.timer<6/staff)return;let price=h.gear===2?25:18,iron=h.gear===2?6:4;if(h.gold>=price&&this.resources.iron>=iron&&((h.gear<2&&h.hide>0)||(h.gear===2&&h.core>0))){this.resources.iron-=iron;h.gold-=price;this.resources.gold+=price;if(h.gear===2)h.core--;else h.hide--;h.gear++;this.stats.crafted++;this.event(h.name+' создал экипировку '+h.gear+' уровня.');}h.state='idle';h.timer=0;return;}
  if(h.state==='combat'){let m=this.mobs.find(m=>m.id===h.target);if(!m){h.state='idle';h.target=null;return;}if(h.patrol&&distance(m,h.patrol)>h.patrol.radius){h.target=null;h.state='patrol';return;}if(distance(h,m)>1.4){if(h.timer>1)this.route(h,{x:Math.round(m.x),y:Math.round(m.y)},'combat');return;}m.hp-=this.power(h)*.65*dt;h.hp=Math.max(0,h.hp-MOBS[m.kind].damage*dt*.45);h.reason='Сражается: '+MOBS[m.kind].name;if(m.hp<=0)this.killMob(m,h);return;}
  if(h.state==='gatherPlant'){let p=this.plants.find(p=>p.id===h.target),c=this.contracts.find(c=>c.id===h.contract);if(!p||!c||!p.amount){h.state='idle';h.target=null;return;}if(distance(h,p)>.3){this.route(h,p,'gatherPlant');return;}if(h.timer>=1.3){h.timer=0;p.amount--;h.cargo[p.kind]=(h.cargo[p.kind]||0)+1;c.progress++;this.stats.gathered++;if(!p.amount)p.regrow=this.time+75;if(c.progress>=c.count){this.complete(c);this.route(h,this.serviceBuilding('hall',h),'deliver');h.reason='Доставляет растения на склад';}}return;}
  if(h.state==='toPatrol'){h.state='patrol';h.timer=0;}
  let c=this.contracts.find(c=>c.id===h.contract);
  if(c&&c.status==='open'){this.visit(h,'gather');return;}
  if(c&&c.kind==='clear'&&c.status==='active'){let site=this.sites.find(s=>s.id===Number(c.target));if(distance(h,site)>1.5){this.route(h,site,'raid');h.reason='Идёт к месту зачистки';}else{h.state='raid';h.reason='Сражается за '+site.name;}return;}
  if(h.timer<1.5)return;h.timer=0;
  if(this.total(h.cargo)>0&&(!c||h.hunger<30)){this.route(h,this.serviceBuilding('hall',h),'deliver');h.reason='Несёт растения на центральный склад';return;}
  if(h.hunger<45||h.energy<35||h.hp<60||h.social<20){this.visit(h);return;}
  if(h.thirst<40){let well=this.buildings.find(b=>b.type==='well'&&distance(b,h)<=TYPES.well.radius&&(b.stock.water||0)>0);if(well){h.target=well.id;this.route(h,well,'drink');h.reason='Идёт к колодцу';}else this.visit(h);return;}
  if(!c&&!h.patrol&&h.gear<3&&h.gold>=25&&this.resources.iron>=6&&((h.gear<2&&h.hide>0)||(h.gear===2&&h.core>0))){let forge=this.serviceBuilding('forge',h);if(forge&&this.workforce(forge)){h.target=forge.id;this.route(h,forge,'craft');return;}}
  if(h.patrol){let enemies=this.mobs.filter(m=>distance(m,h.patrol)<=h.patrol.radius).sort((a,b)=>distance(h,a)-distance(h,b));if(enemies.length){h.target=enemies[0].id;this.route(h,{x:Math.round(enemies[0].x),y:Math.round(enemies[0].y)},'combat');return;}let p={x:h.patrol.x+Math.floor(this.random()*5)-2,y:h.patrol.y+Math.floor(this.random()*5)-2};this.route(h,p,'patrol');h.reason='Патруль: новые мобы не появляются в радиусе 5';return;}
  if(c&&c.status==='active'){
   if(c.kind==='kill'){let existing=this.mobs.find(m=>m.id===c.mark),targets=this.mobs.filter(m=>m.kind===c.target).sort((a,b)=>distance(h,a)-distance(h,b)),m=existing||targets[0];if(m){c.mark=m.id;h.target=m.id;this.route(h,{x:Math.round(m.x),y:Math.round(m.y)},'combat');h.reason='Охотится: '+MOBS[m.kind].name;}else h.reason='Ищет '+MOBS[c.target].plural.toLowerCase()+' по всей карте';return;}
   if(c.kind==='gather'){let targets=this.plants.filter(p=>p.kind===c.target&&p.amount>0).sort((a,b)=>distance(h,a)-distance(h,b));if(targets[0]){h.target=targets[0].id;this.route(h,targets[0],'gatherPlant');h.reason='Собирает: '+PLANTS[c.target].name;}else h.reason='Ищет растения / ждёт восстановления';return;}
  }
  if(this.chooseTask(h))return;
  let nearby=this.mobs.filter(m=>distance(m,h)<6&&MOBS[m.kind].damage<(h.trait==='coward'?2.5:5)).sort((a,b)=>distance(h,a)-distance(h,b));if(nearby.length){h.target=nearby[0].id;this.route(h,{x:Math.round(nearby[0].x),y:Math.round(nearby[0].y)},'combat');return;}
  if(h.social<75){this.visit(h);return;}let p={x:8+Math.floor(this.random()*10),y:9+Math.floor(this.random()*9)};this.route(h,p,'idle');h.reason='Гуляет по городу';
 }
 tickContracts(dt){for(let c of [...this.contracts]){let members=c.members.map(id=>this.heroes.find(h=>h.id===id)).filter(Boolean);
  if(c.status==='open'){let ready=members.filter(h=>h.inside&&h.hp>70&&h.energy>50);if(members.length===c.partySize&&ready.length===members.length&&new Set(ready.map(h=>h.inside)).size===1){c.ready+=dt;if(c.ready>=4){if(c.kind==='clear'){let site=this.sites.find(s=>s.id===Number(c.target));if(members.reduce((s,h)=>s+this.power(h),0)<site.power*.85){for(let h of members)h.reason='Отряд слаб: нужны экипировка или больше героев';continue;}}c.status='active';for(let h of members){this.leave(h);h.reason='Отряд отправляется на контракт';}this.event('В таверне собран отряд: '+members.map(h=>h.name).join(', '));if(c.kind==='patrol')this.complete(c);}}else c.ready=0;}
  if(c.status==='active'&&c.kind==='clear'){let site=this.sites.find(s=>s.id===Number(c.target)),fighters=members.filter(h=>!h.inside&&h.state==='raid'&&distance(h,site)<=1.5);if(fighters.length){site.hp-=fighters.reduce((s,h)=>s+this.power(h),0)*dt*.4;for(let h of fighters)h.hp=Math.max(0,h.hp-site.power*.035/fighters.length*dt);if(site.hp<=0){site.hp=0;site.cleared=true;if(site.kind==='boss')this.stats.boss++;for(let h of members){h.hide+=3;if(site.kind==='boss')h.core++;}this.event(site.name+' зачищен. Лагерь больше не возрождается.');this.complete(c);}}}
 }}
 tick(dt){this.time+=dt;this.spawnClock+=dt;this.resources.gold+=dt*.08;this.resources.firewood=Math.max(0,this.resources.firewood-this.count('house')*.015*dt);
  if(this.spawnClock>=7){this.spawnClock=0;const hunts=this.contracts.filter(c=>c.kind==='kill');const kind=hunts.length&&this.random()<.65?hunts[Math.floor(this.random()*hunts.length)].target:null;this.spawnMob(kind);}
  for(let p of this.plants)if(!p.amount&&this.time>=p.regrow)p.amount=8;
  for(let w of this.residents)this.tickResident(w,dt);for(let h of this.heroes)this.tickHero(h,dt);this.tickContracts(dt);
  for(let m of this.mobs){m.timer+=dt;if(this.advance(m,dt,.5))continue;if(m.timer>5){m.timer=0;let p={x:Math.max(0,Math.min(SIZE-1,Math.round(m.x)+Math.floor(this.random()*5)-2)),y:Math.max(0,Math.min(SIZE-1,Math.round(m.y)+Math.floor(this.random()*5)-2))};if(distance(p,{x:12,y:13})>4&&!this.protectedAt(p)){let path=this.path(m,p);if(path)m.path=path;}}}
 }
 serialize(){return JSON.stringify(this,(k,v)=>k==='_roads'?undefined:v);}
 static restore(json){let d=JSON.parse(json);if(d.version!==2||!Array.isArray(d.tiles)||d.tiles.length!==SIZE*SIZE||!Array.isArray(d.residents))throw Error('Сохранение другой версии');return Object.assign(Object.create(Game.prototype),d);}
}
root.Kingdom={Game,TYPES,TRAITS,MOBS,PLANTS,SIZE,distance};if(typeof module!=='undefined')module.exports=root.Kingdom;
})(typeof globalThis!=='undefined'?globalThis:this);
