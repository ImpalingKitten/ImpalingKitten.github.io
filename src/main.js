import { Game } from './game/Game.js';
import { UI } from './ui/UI.js';
import './ui/styles.css';

const root = document.querySelector('#app');
const ui = new UI(root);
const game = new Game(root, ui);

ui.bindGame(game);
ui.showMainMenu();
