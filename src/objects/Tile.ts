import Phaser from 'phaser';

export default class Tile extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.Rectangle;
    private text: Phaser.GameObjects.Text;
    public isRevealed: boolean = false;
    
    // 타일 내용물 (Monster, Item 등)
    public tileType: string; 

    constructor(scene: Phaser.Scene, x: number, y: number, type: string) {
        super(scene, x, y);
        this.tileType = type;

        // 1. 타일 배경 (뒷면: 짙은 회색)
        this.bg = scene.add.rectangle(0, 0, 80, 80, 0x333333)
            .setStrokeStyle(2, 0x555555);
        
        // 2. 텍스트 (초기엔 ?)
        this.text = scene.add.text(0, 0, '?', { 
            fontSize: '32px', color: '#888' 
        }).setOrigin(0.5);

        // 컨테이너에 담기
        this.add([this.bg, this.text]);

        // 사이즈 설정 (인터랙션용)
        this.setSize(80, 80);
        this.setInteractive();
    }

    // 핵심: 뒤집기 연출 함수
    public flip(silent: boolean = false) {
        if (this.isRevealed) return;
        this.isRevealed = true;

        if (silent) {
            this.updateContent();
            return;
        }

        // Phaser의 Tween 기능으로 찌그러졌다 펴지기 (Flip 효과)
        this.scene.tweens.add({
            targets: this,
            scaleX: 0,       // 가로로 납작하게
            duration: 150,
            onComplete: () => {
                if (!this.scene || !this.active) {
                    return;
                }
                // 납작해졌을 때 내용물 변경
                this.updateContent();

                if(!this.scene) return;
                
                // 다시 펴기
                this.scene.tweens.add({
                    targets: this,
                    scaleX: 1,
                    duration: 150
                });
            }
        });
    }

    private updateContent() {
        // [신규] 방어 코드: 씬이 없거나, 텍스트 객체가 죽었으면 중단
        if (!this.scene || !this.text || !this.text.scene) {
            return;
        }
        // 타입에 따라 색상과 텍스트 변경
        switch (this.tileType) {
            case 'M': // 몬스터
                this.bg.setFillStyle(0xff4444); // 빨강
                this.text.setText('👾');
                break;
            case 'I': // 아이템
                this.bg.setFillStyle(0x44ff44); // 초록
                this.text.setText('⚔️');
                break;
            case 'T': // 함정
                this.bg.setFillStyle(0xffaa00); // 주황
                this.text.setText('🔥');
                break;
            case 'EVT':
                this.bg.setFillStyle(0x4444ff); // 파랑
                this.text.setText('❓');
                break;
            case 'G': // 골드
                this.bg.setFillStyle(0xffff44); // 노랑
                this.text.setText('💰');
                break;
            case 'H': // 힐링
                this.bg.setFillStyle(0x44ffff); // 민트
                this.text.setText('❤️');
                break;
            case 'SHOP_G': // 상점 골드
                this.bg.setFillStyle(0xff44ff); // 핑크
                this.text.setText('🏪');
                break;
            case 'SHOP_D': // 상점 악마
                this.bg.setFillStyle(0x8844ff); // 보라
                this.text.setText('😈');
                break;
            default:  // 꽝/빈땅
                this.bg.setFillStyle(0x666666);
                this.text.setText('');
                break;
        }
    }
}