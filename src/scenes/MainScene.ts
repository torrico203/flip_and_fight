import Phaser from 'phaser';
import Tile from '../objects/Tile';
import Character from '../objects/Character';
import BattleScene from './BattleScene';
import DataManager from '../managers/DataManager';
import PachinkoScene from './PachinkoScene';
import SlotMachineScene from './SlotMachineScene';

interface GameData { gridSize: number; }

export default class MainScene extends Phaser.Scene {
    private gridSize: number = 5;
    private tileSize = 80;
    private tileGap = 10;
    
    private boardContainer!: Phaser.GameObjects.Container;
    private tiles: Tile[][] = [];
    
    // 플레이어 스탯 (임시)
    private playerStats = { hp: 10, atk: 2 };

    // 캐릭터
    private player!: Character;
    private enemy!: Character;

    // 게임 상태 (입력 대기중인가? 애니메이션 중인가?)
    private isProcessingTurn: boolean = false;

    // 보드 시작점 (전역 계산용)
    private boardStartX: number = 0;
    private boardStartY: number = 0;

    constructor() { super('MainScene'); }

    init(data: GameData) { this.gridSize = data.gridSize || 5; }

    create() {
        this.isProcessingTurn = false;
        this.boardContainer = this.add.container(0, 0);
        this.tiles = [];
        DataManager.startNewGame(0, this.gridSize - 1);

        // 보드 생성
        this.createBoard();
        this.centerBoard(); // 여기서 boardStartX, Y 계산됨
        this.scale.on('resize', this.resize, this);

        // 캐릭터 생성 및 배치
        // 플레이어: (0, 4) -> 좌측 하단 (x=0, y=Max)
        const heroSkin = DataManager.meta.heroId;
        this.player = new Character(this, 0, 0, 0x4facfe, '😎');
        const session = DataManager.getSession();
        this.player.setGridPosition(session.gridX, session.gridY, this.tileSize, this.tileGap, this.boardStartX, this.boardStartY);
        
        // 적: (4, 0) -> 우측 상단 (x=Max, y=0)
        this.enemy = new Character(this, 0, 0, 0xff0057, '👿');
        this.enemy.setGridPosition(this.gridSize - 1, 0, this.tileSize, this.tileGap, this.boardStartX, this.boardStartY);

        // 컨테이너에 넣으면 좌표 계산 복잡해지니 캐릭터는 Scene에 직접 둡니다. (Depth로 조절)
        this.add.existing(this.player);
        this.add.existing(this.enemy);

        // 첫 위치 타일 오픈 처리
        this.tiles[this.gridSize-1][0].flip(true); // silent flip
        this.tiles[0][this.gridSize-1].flip(true);
    }

