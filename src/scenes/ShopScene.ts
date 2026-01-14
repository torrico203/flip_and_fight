import Phaser from 'phaser';
import DataManager from '../managers/DataManager';

// 상점 타입 정의
export type ShopType = 'GOLD' | 'DEVIL';

interface ShopData {
    type: ShopType;
    onComplete: () => void;
}

// 판매 상품 인터페이스
interface Product {
    id: string;
    name: string;
    desc: string; // 설명
    cost: number; // 가격 (골드 또는 HP)
    effect: (session: any) => void; // 구매 시 효과
    soldOut: boolean; // 품절 여부
    icon: string; // 이모지 등
}

export default class ShopScene extends Phaser.Scene {
    private shopData!: ShopData;
    private products: Product[] = [];
    
    // UI
    private coinText!: Phaser.GameObjects.Text;
    private hpText!: Phaser.GameObjects.Text;
    private msgText!: Phaser.GameObjects.Text;

    constructor() {
        super('ShopScene');
    }

    init(data: ShopData) {
        this.shopData = data;
        this.products = [];

        this.coinText = undefined as any;
        this.hpText = undefined as any;
        this.msgText = undefined as any;
        
        // 상점 타입에 따라 상품 목록 구성
        if (this.shopData.type === 'GOLD') {
            this.setupGoldShop();
        } else {
            this.setupDevilShop();
        }
    }

