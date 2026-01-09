import Phaser from 'phaser';
import DataManager from '../managers/DataManager';

interface SlotData {
    onComplete: (result: { hpChanged: number, atkChanged: number }) => void;
}

// 상태 정의
const SlotState = {
    IDLE: 0,
    SPINNING_1: 1,
    SPINNING_2: 2,
    SPINNING_3: 3,
    RESULT: 4
} as const;

type SlotState = typeof SlotState[keyof typeof SlotState];


export default class SlotMachineScene extends Phaser.Scene {
    private slotData!: SlotData;
    private state: SlotState = SlotState.IDLE;
    
    // 심볼 정의 (이모지)
    private readonly SYMBOLS = ['7', '💎', '🍒', '💩', '7', '💎', '🍒', '💩']; 
    private readonly SYMBOL_HEIGHT = 100; 
    
    // 릴 관리
    private reels: Phaser.GameObjects.Container[] = [];
    private reelSpeeds: number[] = [0, 0, 0]; // 각 릴의 현재 회전 속도
    private resultIdxs: number[] = [0, 0, 0]; // 미리 정해진 결과 인덱스

    // UI
    private msgText!: Phaser.GameObjects.Text;
    private playBtn!: Phaser.GameObjects.Container;
    private btnText!: Phaser.GameObjects.Text;
    private btnBg!: Phaser.GameObjects.Rectangle;

    constructor() {
        super('SlotMachineScene');
    }

    init(data: SlotData) {
        this.slotData = data;
        this.state = SlotState.IDLE;
        this.reels = [];
        this.reelSpeeds = [0, 0, 0];
    }

