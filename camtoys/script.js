document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('nav a');
    const iframe = document.querySelector('#toy-frame');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const main = document.querySelector('main');

    function loadToy(toyName) {
        iframe.src = `toys/toy.html?toy=${toyName}`;
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const toyName = link.dataset.toy;
            loadToy(toyName);

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Load the first toy by default
    if (navLinks.length > 0) {
        const firstToy = navLinks[0].dataset.toy;
        loadToy(firstToy);
        navLinks[0].classList.add('active');
    }

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