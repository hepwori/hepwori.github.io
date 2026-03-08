class EdgeToy extends Toy {
    constructor() {
        super();

        this.DOWNSCALE = 0.5;

        this.srcCanvas = document.createElement('canvas');
        this.srcCtx = this.srcCanvas.getContext('2d');

        this.edgeCanvas = document.createElement('canvas');
        this.edgeCtx = this.edgeCanvas.getContext('2d');
    }

    onResize(w, h) {
        const lw = Math.floor(w * this.DOWNSCALE);
        const lh = Math.floor(h * this.DOWNSCALE);
        this.srcCanvas.width = lw;
        this.srcCanvas.height = lh;
        this.edgeCanvas.width = lw;
        this.edgeCanvas.height = lh;
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const lw = this.srcCanvas.width;
        const lh = this.srcCanvas.height;

        if (!lw || !lh) return;

        this.srcCtx.drawImage(this.video, 0, 0, lw, lh);
        const frame = this.srcCtx.getImageData(0, 0, lw, lh);
        const data = frame.data;

        const output = new Uint8ClampedArray(lw * lh * 4);

        for (let y = 1; y < lh - 1; y++) {
            for (let x = 1; x < lw - 1; x++) {
                const getL = (dx, dy) => {
                    const i = ((y + dy) * lw + (x + dx)) * 4;
                    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                };

                // Sobel kernels
                const gx = -getL(-1,-1) - 2*getL(-1, 0) - getL(-1, 1)
                           + getL( 1,-1) + 2*getL( 1, 0) + getL( 1, 1);
                const gy = -getL(-1,-1) - 2*getL( 0,-1) - getL( 1,-1)
                           + getL(-1, 1) + 2*getL( 0, 1) + getL( 1, 1);

                const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy));
                const t = mag / 255;

                const i = (y * lw + x) * 4;
                output[i]     = data[i]     * t;
                output[i + 1] = data[i + 1] * t;
                output[i + 2] = data[i + 2] * t;
                output[i + 3] = mag;
            }
        }

        this.edgeCtx.putImageData(new ImageData(output, lw, lh), 0, 0);

        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, w, h);

        // Glow pass
        this.ctx.filter = 'blur(3px) brightness(2.5)';
        this.ctx.drawImage(this.edgeCanvas, 0, 0, w, h);

        // Sharp pass on top
        this.ctx.filter = 'none';
        this.ctx.drawImage(this.edgeCanvas, 0, 0, w, h);
    }
}

new EdgeToy();
