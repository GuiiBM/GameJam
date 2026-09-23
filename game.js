/* Browser adaptation of the existing GameMaker events. No source-game writes. */
(() => {
  'use strict';
  const D = window.GAME_DATA, M = window.Mechanics;
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const keys = new Set(), images = {}, tileLayers = [];
  const show = (id, visible) => { $(id).hidden = !visible; };
  const focusStage = () => $('stage').focus({preventScroll:true});
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mod = (a, b) => ((a % b) + b) % b;

  function sprite(name, frame, x, y, scale = 1, flip = false) {
    const data = D.sprites[name], img = images[name]?.[mod(Math.floor(frame), data.frames.length)];
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(flip ? -scale : scale, scale);
    ctx.drawImage(img, -data.xorigin, -data.yorigin);
    ctx.restore();
  }
  function ellipse(x, y, rx, ry, color, alpha = 1) {
    ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function buildTiles() {
    for (const layer of D.rooms.rm_tutorial.tiles) {
      const image = document.createElement('canvas'); image.width = 640; image.height = 384;
      const g = image.getContext('2d'); g.imageSmoothingEnabled = false;
      const tiles = M.expandTiles(layer.compressed), sheet = images.spr_tileset[0];
      if (tiles.length !== layer.width * layer.height) throw Error('Camada de tiles inválida: ' + layer.name);
      tiles.forEach((raw, i) => {
        if (raw === -2147483648 || raw === 0) return;
        const index = raw & 0x7ffff;
        // Source tilesheet has 30 columns of 16px, without export padding.
        g.drawImage(sheet, (index % 30) * 16, Math.floor(index / 30) * 16, 16, 16, (i % layer.width) * 16, Math.floor(i / layer.width) * 16, 16, 16);
      });
      tileLayers.push({image, depth:layer.depth});
    }
    tileLayers.sort((a,b) => b.depth - a.depth);
  }

  class Game {
    constructor() {
      this.mode = 'menu'; this.room = 'rm_tutorial'; this.time = 0; this.sceneTime = 0;
      this.player = {x:112,y:144,direction:'front',flip:false,moving:false};
      this.menuIndex = 0; this.paused = false; this.modalKind = null;
      this.dialogue = null; this.portal = null; this.battle = null; this.transition = null;
      this.newtonComplete = false; this.bossEncountered = false; this.bossDefeated = false;
      this.footprints = []; this.footTimer = 0; this.footSide = 1; this.toastUntil = 0;
      this.updateUI(); this.selectMenu(0);
    }
    setMode(mode) { this.mode = mode; keys.clear(); this.player.moving = false; this.updateUI(); }
    updateUI() {
      ['menu','hud','dialogue','choice','battle','challenge','result','ending','prompt'].forEach(id => show(id, false));
      if (this.mode === 'menu') show('menu', true);
      if (['explore','dialogue','choice'].includes(this.mode)) {
        show('hud', true);
        $('location').textContent = this.room === 'rm_tutorial' ? 'PONTO DE INCURSÃO' : this.room === 'rm_cavernas' ? 'CAVERNAS · FLORESTA' : 'CAVERNAS · VALE DOS OSSOS';
        $('objective').textContent = this.portal ? 'ATRAVESSE O PORTAL' : this.room === 'rm_tutorial' ? 'ENCONTRE NEWTON' : this.room === 'rm_cavernas' ? 'SIGA PARA A DIREITA →' : 'ENCONTRE O ISLEIDE DAS CAVERNAS';
      }
      if (this.mode === 'dialogue') {
        show('dialogue', true);
        $('speaker').textContent = this.dialogue.speaker;
        $('page-number').textContent = `${this.dialogue.index + 1} / ${this.dialogue.pages.length}`;
        $('dialogue-text').textContent = this.dialogue.pages[this.dialogue.index];
      }
      if (this.mode === 'choice') show('choice', true);
      if (this.mode === 'battle') this.battleUI();
      if (this.mode === 'aftermath') show('ending', true);
    }
    start() {
      this.newtonComplete = false; this.bossEncountered = false; this.bossDefeated = false;
      this.portal = null; this.battle = null; this.dialogue = null; this.sceneTime = 0;
      this.enterRoom('rm_tutorial'); focusStage();
    }
    enterRoom(room) {
      this.room = room; this.portal = null; this.footprints = []; this.footTimer = 0;
      const spawn = D.rooms[room].instances.find(i => i.object === 'obj_player');
      this.player = {x:spawn.x,y:spawn.y,direction:'front',flip:false,moving:false};
      this.setMode('explore');
      if (room === 'rm_cavernas') this.say(D.dialogues.cavern, 'ISLEIDE NEWTON · TRANSMISSÃO');
    }
    say(pages, speaker, after = () => this.setMode('explore')) {
      this.dialogue = {pages, speaker, index:0, after};
      this.setMode('dialogue');
    }
    advance() {
      if (this.paused) return;
      if (this.mode === 'dialogue') {
        if (++this.dialogue.index >= this.dialogue.pages.length) {
          const after = this.dialogue.after; this.dialogue = null; after();
        } else this.updateUI();
      } else if (this.mode === 'explore' && this.room === 'rm_tutorial' && Math.hypot(this.player.x - 560, this.player.y - 272) <= 78) {
        if (this.newtonComplete) this.say(D.dialogues.reminder, 'ISLEIDE NEWTON');
        else this.say(D.dialogues.intro, 'ISLEIDE NEWTON', () => { this.setMode('choice'); $('train').focus(); });
      } else if (this.mode === 'battle' && ['victory','defeat'].includes(this.battle.screen)) this.finishBattle();
      else if (this.mode === 'aftermath' && this.sceneTime >= 2) this.toMenu();
    }
    chooseTutorial(skip) {
      if (this.mode !== 'choice') return;
      if (skip) {
        this.newtonComplete = true;
        this.say(D.dialogues.skipped, 'ISLEIDE NEWTON', () => this.openPortal(596, 284, 'rm_cavernas'));
      } else this.startBattle('newton');
      focusStage();
    }
    openPortal(x, y, destination) {
      this.portal = {x,y,destination,age:0}; this.setMode('explore');
    }
    startBattle(kind) {
      this.battle = new M.Battle(kind); this.setMode('battle'); focusStage();
    }
    battleUI() {
      const b = this.battle;
      show('battle', true); show('challenge', b.screen === 'challenge');
      const done = ['victory','defeat'].includes(b.screen);
      show('result', done); show('guide', b.guided && !done);
      $('enemy-name').textContent = b.enemyName;
      $('math-level').textContent = 'NÍVEL MAT. ' + b.phase;
      $('enemy-hp').max = b.enemyMax; $('enemy-hp').value = b.enemyHp;
      $('player-hp').value = b.playerHp;
      $('enemy-health').textContent = `HP: ${b.enemyHp}/${b.enemyMax}`;
      $('player-health').textContent = `HP: ${b.playerHp}/100`;
      $('battle-log').textContent = b.message;
      $('guide').textContent = `TREINO DE INCURSÃO · PASSO ${b.step + 1}/4 — Use ${M.LABELS[b.step] || ''}.`;
      document.querySelectorAll('[data-action]').forEach(button => {
        button.disabled = b.screen !== 'actions' || (b.guided && button.dataset.action !== M.ACTIONS[b.step]);
      });
      if (b.screen === 'challenge') $('equation').textContent = `${b.challenge.x} ${b.challenge.operator} ${b.challenge.y}`;
      if (done) {
        $('result-title').textContent = b.screen === 'victory' ? 'VOCÊ VENCEU!' : 'VOCÊ PERDEU';
        $('result-text').textContent = b.screen === 'victory' ? b.kind === 'cavern' ? 'O Isleide das Cavernas foi derrotado.' : 'Você está pronto para enfrentar as incursões.' : 'A realidade ainda precisa de você. Tente novamente.';
        $('result-next').textContent = b.screen === 'victory' ? 'CONTINUAR · ENTER' : 'TENTAR NOVAMENTE · ENTER';
      }
    }
    action(action) {
      if (this.paused || this.mode !== 'battle') return;
      const requested = this.battle.request(action); this.battleUI();
      if (requested) { $('answer').value = ''; $('answer').focus({preventScroll:true}); }
    }
    answer(value) {
      if (this.paused || this.mode !== 'battle') return;
      const correct = this.battle.submit(value);
      if (correct === null) return;
      $('toast').textContent = correct ? 'ACERTOU!' : 'ERROU!';
      this.toastUntil = this.time + .9; show('toast', true);
      this.battleUI(); focusStage();
    }
    finishBattle() {
      const b = this.battle;
      if (b.screen === 'defeat') { b.restart(); this.battleUI(); focusStage(); return; }
      if (b.screen !== 'victory') return;
      this.battle = null;
      if (b.kind === 'newton') {
        this.newtonComplete = true;
        this.say(D.dialogues.post, 'ISLEIDE NEWTON', () => this.openPortal(596,284,'rm_cavernas'));
      } else {
        this.bossDefeated = true;
        this.say(D.dialogues.escape, 'ISLEIDE NEWTON · TRANSMISSÃO', () => this.openPortal(525,310,'meteor'));
      }
      focusStage();
    }
    travel(destination) {
      if (this.transition) return;
      this.transition = {destination,elapsed:0,switched:false}; this.setMode('transition');
    }
    selectMenu(index) {
      this.menuIndex = mod(index, 3);
      document.querySelectorAll('[data-menu]').forEach((b,i)=> b.classList.toggle('selected',i===this.menuIndex));
    }
    menuAction(name) {
      if (name === 'play') this.start();
      else if (name === 'controls') this.openModal('controls');
      else this.openModal('exit');
    }
    openModal(kind) {
      this.paused = true; this.modalKind = kind; keys.clear();
      $('modal-title').textContent = kind === 'pause' ? 'JOGO PAUSADO' : kind === 'exit' ? 'ATÉ A PRÓXIMA INCURSÃO' : 'CONTROLES';
      $('modal-text').innerHTML = kind === 'controls' ? '<dl><dt>WASD</dt><dd>Movimentar Wilson</dd><dt>E / ESPAÇO</dt><dd>Interagir e avançar diálogos</dd><dt>1 / 2 / 3 / 4</dt><dd>Ataque / cura / defesa / esquiva</dd><dt>NÚMEROS + ENTER</dt><dd>Responder aos cálculos</dd><dt>ESC</dt><dd>Pausar ou voltar</dd></dl>' : kind === 'exit' ? '<p>Você pode fechar esta aba para sair do jogo.</p>' : '<p>A linha do tempo está esperando por você.</p>';
      $('modal-close').textContent = kind === 'pause' ? 'CONTINUAR JOGANDO' : 'VOLTAR';
      show('return-menu', kind === 'pause'); show('modal', true); $('modal-close').focus();
    }
    closeModal() { this.paused = false; this.modalKind = null; show('modal', false); focusStage(); }
    toMenu() {
      this.closeModal(); this.battle = null; this.dialogue = null; this.portal = null; this.transition = null;
      $('fade').style.opacity = 0; show('toast', false); this.setMode('menu'); this.selectMenu(0);
    }
    update(dt) {
      if (this.paused) return;
      this.time += dt;
      if (this.time >= this.toastUntil) show('toast', false);
      if (this.transition) {
        const t = this.transition; t.elapsed += dt;
        $('fade').style.opacity = t.elapsed < .42 ? t.elapsed / .42 : Math.max(0, 1 - (t.elapsed - .42) / .3);
        if (!t.switched && t.elapsed >= .42) {
          t.switched = true;
          if (t.destination === 'meteor') { this.sceneTime = 0; this.portal = null; this.setMode('meteor'); }
          else this.enterRoom(t.destination);
        }
        if (t.elapsed >= .72) this.transition = null;
        return;
      }
      if (this.mode === 'meteor') {
        this.sceneTime += dt;
        if (this.sceneTime >= 1.9) { this.sceneTime = 0; show('ending-menu', false); this.setMode('aftermath'); }
        return;
      }
      if (this.mode === 'aftermath') { this.sceneTime += dt; show('ending-menu', this.sceneTime >= 2); return; }
      if (this.portal) this.portal.age += dt;
      this.footprints = this.footprints.filter(f => this.time - f.born < 2);
      if (this.mode !== 'explore') return;
      let dx = Number(keys.has('d')) - Number(keys.has('a'));
      let dy = Number(keys.has('s')) - Number(keys.has('w'));
      const length = Math.hypot(dx, dy), p = this.player;
      const oldX = p.x, oldY = p.y;
      if (length) {
        if (dx) { p.direction = 'side'; p.flip = dx < 0; }
        else { p.direction = dy < 0 ? 'back' : 'front'; p.flip = false; }
        M.move(p, dx / length * 120 * dt, dy / length * 120 * dt, D.rooms[this.room].colliders);
      }
      p.moving = Math.hypot(p.x-oldX,p.y-oldY) > .01;
      if (p.moving && this.room !== 'rm_tutorial') {
        this.footTimer += dt;
        if (this.footTimer >= 10/60) {
          this.footTimer = 0; this.footSide *= -1;
          this.footprints.push({x:p.x+this.footSide*4,y:p.y+7,side:this.footSide,born:this.time});
        }
      }
      let prompt = '';
      if (this.room === 'rm_tutorial' && Math.hypot(p.x-560,p.y-272)<=78) prompt = 'E / ESPAÇO · FALAR COM NEWTON';
      if (this.room === 'rm_cavernas' && p.x >= 616) { this.travel('rm_cavernas_2'); return; }
      if (this.room === 'rm_cavernas_2' && !this.bossEncountered && Math.hypot(p.x-520,p.y-305)<=125) {
        this.bossEncountered = true;
        this.say(D.dialogues.boss, 'ISLEIDE DAS CAVERNAS', () => this.startBattle('cavern')); return;
      }
      if (this.portal && this.portal.age >= .5) {
        const portal = this.portal;
        if (Math.hypot(p.x-portal.x,p.y-portal.y)<65) prompt = 'CAMINHE PARA DENTRO DO PORTAL';
        if (p.x >= portal.x-9 && p.x <= portal.x+9 && p.y >= portal.y-26 && p.y <= portal.y) { this.travel(portal.destination); return; }
      }
      $('prompt').textContent = prompt; show('prompt', !!prompt);
    }
    drawPlayer() {
      const p = this.player, scale = this.room === 'rm_tutorial' ? 1 : 2;
      ellipse(p.x, p.y+7, 7*scale, 2*scale, '#121a16', .22);
      sprite(`spr_player_${p.moving ? 'walk' : 'idle'}_${p.direction}`, p.moving ? this.time*8 : 0, p.x, p.y + 7*(1-scale), scale, p.flip);
    }
    ambience() {
      ctx.save();
      ctx.fillStyle = '#e1eeb0'; ctx.globalAlpha = .025 + Math.sin(this.time*.6)*.008;
      ctx.beginPath(); ctx.moveTo(80,0);ctx.lineTo(205,0);ctx.lineTo(290,360);ctx.fill();
      ctx.beginPath();ctx.moveTo(430,0);ctx.lineTo(510,0);ctx.lineTo(390,360);ctx.fill();
      for(let i=0;i<30;i++) {
        const x = mod(i*137 + this.time*(i%2 ? 2 : -2),640), y = mod(i*71 + Math.sin(this.time*.3+i)*8,360);
        ctx.globalAlpha = .05 + .08*Math.abs(Math.sin(this.time+i));
        ctx.fillStyle = i%3 ? '#ffffff' : '#f4e087'; ctx.fillRect(Math.floor(x),Math.floor(y),1,1);
      }
      ctx.restore();
    }
    drawWorld() {
      const tutorial = this.room === 'rm_tutorial';
      ctx.save();
      if (tutorial) {
        const cx = M.clamp(this.player.x-192,0,256), cy = M.clamp(this.player.y-109.5,0,161);
        ctx.scale(960/384,540/219); ctx.translate(-Math.round(cx),-Math.round(cy));
        ctx.fillStyle='#243b28'; ctx.fillRect(0,0,640,380);
        tileLayers.filter(l=>l.depth>100).forEach(l=>ctx.drawImage(l.image,0,0));
      } else {
        ctx.scale(1.5,1.5);
        sprite(this.room === 'rm_cavernas' ? 'spr_cenario_cavernas' : 'spr_cenario_cavernas_2',0,0,0);
        if (this.room === 'rm_cavernas_2') {
          sprite('spr_cavern_birds',this.time*3.6,0,0);
          sprite('spr_cavern_dinosaurs',this.time*.75,0,0);
        }
        for(const f of this.footprints) {
          const life = 1-(this.time-f.born)/2;
          ellipse(f.x,f.y,3.5,2,'#242218',.48*life);
          ellipse(f.x-f.side*1.5,f.y+1.5,1.5,1.5,'#242218',.35*life);
          if(life>.88) ellipse(f.x+f.side*3,f.y-3,1,1,'#d1bd85',.18);
        }
        // The original latest layering puts BOTH actors above the scenery.
        sprite(this.room === 'rm_cavernas' ? 'spr_cavern_foreground_1' : 'spr_cavern_foreground_2',0,0,0);
        if (this.room === 'rm_cavernas_2') sprite('spr_cavern_foreground_bones',0,0,0);
        this.ambience();
      }
      if (this.mode !== 'battle') {
        if (tutorial) sprite('spr_newton_npc',0,560,272);
        if(this.portal) sprite('spr_portal',this.time*10,this.portal.x,this.portal.y,.8);
        this.drawPlayer();
        if(this.room === 'rm_cavernas_2' && !this.bossDefeated) {
          ellipse(520,309,13,4,'#142015',.26); sprite('spr_isleide_cavernas',0,520,305,.1);
        }
      }
      if (tutorial) tileLayers.filter(l=>l.depth<100).forEach(l=>ctx.drawImage(l.image,0,0));
      ctx.restore();
    }
    drawFire() {
      const t = this.time;
      const fires = [[42,221],[72,174],[128,310],[221,286],[338,190],[417,244],[501,181],[579,285],[612,257],[385,182],[450,177],[535,190]];
      for (let i=0;i<fires.length;i++) {
        const [x,y] = fires[i], pulse = .5+.5*Math.sin(t*8+i*2.7);
        ellipse(x,y-4,12,9,'#ff6b08',.10+pulse*.05);
        ctx.fillStyle='#d83e0d';ctx.fillRect(x-6,y-3,13,4);
        for(let j=0;j<4;j++) {
          const h = Math.round(5+3*Math.sin(t*(6+j)+i*2+j*3)), fx=x+j*3-5;
          const sway=Math.round(Math.sin(t*9+j+i));
          ctx.fillStyle='#fa5d0b';ctx.fillRect(fx-1,y-Math.floor(h*.6),4,Math.floor(h*.6));
          ctx.fillStyle='#ffba35';ctx.fillRect(fx+sway,y-h,2,h);
          ctx.fillStyle='#f47a15';ctx.fillRect(fx+sway+1,y-h-2,1,2);
          ctx.fillStyle='#ffe189';ctx.fillRect(fx,y-2,2,2);
        }
      }
      const smoke = [[52,171],[113,139],[191,166],[405,160],[459,108],[505,135],[596,143]];
      smoke.forEach(([x,y],i)=> {
        for(let j=0;j<6;j++) {
          const age = mod(t*.15+j/6+i*.13,1), offset = Math.sin(t*.55+i+j)*7;
          ellipse(x+age*20+offset,y-age*75,6+age*15,7+age*18,'#41404a',.11*(1-age));
        }
      });
      for(let i=0;i<42;i++) {
        const age=mod(t*.22+i*.137,1), x=mod(i*89+Math.sin(t+i)*6+age*14,640),y=330-age*230;
        ctx.save();ctx.globalAlpha=(1-age)*.65;ctx.fillStyle=i%3?'#f47a15':'#ffce63';ctx.fillRect(Math.floor(x),Math.floor(y),1,2);ctx.restore();
      }
    }
    drawCatastrophe() {
      ctx.save();ctx.scale(1.5,1.5);
      const frame = Math.min(9,Math.floor(this.sceneTime/.15));
      const impact = this.mode === 'aftermath' || frame >= 5;
      sprite(impact ? 'spr_cenario_pos_meteoro' : 'spr_cenario_cavernas_2',0,0,0);
      if(this.mode === 'meteor') {
        ctx.fillStyle='rgba(12,8,24,.42)';ctx.fillRect(0,0,640,360);
        const shake=impact && !reduceMotion ? Math.min(5,frame-3) : 0;
        sprite('spr_meteor_explosion',frame,320+Math.sin(this.time*120)*shake,154.8+Math.cos(this.time*105)*shake,.28);
        if(frame === 5) {
          ctx.fillStyle=`rgba(255,255,255,${reduceMotion ? .18 : M.clamp(.92-(this.sceneTime-.75)*60*.09,.2,.92)})`;ctx.fillRect(0,0,640,360);
        }
      } else this.drawFire();
      ctx.restore();
    }
    draw() {
      ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;
      ctx.clearRect(0,0,960,540);
      if (this.mode === 'menu') { ctx.drawImage(images.spr_menu_background[0],0,0,960,540); return; }
      if (this.mode === 'meteor' || this.mode === 'aftermath') { this.drawCatastrophe(); return; }
      this.drawWorld();
      if (this.mode === 'battle') {
        ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(0,0,960,540);
        ellipse(300,415,65,12,'#160e20',.3);ellipse(705,305,60,11,'#160e20',.3);
        sprite('spr_battle_isleide',0,300,415,.4);
        sprite(this.battle.kind === 'cavern' ? 'spr_isleide_cavernas' : 'spr_battle_newton',0,705,305,this.battle.kind === 'cavern' ? .45 : .4);
      }
    }
  }

  let game;
  document.querySelectorAll('[data-menu]').forEach((button,index)=> {
    button.addEventListener('click',()=>game.menuAction(button.dataset.menu));
    button.addEventListener('pointerenter',()=>game.selectMenu(index));
  });
  $('next-dialogue').onclick=()=>game.advance();
  $('train').onclick=()=>game.chooseTutorial(false); $('skip').onclick=()=>game.chooseTutorial(true);
  document.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>game.action(button.dataset.action));
  $('answer-form').onsubmit=event=>{event.preventDefault();game.answer($('answer').value);};
  $('answer').oninput=()=>{$('answer').value=$('answer').value.replace(/\D/g,'').slice(0,5);};
  $('result-next').onclick=()=>game.finishBattle();
  $('pause-button').onclick=()=>game.openModal('pause');
  $('modal-close').onclick=()=>game.closeModal(); $('return-menu').onclick=()=>game.toMenu();
  $('ending-menu').onclick=()=>game.toMenu(); $('touch-interact').onclick=()=>game.advance();
  $('fullscreen').onclick=async()=>{
    try {if(document.fullscreenElement) await document.exitFullscreen();else await $('stage').requestFullscreen();}
    catch { $('fullscreen').textContent='USE F11 PARA TELA CHEIA'; }
  };
  for(const button of document.querySelectorAll('[data-key]')) {
    button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);keys.add(button.dataset.key);});
    for(const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type,()=>keys.delete(button.dataset.key));
  }
  window.addEventListener('keydown',event=>{
    if(!game || event.ctrlKey || event.metaKey || event.altKey) return;
    const k=event.key.toLowerCase();
    if(k==='escape') {event.preventDefault();if(event.repeat)return;game.paused?game.closeModal():game.openModal(game.mode==='menu'?'controls':'pause');return;}
    if(game.paused) return;
    if(event.target === $('answer')) return;
    if(['w','a','s','d','e',' ','enter','arrowup','arrowdown','arrowleft','arrowright','1','2','3','4'].includes(k)) event.preventDefault();
    keys.add(k);
    if(event.repeat) return;
    if(game.mode==='menu') {
      if(['w','arrowup'].includes(k)) game.selectMenu(game.menuIndex-1);
      if(['s','arrowdown'].includes(k)) game.selectMenu(game.menuIndex+1);
      if(['enter',' '].includes(k)) game.menuAction(['play','controls','exit'][game.menuIndex]);
    } else if(game.mode==='choice') {
      if(['a','arrowleft'].includes(k)) $('train').focus();
      if(['d','arrowright'].includes(k)) $('skip').focus();
      if(['enter',' ','e'].includes(k)) game.chooseTutorial(document.activeElement===$('skip'));
    } else if(game.mode==='battle' && ['1','2','3','4'].includes(k)) game.action(M.ACTIONS[Number(k)-1]);
    else if(['e',' ','enter'].includes(k)) game.advance();
  });
  window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur',()=>{keys.clear();if(game && game.mode!=='menu' && !game.paused)game.openModal('pause');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)keys.clear();});

  async function boot() {
    let loaded=0;
    const total=Object.values(D.sprites).reduce((n,s)=>n+s.frames.length,0);$('load-progress').max=total;
    await Promise.all(Object.entries(D.sprites).map(async([name,data])=> {
      images[name]=await Promise.all(data.frames.map(src=>new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>{loaded++;$('load-progress').value=loaded;resolve(img);};
        img.onerror=()=>reject(Error('Não foi possível carregar '+src));img.src=src;
      })));
    }));
    buildTiles();game=new Game();show('loading',false);focusStage();
    // Only expose state for automated local regression tests, never in normal play.
    if(new URLSearchParams(location.search).has('test'))window.__game=game;
    let last=performance.now();
    function tick(now) {
      const dt=Math.min((now-last)/1000,.05);last=now;game.update(dt);game.draw();requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  boot().catch(error=>{$('loading-text').textContent=error.message+' — mantenha a pasta assets junto dos arquivos HTML, CSS e JS.';console.error(error);});
})();
