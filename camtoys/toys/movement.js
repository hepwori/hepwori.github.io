class MovementToy extends Toy {
    constructor() {
        super();

        this.MOTION_THRESHOLD = 40;
        this.FADE_ALPHA_STEP = 0.01;
        this.TRAIL_COLOR = [255, 255, 255];
        this.DOWNSCALE = 0.25;

        this.lowResCanvas = document.createElement('canvas');
        this.lowResCtx = this.lowResCanvas.getContext('2d');

        this.trailCanvas = document.createElement('canvas');
        this.trailCtx = this.trailCanvas.getContext('2d');

        this.lastLowRes = null;
    }

    onResize(w, h) {
        this.trailCanvas.width = w;
        this.trailCanvas.height = h;
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        const lw = Math.floor(w * this.DOWNSCALE);
        const lh = Math.floor(h * this.DOWNSCALE);
        this.lowResCanvas.width = lw;
        this.lowResCanvas.height = lh;

        this.lowResCtx.drawImage(this.video, 0, 0, lw, lh);
        const currImageData = this.lowResCtx.getImageData(0, 0, lw, lh);
        const curr = currImageData.data;

        if (this.lastLowRes) {
            for (let y = 0; y < lh; y++) {
                for (let x = 0; x < lw; x++) {
                    const i = (y * lw + x) * 4;
                    const delta = Math.abs(curr[i] - this.lastLowRes[i]) +
                                  Math.abs(curr[i + 1] - this.lastLowRes[i + 1]) +
                                  Math.abs(curr[i + 2] - this.lastLowRes[i + 2]);

                    if (delta > this.MOTION_THRESHOLD) {
                        const dx = Math.floor(x / this.DOWNSCALE);
                        const dy = Math.floor(y / this.DOWNSCALE);
                        this.drawMotionSpot(dx, dy);
                    }
                }
            }
        }

        this.fadeTrail();
        this.lastLowRes = new Uint8ClampedArray(curr);

        this.ctx.clearRect(0, 0, w, h);
        this.ctx.filter = 'blur(2px)';
        this.ctx.drawImage(this.trailCanvas, 0, 0);
        this.ctx.filter = 'none';
    }

    drawMotionSpot(x, y) {
        const radius = 6;
        this.trailCtx.beginPath();
        this.trailCtx.fillStyle = `rgb(${this.TRAIL_COLOR[0]}, ${this.TRAIL_COLOR[1]}, ${this.TRAIL_COLOR[2]})`;
        this.trailCtx.arc(x, y, radius, 0, 2 * Math.PI);
        this.trailCtx.fill();
    }

    fadeTrail() {
        this.trailCtx.globalCompositeOperation = 'destination-out';
        this.trailCtx.fillStyle = `rgba(0, 0, 0, ${this.FADE_ALPHA_STEP})`;
        this.trailCtx.fillRect(0, 0, this.trailCanvas.width, this.trailCanvas.height);
        this.trailCtx.globalCompositeOperation = 'source-over';
    }
}

new MovementToy();