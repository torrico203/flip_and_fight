import Phaser from 'phaser';
import DataManager from '../managers/DataManager';

// 결과 데이터도 골드만 넘겨주도록 변경
interface HammerData {
    onComplete: (result: { goldEarned: number }) => void;
}

interface TargetBlock {
    y: number;
    id: number;
    isHit: boolean;
    rect: Phaser.GameObjects.Rectangle;
    zone: Phaser.GameObjects.Rectangle;
}

export default class HammerScene extends Phaser.Scene {
    private hammerData!: HammerData;
    
    // 게임 설정
    private towerHeight = 500;
    private towerBaseY = 0;
    private targetCount = 5;
    
    // 객체
    private targets: TargetBlock[] = [];
    private hammer!: Phaser.GameObjects.Container;
    private hammerVisual!: Phaser.GameObjects.Rectangle;
    
    private isPlaying: boolean = false;
    private tween: Phaser.Tweens.Tween | null = null;

    // [변경] 오직 골드만 쌓입니다!
    private accumulatedGold: number = 0;

    // UI
    private msgText!: Phaser.GameObjects.Text;
    private rewardText!: Phaser.GameObjects.Text;
    private startBtn!: Phaser.GameObjects.Text;

    constructor() {
        super('HammerScene');
    }

    init(data: HammerData) {
        this.hammerData = data;
        this.accumulatedGold = 0; // 초기화
        this.targets = [];
        this.isPlaying = false;
    }

    create() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        
        this.towerHeight = height * 0.7;
        this.towerBaseY = centerY + (this.towerHeight / 2);

