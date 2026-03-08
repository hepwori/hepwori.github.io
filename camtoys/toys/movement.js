class MovementToy extends Toy {
    constructor() {
        super();

        this.FADE_ALPHA_STEP = 0.015;

        this.captureCanvas = document.createElement('canvas');
        this.captureCtx = this.captureCanvas.getContext('2d');

        this.trailCanvas = document.createElement('canvas');
        this.trailCtx = this.trailCanvas.getContext('2d');

        this.maskCanvas = document.createElement('canvas');
        this.maskCtx = this.maskCanvas.getContext('2d');

        this.workerBusy = false;
        this.worker = this._createWorker();
        this.worker.onmessage = (e) => this._onWorkerResult(e);

    }

    _createWorker() {
        const code = `
            var prev = null;
            var THRESHOLD = 80;
            self.onmessage = function(e) {
                var curr = new Uint8ClampedArray(e.data.buffer);
                var w = e.data.width, h = e.data.height;
                var mask = new Uint8ClampedArray(w * h * 4);
                var hasMotion = false;
                if (prev) {
                    for (var i = 0; i < curr.length; i += 4) {
                        var delta = Math.abs(curr[i]   - prev[i])   +
                                    Math.abs(curr[i+1] - prev[i+1]) +
                                    Math.abs(curr[i+2] - prev[i+2]);
                        if (delta > THRESHOLD) {
                            mask[i] = mask[i+1] = mask[i+2] = mask[i+3] = 255;
                            hasMotion = true;
                        }
                    }
                }
                prev = curr;
                self.postMessage({ buffer: mask.buffer, width: w, height: h, hasMotion: hasMotion }, [mask.buffer]);
            };
        `;
        const blob = new Blob([code], { type: 'application/javascript' });
        return new Worker(URL.createObjectURL(blob));
    }

    onResize(w, h) {
        this.captureCanvas.width = w;
        this.captureCanvas.height = h;
        this.trailCanvas.width = w;
        this.trailCanvas.height = h;
        this.maskCanvas.width = w;
        this.maskCanvas.height = h;
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (!this.workerBusy) {
            this.captureCtx.drawImage(this.video, 0, 0, w, h);
            const imageData = this.captureCtx.getImageData(0, 0, w, h);
            this.workerBusy = true;
            this.worker.postMessage(
                { buffer: imageData.data.buffer, width: w, height: h },
                [imageData.data.buffer]
            );
        }

        this.fadeTrail();

        this.ctx.clearRect(0, 0, w, h);
        this.ctx.filter = 'blur(3px)';
        this.ctx.drawImage(this.trailCanvas, 0, 0);
        this.ctx.filter = 'none';
    }

    _onWorkerResult(e) {
        this.workerBusy = false;
        const { buffer, width, height, hasMotion } = e.data;
        const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height);
        this.maskCtx.putImageData(imageData, 0, 0);
        if (hasMotion) {
            this.trailCtx.drawImage(this.maskCanvas, 0, 0);
        }
    }

    fadeTrail() {
        const w = this.trailCanvas.width, h = this.trailCanvas.height;
        if (!w || !h) return;
        // Linear subtraction ensures alpha actually reaches 0.
        // destination-out uses exponential decay (alpha *= 1-step) which in 8-bit
        // integer math rounds and gets permanently stuck at ~16% gray.
        const imageData = this.trailCtx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const step = Math.round(this.FADE_ALPHA_STEP * 255);
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) data[i] = Math.max(0, data[i] - step);
        }
        this.trailCtx.putImageData(imageData, 0, 0);
    }
}

new MovementToy();