    create() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // 1. 배경 (타입에 따라 분위기 다르게)
        const bgColor = this.shopData.type === 'GOLD' ? 0x221100 : 0x110000; // 갈색 vs 검붉은색
        this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.9).setInteractive();
        
        // 상점 본체 배경
        const boardColor = this.shopData.type === 'GOLD' ? 0x885500 : 0x440000;
        const strokeColor = this.shopData.type === 'GOLD' ? 0xffd700 : 0xff0000;
        
        this.add.rectangle(centerX, centerY, 350, 500, boardColor).setStrokeStyle(4, strokeColor);

        // 2. 타이틀 & NPC
        const titleText = this.shopData.type === 'GOLD' ? '💰 GENERAL STORE 💰' : '👿 DEVIL DEAL 👿';
        const titleColor = this.shopData.type === 'GOLD' ? '#ffd700' : '#ff0000';
        const npcIcon = this.shopData.type === 'GOLD' ? '🧔' : '🧛';

        this.add.text(centerX, centerY - 220, npcIcon, { fontSize: '60px' }).setOrigin(0.5);
        this.add.text(centerX, centerY - 160, titleText, {
            fontSize: '28px', color: titleColor, fontStyle: 'bold'
        }).setOrigin(0.5);

        // 3. 현재 재화 표시
        this.updateCurrencyUI();

        // 4. 상품 진열 (3개 슬롯)
        this.displayProducts(centerX, centerY + 20);

        // 5. 나가기 버튼
        const closeBtnColor = this.shopData.type === 'GOLD' ? 0xccaa00 : 0xcc0000;
        const closeBtn = this.add.container(centerX, centerY + 200);
        const btnBg = this.add.rectangle(0, 0, 150, 50, closeBtnColor).setInteractive({ useHandCursor: true });
        const btnTxt = this.add.text(0, 0, 'LEAVE', { fontSize: '20px', fontStyle: 'bold', color: '#000' }).setOrigin(0.5);
        
        closeBtn.add([btnBg, btnTxt]);
        
        btnBg.on('pointerdown', () => {
            if (this.shopData.onComplete) this.shopData.onComplete();
            this.scene.stop();
        });
        
        // 메시지 텍스트
        this.msgText = this.add.text(centerX, centerY + 140, '어서오게, 여행자여.', {
            fontSize: '16px', color: '#fff'
        }).setOrigin(0.5);
    }

    private setupGoldShop() {
        // [황금 상점 물품 리스트]
        // 실제 게임에선 랜덤으로 3개 뽑으면 됨. 여기선 고정 예시.
        this.products = [
            {
                id: 'potion', name: '회복 물약', desc: 'HP +5 회복', icon: '🍷',
                cost: 20, soldOut: false,
                effect: (s) => { s.currentHp += 5; }
            },
            {
                id: 'whetstone', name: '숫돌', desc: 'ATK +1 강화', icon: '🔪',
                cost: 50, soldOut: false,
                effect: (s) => { s.currentAtk += 1; }
            },
            {
                id: 'protein', name: '전사의 밥', desc: 'HP +10 (최대체력?)', icon: '🍖',
                cost: 40, soldOut: false,
                effect: (s) => { s.currentHp += 10; }
            }
        ];
    }

    private setupDevilShop() {
        // [악마 상점 물품 리스트] - HP를 지불
        this.products = [
            {
                id: 'blood_pact', name: '피의 계약', desc: 'ATK +3 증가', icon: '🩸',
                cost: 5, soldOut: false, // HP 5 소모
                effect: (s) => { s.currentAtk += 3; }
            },
            {
                id: 'cursed_armor', name: '저주받은 갑옷', desc: 'HP 풀회복', icon: '🛡️',
                cost: 2, soldOut: false, // HP 2를 바치고 풀피? (도박성) -> 예시: 현재 HP의 절반을 바치고 ATK +5 등
                // 단순하게: HP 2 소모 -> ATK +1 (가성비)
                effect: (s) => { s.currentHp = 30; } // 예: 최대치로 고정 (테스트용)
            },
            {
                id: 'gamble', name: '악마의 주사위', desc: '랜덤 스탯 대폭 상승', icon: '🎲',
                cost: 3, soldOut: false,
                effect: (s) => { 
                    if(Math.random() > 0.5) s.currentAtk += 5; 
                    else s.currentHp += 20;
                }
            }
        ];
    }

    private displayProducts(x: number, startY: number) {
        // 상품 3개를 가로로 배치
        const spacing = 100;
        
        this.products.forEach((prod, idx) => {
            const px = x - spacing + (idx * spacing);
            const container = this.add.container(px, startY);

            // 상품 배경 카드
            const bg = this.add.rectangle(0, 0, 90, 140, 0x333333).setInteractive({ useHandCursor: true });
            
            // 아이콘
            const icon = this.add.text(0, -40, prod.icon, { fontSize: '40px' }).setOrigin(0.5);
            
            // 이름
            const name = this.add.text(0, -10, prod.name, { 
                fontSize: '12px', color: '#fff', wordWrap: { width: 80 } 
            }).setOrigin(0.5);

            // 가격표
            const currencyIcon = this.shopData.type === 'GOLD' ? '💰' : '🩸HP';
            const costColor = this.shopData.type === 'GOLD' ? '#ffd700' : '#ff4444';
            
            const costText = this.add.text(0, 20, `${currencyIcon} ${prod.cost}`, { 
                fontSize: '14px', color: costColor, fontStyle: 'bold' 
            }).setOrigin(0.5);

            // 설명 (작게)
            const desc = this.add.text(0, 45, prod.desc, { 
                fontSize: '10px', color: '#aaa', align: 'center', wordWrap: { width: 80 } 
            }).setOrigin(0.5);

            // [품절] 덮개
            const soldOutCover = this.add.rectangle(0, 0, 90, 140, 0x000000, 0.7).setVisible(false);
            const soldOutText = this.add.text(0, 0, 'SOLD OUT', { 
                fontSize: '14px', color: '#ff0000', fontStyle: 'bold' 
            }).setOrigin(0.5).setVisible(false).setRotation(-0.5);

            container.add([bg, icon, name, costText, desc, soldOutCover, soldOutText]);

            // 클릭 이벤트
            bg.on('pointerdown', () => {
                if (!prod.soldOut) {
                    this.buyProduct(prod, container, soldOutCover, soldOutText);
                }
            });
            
            // 호버 효과
            bg.on('pointerover', () => bg.setStrokeStyle(2, 0xffffff));
            bg.on('pointerout', () => bg.setStrokeStyle(0));
        });
    }

    private buyProduct(prod: Product, container: Phaser.GameObjects.Container, cover: any, text: any) {
        const session = DataManager.getSession();

        if (this.shopData.type === 'GOLD') {
            // 골드 상점 구매 로직
            if (DataManager.meta.gold >= prod.cost) {
                DataManager.meta.gold -= prod.cost; // 골드 차감
                this.processPurchase(prod, session, cover, text);
            } else {
                this.showMsg("골드가 부족합니다!", '#ff0000');
            }
        } else {
            // 악마 상점 구매 로직 (HP 지불)
            if (session.currentHp > prod.cost) { // 최소 1은 남아야 함
                session.currentHp -= prod.cost; // HP 차감
                this.processPurchase(prod, session, cover, text);
            } else {
                this.showMsg("체력이 부족합니다! (죽습니다)", '#ff0000');
            }
        }
    }

    private processPurchase(prod: Product, session: any, cover: any, text: any) {
        // 효과 적용
        prod.effect(session);
        
        // 품절 처리
        prod.soldOut = true;
        cover.setVisible(true);
        text.setVisible(true);
        
        // UI 갱신 & 피드백
        this.updateCurrencyUI();
        this.showMsg(`${prod.name} 구매 완료!`, '#00ff00');
        this.sound.play('buy_sound'); // (사운드 있으면)
    }

    private updateCurrencyUI() {
        const session = DataManager.getSession();
        const gold = DataManager.meta.gold; // 골드는 메타 데이터
        const hp = session.currentHp;
        
        if (!this.coinText) {
             this.coinText = this.add.text(this.scale.width/2 - 80, this.scale.height/2 - 100, '', { fontSize: '16px' });
             this.hpText = this.add.text(this.scale.width/2 + 20, this.scale.height/2 - 100, '', { fontSize: '16px' });
        }

        this.coinText.setText(`💰 ${gold}`);
        this.hpText.setText(`🩸HP ${hp}`);
        
        // 색상 강조
        this.coinText.setColor(this.shopData.type === 'GOLD' ? '#ffff00' : '#888');
        this.hpText.setColor(this.shopData.type === 'DEVIL' ? '#ff0000' : '#888');
    }

    private showMsg(msg: string, color: string) {
        this.msgText.setText(msg);
        this.msgText.setColor(color);
        this.tweens.add({
            targets: this.msgText,
            scale: { from: 1.2, to: 1 },
            duration: 200
        });
    }
}