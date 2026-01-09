import Phaser from 'phaser';
import DataManager from '../managers/DataManager';

interface PachinkoData {
    onComplete: (result: { hpChanged: number, atkChanged: number }) => void;
}

export default class PachinkoScene extends Phaser.Scene {
    private pachinkoData!: PachinkoData;
    private ball?: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
    private pins?: Phaser.Physics.Arcade.StaticGroup;
    private isPlaying: boolean = false;

    // UI 요소
    private msgText!: Phaser.GameObjects.Text;
    private hpText!: Phaser.GameObjects.Text;

    private walls?: Phaser.Physics.Arcade.StaticGroup;

    constructor() {
        super('PachinkoScene');
    }

    init(data: PachinkoData) {
        this.pachinkoData = data;
        this.isPlaying = false;
    }

    create() {
        const { width, height } = this.scale;

        // 1. 배경 (팝업 스타일)
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8).setInteractive();
        const bg = this.add.rectangle(width / 2, height / 2, 350, 500, 0x222222).setStrokeStyle(4, 0xffd700);

        // 2. 타이틀 & 설명
        this.add.text(width / 2, height / 2 - 220, '🎰 HP PACHINKO 🎰', {
            fontSize: '28px', color: '#ffd700', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.hpText = this.add.text(width / 2, height / 2 - 180, `현재 HP: ${DataManager.getSession().currentHp}`, {
            fontSize: '20px', color: '#fff'
        }).setOrigin(0.5);

        this.msgText = this.add.text(width / 2, height / 2 + 150, '도전 단계를 선택하세요!', {
            fontSize: '18px', color: '#aaa'
        }).setOrigin(0.5);

        // [신규] 1. 양쪽 벽(가이드) 세우기
        this.walls = this.physics.add.staticGroup();

        const wallColor = 0x555555;
        const wallAlpha = 0.5; // 반투명
        const wallThick = 20;  // 벽 두께

        // 왼쪽 벽 (막대기)
        const leftWallX = (width / 2) - 140; 
        const leftWall = this.add.rectangle(leftWallX, height/2, wallThick, 400, wallColor, wallAlpha);
        this.walls.add(leftWall as any); // 물리 그룹 추가

        // 오른쪽 벽
        const rightWallX = (width / 2) + 140;
        const rightWall = this.add.rectangle(rightWallX, height/2, wallThick, 400, wallColor, wallAlpha);
        this.walls.add(rightWall as any);

        // 3. 핀(Pins) 배치 (삼각형 모양)
        this.pins = this.physics.add.staticGroup();
        const startY = height / 2 - 120;
        const rows = 6;
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c <= r; c++) {
                // 피라미드 형태 좌표 계산
                const x = (width / 2) - (r * 20) + (c * 40); 
                const y = startY + (r * 40);
                
                const pin = this.add.circle(x, y, 5, 0xffffff);
                this.pins.add(pin as any); // 물리 그룹에 추가

                const body = pin.body as Phaser.Physics.Arcade.StaticBody;
                if (body) {
                    body.setCircle(6); // 반지름 6
                    body.updateFromGameObject(); // 위치 동기화
                }
            }
        }

        // 4. 하단 슬롯 (보상 구간) 표시
        // [ 꽝 ] [ ATK+1 ] [ HP+5 ] [ ATK+1 ] [ 꽝 ]
        const slotY = startY + (rows * 40) + 20;
        const slots = ['💣', '⚔️', '💖', '⚔️', '💣'];
        slots.forEach((icon, idx) => {
            const x = (width / 2) - 80 + (idx * 40);
            this.add.text(x, slotY, icon, { fontSize: '24px' }).setOrigin(0.5);
            // 시각적 구분을 위한 선
            this.add.rectangle(x, slotY, 38, 40).setStrokeStyle(1, 0x555555);
        });

