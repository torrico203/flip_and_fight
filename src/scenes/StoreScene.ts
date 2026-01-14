import Phaser from 'phaser';

// 판매할 유료 상품 목록
const STORE_ITEMS = [
    { id: 'remove_ads', name: '🚫 광고 제거', price: '$4.99', desc: '영구적으로 광고가 사라집니다.' },
    { id: 'starter_pack', name: '🎁 스타터 팩', price: '$2.99', desc: '500 골드 + 부활권 1개' },
    { id: 'gold_pouch', name: '💰 금화 주머니', price: '$0.99', desc: '즉시 1000 골드 획득' },
    { id: 'skin_dark', name: '🥷 닌자 스킨', price: '$1.99', desc: '새로운 외형 잠금 해제' }
];

export default class StoreScene extends Phaser.Scene {
    constructor() {
        super('StoreScene');
    }

    create() {
        const { width, height } = this.scale;
        
        // 1. 배경 (고급스러운 딥 블루/퍼플)
        this.add.rectangle(width/2, height/2, width, height, 0x000022, 0.95).setInteractive();
        
        // 타이틀
        this.add.text(width/2, 60, '💎 PREMIUM STORE 💎', {
            fontSize: '32px', color: '#00ffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        // 2. 상품 나열 (2열 그리드)
        let startX = width/2 - 100;
        let startY = 150;
        
        STORE_ITEMS.forEach((item, index) => {
            const row = Math.floor(index / 2);
            const col = index % 2;
            
            const x = (col === 0) ? width/2 - 100 : width/2 + 100;
            const y = startY + (row * 160); // 세로 간격
            
            this.createProductCard(x, y, item);
        });

        // 3. 닫기 버튼
        const closeBtn = this.add.text(width/2, height - 80, 'CLOSE', {
            fontSize: '24px', color: '#ffffff', backgroundColor: '#444', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        closeBtn.on('pointerdown', () => this.scene.stop());
    }

    private createProductCard(x: number, y: number, item: any) {
        const container = this.add.container(x, y);
        
        // 카드 배경
        const bg = this.add.rectangle(0, 0, 180, 140, 0x333355).setStrokeStyle(2, 0x00aaff);
        bg.setInteractive({ useHandCursor: true });

        // 상품명
        const name = this.add.text(0, -40, item.name, { fontSize: '18px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
        
        // 설명
        const desc = this.add.text(0, -10, item.desc, { fontSize: '12px', color: '#aaa', wordWrap: { width: 160 } }).setOrigin(0.5);
        
        // 가격 버튼 모양
        const priceBtn = this.add.rectangle(0, 40, 140, 30, 0x00cc00);
        const priceTxt = this.add.text(0, 40, item.price, { fontSize: '18px', fontStyle: 'bold' }).setOrigin(0.5);

        container.add([bg, name, desc, priceBtn, priceTxt]);

        // 클릭 시 결제 요청
        bg.on('pointerdown', () => {
            this.requestPayment(item);
        });
        
        // 호버 효과
        bg.on('pointerover', () => bg.setFillStyle(0x444466));
        bg.on('pointerout', () => bg.setFillStyle(0x333355));
    }

    private requestPayment(item: any) {
        console.log(`[결제 요청] ${item.id} - ${item.price}`);
        
        // 나중에 여기에 플랫폼별 결제 로직 연결
        // if (PLATFORM === 'STEAM') SteamManager.buyDLC(item.id);
        // if (PLATFORM === 'TOSS') TossManager.requestPayment(...);
        
        // 테스트용: 성공 처리
        alert(`${item.name} 결제 시뮬레이션 완료!`);
    }
}