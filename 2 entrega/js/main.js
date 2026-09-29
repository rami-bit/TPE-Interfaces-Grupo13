document.addEventListener("DOMContentLoaded", () => {

    // 1. EL JEFE: LLAMA A LA API UNA SOLA VEZ Y REPARTE LAS CARTAS
    fetch('https://vj.interfaces.jima.com.ar/api/v2')
        .then(response => response.json())
        .then(games => {

            // --- HERO BANNER (Juegos 0, 1, 2) ---
            renderizarHeroBanner(games.slice(0, 3));
            inicializarCarruselHero('hero-track', 'btn-prev', 'btn-next', '.punto');

            // --- CARRUSEL TENDENCIAS (Juegos 3 al 10) ---
            renderizarCarruselChico(games.slice(3, 11), 'carrusel-destacados');
            inicializarCarruselUniversal('carrusel-destacados', 'btn-prev-chico', 'btn-next-chico');

            // Acá el día de mañana podés agregar más carruseles:
            // renderizarCarruselChico(games.slice(11, 19), 'carrusel-accion');
            // inicializarCarruselUniversal('carrusel-accion', 'btn-prev-accion', 'btn-next-accion');
        })
        .catch(error => console.error("Error al cargar los juegos de la API:", error));
});


/* ========================================================================= */
/*                   MÁQUINAS DEL CARRUSEL (Lógica de JS)                    */
/* ========================================================================= */

// MÁQUINA UNIVERSAL 
function inicializarCarruselUniversal(trackId, btnPrevId, btnNextId) {
    const track = document.getElementById(trackId);
    const btnNext = document.getElementById(btnNextId);
    const btnPrev = document.getElementById(btnPrevId);

    if (!track || !btnNext || !btnPrev) return;

    let currentTranslate = 0;

    // Calculamos cuánto scrollear: buscamos el ancho real de las cards + el gap de 30px
    const getScrollAmount = () => {
        const card = track.querySelector('.card-juego');
        if (card) {
            const cardWidth = card.clientWidth + 30; // 260px de card + 30px de gap
            const cardsVisibles = Math.max(1, Math.floor(track.parentElement.clientWidth / cardWidth));
            return cardWidth * cardsVisibles;
        }
        return track.parentElement.clientWidth * 0.8;
    };

    // Calculamos el tope máximo que podemos movernos a la izquierda
    const getMaxTranslate = () => {
        // Ancho total de la cinta menos el ancho visible por la "cámara"
        return Math.max(0, track.scrollWidth - track.parentElement.clientWidth);
    };

    // Función que evalúa si los botones deben estar encendidos o apagados
    const actualizarBotones = () => {
        btnPrev.disabled = currentTranslate === 0;
        btnNext.disabled = currentTranslate >= getMaxTranslate();
    };

    btnNext.addEventListener('click', () => {
        const max = getMaxTranslate();
        currentTranslate += getScrollAmount();

        // Si nos pasamos del máximo, nos clavamos en el máximo
        if (currentTranslate > max) {
            currentTranslate = max;
        }

        track.style.transform = `translateX(-${currentTranslate}px)`;
        actualizarBotones();
    });

    btnPrev.addEventListener('click', () => {
        currentTranslate -= getScrollAmount();

        // Si nos pasamos de cero (números negativos), nos clavamos en 0
        if (currentTranslate < 0) {
            currentTranslate = 0;
        }

        track.style.transform = `translateX(-${currentTranslate}px)`;
        actualizarBotones();
    });

    // Cuando arranca la página, ejecutamos una vez para que Prev nazca apagado
    setTimeout(actualizarBotones, 100);
}

// MÁQUINA ESPECÍFICA DEL HERO BANNER 
function inicializarCarruselHero(trackId, btnPrevId, btnNextId, puntosSelector) {
    const track = document.getElementById(trackId);
    const btnNext = document.getElementById(btnNextId);
    const btnPrev = document.getElementById(btnPrevId);
    const slides = document.querySelectorAll('.hero-slide');
    const puntos = document.querySelectorAll(puntosSelector);

    if (!track || slides.length === 0) return;

    let currentIndex = 0;
    const getSlideWidth = () => slides[0].clientWidth;

    const actualizarBotones = () => {
        if (btnPrev) btnPrev.disabled = currentIndex === 0;
        if (btnNext) btnNext.disabled = currentIndex === slides.length - 1;
    };

    const goToSlide = (index) => {
        if (index < 0 || index >= slides.length) return;
        currentIndex = index;

        // Calculamos la posición en píxeles y movemos la pista
        const translatePosition = currentIndex * getSlideWidth();
        track.style.transform = `translateX(-${translatePosition}px)`;

        puntos.forEach((p, i) => {
            p.classList.toggle('activo', i === currentIndex);
        });
        actualizarBotones();
    };

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (currentIndex < slides.length - 1) goToSlide(currentIndex + 1);
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (currentIndex > 0) goToSlide(currentIndex - 1);
        });
    }

    puntos.forEach((punto, index) => {
        punto.addEventListener('click', () => goToSlide(index));
    });

    actualizarBotones();
}


/* ========================================================================= */
/*                     FUNCIONES OBRERAS (Fabrican el HTML)                  */
/* ========================================================================= */