        // 1. 배경
        this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.9).setInteractive();

        // 타이틀
        this.add.text(centerX, centerY - (height/2) + 40, '🔨 GOLD RUSH 🔨', { // 이름 변경
            fontSize: '28px', color: '#ffd700', fontStyle: 'bold' // 금색
        }).setOrigin(0.5);

        this.rewardText = this.add.text(centerX, centerY - (height/2) + 80, '획득 골드: 0 G', {
            fontSize: '20px', color: '#fff'
        }).setOrigin(0.5);

        this.msgText = this.add.text(centerX, centerY + (height/2) - 50, '타이밍 맞춰서 골드를 캐세요!', {
            fontSize: '16px', color: '#aaa'
        }).setOrigin(0.5);

        // 2. 타워 & 망치 생성
        this.createTower(centerX);
        this.createHammer(centerX);

        // 3. 시작 버튼
        this.startBtn = this.add.text(centerX, centerY, 'TAP TO START', {
            fontSize: '32px', color: '#00ff00', backgroundColor: '#000', padding: { x: 10, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.startGame());

        this.input.on('pointerdown', () => this.handleInput());
    }

    private createTower(x: number) {
        const blockHeight = 40;
        const maxSlots = Math.floor(this.towerHeight / blockHeight);
        
        this.targetCount = Phaser.Math.Between(5, 8);
        
        const slots: number[] = [];
        while(slots.length < this.targetCount) {
            const r = Phaser.Math.Between(1, maxSlots - 2);
            if (!slots.includes(r)) slots.push(r);
        }
        slots.sort((a, b) => a - b);

        this.add.rectangle(x, this.towerBaseY - (this.towerHeight/2), 60, this.towerHeight, 0x333333);

        slots.forEach((slotIdx, i) => {
            const y = this.towerBaseY - (slotIdx * blockHeight);
            
            // 타겟 블록 (금광석 느낌)
            const rect = this.add.rectangle(x, y, 60, blockHeight - 2, 0x665533);
            const zone = this.add.rectangle(x, y, 50, 8, 0xffd700); // 금색 약점
            
            this.targets.push({
                y: y, id: i, isHit: false, rect: rect, zone: zone
            });
        });
    }

    private createHammer(x: number) {
        this.hammer = this.add.container(x + 50, this.towerBaseY);
        this.hammerVisual = this.add.rectangle(0, 0, 40, 20, 0xaaaaaa).setStrokeStyle(2, 0xffffff); // 은색 망치
        const handle = this.add.rectangle(20, 0, 40, 6, 0x553300);
        this.hammer.add([handle, this.hammerVisual]);
    }

    private startGame() {
        if (this.isPlaying) return;
        this.startBtn.setVisible(false);
        this.isPlaying = true;
        this.msgText.setText("HIT IT!");

        const topY = this.towerBaseY - this.towerHeight;

        this.tween = this.tweens.add({
            targets: this.hammer,
            y: topY,
            duration: 1500,
            yoyo: true,
            ease: 'Quad.easeInOut',
            onComplete: () => this.finishGame()
        });
    }

    private handleInput() {
        if (!this.isPlaying) return;

        const hammerY = this.hammer.y;
        let closestDist = 9999;
        let targetIndex = -1;

        this.targets.forEach((t, i) => {
            if (t.isHit) return;
            const dist = Math.abs(hammerY - t.y);
            if (dist < closestDist) {
                closestDist = dist;
                targetIndex = i;
            }
        });

        // 판정 로직
        if (targetIndex !== -1 && closestDist <= 25) {
            const target = this.targets[targetIndex];
            target.isHit = true;
            this.evaluateHit(target, closestDist);
        } else {
            this.showFeedback(this.hammer.x, this.hammer.y, "MISS", 0x888888);
        }

        this.tweens.add({
            targets: this.hammerVisual,
            x: -10, duration: 50, yoyo: true
        });
    }

    private evaluateHit(target: TargetBlock, dist: number) {
        let label = "";
        let color = 0xffffff;
        let goldGain = 0; // [변경] 골드 보상

        if (dist <= 8) {
            // PERFECT: 50골드
            label = "PERFECT! (+50G)";
            color = 0xffd700;
            goldGain = 50;
            
            this.createExplosion(target.rect.x, target.rect.y);
            this.cameras.main.shake(100, 0.02);

        } else if (dist <= 20) {
            // GOOD: 10골드
            label = "GOOD (+10G)";
            color = 0x00ff00;
            goldGain = 10;
            
            this.cameras.main.shake(50, 0.005);
        } else {
            label = "BAD (0G)";
            color = 0xaaaaaa;
            goldGain = 0;
        }

        // [변경] 골드 누적
        this.accumulatedGold += goldGain;
        this.rewardText.setText(`획득 골드: ${this.accumulatedGold} G`);

        target.zone.setVisible(false);
        target.rect.setFillStyle(0x222222);
        
        this.showFeedback(target.rect.x + 100, target.rect.y, label, color);
    }

    private showFeedback(x: number, y: number, text: string, color: number) {
        const popup = this.add.text(x, y, text, {
            fontSize: '20px', fontStyle: 'bold', color: '#fff'
        }).setOrigin(0.5).setTint(color);

        this.tweens.add({
            targets: popup, y: y - 50, alpha: 0, duration: 800,
            onComplete: () => popup.destroy()
        });
    }

    private createExplosion(x: number, y: number) {
        for (let i = 0; i < 8; i++) {
            const p = this.add.rectangle(x, y, 8, 8, 0xffd700); // 금가루가 튐
            const angle = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
            const speed = Phaser.Math.Between(50, 100);
            this.physics.add.existing(p);
            const body = p.body as Phaser.Physics.Arcade.Body;
            body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            this.tweens.add({
                targets: p, alpha: 0, scale: 0, duration: 600,
                onComplete: () => p.destroy()
            });
        }
    }

    private finishGame() {
        this.isPlaying = false;
        
        const msg = this.accumulatedGold > 0 ? `💰 ${this.accumulatedGold}G 획득!` : "빈손...";
        this.msgText.setText(msg);
        this.msgText.setColor('#ffd700');
        
        this.time.delayedCall(2000, () => {
            if (this.hammerData.onComplete) {
                // [중요] 골드만 전달
                this.hammerData.onComplete({
                    goldEarned: this.accumulatedGold
                });
            }
            this.scene.stop();
        });
    }
}