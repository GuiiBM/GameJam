const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const M = require('../mechanics.js');
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data.js'),'utf8'),sandbox);
const D = sandbox.window.GAME_DATA;
const fixed = () => .5;

test('16 math phases retain original ranges and operations', () => {
  for(let phase=1;phase<=16;phase++) for(const random of [0,.05,.5,.999999]) {
    const q=M.question(phase,()=>random);
    if(phase<=3) {assert(q.x>=1&&q.x<=9);assert(q.y>=1&&q.y<=9);}
    else if(phase<=6) {assert(q.x>=10&&q.x<=48);assert(q.y>=10&&q.y<=28);}
    else if(phase<=9) {assert(q.x>=2&&q.x<=9);assert(q.y>=1&&q.y<q.x);}
    else if(phase<=12) {assert(q.x>=10&&q.x<=48);assert(q.y>=10&&q.y<=q.x);}
    else if(phase<=14) {assert(q.x>=1&&q.x<=9);assert(q.y>=1&&q.y<=9);}
    else {assert(q.x>=10&&q.x<=98);assert(q.y>=10&&q.y<=98);}
    assert.equal(q.answer,phase<=6?q.x+q.y:phase<=12?q.x-q.y:q.x*q.y);
  }
});
test('four guided actions unlock the Newton fight at phase 5',()=>{
  const b=new M.Battle('newton',fixed);
  assert.equal(b.request('heal'),false);
  for(const action of M.ACTIONS) {assert(b.request(action));assert(b.submit(b.challenge.answer));}
  assert.equal(b.phase,5);assert.equal(b.step,4);assert.equal(b.guided,false);
  b.restart();assert.equal(b.phase,5);assert.equal(b.playerHp,100);assert.equal(b.enemyHp,100);assert(!b.guided);
});
test('wrong answer retaliates without executing action or progressing tutorial',()=>{
  const b=new M.Battle('newton',fixed);b.request('attack');assert.equal(b.submit(999),false);
  assert.equal(b.enemyHp,100);assert.equal(b.playerHp,94);assert.equal(b.step,0);assert.equal(b.phase,1);
});
test('cave boss has 75 HP, fixed phase 1, normal damage and valid retry',()=>{
  const b=new M.Battle('cavern',fixed);
  assert.equal(b.enemyHp,75);
  for(let i=0;i<3;i++) {b.request('attack');b.submit(b.challenge.answer);}
  assert.equal(b.phase,1);assert.equal(b.enemyHp,24);assert.equal(b.playerHp,61);
  b.restart();assert.equal(b.enemyHp,75);assert.equal(b.playerHp,100);assert.equal(b.phase,1);assert(!b.guided);
});
test('healing caps at 100, defense halves damage, dodging succeeds at 50%',()=>{
  let b=new M.Battle('cavern',fixed);b.request('heal');b.submit(b.challenge.answer);assert.equal(b.playerHp,87);
  b=new M.Battle('cavern',fixed);b.request('defense');b.submit(b.challenge.answer);assert.equal(b.playerHp,94);
  b=new M.Battle('cavern',()=>.2);b.request('dodge');b.submit(b.challenge.answer);assert.equal(b.playerHp,100);
});
test('critical hit doubles damage; fatal hit prevents retaliation',()=>{
  const b=new M.Battle('cavern',()=>0);b.request('attack');b.submit(b.challenge.answer);
  assert.equal(b.enemyHp,51);assert.equal(b.playerHp,84);
  b.enemyHp=10;const hp=b.playerHp;b.request('attack');b.submit(b.challenge.answer);
  assert.equal(b.screen,'victory');assert.equal(b.playerHp,hp);
});
test('invalid and repeated submissions cannot take extra turns',()=>{
  const b=new M.Battle('cavern',fixed);b.request('attack');
  for(const value of ['',NaN,'abc','123456','-1']) assert.equal(b.submit(value),null);
  assert.equal(b.playerHp,100);b.submit(b.challenge.answer);const hp=b.playerHp;
  assert.equal(b.submit(1),null);assert.equal(b.playerHp,hp);
});
test('defeat locks actions until retry, restoring original HP and phase',()=>{
  const b=new M.Battle('cavern',fixed);b.playerHp=1;b.request('attack');b.submit(999);
  assert.equal(b.screen,'defeat');assert.equal(b.playerHp,0);assert(!b.request('heal'));
  b.restart();assert.equal(b.screen,'actions');assert.equal(b.playerHp,100);assert.equal(b.enemyHp,75);assert.equal(b.phase,1);
});
test('player cannot tunnel through solid scenery',()=>{
  const p={x:50,y:50};M.move(p,200,0,[[100,0,20,100]]);
  assert(p.x<94);assert(!M.blocked(p.x,p.y,[[100,0,20,100]]));
});
function reachable(room,target) {
  const r=D.rooms[room],spawn=r.instances.find(i=>i.object==='obj_player');
  const visited=new Uint8Array(640*384),queue=[[spawn.x,spawn.y]];let head=0;
  assert(!M.blocked(spawn.x,spawn.y,r.colliders),'Spawn must be free: '+room);
  while(head<queue.length) {
    const [x,y]=queue[head++];
    if(target(x,y)) return true;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,ny=y+dy,key=ny*640+nx;
      if(nx<0||ny<0||nx>=640||ny>=384||visited[key])continue;
      visited[key]=1;
      if(!M.blocked(nx,ny,r.colliders))queue.push([nx,ny]);
    }
  }
  return false;
}
test('all maps have a walkable route from spawn to objective and portal',()=>{
  assert(reachable('rm_tutorial',(x,y)=>x>=587&&x<=605&&y>=258&&y<=284));
  assert(reachable('rm_cavernas',(x,y)=>x>=616));
  assert(reachable('rm_cavernas_2',(x,y)=>x>=516&&x<=534&&y>=284&&y<=310));
});
test('all 52 exported frames exist; tilemaps decompress to their full size',()=>{
  let frames=0;
  for(const sprite of Object.values(D.sprites))for(const file of sprite.frames){assert(fs.existsSync(path.join(__dirname,'..',file)),file);frames++;}
  assert.equal(frames,52);
  for(const layer of D.rooms.rm_tutorial.tiles)assert.equal(M.expandTiles(layer.compressed).length,layer.width*layer.height);
  assert.equal(D.dialogues.intro.length,8);assert.equal(D.dialogues.cavern.length,4);assert.equal(D.dialogues.boss.length,3);
  assert.equal(D.sprites.spr_meteor_explosion.frames.length,10);
});
test('GameMaker source matches the pre-port SHA-256 snapshot',()=>{
  const source=path.resolve(__dirname,'../../ExpoGameJam-main');
  if(!fs.existsSync(source))return;
  const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'../source-snapshot.json'),'utf8'));
  for(const file of baseline) {
    const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(source,file.path))).digest('hex');
    assert.equal(actual,file.sha256,'Original changed: '+file.path);
  }
});