function renderizarHeroBanner(juegos) {
    const track = document.getElementById('hero-track');
    if (!track) return;

    juegos.forEach((game, index) => {
        const genero = game.genres && game.genres.length > 0 ? game.genres[0].name : 'Acción';
        const añoLanzamiento = game.released ? game.released.substring(0, 4) : '2020';

        let descCorta = game.description || '';
        if (descCorta.length > 150) {
            descCorta = descCorta.substring(0, 150) + '...';
        }

        const slideHTML = `
            <div class="hero-slide">
                <div class="hero-contenido">
                    <h1>${game.name}</h1>
                    <p class="hero-descripcion body-base">${descCorta}</p>
                    <div class="hero-tags body-base">
                        <span>${genero}</span> &bull; <span>⭐ ${game.rating}</span> &bull; <span>${añoLanzamiento}</span>
                    </div>
                    <div class="hero-botones">
                        <button class="btn-primario h3">Jugar</button>
                        <button class="btn-fav-hero" aria-label="Favoritos">
                            <svg viewBox="0 0 65 53" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path d="M32.4652 39.9806L30.4253 38.1236C23.1802 31.5537 18.397 27.2067 18.397 21.9029C18.397 17.5559 21.8015 14.1654 26.1345 14.1654C28.5824 14.1654 30.9318 15.3049 32.4652 17.0916C33.9986 15.3049 36.348 14.1654 38.7959 14.1654C43.1289 14.1654 46.5335 17.5559 46.5335 21.9029C46.5335 27.2067 41.7502 31.5537 34.5051 38.1236L32.4652 39.9806Z" />
                            </svg>
                        </button>
                        ${index === 0 ? `
                        <div class="etiqueta-pro-carrusel">
                            <svg width="31" height="25" viewBox="0 0 31 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M29.2792 2.69097C28.8093 2.50059 28.2917 2.45055 27.7924 2.54722C27.2931 2.64388 26.8347 2.88288 26.4755 3.23377L23.1497 6.46807L17.2517 0.732374C16.7693 0.263435 16.1152 0 15.4331 0C14.7511 0 14.097 0.263435 13.6146 0.732374L7.71657 6.46807L4.39073 3.23377C4.031 2.88405 3.57273 2.6459 3.07385 2.54943C2.57496 2.45296 2.05787 2.50249 1.58793 2.69177C1.11799 2.88105 0.71631 3.20158 0.433667 3.61283C0.151024 4.02409 0.000108609 4.5076 0 5.00225L0 18.2421C0.00204213 19.9001 0.680192 21.4895 1.8857 22.6618C3.0912 23.8342 4.72563 24.4936 6.43047 24.4956H24.4358C26.1406 24.4936 27.7751 23.8342 28.9806 22.6618C30.1861 21.4895 30.8642 19.9001 30.8663 18.2421V5.00225C30.8664 4.50756 30.7157 4.02394 30.4332 3.61254C30.1507 3.20114 29.7491 2.88043 29.2792 2.69097Z" fill="var(--primarioLuz2)"/>
                            </svg>
                            <h3 class="h3">PRO</h3>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="hero-imagen">
                    <img src="${game.background_image}" alt="${game.name}">
                </div>
            </div>
        `;
        track.insertAdjacentHTML('beforeend', slideHTML);
    });
}

function renderizarCarruselChico(juegos, trackId) {
    const track = document.getElementById(trackId);
    if (!track) return;

    // Limpiamos el track por si tenía las cards de prueba del HTML
    track.innerHTML = '';

    juegos.forEach((game, index) => {
        const slideHTML = `
            <article class="card-juego">
                <div class="card-imagen">
                    <img src="${game.background_image}" alt="${game.name}">
                </div>
                
                <!-- Le ponemos la etiqueta PRO a la 2da y 4ta card reales como demostración -->
                ${(index === 1 || index === 3) ? `
                <div class="etiqueta-pro-carrusel card-etiqueta-pro">
                    <svg viewBox="0 0 31 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M29.2792 2.69097C28.8093 2.50059 28.2917 2.45055 27.7924 2.54722C27.2931 2.64388 26.8347 2.88288 26.4755 3.23377L23.1497 6.46807L17.2517 0.732374C16.7693 0.263435 16.1152 0 15.4331 0C14.7511 0 14.097 0.263435 13.6146 0.732374L7.71657 6.46807L4.39073 3.23377C4.031 2.88405 3.57273 2.6459 3.07385 2.54943C2.57496 2.45296 2.05787 2.50249 1.58793 2.69177C1.11799 2.88105 0.71631 3.20158 0.433667 3.61283C0.151024 4.02409 0.000108609 4.5076 0 5.00225L0 18.2421C0.00204213 19.9001 0.680192 21.4895 1.8857 22.6618C3.0912 23.8342 4.72563 24.4936 6.43047 24.4956H24.4358C26.1406 24.4936 27.7751 23.8342 28.9806 22.6618C30.1861 21.4895 30.8642 19.9001 30.8663 18.2421V5.00225C30.8664 4.50756 30.7157 4.02394 30.4332 3.61254C30.1507 3.20114 29.7491 2.88043 29.2792 2.69097Z" fill="var(--primarioLuz2)"/>
                    </svg>
                    <span class="label">PRO</span>
                </div>
                ` : ''}

                <div class="card-overlay">
                    <h3 class="card-titulo h4">${game.name}</h3>
                </div>
            </article>
        `;
        track.insertAdjacentHTML('beforeend', slideHTML);
    });
}
