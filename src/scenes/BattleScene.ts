import Phaser from 'phaser';
import DataManager from '../managers/DataManager';

// 메인 씬에서 넘겨받을 데이터
interface BattleData {
    enemyName: string;
    enemyHP: number;
    enemyAtk: number;
    playerHP: number;
    playerAtk: number;
    // 전투 종료 후 실행할 콜백 (결과 전달용)
    onComplete: (result: { win: boolean, remainingHP: number }) => void;
}

export default class BattleScene extends Phaser.Scene {
    private battleData!: BattleData;
    private turnTimer?: Phaser.Time.TimerEvent;

    // UI 요소
    private logText!: Phaser.GameObjects.Text;
    private playerText!: Phaser.GameObjects.Text;
    private enemyText!: Phaser.GameObjects.Text;

    // 현재 전투 상태
    private currentPlayerHP: number = 0;
    private currentEnemyHP: number = 0;

    constructor() {
        super('BattleScene');
    }

    init(data: any) {
        // 배틀 시작 시, 현재 내 세션의 체력을 가져옴
        const session = DataManager.getSession();
        console.log(`[BattleScene] 세션 HP: ${session.currentHp}`);
        
        this.battleData = {
            ...data,
            playerHP: session.currentHp,   // 현재 체력
            playerAtk: session.currentAtk  // 현재 공격력
        };

        this.currentPlayerHP = this.battleData.playerHP; 
        this.currentEnemyHP = this.battleData.enemyHP;
    }

    create() {
        const { width, height } = this.scale;

        // 1. 반투명 검은 배경
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
            .setInteractive(); 

        // 2. 전투 UI 컨테이너 (중앙 팝업창)
        const box = this.add.container(width / 2, height / 2);

        // 하얀 박스 배경
        const bg = this.add.rectangle(0, 0, 300, 400, 0x222222)
            .setStrokeStyle(4, 0xffffff);
        
        box.add(bg);

        // [수정2] setParent 대신 변수에 할당 후 box.add() 사용
        const titleText = this.add.text(0, -150, '⚔️ BATTLE ⚔️', { 
            fontSize: '32px', color: '#ff0057', fontStyle: 'bold' 
        }).setOrigin(0.5);

        this.enemyText = this.add.text(0, -50, `몬스터\nHP: ${this.currentEnemyHP}`, { 
            fontSize: '24px', align: 'center', color: '#ff4444' 
        }).setOrigin(0.5);

        const vsText = this.add.text(0, 20, 'VS', { 
            fontSize: '20px', color: '#aaa' 
        }).setOrigin(0.5);

        this.playerText = this.add.text(0, 90, `나\nHP: ${this.currentPlayerHP}`, { 
            fontSize: '24px', align: 'center', color: '#4facfe' 
        }).setOrigin(0.5);

        this.logText = this.add.text(0, 160, '전투 시작!', { 
            fontSize: '16px', color: '#fff' 
        }).setOrigin(0.5);

        // 컨테이너에 UI 요소들 일괄 추가
        box.add([titleText, this.enemyText, vsText, this.playerText, this.logText]);

        // 3. 1초 뒤 자동 전투 시작
        this.time.delayedCall(1000, () => this.nextTurn());
    }

    private nextTurn() {
        // 1. 플레이어 공격
        this.currentEnemyHP -= this.battleData.playerAtk;
        this.logText.setText(`당신의 공격! 몬스터에게 ${this.battleData.playerAtk} 데미지!`);
        this.updateUI();
        this.shakeEffect(this.enemyText); // 타격감

        // 몬스터 사망 체크
        if (this.currentEnemyHP <= 0) {
            this.endBattle(true);
            return;
        }

        // 2. 0.8초 뒤 몬스터 반격
        this.time.delayedCall(800, () => {
            this.currentPlayerHP -= this.battleData.enemyAtk;
            this.logText.setText(`몬스터 반격! 나에게 ${this.battleData.enemyAtk} 데미지!`);
            this.updateUI();
            this.shakeEffect(this.playerText);

            // 플레이어 사망 체크
            if (this.currentPlayerHP <= 0) {
                this.endBattle(false);
                return;
            }

            // 다음 턴 (반복)
            this.time.delayedCall(800, () => this.nextTurn());
        });
    }

    private updateUI() {
        this.enemyText.setText(`몬스터 (ATK ${this.battleData.enemyAtk})\nHP: ${Math.max(0, this.currentEnemyHP)}`);
        this.playerText.setText(`나 (ATK ${this.battleData.playerAtk})\nHP: ${Math.max(0, this.currentPlayerHP)}`);
    }

    private shakeEffect(target: Phaser.GameObjects.Text) {
        this.tweens.add({
            targets: target,
            x: '+=5',
            duration: 50,
            yoyo: true,
            repeat: 3
        });
    }

    private endBattle(isWin: boolean) {
        const msg = isWin ? "승리! 🎉" : "패배... 💀";
        if (isWin) {
            const session = DataManager.getSession();
            session.currentHp = this.currentPlayerHP; // 깎인 체력 저장
            console.log(`전투 승리. 남은 HP: ${session.currentHp}`);
        } else {
            // 패배 처리 (게임 오버)
            DataManager.endGame(false);
        }
        this.logText.setText(msg);


        // 1초 뒤 팝업 닫기
        this.time.delayedCall(1500, () => {
            // MainScene으로 결과 전달
            if (this.battleData.onComplete) {
                this.battleData.onComplete({
                    win: isWin,
                    remainingHP: this.currentPlayerHP
                });
            }
            this.scene.stop(); // BattleScene 종료
        });
    }
}