document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('nav a');
    const iframe = document.querySelector('#toy-frame');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const main = document.querySelector('main');

    function loadToy(toyName) {
        iframe.src = `toys/toy.html?toy=${toyName}`;
    }

    function activateToy(toyName) {
        loadToy(toyName);
        navLinks.forEach(l => l.classList.toggle('active', l.dataset.toy === toyName));
    }

    function toyFromHash() {
        const hash = location.hash.slice(1);
        return [...navLinks].find(l => l.dataset.toy === hash)?.dataset.toy;
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            location.hash = link.dataset.toy;
        });
    });

    window.addEventListener('hashchange', () => {
        const toy = toyFromHash() || navLinks[0]?.dataset.toy;
        if (toy) activateToy(toy);
    });

    // Load from hash on arrival, fall back to first toy
    const initial = toyFromHash() || navLinks[0]?.dataset.toy;
    if (initial) activateToy(initial);

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            main.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    });

    document.addEventListener('fullscreenchange', () => {
        const isFullscreen = !!document.fullscreenElement;
        main.classList.toggle('fullscreen', isFullscreen);
        if (isFullscreen) {
            iframe.contentWindow.postMessage('enter-fullscreen', '*');
        } else {
            iframe.contentWindow.postMessage('exit-fullscreen', '*');
        }
    });
});