    create() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // 1. 배경
        this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.85).setInteractive();
        const machineBg = this.add.rectangle(centerX, centerY, 320, 250, 0x220000).setStrokeStyle(6, 0xffd700);

        this.add.text(centerX, centerY - 160, '🎰 CONTROL SLOTS 🎰', {
            fontSize: '28px', color: '#ff4444', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.msgText = this.add.text(centerX, centerY + 160, '비용: HP 2', {
            fontSize: '24px', color: '#ffffff'
        }).setOrigin(0.5);

        // 2. 릴 생성 (마스크 적용)
        const maskShape = this.make.graphics({});
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(centerX - 135, centerY - 60, 270, 120);
        const mask = maskShape.createGeometryMask();

        this.add.rectangle(centerX, centerY, 270, 120, 0xffffff); // 흰 배경

        for (let i = 0; i < 3; i++) {
            const reelX = centerX - 90 + (i * 90);
            const reelContainer = this.add.container(reelX, centerY);
            
            // 3번 반복해서 긴 띠 만들기 (무한 스크롤용)
            // 중앙(0) 기준으로 위아래로 배치
            const strip = [...this.SYMBOLS, ...this.SYMBOLS, ...this.SYMBOLS];
            strip.forEach((sym, idx) => {
                // strip[0]이 맨 위, 내려갈수록 y 증가
                // 컨테이너가 내려가면(-y) 심볼이 올라감? 반대로 가자.
                // 슬롯은 보통 위에서 아래로 심볼이 떨어짐 -> 컨테이너 y 증가
                // 심볼 배치는 0, -100, -200... (위쪽으로 쌓음)
                const txt = this.add.text(0, idx * -this.SYMBOL_HEIGHT, sym, {
                    fontSize: '60px', color: '#000000'
                }).setOrigin(0.5);
                reelContainer.add(txt);
            });

            reelContainer.setMask(mask);
            this.reels.push(reelContainer);
        }

        // 3. 버튼 생성
        this.createPlayButton(centerX, centerY + 230);
    }

    private createPlayButton(x: number, y: number) {
        this.playBtn = this.add.container(x, y);
        
        this.btnBg = this.add.rectangle(0, 0, 150, 60, 0xffd700).setInteractive({ useHandCursor: true });
        this.btnText = this.add.text(0, 0, 'SPIN!', { fontSize: '28px', color: '#000', fontStyle: 'bold' }).setOrigin(0.5);
        
        this.playBtn.add([this.btnBg, this.btnText]);

        this.btnBg.on('pointerdown', () => this.handleInput());
    }

    // --- 핵심: 버튼 하나로 상태 관리 ---
    private handleInput() {
        switch (this.state) {
            case SlotState.IDLE:
                this.startSpin();
                break;
            case SlotState.SPINNING_1:
                this.stopReel(0); // 첫 번째 멈춤
                this.state = SlotState.SPINNING_2;
                this.accelerateReels([1, 2]); // 나머지 가속
                break;
            case SlotState.SPINNING_2:
                this.stopReel(1); // 두 번째 멈춤
                this.state = SlotState.SPINNING_3;
                this.accelerateReels([2]); // 마지막 초가속
                break;
            case SlotState.SPINNING_3:
                this.stopReel(2); // 마지막 멈춤
                this.state = SlotState.RESULT;
                this.btnBg.setFillStyle(0x555555); // 버튼 비활성
                this.btnText.setText('...');
                break;
        }
    }

    private startSpin() {
        const session = DataManager.getSession();
        const cost = 2;

        if (session.currentHp < cost) {
            this.msgText.setText("HP 부족! (최소 2 필요)");
            this.msgText.setColor('#ff0000');
            this.cameras.main.shake(200, 0.01);
            return;
        }

        // 비용 지불 & 결과 결정
        session.currentHp -= cost;
        this.msgText.setText("STOP을 눌러서 멈추세요!");
        
        // 결과 미리 결정
        this.resultIdxs = [
            Phaser.Math.Between(0, 3),
            Phaser.Math.Between(0, 3),
            Phaser.Math.Between(0, 3)
        ];

        // 회전 시작
        this.state = SlotState.SPINNING_1;
        this.reelSpeeds = [30, 30, 30]; // 기본 속도
        this.btnText.setText("STOP!");
        this.btnBg.setFillStyle(0xff4444); // 빨간색(긴급함)으로 변경
    }

    private stopReel(index: number) {
        // 해당 릴 속도 0으로 만들고, 목표 위치로 '스냅' 이동
        this.reelSpeeds[index] = 0;

        const targetIdx = this.resultIdxs[index];
        const reel = this.reels[index];
        
        // 현재 위치에서 가장 가까운 '정답 심볼' 위치 계산
        // 심볼 8개짜리 3세트 = 24개. 중앙 세트(index 8~15)를 타겟으로 잡으면 안전함
        // 타겟 심볼의 컨테이너 Y값 = CenterY + (심볼인덱스 * 높이)
        // 우리는 반복되는 패턴 중 현재 위치보다 아래에 있는 걸 찾아야 함
        
        const baseTargetY = this.scale.height / 2 + (targetIdx * this.SYMBOL_HEIGHT);
        
        // 현재 y보다 큰 값 중에서, baseTargetY와 위상이 같은(modula) 위치 찾기?
        // 간단하게: 그냥 트윈으로 '좀 더 돌다가' 해당 심볼에 멈추게 처리
        // 릴을 계속 내리고 있었으니(y 증가), 더 아래쪽 좌표로 보내야 함.
        
        // 현재 y값 기준으로 다음 타겟 y 계산
        // 한 바퀴(8개) 길이 = 800
        // 현재 y에서 offset을 구하고 보정
        
        // 꼼수: 그냥 현재 Y에서 1000px 정도 더한 곳에 있는 '해당 심볼' 위치로 이동
        // 정확한 수학 계산 대신 트윈의 힘을 빌립니다.
        
        // 1. 현재 컨테이너 내부 오프셋 계산 (0 ~ 2400)
        // 2. targetIdx에 해당하는 오프셋 찾기
        // 그냥 쿨하게, 무조건 화면 중앙에 'targetIdx' 심볼이 오도록 트윈
        
        // 시각적으로 끊기지 않게 하려면, 현재 reel.y를 기준으로
        // 앞으로 올 'targetIdx'를 계산해야 합니다.
        
        const rowHeight = this.SYMBOL_HEIGHT;
        const totalStripHeight = rowHeight * 8; // 1세트 높이
        
        // 목표: (reel.y % totalStripHeight) 가 (targetIdx * rowHeight) 가 되도록.
        // 하지만 이미지가 잘리지 않게 하려면 Tween으로 부드럽게 가야함.
        
        // 목표 Y 좌표 계산:
        // 현재 위치 + (최소 1바퀴 ~ 2바퀴) + 타겟 위치 보정
        const currentY = reel.y;
        const targetRelY = (targetIdx * rowHeight); // 0, 100, 200...
        
        // 현재 y를 800으로 나눈 나머지 등을 고려... 복잡하죠?
        // 더 쉬운 방법:
        // 무한 스크롤 중이니까, 그냥 y를 계속 늘리다가
        // y가 (targetRelY + CenterY)의 배수가 되는 지점에서 멈추면 됨.
        
        // 여기선 "Back.out" 효과를 위해 Tween을 씁니다.
        // 현재 위치에서 + 500px 정도 더 가서 멈추는데, 그 끝이 정답이어야 함.
        
        // 대략적인 목표치
        const destY = currentY + totalStripHeight; 
        // destY를 100단위로 맞추고 + targetIdx 보정
        // (이 부분은 완벽하게 맞추려면 복잡하니, 살짝 편법을 씁니다)
        
        // 1. 일단 멈춤 연출
        this.tweens.add({
            targets: reel,
            y: currentY + 300, // 관성으로 좀 더 밀림
            duration: 200,
            ease: 'Quad.out',
            onComplete: () => {
                // 2. 쓱 위치 보정 (플레이어는 눈치 못 챔)
                // 중앙에 와야 할 y값: CenterY + (targetIdx * 100)
                // 하지만 우리는 strip이 반복되므로, 적절한 세트 위치로 점프
                const finalY = (this.scale.height / 2) + (targetIdx * this.SYMBOL_HEIGHT) + (800); // 2번째 세트쯤?
                
                // 마스크 때문에 안 보일 때 몰래 바꿔치기 하거나
                // 그냥 여기서 3번째 세트 위치로 강제 이동 후 살짝 흔들어줌
                reel.y = finalY; 
                
                // 팅~ 하는 반동 효과
                this.tweens.add({
                    targets: reel,
                    y: finalY - 20,
                    yoyo: true,
                    duration: 100,
                    repeat: 1
                });

                // 마지막 릴이면 결과 체크
                if (index === 2) {
                    this.checkResult();
                }
            }
        });
    }

    private accelerateReels(indices: number[]) {
        indices.forEach(i => {
            this.reelSpeeds[i] += 20; // 속도 대폭 증가!
        });
    }

    // --- 무한 스크롤 루프 ---
    update() {
        if (this.state === SlotState.IDLE || this.state === SlotState.RESULT) return;

        const stripHeight = this.SYMBOL_HEIGHT * 8; // 8개 심볼 한 세트 높이
        const totalHeight = stripHeight * 3;
        
        for (let i = 0; i < 3; i++) {
            if (this.reelSpeeds[i] > 0) {
                const reel = this.reels[i];
                reel.y += this.reelSpeeds[i];

                // 일정 높이 넘어가면(너무 내려가면) 위로 되감기 (무한 스크롤)
                // 2번째 세트가 화면을 지나가면 다시 1번째 세트 위치로 복귀
                if (reel.y > (this.scale.height/2) + stripHeight) {
                    reel.y -= stripHeight;
                }
            }
        }
    }

    private checkResult() {
        const [r1, r2, r3] = this.resultIdxs;
        const s1 = this.SYMBOLS[r1];
        
        // (기존 결과 판정 로직 복사)
        let msg = "꽝! 다음 기회에...";
        let hpBonus = 0;
        let atkBonus = 0;

        if (r1 === r2 && r2 === r3) {
            if (s1 === '7') {
                msg = "🎰 JACKPOT! (All +) 🎰";
                hpBonus = 10; atkBonus = 2;
                this.cameras.main.shake(500, 0.02);
            } else if (s1 === '💎') {
                msg = "공격력 강화!";
                atkBonus = 2;
            } else if (s1 === '🍒') {
                msg = "HP 회복!";
                hpBonus = 5;
            } else if (s1 === '💩') {
                msg = "똥 밟음 (HP -1)";
                hpBonus = -1;
            }
        } else if (r1 === r2 || r2 === r3 || r1 === r3) {
             msg = "아깝다! (HP +1)";
             hpBonus = 1;
        }

        const session = DataManager.getSession();
        session.currentHp += hpBonus;
        session.currentAtk += atkBonus;

        this.msgText.setText(msg);
        this.msgText.setColor('#ffff00');

        this.time.delayedCall(2000, () => {
            if (this.slotData.onComplete) {
                this.slotData.onComplete({ hpChanged: hpBonus, atkChanged: atkBonus });
            }
            this.scene.stop();
        });
    }
}