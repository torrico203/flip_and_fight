import Phaser from 'phaser';
import DataManager from '../managers/DataManager';

interface PineappleData {
    onComplete: (result: { hpChanged: number, atkChanged: number }) => void;
}

interface Slot {
    x: number;
    y: number;
    isBomb: boolean;
    isRevealed: boolean;
    rewardValue: number;
}

export default class PineappleScene extends Phaser.Scene {
    private pineappleData!: PineappleData;
    
    private slots: Slot[] = [];
    private currentRound: number = 1;
    private maxRounds: number = 5;
    
    private selectorIndex: number = 0;
    private isSpinning: boolean = false;
    private spinTimer: Phaser.Time.TimerEvent | null = null;
    private spinSpeed: number = 100;

    private accumulatedHp: number = 0;
    private accumulatedAtk: number = 0;

    private selector!: Phaser.GameObjects.Arc;
    private slotGraphics: Phaser.GameObjects.Container[] = [];
    private msgText!: Phaser.GameObjects.Text;
    private rewardText!: Phaser.GameObjects.Text;
    
    private stopBtn!: Phaser.GameObjects.Container;
    private decisionBtns!: Phaser.GameObjects.Container;

    constructor() {
        super('PineappleScene');
    }

    init(data: PineappleData) {
        this.pineappleData = data;
        this.currentRound = 1;
        this.accumulatedHp = 0;
        this.accumulatedAtk = 0;
        this.isSpinning = false;
        this.slots = [];
        this.slotGraphics = [];
    }

