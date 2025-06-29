class StarsToy extends Toy {
    constructor() {
        super();

        this.STAR_BLUR_RADIUS = 10;
        this.N = 8;
        this.PEAK_DISTANCE = 20;
        this.EDGE_MARGIN = 40;
        this.STAR_DENSITY_SPACING = 500;

        this.nextId = 1;
        this.stars = [];

        this.blurCanvas = document.createElement('canvas');
        this.blurCtx = this.blurCanvas.getContext('2d');
    }

    onResize(w, h) {
        this.blurCanvas.width = w;
        this.blurCanvas.height = h;
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, w, h);

        this.blurCtx.filter = `blur(${this.STAR_BLUR_RADIUS}px)`;
        this.blurCtx.drawImage(this.video, 0, 0, w, h);
        this.ctx.drawImage(this.blurCanvas, 0, 0, w, h);

        const frame = this.ctx.getImageData(0, 0, w, h);
        const lum = this.getLuminanceData(frame, w, h);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, w, h);

        const peaks = this.getLocalMaxima(lum, w, h, this.N, this.PEAK_DISTANCE);
        this.matchStarsToTargets(peaks);
        this.updateStars();
        this.drawStars();
    }

    getLuminanceData(imageData, width, height) {
        const luminance = new Float32Array(width * height);
        for (let i = 0; i < luminance.length; i++) {
            const idx = i * 4;
            const r = imageData.data[idx];
            const g = imageData.data[idx + 1];
            const b = imageData.data[idx + 2];
            luminance[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        }
        return luminance;
    }

    getLocalMaxima(luminance, width, height, count, minDist) {
        const peaks = [];
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                if (x < this.EDGE_MARGIN || x > width - this.EDGE_MARGIN || y < this.EDGE_MARGIN || y > height - this.EDGE_MARGIN) continue;
                const i = y * width + x;
                const val = luminance[i];
                let isMax = true;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const ni = (y + dy) * width + (x + dx);
                        if (luminance[ni] > val) {
                            isMax = false;
                            break;
                        }
                    }
                    if (!isMax) break;
                }
                if (isMax) peaks.push({ x, y, brightness: val });
            }
        }

        peaks.sort((a, b) => b.brightness - a.brightness);
        const finalPeaks = [];

        for (const peak of peaks) {
            let tooClose = false;
            for (const p of finalPeaks) {
                const dx = peak.x - p.x;
                const dy = peak.y - p.y;
                if (dx * dx + dy * dy < minDist * minDist) {
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) {
                finalPeaks.push(peak);
                if (finalPeaks.length >= count) break;
            }
        }

        for (let i = 0; i < finalPeaks.length; i++) {
            let minD = Infinity;
            for (let j = 0; j < finalPeaks.length; j++) {
                if (i === j) continue;
                const dx = finalPeaks[i].x - finalPeaks[j].x;
                const dy = finalPeaks[i].y - finalPeaks[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < minD) minD = d;
            }
            const scale = this.canvas.clientWidth / 640;
            const raw = Math.max(1.2, Math.min(4.8, minD / 10));
            const boosted = (raw - 1.2) * 1.8 + 1.2;
            finalPeaks[i].size = scale * boosted;
        }

        return finalPeaks;
    }

    matchStarsToTargets(peaks) {
        const unmatched = [...peaks];
        for (const star of this.stars) {
            let closest = null;
            let closestDist = Infinity;
            for (let i = 0; i < unmatched.length; i++) {
                const p = unmatched[i];
                const dx = star.x - p.x;
                const dy = star.y - p.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < closestDist) {
                    closest = i;
                    closestDist = d2;
                }
            }
            if (closest !== null) {
                const p = unmatched.splice(closest, 1)[0];
                star.tx = p.x;
                star.ty = p.y;
                star.targetSize = p.size;
            }
        }

        for (const p of unmatched) {
            this.stars.push({
                id: this.nextId++,
                x: p.x,
                y: p.y,
                tx: p.x,
                ty: p.y,
                size: p.size,
                targetSize: p.size,
                vx: 0,
                vy: 0,
            });
        }
    }

    updateStars() {
        const attraction = 0.005;
        const damping = 0.9;
        const maxSpeed = 2.0;

        for (let i = 0; i < this.stars.length; i++) {
            for (let j = i + 1; j < this.stars.length; j++) {
                const a = this.stars[i];
                const b = this.stars[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.hypot(dx, dy);
                if (dist < this.STAR_DENSITY_SPACING && dist > 0) {
                    const force = (this.STAR_DENSITY_SPACING - dist) / this.STAR_DENSITY_SPACING * 0.05;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    a.vx -= nx * force;
                    a.vy -= ny * force;
                    b.vx += nx * force;
                    b.vy += ny * force;
                }
            }
        }

        for (const s of this.stars) {
            const dx = s.tx - s.x;
            const dy = s.ty - s.y;
            s.vx = (s.vx + dx * attraction) * damping;
            s.vy = (s.vy + dy * attraction) * damping;

            const speed = Math.hypot(s.vx, s.vy);
            if (speed > maxSpeed) {
                const scale = maxSpeed / speed;
                s.vx *= scale;
                s.vy *= scale;
            }
            s.x += s.vx;
            s.y += s.vy;
            s.size += (s.targetSize - s.size) * 0.05;
        }
    }

    drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        const step = Math.PI / spikes;
        let rot = Math.PI / 2 * 3;
        this.ctx.beginPath();
        this.ctx.moveTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
        for (let i = 0; i < spikes; i++) {
            rot += step;
            this.ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
            rot += step;
            this.ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
        }
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawStars() {
        this.ctx.fillStyle = 'rgba(255,255,200)';
        for (const s of this.stars) {
            this.drawStar(s.x, s.y, 5, s.size, s.size * 0.5);
        }

        const lines = [];
        const threshold = 500;
        const maxLinesPerStar = 3;
        const connectionCounts = new Map();
        for (let i = 0; i < this.stars.length; i++) {
            for (let j = i + 1; j < this.stars.length; j++) {
                const a = this.stars[i];
                const b = this.stars[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.hypot(dx, dy);
                if (dist < threshold) {
                    const segment = { a, b, dist };
                    let crosses = false;
                    for (const l of lines) {
                        if (this.intersects(a, b, l.a, l.b)) {
                            crosses = true;
                            break;
                        }
                    }
                    if (!crosses) {
                        const countA = connectionCounts.get(a.id) || 0;
                        const countB = connectionCounts.get(b.id) || 0;
                        if (countA < maxLinesPerStar && countB < maxLinesPerStar) {
                            lines.push(segment);
                            connectionCounts.set(a.id, countA + 1);
                            connectionCounts.set(b.id, countB + 1);
                        }
                    }
                }
            }
        }

        this.ctx.strokeStyle = 'rgba(255,255,200,0.2)';
        this.ctx.lineWidth = 1;
        for (const l of lines) {
            this.ctx.beginPath();
            this.ctx.moveTo(l.a.x, l.a.y);
            this.ctx.lineTo(l.b.x, l.b.y);
            this.ctx.stroke();
        }
    }

    ccw(ax, ay, bx, by, cx, cy) {
        return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
    }

    intersects(a1, a2, b1, b2) {
        return (
            this.ccw(a1.x, a1.y, b1.x, b1.y, b2.x, b2.y) !== this.ccw(a2.x, a2.y, b1.x, b1.y, b2.x, b2.y) &&
            this.ccw(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y) !== this.ccw(a1.x, a1.y, a2.x, a2.y, b2.x, b2.y)
        );
    }
}

new StarsToy();