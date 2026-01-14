import Phaser from 'phaser';
import DataManager from '../managers/DataManager';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        // 타이틀
        this.add.text(centerX, centerY - 200, 'FLIP & FIGHT', {
            fontSize: '40px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        // ---  난이도 버튼들 (간격 조정) ---
        
        // Tutorial: 기존 -50 -> -100
        this.createButton(centerX, centerY - 100, 'Tutorial (3x3)', () => {
            this.scene.start('MainScene', { gridSize: 3 });
        });

        // Standard: 기존 +30 -> -20 (화면 중앙보다 살짝 위)
        this.createButton(centerX, centerY - 20, 'Standard (5x5)', () => {
            this.scene.start('MainScene', { gridSize: 5 });
        });
        
        // Hardcore: 기존 +160 -> +60 (Standard 바로 아래로 배치)
        this.createButton(centerX, centerY + 60, 'Hardcore (7x7)', () => {
            this.scene.start('MainScene', { gridSize: 7 });
        });

        // ---  개발자 테스트 존 (Dev Zone) ---
        
        const devStartY = centerY + 160; // Dev Zone 시작 위치

        // 구분선
        this.add.line(centerX, devStartY, 0, 0, width - 40, 0, 0x555555).setOrigin(0.5);
        
        // 헤더 텍스트
        this.add.text(centerX, devStartY + 20, '[ DEV / TEST MODE ]', { 
            fontSize: '14px', color: '#888' 
        }).setOrigin(0.5);

        // 테스트 버튼들
        // [Test 1] 파칭코
        this.createSmallButton(centerX - 80, devStartY + 60, '🎰 Pachinko', () => {
            this.runTestEvent('PachinkoScene');
        });

        // [Test 2] 배틀
        this.createSmallButton(centerX + 80, devStartY + 60, '⚔️ Battle', () => {
           this.runTestBattle();
        });

        this.createSmallButton(centerX - 80, devStartY + 100, '🎰 Slots', () => {
             this.runTestEvent('SlotMachineScene');
        });

        this.createSmallButton(centerX + 80, devStartY + 100, '🍍 Pineapple', () => {
            this.runTestEvent('PineappleScene');
        });

        this.createSmallButton(centerX - 80, devStartY + 140, '🔨 Hammer', () => {
            this.runTestEvent('HammerScene');
        });

        this.createSmallButton(centerX - 80, devStartY + 180, '💰 Gold Shop', () => {
             this.runTestShop('GOLD');
        });

        this.createSmallButton(centerX + 80, devStartY + 180, '👿 Devil Shop', () => {
             this.runTestShop('DEVIL');
        });
    }

    private createButton(x: number, y: number, label: string, callback: () => void) {
        const btn = this.add.text(x, y, label, {
            fontSize: '28px',
            color: '#4facfe',
            backgroundColor: '#333',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true }) // 마우스 올리면 손가락 모양
        .on('pointerdown', callback)
        .on('pointerover', () => btn.setStyle({ color: '#ff0057' })) // 호버 효과
        .on('pointerout', () => btn.setStyle({ color: '#4facfe' }));

        return btn;
    }

    // 개발용 작은 버튼 스타일
    private createSmallButton(x: number, y: number, label: string, callback: () => void) {
        const btn = this.add.text(x, y, label, {
            fontSize: '16px', color: '#00ff00', backgroundColor: '#222', // 초록색으로 구분
            padding: { x: 10, y: 5 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', callback)
        .on('pointerover', () => btn.setStyle({ backgroundColor: '#444' }))
        .on('pointerout', () => btn.setStyle({ backgroundColor: '#222' }));
        return btn;
    }

    // 테스트 씬 실행 헬퍼 함수
    private runTestEvent(sceneKey: string) {
        console.log(`🧪 Testing Scene: ${sceneKey}`);
        
        // [중요] 세션이 없으면 에러나므로, 테스트용 가짜 세션 생성!
        DataManager.startNewGame(0, 0);
        // 테스트니까 돈도 많고 체력도 빵빵하게
        DataManager.getSession().currentHp = 50; 

        this.scene.start(sceneKey, {
            // 테스트가 끝나면 다시 메뉴로 돌아오게 콜백 설정
            onComplete: (result: any) => {
                console.log("Test Result:", result);
                alert(`테스트 종료!\n결과: ${JSON.stringify(result)}`);
                this.scene.start('MenuScene'); // 다시 메뉴로
            }
        });
    }

    // 배틀씬은 파라미터가 좀 달라서 따로 함수 만듦
    private runTestBattle() {
        DataManager.startNewGame(0, 0);
        DataManager.getSession().currentHp = 30; // 넉넉하게

        this.scene.start('BattleScene', {
            enemyName: 'Test Dummy',
            enemyHP: 100, // 샌드백
            enemyAtk: 1,
            playerHP: 30,
            playerAtk: 5,
            onComplete: (result: any) => {
                console.log("Battle Test Result:", result);
                this.scene.start('MenuScene');
            }
        });
    }

    // [신규] 상점 테스트용 헬퍼 함수
    private runTestShop(type: 'GOLD' | 'DEVIL') {
        console.log(`🧪 Testing Shop: ${type}`);
        
        // 1. 가짜 세션 생성
        DataManager.startNewGame(0, 0);
        
        // 2. 쇼핑 좀 시원하게 하시라고 지갑 두둑히 채워드립니다.
        DataManager.meta.gold = 500;        // 황금 상점용: 500골드
        DataManager.getSession().currentHp = 30; // 악마 상점용: 체력 30
        
        this.scene.start('ShopScene', {
            type: type,
            onComplete: () => {
                console.log("상점 이용 종료. 메뉴로 복귀.");
                this.scene.start('MenuScene');
            }
        });
    }
}