    create() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.9).setInteractive();
        
        this.add.text(centerX, centerY - 250, '🍍 PINEAPPLE BOMB 🍍', {
            fontSize: '32px', color: '#ffff00', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.rewardText = this.add.text(centerX, centerY - 200, '누적 보상: 없음', {
            fontSize: '20px', color: '#aaa'
        }).setOrigin(0.5);

        this.msgText = this.add.text(centerX, centerY + 200, 'Round 1\n(폭탄 0개 / 안전 5개)', {
            fontSize: '24px', color: '#ffffff', align: 'center'
        }).setOrigin(0.5);

        // 슬롯 배치
        const radius = 120;
        for (let i = 0; i < 5; i++) {
            const angle = Phaser.Math.DegToRad(-90 + (i * 72));
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            this.slots.push({
                x, y,
                isBomb: false, 
                isRevealed: false,
                rewardValue: 1 
            });

            const container = this.add.container(x, y);
            const bg = this.add.circle(0, 0, 40, 0x333333).setStrokeStyle(2, 0x888888);
            const content = this.add.text(0, 0, '?', { fontSize: '32px' }).setOrigin(0.5);
            
            container.add([bg, content]);
            this.slotGraphics.push(container);
        }

        this.selector = this.add.circle(this.slots[0].x, this.slots[0].y, 45).setStrokeStyle(4, 0xffffff);
        this.selector.setVisible(false);

        this.createButtons(centerX, centerY + 280);
        this.time.delayedCall(500, () => this.startRound());
    }

    private createButtons(x: number, y: number) {
        this.stopBtn = this.createButton(x, y, 'STOP!', 0xff4444, () => this.stopSpin());
        this.stopBtn.setVisible(false);

        this.decisionBtns = this.add.container(x, y);
        const btnNext = this.createButton(60, 0, 'GO NEXT', 0x4facfe, () => this.nextRound());
        const btnQuit = this.createButton(-60, 0, 'CASH OUT', 0x00ff00, () => this.cashOut());
        
        // @ts-ignore
        btnNext.list[0].width = 110; 
        // @ts-ignore
        btnQuit.list[0].width = 110;

        this.decisionBtns.add([btnNext, btnQuit]);
        this.decisionBtns.setVisible(false);
    }

    private createButton(x: number, y: number, label: string, color: number, callback: () => void) {
        const container = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 100, 50, color).setInteractive({ useHandCursor: true });
        const text = this.add.text(0, 0, label, { fontSize: '16px', fontStyle: 'bold', color: '#000' }).setOrigin(0.5);
        container.add([bg, text]);
        bg.on('pointerdown', callback);
        return container;
    }

    private startRound() {
        const bombCount = this.slots.filter(s => s.isBomb).length;
        this.msgText.setText(`Round ${this.currentRound}/${this.maxRounds}\n(폭탄 ${bombCount}개 / 안전 ${5 - bombCount}개)`);
        
        this.isSpinning = true;
        this.selector.setVisible(true);
        this.selector.setStrokeStyle(4, 0xffffff);
        this.stopBtn.setVisible(true);
        this.decisionBtns.setVisible(false);

        // 라운드가 갈수록 빨라짐
        this.spinSpeed = Math.max(40, 120 - (this.currentRound * 15));

        this.spinTimer = this.time.addEvent({
            delay: this.spinSpeed,
            callback: this.tickSpin,
            callbackScope: this,
            loop: true
        });
    }

    private tickSpin() {
        this.selectorIndex = (this.selectorIndex + 1) % 5;
        const targetSlot = this.slots[this.selectorIndex];
        this.selector.setPosition(targetSlot.x, targetSlot.y);
    }

    private stopSpin() {
        if (!this.isSpinning) return;
        this.isSpinning = false;
        if (this.spinTimer) this.spinTimer.remove();

        this.stopBtn.setVisible(false);
        this.selector.setStrokeStyle(6, 0xff0000);

        this.time.delayedCall(500, () => {
            this.checkResult(this.selectorIndex);
        });
    }

    private checkResult(index: number) {
        const slot = this.slots[index];
        const graphics = this.slotGraphics[index];
        const contentText = graphics.list[1] as Phaser.GameObjects.Text;

        // [수정] 이미 폭탄인 곳을 밟았을 때
        if (slot.isBomb) {
            this.cameras.main.shake(500, 0.05);
            this.msgText.setText("펑!! 파인애플 폭탄이 터졌습니다.\n모든 보상이 사라집니다.");
            this.msgText.setColor('#ff0000');
            this.time.delayedCall(2000, () => this.finishGame(false));
        } else {
            // 성공! (아직 폭탄 아님)
            const roundRewards = [
                { hp: 0, atk: 1 }, 
                { hp: 2, atk: 0 }, 
                { hp: 0, atk: 2 }, 
                { hp: 5, atk: 1 }, 
                { hp: 10, atk: 3 }
            ];
            const reward = roundRewards[this.currentRound - 1];

            this.accumulatedHp += reward.hp;
            this.accumulatedAtk += reward.atk;

            // [연출] 일단 '보석'을 보여줘서 성공했음을 알림
            contentText.setText('💎'); 
            this.rewardText.setText(`누적 보상: HP+${this.accumulatedHp} / ATK+${this.accumulatedAtk}`);
            this.rewardText.setColor('#00ff00');
            
            // [중요] 데이터상으로는 이제 폭탄이 됨
            slot.isBomb = true;

            if (this.currentRound >= this.maxRounds) {
                this.cashOut();
                return;
            }

            this.msgText.setText("성공! 계속하시겠습니까?");
            this.decisionBtns.setVisible(true);
        }
    }

    private nextRound() {
        this.currentRound++;
        
        const prevIndex = this.selectorIndex;
        const graphics = this.slotGraphics[prevIndex];
        const contentText = graphics.list[1] as Phaser.GameObjects.Text;
        
        contentText.setText('🍍'); // "이제 여긴 밟으면 죽는 땅이야"
        
        // 바로 다음 라운드 시작
        this.startRound();
    }

    private cashOut() {
        this.finishGame(true);
    }

    private finishGame(isSuccess: boolean) {
        if (isSuccess) {
            const session = DataManager.getSession();
            session.currentHp += this.accumulatedHp;
            session.currentAtk += this.accumulatedAtk;
            this.msgText.setText(`보상 획득 완료!\nHP+${this.accumulatedHp}, ATK+${this.accumulatedAtk}`);
        } else {
            this.accumulatedHp = 0;
            this.accumulatedAtk = 0;
        }

        this.time.delayedCall(2000, () => {
            if (this.pineappleData.onComplete) {
                this.pineappleData.onComplete({
                    hpChanged: this.accumulatedHp,
                    atkChanged: this.accumulatedAtk
                });
            }
            this.scene.stop();
        });
    }
}