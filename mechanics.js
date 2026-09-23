(function (root) {
  'use strict';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const integer = (min, max, rng = Math.random) => Math.floor(rng() * (max - min + 1)) + min;
  const ACTIONS = ['attack', 'heal', 'defense', 'dodge'];
  const LABELS = ['ATAQUE', 'CURA', 'DEFESA', 'ESQUIVA'];

  // Same ranges and progression as scripts/battle_system in the GameMaker source.
  function question(phase, rng = Math.random) {
    phase = clamp(Math.floor(phase), 1, 16);
    let x, y, operator, answer;
    if (phase <= 6) {
      x = integer(phase <= 3 ? 1 : 10, phase <= 3 ? 9 : 48, rng);
      y = integer(phase <= 3 ? 1 : 10, phase <= 3 ? 9 : 28, rng);
      operator = '+'; answer = x + y;
    } else if (phase <= 12) {
      x = integer(phase <= 9 ? 2 : 10, phase <= 9 ? 9 : 48, rng);
      y = phase <= 9 ? integer(1, x - 1, rng) : Math.floor(rng() * (x - 10)) + 10;
      operator = '−'; answer = x - y;
    } else {
      x = integer(phase <= 14 ? 1 : 10, phase <= 14 ? 9 : 98, rng);
      y = integer(phase <= 14 ? 1 : 10, phase <= 14 ? 9 : 98, rng);
      operator = '×'; answer = x * y;
    }
    return {x, y, operator, answer};
  }

  class Battle {
    constructor(kind = 'newton', rng = Math.random) {
      this.kind = kind; this.rng = rng; this.completedGuide = false;
      this.enemyName = kind === 'cavern' ? 'Isleide das Cavernas' : 'Isleide Newton';
      this.enemyMax = kind === 'cavern' ? 75 : 100;
      this.maxPhase = kind === 'cavern' ? 1 : 16;
      this.restart();
    }
    restart() {
      this.playerHp = 100; this.enemyHp = this.enemyMax;
      this.guided = this.kind === 'newton' && !this.completedGuide;
      this.step = this.completedGuide ? 4 : 0;
      this.phase = this.completedGuide ? 5 : 1;
      this.screen = 'actions'; this.pending = null; this.challenge = null;
      this.message = this.guided ? 'Newton: primeiro, escolha ATAQUE e resolva a conta.' : 'Escolha uma ação e resolva o cálculo para realizá-la.';
    }
    request(action) {
      if (this.screen !== 'actions' || !ACTIONS.includes(action)) return false;
      if (this.guided && action !== ACTIONS[this.step]) {
        this.message = `Tutorial: agora escolha ${LABELS[this.step]}.`; return false;
      }
      this.pending = action; this.challenge = question(this.phase, this.rng);
      this.screen = 'challenge'; return true;
    }
    enemyAttack(defending = false, dodging = false) {
      let damage = integer(this.guided ? 4 : 8, this.guided ? 8 : 18, this.rng);
      let critical = !this.guided && this.rng() < 0.15;
      if (critical) damage *= 2;
      if (defending) damage = Math.floor(damage / 2);
      if (dodging && this.rng() < 0.5) damage = 0;
      this.playerHp = clamp(this.playerHp - damage, 0, 100);
      if (dodging && !damage) return 'Você esquivou do ataque inimigo.';
      if (dodging) return `A esquiva falhou. Você recebeu ${damage} de dano.`;
      if (defending) return `Dano reduzido: você recebeu ${damage} de dano.`;
      return `O inimigo ${critical ? 'acertou um crítico' : 'atacou'}: ${damage} de dano.`;
    }
    submit(value) {
      if (this.screen !== 'challenge' || !/^\d{1,5}$/.test(String(value))) return null;
      const correct = Number(value) === this.challenge.answer;
      const action = this.pending;
      this.pending = null; this.screen = 'actions';
      if (!correct) this.message = 'Você errou a conta. ' + this.enemyAttack();
      else {
        this.phase = Math.min(this.maxPhase, this.phase + 1);
        if (action === 'attack') {
          let damage = integer(12, 22, this.rng);
          const critical = this.rng() < 0.20;
          if (critical) damage *= 2;
          this.enemyHp = clamp(this.enemyHp - damage, 0, this.enemyMax);
          this.message = `Você ${critical ? 'acertou um crítico' : 'atacou'}: ${damage} de dano. `;
          if (this.enemyHp > 0) this.message += this.enemyAttack();
        } else if (action === 'heal') {
          const before = this.playerHp;
          this.playerHp = Math.min(100, before + 20);
          this.message = `Você curou ${this.playerHp - before} de vida. ` + this.enemyAttack();
        } else this.message = this.enemyAttack(action === 'defense', action === 'dodge');
        if (this.guided && this.playerHp > 0) {
          this.step++;
          if (this.step >= 4) {
            this.guided = false; this.completedGuide = true;
            this.message = 'Treinamento concluído! Agora use livremente as quatro ações e derrote Newton.';
          }
        }
      }
      if (this.playerHp <= 0) this.screen = 'defeat';
      else if (this.enemyHp <= 0) this.screen = 'victory';
      return correct;
    }
  }

  // Feet-only mask, identical to the GameMaker player's fixed collision mask.
  function blocked(x, y, colliders) {
    return colliders.some(([rx, ry, w, h]) => x + 6 >= rx && x - 7 <= rx + w - 1 && y + 7 >= ry && y - 1 <= ry + h - 1);
  }
  function move(player, dx, dy, colliders) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    for (let i = 0; i < steps; i++) {
      if (!blocked(player.x + dx / steps, player.y, colliders)) player.x += dx / steps;
      if (!blocked(player.x, player.y + dy / steps, colliders)) player.y += dy / steps;
    }
  }
  function expandTiles(compressed) {
    const tiles = [];
    for (let i = 0; i < compressed.length;) {
      const count = compressed[i++];
      if (count < 0) { const value = compressed[i++]; for (let j = 0; j < -count; j++) tiles.push(value); }
      else for (let j = 0; j < count; j++) tiles.push(compressed[i++]);
    }
    return tiles;
  }
  const api = {Battle, ACTIONS, LABELS, question, clamp, integer, blocked, move, expandTiles};
  if (typeof module !== 'undefined') module.exports = api;
  else root.Mechanics = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
