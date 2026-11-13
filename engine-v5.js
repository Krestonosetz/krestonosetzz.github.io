(function(root){
'use strict';
const K=typeof module!=='undefined'?require('./engine-v4'):root.Kingdom;
const {Game:Previous,MOBS,SIZE,CITY,distance}=K;
class Game extends Previous{
 constructor(seed=42){super(seed);this.version=5;for(let h of this.heroes)h.debuffs=[];Object.defineProperty(this,'_attacker',{value:null,writable:true,enumerable:false});}
 debuffs(h){return (h.debuffs||[]).filter(e=>e.until>this.time);}
 slowFactor(h){return 1-Math.max(0,...this.debuffs(h).map(e=>e.slow));}
 advance(a,dt,speed=1.5){if(a.classId)speed*=.55*this.slowFactor(a);else if(a.kind&&MOBS[a.kind]&&a.target){let kind=a.kind;speed*=kind==='wolf'?1.7:['ogre','troll','slime'].includes(kind)?1.08:1.45;}return super.advance(a,dt,speed);}
 applyDebuff(h,id,name,slow,duration,source){if(h.dead)return;h.debuffs=h.debuffs||[];let effect=h.debuffs.find(e=>e.id===id),fresh=!effect||effect.until<=this.time;if(effect)Object.assign(effect,{slow,until:this.time+duration,source});else h.debuffs.push({id,name,slow,until:this.time+duration,source});if(fresh)this.event(h.name+': '+name+' — движение замедлено на '+Math.round(slow*100)+'%.');}
 damageHero(h,amount,cause){super.damageHero(h,amount,cause);let m=this._attacker;if(h.dead||!m)return;let role=MOBS[m.kind]?.role;if(role==='ranged')this.applyDebuff(h,'knee','Прострел колена',.45,10,m.id);if(role==='caster')this.applyDebuff(h,'frost','Обморожение',.55,12,m.id);}
 tickMob(m,dt){this._attacker=m;try{return super.tickMob(m,dt);}finally{this._attacker=null;}}
 postTask(kind,target,count,reward,_ignoredParty,stay=true){let err=super.postTask(kind,target,count,reward,1,stay);if(!err)this.autoContract(this.contracts[this.contracts.length-1]);return err;}
 contextContract(action,object,reward=60,_ignoredParty){let err=super.contextContract(action,object,reward,1);if(!err)this.autoContract(this.contracts[this.contracts.length-1]);return err;}
 autoContract(c){if(!c)return;c.autoParty=true;c.leaderId=c.leaderId||null;c.partySize=Math.max(1,c.members.length);c.teamNote='Герои оценивают задачу и выбирают состав';c.riskMemory=c.riskMemory||0;}
 risk(c){
  let anchor=c.anchor||(['clear','patrol'].includes(c.kind)?this.sites.find(s=>s.id===Number(c.target)):null),risk=12;
  if(c.kind==='clear')risk=this.sites.find(s=>s.id===Number(c.target)).power;
  if(c.kind==='kill'){let m=MOBS[c.target];risk=(m.damage*2+m.hp*.12)*(m.role==='caster'?3:2.2);}
  if(c.kind==='huntGroup'){let report=this.intel.find(r=>r.groupId===c.target&&!r.resolved);if(report)risk=report.composition.reduce((s,row)=>s+row.count*(MOBS[row.kind].damage*2+MOBS[row.kind].hp*.12),0);else risk=50;}
  if(c.kind==='huntTarget'){let m=this.mobs.find(m=>m.id===c.target&&this.isVisible(m));risk=m?MOBS[m.kind].damage*2+m.hp*.12:35;}
  if(anchor){risk=Math.max(risk,12+Math.max(0,distance(anchor,CITY)-7)*1.4);let nearby=this.intel.filter(r=>!r.resolved&&distance(r,anchor)<7);for(let r of nearby)risk=Math.max(risk,r.composition.reduce((s,row)=>s+row.count*(MOBS[row.kind].damage*2+MOBS[row.kind].hp*.12),0));}
  return Math.max(risk,c.riskMemory||0);
 }
 reviewParty(c){let leader=this.heroes.find(h=>h.id===c.leaderId&&h.contract===c.id);if(!leader){leader=this.heroes.find(h=>h.contract===c.id);c.leaderId=leader?.id||null;}if(!leader){c.partySize=1;return;}let members=this.heroes.filter(h=>h.contract===c.id),required=this.risk(c)*(leader.trait==='coward'?1.45:leader.trait==='brave'?.85:1.15),strength=members.reduce((s,h)=>s+this.power(h),0);c.requiredStrength=required;c.teamStrength=strength;
  if(strength>=required){c.partySize=Math.max(1,members.length);c.teamNote=members.length===1?leader.name+' решает идти самостоятельно':leader.name+' считает отряд готовым';}
  else{let average=strength/Math.max(1,members.length);c.partySize=Math.min(4,Math.max(members.length+1,Math.ceil(required/Math.max(1,average))));let needHealer=members.length>=2&&!members.some(h=>h.classId==='healer');c.teamNote=leader.name+(needHealer?' ищет целителя и спутников':' ищет спутников')+' · сила '+Math.round(strength)+' / оценка '+Math.round(required);if(members.length===4&&strength<required)c.teamNote=leader.name+': отряд собран, риск остаётся высоким';}
 }
 chooseTask(h){let options=this.contracts.filter(c=>c.status==='open'&&c.members.length<c.partySize&&!(c.kind==='escort'&&c.actorType==='hero'&&c.target===h.id)).map(c=>{let leader=this.heroes.find(a=>a.id===c.leaderId),expected=leader?c.partySize:Math.min(4,Math.max(1,Math.ceil(this.risk(c)/Math.max(1,this.power(h))))),share=c.reward/expected,missingRole=leader&&h.classId==='healer'&&!c.members.some(id=>this.heroes.find(a=>a.id===id)?.classId==='healer');return {c,score:share-(h.trait==='greedy'?10:4)-this.risk(c)/(expected*Math.max(1,this.power(h)))*2+(missingRole?5:0)};}).sort((a,b)=>b.score-a.score);
  if(!options[0]||options[0].score<=0)return false;let c=options[0].c;h.contract=c.id;c.members.push(h.id);if(!c.leaderId)c.leaderId=h.id;this.reviewParty(c);this.visit(h,'gather');return true;
 }
 flee(h,why){let c=this.contracts.find(c=>c.id===h.contract);if(c&&c.status==='active'){let seen=this.mobs.filter(m=>this.canSee(h,m)),d=this.derived(h),healthyStrength=d.damage*2+d.maxHp*.15+(h.classId==='healer'?15:0);c.riskMemory=Math.max(c.riskMemory||0,this.risk(c)*1.4,healthyStrength*1.4,seen.reduce((s,m)=>s+MOBS[m.kind].damage*2+m.hp*.12,0));c.status='regrouping';c.ready=0;c.teamNote=h.name+' отступает: отряд перегруппируется и ищет помощь';for(let a of this.heroes.filter(a=>a!==h&&a.contract===c.id&&!a.inside)){a.path=[];a.target=null;a.combatGroup=null;this.visit(a);a.reason='Отряд возвращается на перегруппировку';}}return super.flee(h,why);}
 tickHero(h,dt){h.debuffs=this.debuffs(h);let c=this.contracts.find(c=>c.id===h.contract);if(c?.status==='regrouping'){if(h.inside)h.timer=0;else if(h.state!=='toTavern'){h.path=[];h.target=null;this.visit(h);}super.tickHero(h,dt);if(!h.dead)h.reason=h.inside?'Обсуждает опасность и ищет спутников':'Отступает к таверне для перегруппировки';return;}return super.tickHero(h,dt);}
 tickContracts(dt){for(let c of this.contracts){if(c.status==='regrouping'){let members=this.heroes.filter(h=>h.contract===c.id);if(!members.length){c.status='open';c.leaderId=null;c.partySize=1;}else if(members.every(h=>h.inside)){c.status='open';c.ready=0;this.reviewParty(c);}}
   if(c.status==='open'){this.reviewParty(c);if(c.members.length===4&&c.teamStrength<c.requiredStrength){let leader=this.heroes.find(h=>h.id===c.leaderId);if(leader?.trait==='coward'){c.ready=-1;c.teamNote=leader.name+' откладывает поход: нужны более сильные спутники или снаряжение';continue;}}}}
  super.tickContracts(dt);
 }
 static restore(json){let data=JSON.parse(json),oldVersion=data.version;if(![3,4,5].includes(oldVersion)||data.tiles?.length!==SIZE*SIZE)throw Error('Сохранение другой версии');data.version=4;let g=Previous.restore(JSON.stringify(data));Object.setPrototypeOf(g,Game.prototype);g.version=5;Object.defineProperty(g,'_attacker',{value:null,writable:true,enumerable:false});for(let h of [...g.heroes,...g.fallen])h.debuffs=h.debuffs||[];for(let c of g.contracts){if(oldVersion<5)g.autoContract(c);if(c.status==='open')g.reviewParty(c);}return g;}
}
root.Kingdom={...K,Game};if(typeof module!=='undefined')module.exports=root.Kingdom;
})(typeof globalThis!=='undefined'?globalThis:this);
