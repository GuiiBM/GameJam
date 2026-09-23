// Read-only export from GameMaker. All writes stay inside this web project.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = path.resolve(root, '../ExpoGameJam-main');
const readYY = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/,\s*([}\]])/g, '$1'));
const readGML = object => fs.readFileSync(path.join(source, 'objects', object, 'Create_0.gml'), 'utf8');
const sprites = {};
for (const name of fs.readdirSync(path.join(source, 'sprites')).filter(n => n.startsWith('spr_') && n !== 'spr_colisor')) {
  const dir = path.join(source, 'sprites', name);
  const sprite = readYY(path.join(dir, name + '.yy'));
  const dest = path.join(root, 'assets', name);
  fs.mkdirSync(dest, {recursive:true});
  const frames = sprite.frames.map((frame, i) => {
    fs.copyFileSync(path.join(dir, frame.name + '.png'), path.join(dest, i + '.png'));
    return `assets/${name}/${i}.png`;
  });
  sprites[name] = {width:sprite.width, height:sprite.height, xorigin:sprite.sequence.xorigin, yorigin:sprite.sequence.yorigin, fps:sprite.sequence.playbackSpeed, frames};
}
const rooms = {};
for (const name of ['rm_tutorial','rm_cavernas','rm_cavernas_2']) {
  const room = readYY(path.join(source,'rooms',name,name+'.yy'));
  const instances = room.layers.flatMap(l => l.instances || []).map(i => ({object:i.objectId.name,x:i.x,y:i.y,scaleX:i.scaleX,scaleY:i.scaleY}));
  rooms[name] = {width:room.roomSettings.Width,height:room.roomSettings.Height,instances,
    colliders:instances.filter(i => i.object === 'obj_colisor').map(i => [i.x,i.y,32*i.scaleX,32*i.scaleY]),
    tiles:room.layers.filter(l=>l.tiles).map(l=>({name:l.name,depth:l.depth,x:l.x,y:l.y,width:l.tiles.SerialiseWidth,height:l.tiles.SerialiseHeight,compressed:l.tiles.TileCompressedData}))};
}
const collisions = readGML('obj_cavern_collision_builder').split('else if');
['rm_cavernas','rm_cavernas_2'].forEach((name,i) => {
  for(const m of collisions[i].matchAll(/add_scenery_collider\(([\d., ]+)\);/g)) rooms[name].colliders.push(m[1].split(',').map(Number));
});
function dialogue(object, variable) {
  const match = readGML(object).match(new RegExp(variable+' = \\[([\\s\\S]*?)\\];'));
  if(!match) throw Error('Missing dialogue '+variable);
  const pages = [''];
  for(const token of match[1].matchAll(/"(?:[^"\\]|\\.)*"|,/g)) {
    if(token[0] === ',') pages.push('');
    else pages[pages.length-1] += (pages.at(-1) ? ' ' : '') + JSON.parse(token[0]);
  }
  return pages.filter(Boolean);
}
const dialogues = {};
for(const name of ['intro','post','reminder','skipped']) dialogues[name]=dialogue('obj_newton_npc','dialogue_'+name);
dialogues.cavern = dialogue('obj_newton_cavern_dialogue','dialogue_pages');
dialogues.boss = dialogue('obj_cavern_isleide','dialogue_pages');
dialogues.escape = ['Temos que ir logo antes que esse mundo quebre!'];
const files = [];
function snapshot(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(entry.name === '.git') continue;
    const file = path.join(dir,entry.name);
    if(entry.isDirectory()) snapshot(file);
    else files.push({path:path.relative(source,file).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
  }
}
snapshot(source);
fs.writeFileSync(path.join(root,'data.js'), '// Generated from the original GameMaker project by tools/export-assets.cjs.\nwindow.GAME_DATA = '+JSON.stringify({sprites,rooms,dialogues})+';\n');
fs.writeFileSync(path.join(root,'source-snapshot.json'), JSON.stringify(files,null,2)+'\n');
console.log(`Exported ${Object.keys(sprites).length} sprites, ${Object.values(sprites).reduce((n,s)=>n+s.frames.length,0)} frames, 3 maps and original dialogues. Source unchanged.`);