        // 5. 베팅 버튼 생성
        this.createBetButton(width / 2 - 100, height / 2 + 200, 'Low\n(10%)', 0.1);
        this.createBetButton(width / 2,       height / 2 + 200, 'Mid\n(30%)', 0.3);
        this.createBetButton(width / 2 + 100, height / 2 + 200, 'High\n(50%)', 0.5);
    }

    private createBetButton(x: number, y: number, label: string, riskRatio: number) {
        const btn = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 80, 60, 0x444444).setInteractive({ useHandCursor: true });
        const text = this.add.text(0, 0, label, { fontSize: '14px', align: 'center' }).setOrigin(0.5);
        
        btn.add([bg, text]);

        bg.on('pointerdown', () => this.startGame(riskRatio));
        
        // 호버 효과
        bg.on('pointerover', () => bg.setFillStyle(0x666666));
        bg.on('pointerout', () => bg.setFillStyle(0x444444));
    }

    private startGame(riskRatio: number) {
        if (this.isPlaying) return;

        const session = DataManager.getSession();
        
        // 1. 진입 조건 체크
        if (session.currentHp < 2) {
            this.msgText.setText("HP가 부족합니다! (최소 2)");
            this.msgText.setColor('#ff0000');
            return;
        }

        // 2. 비용 지불 (HP 차감)
        const cost = Math.ceil(session.currentHp * riskRatio);
        session.currentHp -= cost;
        this.hpText.setText(`현재 HP: ${session.currentHp} (-${cost})`);
        this.msgText.setText("공이 떨어집니다...!");
        
        this.isPlaying = true;

        // 3. 공 생성 (화면 상단)
        const randomX = Phaser.Math.Between(-80, 80); 
        this.ball = this.physics.add.image(this.scale.width / 2 + randomX, this.scale.height / 2 - 180, 'ball') as any;
        // 이미지가 없으면 원으로 대체 (Texture 생성)
        if (!this.textures.exists('ball')) {
            const graphics = this.make.graphics({ x: 0, y: 0 });
            graphics.fillStyle(0xff0000);
            graphics.fillCircle(10, 10, 10);
            graphics.generateTexture('ball', 20, 20);
            this.ball?.setTexture('ball');
        }

        this.ball?.setCircle(10);
        this.ball?.setBounce(0.8); // 튕기는 정도
        this.ball?.setCollideWorldBounds(true);
        this.ball?.setGravityY(800); // 중력
        this.ball?.setDrag(10, 10);

        //벽과의 충돌 설정
        this.physics.add.collider(this.ball!, this.walls!);

        // 핀과 충돌 설정
        this.physics.add.collider(this.ball!, this.pins!);
    }

    update() {
        if (!this.isPlaying || !this.ball) return;

        // 공이 바닥에 닿았는지 체크 (슬롯 영역)
        const finishY = this.scale.height / 2 + 140; 
        
        if (this.ball.y > finishY) {
            this.isPlaying = false;
            this.ball.setVelocity(0, 0);
            this.ball.setGravityY(0);
            
            this.checkResult(this.ball.x);
        }
    }

    private checkResult(x: number) {
        const centerX = this.scale.width / 2;
        // 슬롯 간격 40px 기준
        // index 0,4: 꽝 | 1,3: ATK | 2: HP
        const diff = x - (centerX - 80);
        const slotIndex = Math.floor((diff + 20) / 40); // 대략적인 인덱스 계산

        let rewardText = "";
        let atkGain = 0;
        let hpGain = 0;

        // 결과 판정 (범위 보정)
        if (slotIndex === 2) { // 가운데 (대박)
            hpGain = 5;
            rewardText = "대박! HP +5 회복!";
        } else if (slotIndex === 1 || slotIndex === 3) { // 중간 (중박)
            atkGain = 1;
            rewardText = "성공! 공격력 +1 증가!";
        } else { // 꽝
            rewardText = "꽝... 아무 일도 없었다.";
        }

        this.msgText.setText(rewardText);
        this.msgText.setColor('#ffff00');

        // 데이터 적용
        const session = DataManager.getSession();
        session.currentHp += hpGain;
        session.currentAtk += atkGain;

        // 2초 뒤 종료
        this.time.delayedCall(2000, () => {
            if (this.pachinkoData.onComplete) {
                this.pachinkoData.onComplete({ hpChanged: hpGain, atkChanged: atkGain });
            }
            this.scene.stop();
        });
    }
}