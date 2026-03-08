class RainToy extends Toy {
    constructor() {
        super();

        this.CELL = 16;
        this.CHARS = 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789';

        // drops[col] = array of active drops in that column
        this.drops = [];
        this.motionCols = [];

        this.captureCanvas = document.createElement('canvas');
        this.captureCtx = this.captureCanvas.getContext('2d');
        this.prevFrame = null;
    }

    onResize(w, h) {
        const numCols = Math.floor(w / this.CELL);
        const numRows = Math.floor(h / this.CELL);

        this.motionCols = new Float32Array(numCols);
        this.captureCanvas.width = numCols;
        this.captureCanvas.height = numRows;

        this.drops = Array.from({ length: numCols }, (_, i) =>
            this.drops[i] || [this._newDrop(numRows, true)]
        );
    }

    _newDrop(numRows, scatter = false) {
        return {
            y: scatter ? Math.random() * -numRows : -(Math.random() * 3 + 1),
            speed: 0.08 + Math.random() * 0.05,  // slow idle speed
            char: this._rndChar(),
        };
    }

    _rndChar() {
        return this.CHARS[Math.floor(Math.random() * this.CHARS.length)];
    }

    _detectMotion() {
        const cw = this.captureCanvas.width;
        const ch = this.captureCanvas.height;
        if (!cw || !ch) return;

        this.captureCtx.drawImage(this.video, 0, 0, cw, ch);
        const curr = this.captureCtx.getImageData(0, 0, cw, ch).data;

        if (this.prevFrame) {
            for (let col = 0; col < cw; col++) {
                let sum = 0;
                for (let row = 0; row < ch; row++) {
                    const i = (row * cw + col) * 4;
                    sum += Math.abs(curr[i]     - this.prevFrame[i])
                         + Math.abs(curr[i + 1] - this.prevFrame[i + 1])
                         + Math.abs(curr[i + 2] - this.prevFrame[i + 2]);
                }
                // Smooth motion values over time so they don't jump
                const raw = Math.min(1, (sum / ch) / 60);
                this.motionCols[col] = this.motionCols[col] * 0.7 + raw * 0.3;
            }
        }

        this.prevFrame = curr;
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const numCols = Math.floor(w / this.CELL);
        const numRows = Math.floor(h / this.CELL);

        if (this.drops.length !== numCols) return;

        this._detectMotion();

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.font = `${this.CELL}px monospace`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';

        for (let col = 0; col < numCols; col++) {
            const motion = this.motionCols[col] || 0;
            const colDrops = this.drops[col];

            // Spawn extra drops when there's motion — more motion = more drops
            const maxDrops = 1 + Math.floor(motion * 5);
            if (colDrops.length < maxDrops && Math.random() < motion * 0.4) {
                colDrops.push(this._newDrop(numRows));
            }

            for (let d = colDrops.length - 1; d >= 0; d--) {
                const drop = colDrops[d];

                // Motion boosts speed dramatically
                drop.y += drop.speed + motion * 1.5;

                const row = Math.floor(drop.y);
                if (row >= 0 && row < numRows) {
                    if (Math.random() < 0.1) drop.char = this._rndChar();

                    // Color scales from dim green → bright green → white with motion
                    let color;
                    if (motion > 0.7) {
                        color = '#ffffff';
                    } else if (motion > 0.4) {
                        const t = (motion - 0.4) / 0.3;
                        const g = Math.round(255 * t + 180 * (1 - t));
                        color = `rgb(${Math.round(t * 180)}, ${g}, ${Math.round(t * 100)})`;
                    } else {
                        const g = Math.round(80 + motion * 250);
                        color = `rgb(0, ${g}, 0)`;
                    }

                    this.ctx.fillStyle = color;
                    this.ctx.fillText(drop.char, col * this.CELL, row * this.CELL);
                }

                if (drop.y > numRows) {
                    colDrops.splice(d, 1);
                    // Always keep at least one idle drop per column
                    if (colDrops.length === 0) {
                        colDrops.push(this._newDrop(numRows));
                    }
                }
            }
        }
    }
}

new RainToy();
