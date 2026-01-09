import './style.css';
import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene';
import MainScene from './scenes/MainScene';
import BattleScene from './scenes/BattleScene';
import PachinkoScene from './scenes/PachinkoScene';
import SlotMachineScene from './scenes/SlotMachineScene';
import PineappleScene from './scenes/PineappleScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE, // 핵심: 화면 크기에 맞춰 캔버스 리사이즈
        parent: 'app',
        width: '100%',
        height: '100%',
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    backgroundColor: '#1a1a1a', // 레터박스 대신 이 색이 전체를 덮음
    pixelArt: true, // 도트 그래픽 느낌 원하면 true
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: [MenuScene, MainScene, BattleScene, PachinkoScene, SlotMachineScene, PineappleScene]
};

new Phaser.Game(config);