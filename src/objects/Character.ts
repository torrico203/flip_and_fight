import Phaser from 'phaser';

export default class Character extends Phaser.GameObjects.Container {
    public gridX: number;
    public gridY: number;
    private visual: Phaser.GameObjects.Arc; // 동그라미로 표현
    private label: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number, color: number, name: string) {
        super(scene, x, y);
        
        // 1. 캐릭터 외형 (동그라미 + 그림자 느낌)
        this.visual = scene.add.arc(0, 0, 30, color).setStrokeStyle(2, 0xffffff);
        this.label = scene.add.text(0, 0, name, { fontSize: '24px' }).setOrigin(0.5);
        
        this.add([this.visual, this.label]);
        
        // 초기화 시점에는 그리드 좌표 설정을 안 했으므로 0,0 (나중에 setGridPosition 호출)
        this.gridX = 0;
        this.gridY = 0;
        
        // 깊이 설정 (타일보다 위에 있어야 함)
        this.setDepth(10);
    }

    // 픽셀 좌표가 아니라 "그리드 좌표"로 즉시 이동 (초기 세팅용)
    public setGridPosition(gx: number, gy: number, tileSize: number, tileGap: number, boardStartX: number, boardStartY: number) {
        this.gridX = gx;
        this.gridY = gy;
        const { x, y } = this.getPixelCoords(gx, gy, tileSize, tileGap, boardStartX, boardStartY);
        this.setPosition(x, y);
    }

    // 그리드 -> 픽셀 좌표 변환 헬퍼
    public getPixelCoords(gx: number, gy: number, tileSize: number, tileGap: number, bx: number, by: number) {
        const x = bx + gx * (tileSize + tileGap);
        const y = by + gy * (tileSize + tileGap);
        return { x, y };
    }

    // 점프 이동 애니메이션
    public jumpTo(gx: number, gy: number, tileSize: number, tileGap: number, bx: number, by: number): Promise<void> {
        return new Promise((resolve) => {
            const target = this.getPixelCoords(gx, gy, tileSize, tileGap, bx, by);
            
            this.gridX = gx;
            this.gridY = gy;

            // 점프 연출: Y축은 갔다가 돌아오고(yoyo), 전체적으로 목표지점 이동
            // 1. 높이 점프 (시각적)
            this.scene.tweens.add({
                targets: this.visual,
                y: -30, // 공중으로 붕
                duration: 150,
                yoyo: true,
                ease: 'Quad.easeOut'
            });

            // 2. 실제 좌표 이동
            this.scene.tweens.add({
                targets: this,
                x: target.x,
                y: target.y,
                duration: 300,
                ease: 'Quad.easeOut',
                onComplete: () => resolve()
            });
        });
    }

    // 충돌 시 중간까지 갔다가 튕겨나가는 연출
    public clashAndBounce(midX: number, midY: number, targetGx: number, targetGy: number, tileSize: number, tileGap: number, bx: number, by: number): Promise<void> {
        return new Promise((resolve) => {
            // 1. 중간 지점까지 빠르게 이동 (충돌!)
            this.scene.tweens.add({
                targets: this,
                x: midX,
                y: midY,
                duration: 150,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    // 여기서 화면 흔들림은 Scene에서 처리
                    
                    // 2. 랜덤한 위치(인자로 받은 target)로 튕겨나가기
                    const dest = this.getPixelCoords(targetGx, targetGy, tileSize, tileGap, bx, by);
                    this.gridX = targetGx;
                    this.gridY = targetGy;

                    this.scene.tweens.add({
                        targets: this,
                        x: dest.x,
                        y: dest.y,
                        duration: 400,
                        ease: 'Bounce.easeOut',
                        delay: 100, // 충돌 느낌 뜸 들이기
                        onComplete: () => resolve()
                    });
                }
            });
        });
    }
}