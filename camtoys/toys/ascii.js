class AsciiToy extends Toy {
    constructor() {
        super();

        this.ASCII_CHARS = '@%#*+=-:. ';
        this.DOWNSCALE = 0.1;
        this.FONT_SIZE_SCALE = 1.2;
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        const lw = Math.floor(w * this.DOWNSCALE);
        const lh = Math.floor(h * this.DOWNSCALE);

        this.ctx.clearRect(0, 0, w, h);
        this.ctx.drawImage(this.video, 0, 0, lw, lh);
        const frame = this.ctx.getImageData(0, 0, lw, lh);
        const data = frame.data;

        this.ctx.clearRect(0, 0, w, h);
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, w, h);

        const cellWidth = w / lw;
        const cellHeight = h / lh;
        const fontSize = Math.min(cellWidth, cellHeight) * this.FONT_SIZE_SCALE;
        this.ctx.fillStyle = '#0f0';
        this.ctx.font = `${fontSize}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        for (let y = 0; y < lh; y++) {
            for (let x = 0; x < lw; x++) {
                const i = (y * lw + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                const charIndex = Math.floor((brightness / 255) * (this.ASCII_CHARS.length - 1));
                const char = this.ASCII_CHARS[charIndex];

                const posX = x * cellWidth + cellWidth / 2;
                const posY = y * cellHeight + cellHeight / 2;

                this.ctx.fillText(char, posX, posY);
            }
        }
    }
}

new AsciiToy();
