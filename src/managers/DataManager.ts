// 1. Meta Data: 영구 보존용 (DB나 로컬스토리지에 저장될 것)
export interface UserMeta {
    heroId: string;    // 캐릭터 스킨/직업 ID (예: 'knight', 'wizard')
    level: number;     // 계정 레벨
    baseHp: number;    // 기본 체력
    baseAtk: number;   // 기본 공격력
    gold: number;      // 보유 재화
}

// 2. Game Session: 한 판 돌릴 때만 쓰는 휘발성 데이터
export interface GameSession {
    currentHp: number;   // 현재 체력 (다치면 깎임)
    currentAtk: number;  // 현재 공격력 (버프 먹으면 오름)
    gridX: number;       // 현재 위치
    gridY: number;
    turnCount: number;   // 진행된 턴 수
    currentStage: number;
    totalStages: number;
}

class DataManager {
    // 싱글톤 인스턴스
    private static instance: DataManager;

    // 데이터 저장소
    public meta: UserMeta;
    public session: GameSession | null = null; // 게임 중이 아니면 null

    private constructor() {
        // 초기 유저 데이터 (나중엔 로컬스토리지에서 로드)
        this.meta = {
            heroId: 'hero_knight',
            level: 1,
            baseHp: 10,
            baseAtk: 2,
            gold: 0
        };
    }

    // 전역 접근자
    public static getInstance(): DataManager {
        if (!DataManager.instance) {
            DataManager.instance = new DataManager();
        }
        return DataManager.instance;
    }

    // --- 핵심 로직: 게임 시작 (Meta -> Session 복사) ---
    public startNewGame(startX: number, startY: number, maxStages: number = 3) {
        // 메타 데이터의 스탯을 기반으로 세션을 초기화합니다.
        // 여기서 중요한 건 값을 '복사'해서 넣는 것입니다.
        this.session = {
            currentHp: this.meta.baseHp, // 기본 체력 10으로 시작
            currentAtk: this.meta.baseAtk,
            gridX: startX,
            gridY: startY,
            turnCount: 0,
            currentStage: 1,
            totalStages: maxStages
        };
        console.log("새 게임 세션 생성됨:", this.session);
    }

    // 게임 종료 (세션 파기 & 보상 정산)
    public endGame(isWin: boolean) {
        if (isWin) {
            // 이겼을 때만 골드 획득 (Meta에 반영)
            this.meta.gold += 100; 
            console.log(`승리! 골드 획득. 현재 골드: ${this.meta.gold}`);
        } else {
            console.log("패배... 보상 없음.");
        }

        // 세션 데이터 초기화 (이번 판의 성장/피해 초기화)
        this.session = null;
    }

    // 헬퍼: 현재 세션이 없으면 에러
    public getSession(): GameSession {
        if (!this.session) {
            throw new Error("게임 중이 아닙니다!");
        }
        return this.session;
    }
}

export default DataManager.getInstance();