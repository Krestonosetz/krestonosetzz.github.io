const assert=require('node:assert/strict');const {Game,MOBS,BIOMES,SIZE,CITY,distance}=require('./engine-v3');
function run(g,seconds,check){for(let i=0;i<Math.round(seconds*10);i++){g.tick(.1);if(check)check(g);}}
let g=new Game(42);assert.equal(SIZE,64);assert.equal(g.tiles.length,4096);assert.ok(g.groups.length>=16);for(let m of g.mobs){let group=g.groups.find(x=>x.id===m.groupId);assert.ok(group);assert.ok(BIOMES[group.biome].types.includes(m.kind));assert.equal(g.tile(m.x,m.y).biome,group.biome);assert.ok(distance(m,group)<3.5);}
// City leisure never silently becomes a cross-map hunt.
run(g,240,x=>{for(let h of x.heroes)assert.ok(distance(h,CITY)<9,'idle hero leaves town');});assert.equal(g.stats.kills,0);assert.equal(g.stats.deaths,0);
// All subjects use the slower locomotion, including haulers and monsters.
for(let sample of [{x:30,y:30,path:[{x:31,y:30}],state:'idle'},{x:30,y:30,path:[{x:31,y:30}],state:'roam'}]){g.advance(sample,1,1);assert.ok(sample.x<30.51&&sample.x>30.3);}
// Fog remembers terrain, but removes live visibility after a hero leaves.
let h=g.heroes[0],old={x:h.x,y:h.y};h.x=2;h.y=2;h.inside=null;g.updateVisibility();assert.ok(g.isVisible({x:2,y:2}));assert.ok(g.isExplored({x:2,y:2}));h.x=old.x;h.y=old.y;g.updateVisibility();assert.ok(!g.isVisible({x:2,y:2}));assert.ok(g.isExplored({x:2,y:2}));assert.ok(g.memory[2*SIZE+2]);assert.ok(!g.isExplored({x:63,y:63}));
// Stat bonuses are real; slots are functional and class restrictions are off.
assert.equal(h.inventory.length,12);assert.equal(Object.keys(h.equipment).length,9);let armor=g.derived(h).armor;assert.equal(g.equip(h.id,0),null);assert.ok(g.derived(h).armor>armor);assert.equal(g.unequip(h.id,'head'),null);let newMage=g.createHero({classId:'mage'});let shield=newMage.inventory.findIndex(i=>i?.slot==='left');assert.equal(g.equip(newMage.id,shield),null);assert.ok(newMage.equipment.left);let str=g.derived(h).str,capacity=g.derived(h).capacity;h.stats.str++;assert.ok(g.derived(h).capacity>capacity);h.stats.str--;
// Slot capacity and weight limits reject new items without deleting existing items.
let bag=g.createHero();bag.inventory=Array.from({length:12},(_,i)=>g.createItem('ring'));let count=bag.inventory.length;assert.equal(g.addItem(bag,g.createItem('head')),false);assert.equal(bag.inventory.length,count);assert.ok(g.unequip(bag.id,'right'));
// Ranged attacks happen at distance; outside sight the archer cannot acquire a hero.
let combat=new Game();combat.mobs=[];combat.groups=[];let hero=combat.heroes[0];hero.x=45;hero.y=43;hero.inside=null;hero.hp=combat.derived(hero).maxHp;let group=combat.spawnGroup('steppe',{x:46,y:43},['centaurArcher']);let archer=combat.mobs[0];archer.x=49;archer.y=43;let hp=hero.hp;combat.tickMob(archer,.1);assert.ok(hero.hp<hp);assert.ok(distance(hero,archer)>3);hero.x=60;hero.y=60;archer.target=null;archer.cooldown=0;hp=hero.hp;combat.tickMob(archer,.1);assert.equal(hero.hp,hp);assert.equal(archer.target,null);
// Intelligent hero prioritizes caster over melee at a similar distance.
hero.stats.int=9;hero.trait='greedy';hero.x=40;hero.y=40;let melee={kind:'goblin',x:41,y:40,hp:32},caster={kind:'shaman',x:42,y:40,hp:42};assert.equal(combat.chooseTarget(hero,[melee,caster]),caster);
// Healing consumes mana and restores actual HP (luck contributes bounded randomness).
let healer=combat.heroes.find(h=>h.classId==='healer');healer.x=40;healer.y=40;healer.inside=null;healer.healCooldown=0;hero.x=41;hero.y=40;hero.hp=30;let mana=healer.mana;combat.tickHero(healer,.1);assert.ok(hero.hp>30);assert.ok(healer.mana<mana);
// Death is permanent, removes an actor from contracts and preserves a memorial.
combat.postTask('kill','goblin',3,100,1);let c=combat.contracts[0];c.members=[hero.id];c.status='active';hero.contract=c.id;combat.damageHero(hero,10000,'тестовый противник');assert.ok(!combat.heroes.includes(hero));assert.ok(combat.fallen.includes(hero));assert.equal(c.status,'open');assert.equal(c.members.length,0);run(combat,5);assert.equal(hero.hp,0);assert.equal(combat.stats.deaths,1);
// GM commands do not touch personal inventories or unseen knowledge.
let before=g.heroes[0].inventory.map(i=>i?.id),fog=JSON.stringify(g.explored);g.masterResources('zero');assert.ok(Object.values(g.resources).every(v=>v===0));g.masterResources('add');assert.ok(Object.values(g.resources).every(v=>v===100));assert.deepEqual(g.heroes[0].inventory.map(i=>i?.id),before);assert.equal(JSON.stringify(g.explored),fog);
let snap=g.serialize(),restored=Game.restore(snap);assert.equal(restored.serialize(),snap);run(g,3);run(restored,3);assert.equal(restored.serialize(),g.serialize());
console.log('PASS v3: 64×64 map, biome packs, city-only idle AI, slower movement, fog memory, stats, 12 inventory cells, 9 equipment slots, cross-class gear, ranged sight/attack, caster priority, healing, permanent death, GM resources, deterministic saves');
