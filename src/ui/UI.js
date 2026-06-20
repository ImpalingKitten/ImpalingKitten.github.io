export class UI {
  constructor(root) {
    this.root = root;
    this.game = null;
    this.root.innerHTML = `
      <canvas id="gameCanvas"></canvas>
      <div class="vignette"></div>
      <div id="damageFlash"></div>
      <div class="hud hidden">
        <div class="topline">
          <div class="objective">
            <span id="levelName">OBSERVER</span>
            <small id="lesson">Reality only exists when observed.</small>
          </div>
          <div class="pills">
            <span id="levelCount">1/8</span>
            <span id="observedCount">0 observed</span>
            <span>R reset</span>
          </div>
        </div>
        <div class="reticle"></div>
        <div id="story" class="story"></div>
        <div id="warning" class="warning"></div>
      </div>
      <div id="menu" class="menu">
        <div class="titleBlock">
          <p class="eyebrow">First-person puzzle platformer</p>
          <h1>OBSERVER</h1>
          <p class="subtitle">Reality only exists when observed.</p>
        </div>
        <div class="menuActions">
          <button id="newGame">New Game</button>
          <button id="continueGame">Continue</button>
          <button id="levelSelect">Level Select</button>
          <button id="settings">Settings</button>
        </div>
        <div id="levelPanel" class="panel hidden"></div>
        <div id="settingsPanel" class="panel hidden">
          <label>Audio <input id="volume" type="range" min="0" max="0.6" step="0.02" value="0.22"></label>
          <label>Mouse Sensitivity <input id="sensitivity" type="range" min="0.4" max="1.8" step="0.1" value="1"></label>
        </div>
      </div>
      <div id="pause" class="menu compact hidden">
        <h2>Paused</h2>
        <button id="resume">Resume</button>
        <button id="saveQuit">Save and Exit</button>
      </div>
      <div id="ending" class="ending hidden"></div>
    `;
    this.canvas = this.root.querySelector('#gameCanvas');
    this.menu = this.root.querySelector('#menu');
    this.pause = this.root.querySelector('#pause');
    this.hud = this.root.querySelector('.hud');
    this.ending = this.root.querySelector('#ending');
    this.storyLine = this.root.querySelector('#story');
    this.warningLine = this.root.querySelector('#warning');
    this.damageFlash = this.root.querySelector('#damageFlash');
    this.buildLevelPanel();
    this.bindBaseEvents();
  }

  bindGame(game) {
    this.game = game;
    this.root.querySelector('#continueGame').disabled = !game.saveSystem.hasSave();
  }

  bindBaseEvents() {
    this.root.querySelector('#newGame').addEventListener('click', () => this.game?.start(false));
    this.root.querySelector('#continueGame').addEventListener('click', () => this.game?.start(true));
    this.root.querySelector('#resume').addEventListener('click', () => this.game?.resume());
    this.root.querySelector('#saveQuit').addEventListener('click', () => this.game?.saveAndQuit());
    this.root.querySelector('#settings').addEventListener('click', () => this.togglePanel('settingsPanel'));
    this.root.querySelector('#levelSelect').addEventListener('click', () => this.togglePanel('levelPanel'));
    this.root.querySelector('#volume').addEventListener('input', (event) => this.game?.audio?.setVolume(Number(event.target.value)));
    this.root.querySelector('#sensitivity').addEventListener('input', (event) => {
      if (this.game?.player) this.game.player.controls.pointerSpeed = Number(event.target.value);
    });
  }

  buildLevelPanel() {
    const panel = this.root.querySelector('#levelPanel');
    panel.innerHTML = Array.from({ length: 8 }, (_, index) => `<button data-level="${index}">${index + 1}</button>`).join('');
    panel.addEventListener('click', (event) => {
      const button = event.target.closest('[data-level]');
      if (button) this.game?.levelSelect(Number(button.dataset.level));
    });
  }

  togglePanel(id) {
    for (const panel of this.root.querySelectorAll('.panel')) {
      panel.classList.toggle('hidden', panel.id !== id || !panel.classList.contains('hidden'));
    }
  }

  showMainMenu() {
    this.menu.classList.remove('hidden');
    this.pause.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.ending.classList.add('hidden');
    this.root.querySelector('#continueGame').disabled = !this.game?.saveSystem.hasSave();
  }

  showHud() {
    this.menu.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.ending.classList.add('hidden');
  }

  showPause() {
    this.pause.classList.remove('hidden');
  }

  hidePause() {
    this.pause.classList.add('hidden');
  }

  setLevel(index, total, title, lesson) {
    this.root.querySelector('#levelName').textContent = `${String(index + 1).padStart(2, '0')} ${title}`;
    this.root.querySelector('#lesson').textContent = lesson;
    this.root.querySelector('#levelCount').textContent = `${index + 1}/${total}`;
  }

  setVitals(observed, total) {
    this.root.querySelector('#observedCount').textContent = `${observed}/${total} observed`;
  }

  story(text) {
    this.storyLine.textContent = text;
    clearTimeout(this.storyTimer);
    this.storyTimer = setTimeout(() => (this.storyLine.textContent = ''), 7600);
  }

  warn(text) {
    this.warningLine.textContent = text;
    clearTimeout(this.warningTimer);
    this.warningTimer = setTimeout(() => (this.warningLine.textContent = ''), 3600);
  }

  setDamage(value) {
    this.damageFlash.style.opacity = String(Math.max(0, value * 0.45));
  }

  victory() {
    this.ending.className = 'ending';
    this.ending.innerHTML = `
      <h2>You were never trapped.</h2>
      <p>You were the observer.</p>
      <p class="credits">All geometry, audio, levels, enemies, projectiles, shaders, and observation rules were generated procedurally in Three.js.</p>
      <button id="again">Observe Again</button>
    `;
    this.ending.querySelector('#again').addEventListener('click', () => this.game.start(false));
  }
}