    private createBoard() {
        for (let y = 0; y < this.gridSize; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                // 좌표는 createBoard에서 계산하지만, centerBoard에서 container 위치를 옮김
                const posX = x * (this.tileSize + this.tileGap);
                const posY = y * (this.tileSize + this.tileGap);
                
                // 랜덤 타입
                const types = ['M', 'I', 'T', 'E', 'EVT']; // 몬스터, 아이템, 트랩, 타임, 이벤트, 빈칸
                const randomType = types[Math.floor(Math.random() * types.length)];

                const tile = new Tile(this, posX, posY, randomType);
                
                // 클릭 이벤트: 인접한 타일만 이동 가능
                tile.on('pointerdown', () => this.handleInput(x, y));

                this.boardContainer.add(tile);
                this.tiles[y][x] = tile;
            }
        }
    }

    // --- 핵심 로직: 입력 처리 ---
    private handleInput(targetX: number, targetY: number) {
        if (this.isProcessingTurn) return; // 애니메이션 중 클릭 방지

        // 1. 유효성 검사: 플레이어와 인접한 칸인가? (상하좌우 1칸)
        const dist = Math.abs(targetX - this.player.gridX) + Math.abs(targetY - this.player.gridY);
        if (dist !== 1) {
            // 인접하지 않으면 무시 (혹은 흔들어서 "못가" 표시)
            return;
        }

        // 2. 턴 진행 시작
        this.processTurn(targetX, targetY);
    }

    // --- 핵심 로직: 턴 동시 진행 ---
    private async processTurn(playerDestX: number, playerDestY: number) {
        this.isProcessingTurn = true;

        // 1. 적 AI의 목표 결정 (플레이어 쪽으로 다가오거나 랜덤)
        // 단순하게 인접 타일 중 하나 랜덤 선택
        const enemyMoves = [
            {x:0, y:1}, {x:0, y:-1}, {x:1, y:0}, {x:-1, y:0}
        ];
        // 유효한 이동만 필터링
        const validEnemyMoves = enemyMoves.filter(m => {
            const nx = this.enemy.gridX + m.x;
            const ny = this.enemy.gridY + m.y;
            return nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize;
        });
        const chosen = validEnemyMoves[Math.floor(Math.random() * validEnemyMoves.length)];
        const enemyDestX = this.enemy.gridX + chosen.x;
        const enemyDestY = this.enemy.gridY + chosen.y;

        // 2. 충돌 체크 (같은 칸으로 이동하려 하는가?)
        if (playerDestX === enemyDestX && playerDestY === enemyDestY) {
            await this.executeClash(playerDestX, playerDestY);
        } else {
            await this.executeMove(playerDestX, playerDestY, enemyDestX, enemyDestY);
        }

        this.postMoveCheck();

        this.isProcessingTurn = false;
    }

    // 시나리오 A: 충돌 없음 (정상 이동)
    private async executeMove(px: number, py: number, ex: number, ey: number) {
        // 두 캐릭터 동시에 점프 (Promise.all)
        await Promise.all([
            this.player.jumpTo(px, py, this.tileSize, this.tileGap, this.boardStartX, this.boardStartY),
            this.enemy.jumpTo(ex, ey, this.tileSize, this.tileGap, this.boardStartX, this.boardStartY)
        ]);

        // 타일 오픈
        const pTile = this.tiles[py][px];
        const eTile = this.tiles[ey][ex];
        
        pTile.flip();
        eTile.flip();

        const session = DataManager.getSession();
        session.gridX = px;
        session.gridY = py;
        session.turnCount++;

        // ... 아이템 획득 로직 예시 ...
        // 타일이 아이템이라면?
        // session.currentAtk += 1; (이번 판만 쎄짐)
        // DataManager.meta.baseAtk 는 건드리지 않음! (영구 스탯이니까)

        if (pTile.tileType === 'M') {
            // 잠시 0.5초 대기 후 배틀 진입
            this.time.delayedCall(500, () => {
                this.startBattle();
            });
        }
        else if (pTile.tileType === 'EVT') {
            this.time.delayedCall(500, () => this.triggerRandomEvent());
        }
        else {
             // 일반 아이템/함정 처리는 여기서 즉시 해도 됨
             this.postMoveCheck();
        }
    }

    // 시나리오 B: 공중 충돌!
    private async executeClash(destX: number, destY: number) {
        // 1. 충돌 지점의 픽셀 좌표 계산
        const clashPoint = this.player.getPixelCoords(destX, destY, this.tileSize, this.tileGap, this.boardStartX, this.boardStartY);

        // 2. 카메라 쉐이크 (쾅!)
        this.time.delayedCall(150, () => {
            this.cameras.main.shake(100, 0.02);
        });

        // 3. [수정됨] 튕겨나갈 위치 선정 (중복 방지 로직)
        const safeSpots = this.getRevealedTiles();
        
        let pSafe, eSafe;

        // 안전지대(이미 밝혀진 땅)가 2곳 이상이면 섞어서 하나씩 배정
        if (safeSpots.length >= 2) {
            // Phaser 내장 유틸로 배열을 무작위로 섞음 (Shuffle)
            Phaser.Utils.Array.Shuffle(safeSpots);
            
            pSafe = safeSpots[0]; // 섞인 것 중 첫 번째
            eSafe = safeSpots[1]; // 섞인 것 중 두 번째 (절대 겹칠 일 없음)
        } 
        else {
            // 혹시라도 안전지대가 부족하면(극초반) 각자 본진으로 강제 귀환
            pSafe = { x: 0, y: this.gridSize - 1 }; // 좌하단
            eSafe = { x: this.gridSize - 1, y: 0 }; // 우상단
        }

        // 4. 충돌 및 튕겨나가기 애니메이션 실행
        await Promise.all([
            this.player.clashAndBounce(
                clashPoint.x - 20, clashPoint.y, 
                pSafe.x, pSafe.y, 
                this.tileSize, this.tileGap, this.boardStartX, this.boardStartY
            ),
            this.enemy.clashAndBounce(
                clashPoint.x + 20, clashPoint.y, 
                eSafe.x, eSafe.y, 
                this.tileSize, this.tileGap, this.boardStartX, this.boardStartY
            )
        ]);
    }

    private getRevealedTiles() {
        const revealed: {x: number, y: number}[] = [];
        for(let y=0; y<this.gridSize; y++){
            for(let x=0; x<this.gridSize; x++){
                // isRevealed 속성을 Tile.ts에 public으로 열어둬야 함. 
                // 일단 여기선 임시로 로직만 작성
                // @ts-ignore
                if (this.tiles[y][x].isRevealed) {
                    revealed.push({x, y});
                }
            }
        }
        return revealed;
    }

    private centerBoard() {
        const { width, height } = this.scale;
        const boardSize = (this.tileSize * this.gridSize) + (this.tileGap * (this.gridSize - 1));
        
        // 컨테이너는 화면 중앙으로
        const startX = (width - boardSize) / 2; // 컨테이너의 (0,0)이 시작될 화면 x좌표
        const startY = (height - boardSize) / 2;

        this.boardStartX = startX + (this.tileSize / 2); // 타일의 중심점 계산을 위한 오프셋 (Tile이 0,0 중심이면)
        // Tile.ts가 (0,0) 좌상단 기준이면 + tileSize/2
        // 아까 Tile.ts에서 setOrigin을 안 건드렸으면 기본 0.5(중앙)
        // Tile.ts에서 .add.rectangle(0,0,...) 했으면 중앙 기준임.

        // 보정: Tile.ts가 컨테이너 기반이고 내부 도형을 (0,0)에 그렸다면, Tile의 중심은 (x,y)임.
        // boardContainer 자체를 이동.
        this.boardContainer.setPosition(startX + this.tileSize/2, startY + this.tileSize/2); 
        
        // 캐릭터 계산을 위해 전역 변수 저장 (컨테이너 오프셋 포함)
        this.boardStartX = startX + this.tileSize/2;
        this.boardStartY = startY + this.tileSize/2;
    }

    private resize() {
        this.centerBoard();
        // 리사이즈 시 캐릭터 위치도 업데이트
        this.player.setGridPosition(this.player.gridX, this.player.gridY, this.tileSize, this.tileGap, this.boardStartX, this.boardStartY);
        this.enemy.setGridPosition(this.enemy.gridX, this.enemy.gridY, this.tileSize, this.tileGap, this.boardStartX, this.boardStartY);
    }

    private startBattle() {
        console.log("전투 시작!");
        
        // 중요: Scene.launch는 현재 씬을 끄지 않고 위에 새 씬을 얹습니다.
        this.scene.launch('BattleScene', {
            enemyName: '슬라임',
            enemyHP: 5,   // 몬스터 체력 (나중엔 타일마다 다르게)
            enemyAtk: 1,
            playerHP: 0,
            playerAtk: 0,
            
            // 콜백 함수: 전투 끝나면 이리로 돌아옵니다.
            onComplete: (result: { win: boolean, remainingHP: number }) => {
                if (result.win) {
                    console.log("전투 승리!");
                    this.postMoveCheck();
                    // 승리 후 처리는 DataManager.endGame이 아니라 
                    // 그냥 세션 HP 업데이트만 이미 BattleScene에서 했으므로
                    // 여기선 몬스터 타일 제거 등 시각적 처리만 하면 됨
                    
                    // 예: 몬스터 타일을 빈 땅으로 변경 (나중에 구현)
                } else {
                    console.log("전투 패배... 게임 오버?");
                    // TODO: 게임 오버 처리 or 부활
                    this.cameras.main.shake(500, 0.05);
                    this.handleGameOver(false);
                }
                
                // 전투 끝나면 다시 MainScene 활성화 (필요시)
                // 지금은 pause를 안 걸었으므로 그냥 진행
            }
        });
    }

    // [추가] 이동/행동이 다 끝난 후 호출될 함수
    private async postMoveCheck() {
        // 1. 플레이어 생존 체크 (이미 죽었으면 배틀이고 뭐고 끝)
        if (DataManager.getSession().currentHp <= 0) {
            this.handleGameOver(false);
            return;
        }

        // 2. 모든 타일이 열렸는지 확인
        const allRevealed = this.tiles.every(row => 
            // @ts-ignore (tileType, isRevealed 등 접근)
            row.every(tile => tile.isRevealed)
        );

        if (allRevealed) {
            console.log("📢 모든 타일 오픈! 최종 결전 시작!");
            
            // 잠시 텀을 두고 결전 시작 (연출용)
            this.time.delayedCall(1000, () => {
                this.startShowdown();
            });
        }
    }

    // [신규] 최종 일기토 (Showdown)
    private startShowdown() {
        this.cameras.main.flash(1000, 255, 255, 255); // 화면 번쩍! 연출
        
        // 라이벌 스펙 (나중엔 AI가 먹은 아이템 합산해서 계산하면 더 재밌음)
        // 지금은 고정값: 체력 15, 공격력 2 (보스급)
        const rivalStats = {
            hp: 15,
            atk: 2
        };

        this.scene.launch('BattleScene', {
            enemyName: '라이벌(Rival)',
            enemyHP: rivalStats.hp,
            enemyAtk: rivalStats.atk,
            
            // 내 스탯은 BattleScene이 DataManager에서 알아서 가져감
            playerHP: 0, 
            playerAtk: 0,

            onComplete: (result: { win: boolean, remainingHP: number }) => {
                // 최종 승패 결정
                this.handleGameOver(result.win);
            }
        });
    }

    // [신규] 게임 오버/클리어 처리
    private handleGameOver(isWin: boolean) {
        // 데이터 매니저에 결과 통보 (골드 획득 등)
        DataManager.endGame(isWin);

        const msg = isWin ? "🏆 VICTORY! 🏆" : "💀 GAME OVER 💀";
        const color = isWin ? '#00ff00' : '#ff0000';

        // 결과 텍스트 띄우기 (간단 연출)
        const { width, height } = this.scale;
        this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.7).setDepth(100);
        
        this.add.text(width/2, height/2, msg, {
            fontSize: '40px', color: color, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);

        // 3초 뒤 메뉴로 이동
        this.time.delayedCall(3000, () => {
            this.scene.start('MenuScene');
        });
    }

    // [신규] 랜덤 이벤트 디스패처 (나중에 여기 case문만 늘리면 됨)
    private triggerRandomEvent() {
        // const eventId = Math.floor(Math.random() * 7); 
        const eventId = Math.floor(Math.random() * 2);

        switch(eventId) {
            case 0: // 파칭코
                this.scene.launch('PachinkoScene', {
                    onComplete: (result: any) => {
                        console.log("파칭코 종료:", result);
                        this.postMoveCheck(); // 이벤트 끝나면 턴 종료 체크
                    }
                });
                break;
            case 1: // 슬롯머신
                this.scene.launch('SlotMachineScene', {
                    onComplete: (result: any) => {
                        console.log("슬롯머신 종료:", result);
                        this.postMoveCheck();
                    }
                });
                break;
            case 2:
                this.scene.launch('PineappleScene', {
                    onComplete: (result: any) => {
                        console.log("파인애플 종료:", result);
                        this.postMoveCheck();
                    }
                });
                break;
        }
    }
}