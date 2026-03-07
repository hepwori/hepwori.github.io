class StarsToy extends Toy {
    constructor() {
        super();

        this.N = 8;
        this.STAR_BLUR_RADIUS = 10;
        this.EDGE_MARGIN = 40;
        this.MIN_PEAK_DIST = 30;

        this.nextId = 1;
        this.stars = [];

        this.blurCanvas = document.createElement('canvas');
        this.blurCtx = this.blurCanvas.getContext('2d');
    }

    onResize(w, h) {
        const oldW = this.blurCanvas.width  || w;
        const oldH = this.blurCanvas.height || h;
        const sx = w / oldW, sy = h / oldH;
        for (const s of this.stars) {
            s.x  *= sx; s.y  *= sy;
            s.tx *= sx; s.ty *= sy;
            s.vx *= sx; s.vy *= sy;
        }
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

        const now = performance.now();
        const dt = this.lastTime ? now - this.lastTime : 1000 / 60;
        this.lastTime = now;

        const peaks = this.getLocalMaxima(lum, w, h);
        this.matchStarsToTargets(peaks);
        this.updateStars(dt);
        this.drawStars();
    }

    getLuminanceData(imageData, width, height) {
        const luminance = new Float32Array(width * height);
        for (let i = 0; i < luminance.length; i++) {
            const idx = i * 4;
            luminance[i] = 0.299 * imageData.data[idx] +
                           0.587 * imageData.data[idx + 1] +
                           0.114 * imageData.data[idx + 2];
        }
        return luminance;
    }

    getLocalMaxima(luminance, width, height) {
        // Find all local maxima within the margin
        const allPeaks = [];
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                if (x < this.EDGE_MARGIN || x > width - this.EDGE_MARGIN ||
                    y < this.EDGE_MARGIN || y > height - this.EDGE_MARGIN) continue;
                const i = y * width + x;
                const val = luminance[i];
                let isMax = true;
                for (let dy = -1; dy <= 1 && isMax; dy++) {
                    for (let dx = -1; dx <= 1 && isMax; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        if (luminance[(y + dy) * width + (x + dx)] > val) isMax = false;
                    }
                }
                if (isMax) allPeaks.push({ x, y, brightness: val });
            }
        }
        allPeaks.sort((a, b) => b.brightness - a.brightness);

        // Grid-based selection: divide the frame into cells, take the
        // brightest peak per cell. This forces spatial distribution and
        // prevents all stars from bunching in a bright corner.
        const cols = 4, rows = 3;
        const cellW = (width  - 2 * this.EDGE_MARGIN) / cols;
        const cellH = (height - 2 * this.EDGE_MARGIN) / rows;
        const cells = new Array(cols * rows).fill(null);

        for (const peak of allPeaks) {
            const col = Math.min(cols - 1, Math.floor((peak.x - this.EDGE_MARGIN) / cellW));
            const row = Math.min(rows - 1, Math.floor((peak.y - this.EDGE_MARGIN) / cellH));
            const idx = row * cols + col;
            if (!cells[idx]) cells[idx] = peak;
        }

        // Collect non-empty cells, apply a minimum distance filter, cap at N
        const candidates = cells.filter(Boolean);
        const result = [];
        for (const peak of candidates) {
            let tooClose = false;
            for (const p of result) {
                const dx = peak.x - p.x, dy = peak.y - p.y;
                if (dx * dx + dy * dy < this.MIN_PEAK_DIST * this.MIN_PEAK_DIST) {
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) result.push(peak);
            if (result.length >= this.N) break;
        }

        // Compute display size for each star based on nearest-neighbour distance
        for (let i = 0; i < result.length; i++) {
            let minD = Infinity;
            for (let j = 0; j < result.length; j++) {
                if (i === j) continue;
                const dx = result[i].x - result[j].x, dy = result[i].y - result[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < minD) minD = d;
            }
            const scale = this.canvas.clientWidth / 640;
            const raw = Math.max(1.2, Math.min(4.8, minD / 10));
            result[i].size = scale * ((raw - 1.2) * 1.8 + 1.2);
        }

        return result;
    }

    matchStarsToTargets(peaks) {
        const unmatched = [...peaks];
        for (const star of this.stars) {
            let closest = null, closestDist = Infinity;
            for (let i = 0; i < unmatched.length; i++) {
                const p = unmatched[i];
                const dx = star.x - p.x, dy = star.y - p.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < closestDist) { closest = i; closestDist = d2; }
            }
            if (closest !== null) {
                const p = unmatched.splice(closest, 1)[0];
                star.tx = p.x; star.ty = p.y; star.targetSize = p.size;
            }
        }
        for (const p of unmatched) {
            this.stars.push({
                id: this.nextId++,
                x: p.x, y: p.y,
                tx: p.x, ty: p.y,
                size: p.size, targetSize: p.size,
                vx: 0, vy: 0,
            });
        }
    }

    updateStars(dt) {
        const t = Math.min(dt / (1000 / 60), 3); // normalize to 60fps, cap to avoid jumps
        const attraction = 0.005, maxSpeed = this.canvas.width * 0.0008;
        const damping = Math.pow(0.9, t);
        for (const s of this.stars) {
            const dx = s.tx - s.x, dy = s.ty - s.y;
            s.vx = (s.vx + dx * attraction * t) * damping;
            s.vy = (s.vy + dy * attraction * t) * damping;
            const speed = Math.hypot(s.vx, s.vy);
            if (speed > maxSpeed) { s.vx *= maxSpeed / speed; s.vy *= maxSpeed / speed; }
            s.x += s.vx * t;
            s.y += s.vy * t;
            s.size += (s.targetSize - s.size) * 0.05 * t;
        }
    }

    // Build constellation lines using an angle-aware spanning tree.
    // Works like Kruskal's MST (shortest edges first) but rejects any edge
    // that would create a shallow angle (<MIN_ANGLE) at either endpoint with
    // an already-connected edge. This eliminates zigzags and produces
    // branching shapes that actually look like constellations.
    buildConstellation(stars) {
        if (stars.length < 2) return [];

        const MIN_ANGLE = Math.PI / 5; // ~36° — reject near-collinear junctions
        const MAX_DEGREE = 3;          // cap connections per star to avoid over-linking

        const edges = [];
        for (let i = 0; i < stars.length; i++) {
            for (let j = i + 1; j < stars.length; j++) {
                const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y;
                edges.push({ a: stars[i], b: stars[j], dist: Math.sqrt(dx * dx + dy * dy) });
            }
        }
        edges.sort((e1, e2) => e1.dist - e2.dist);

        const neighbors = new Map();
        const degrees  = new Map();
        for (const s of stars) { neighbors.set(s.id, []); degrees.set(s.id, 0); }

        const lines = [];

        for (const edge of edges) {
            // Allow one edge beyond a spanning tree so Kruskal has room to
            // attach branches rather than always terminating as a chain.
            if (lines.length >= stars.length + 1) break;

            const { a, b } = edge;

            // Reject if either star is already at max degree
            if (degrees.get(a.id) >= MAX_DEGREE || degrees.get(b.id) >= MAX_DEGREE) continue;

            // Reject if this edge crosses any existing line
            let crosses = false;
            for (const l of lines) {
                if (this.intersects(a, b, l.a, l.b)) { crosses = true; break; }
            }
            if (crosses) continue;

            // Reject if the angle at vertex A or B with any existing edge is too shallow
            const abAngle = Math.atan2(b.y - a.y, b.x - a.x);
            const baAngle = abAngle + Math.PI;
            let badAngle = false;

            for (const n of neighbors.get(a.id)) {
                const existing = Math.atan2(n.y - a.y, n.x - a.x);
                if (angleBetween(abAngle, existing) < MIN_ANGLE) { badAngle = true; break; }
            }
            if (!badAngle) {
                for (const n of neighbors.get(b.id)) {
                    const existing = Math.atan2(n.y - b.y, n.x - b.x);
                    if (angleBetween(baAngle, existing) < MIN_ANGLE) { badAngle = true; break; }
                }
            }
            if (badAngle) continue;

            lines.push(edge);
            neighbors.get(a.id).push(b);
            neighbors.get(b.id).push(a);
            degrees.set(a.id, degrees.get(a.id) + 1);
            degrees.set(b.id, degrees.get(b.id) + 1);
        }

        return lines;
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

        const lines = this.buildConstellation(this.stars);
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

function angleBetween(a1, a2) {
    let diff = Math.abs(a1 - a2) % (2 * Math.PI);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    return diff;
}

new StarsToy();
