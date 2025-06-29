class Toy {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('container');
        this.videoAspectRatio = 1;

        this.init();
    }

    async init() {
        await this.startWebcam();
        this.video.addEventListener('loadeddata', () => {
            this.videoAspectRatio = this.video.videoWidth / this.video.videoHeight;
            this.resize();
            this.render();
        });

        window.addEventListener('resize', () => this.resize());
        window.addEventListener('message', (event) => {
            if (event.data === 'enter-fullscreen') {
                this.video.style.objectFit = this.canvas.style.objectFit = 'cover';
            } else if (event.data === 'exit-fullscreen') {
                this.video.style.objectFit = this.canvas.style.objectFit = 'contain';
            }
            this.resize();
        });
    }

    async startWebcam() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.video.srcObject = stream;
        } catch (err) {
            console.error('Error accessing webcam:', err);
        }
    }

    resize() {
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;
        const containerAspectRatio = containerWidth / containerHeight;

        let newWidth, newHeight, newLeft, newTop;

        if (this.video.style.objectFit === 'cover') {
            if (containerAspectRatio > this.videoAspectRatio) {
                newWidth = containerWidth;
                newHeight = newWidth / this.videoAspectRatio;
                newLeft = 0;
                newTop = (containerHeight - newHeight) / 2;
            } else {
                newHeight = containerHeight;
                newWidth = newHeight * this.videoAspectRatio;
                newTop = 0;
                newLeft = (containerWidth - newWidth) / 2;
            }
        } else { // contain
            if (containerAspectRatio > this.videoAspectRatio) {
                newHeight = containerHeight;
                newWidth = newHeight * this.videoAspectRatio;
                newTop = 0;
                newLeft = (containerWidth - newWidth) / 2;
            } else {
                newWidth = containerWidth;
                newHeight = newWidth / this.videoAspectRatio;
                newLeft = 0;
                newTop = (containerHeight - newHeight) / 2;
            }
        }

        this.video.style.width = this.canvas.style.width = `${newWidth}px`;
        this.video.style.height = this.canvas.style.height = `${newHeight}px`;
        this.video.style.left = this.canvas.style.left = `${newLeft}px`;
        this.video.style.top = this.canvas.style.top = `${newTop}px`;

        this.canvas.width = newWidth;
        this.canvas.height = newHeight;

        if (this.onResize) {
            this.onResize(newWidth, newHeight);
        }
    }

    render() {
        if (this.draw) {
            this.draw();
        }
        requestAnimationFrame(() => this.render());
    }
}
