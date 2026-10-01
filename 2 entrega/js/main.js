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

            // --- CARRUSEL JUEGOS RECOMENDADOS (Juegos 11, 12, 13) ---
            renderizarCarruselCentrado(games.slice(11, 14), 'carrusel-grande');

            // Función enchufe para manejar la opacidad y el hover
            const estiloCentrado = (indice, track) => {
                const cartas = track.querySelectorAll('.card-grande');
                cartas.forEach((carta, i) => {
                    carta.classList.toggle('activo', i === indice);
                });
            };

            // Lo inicializamos pasando el estiloCentrado, el startIndex = 1 y aclarando que esCentrado = true
            inicializarCarruselUniversal('carrusel-grande', 'btn-prev-grande', 'btn-next-grande', estiloCentrado, 1, true);


            // --- CARRUSEL Nuevos Juegos (Juegos 22 al 29) ---
            renderizarCarruselChico(games.slice(22, 30), 'carrusel-populares');
            inicializarCarruselUniversal('carrusel-populares', 'btn-prev-populares', 'btn-next-populares');

            // --- CARRUSEL Para ti (Juegos 14 al 21) ---
            renderizarCarruselChico(games.slice(14, 22), 'carrusel-nuevos');
            inicializarCarruselUniversal('carrusel-nuevos', 'btn-prev-nuevos', 'btn-next-nuevos');

            // --- NUEVO: CARRUSEL MIXTO (Juegos 30 al 44) ---
            // Le pasamos 15 juegos para que arme 3 ciclos completos (1 grande + 4 chicas = 5 juegos por ciclo)
            renderizarCarruselMixto(games.slice(30, 45), 'carrusel-mixto');
            inicializarCarruselUniversal('carrusel-mixto', 'btn-prev-mixto', 'btn-next-mixto');

            // --- RPG (Carrusel Chico Filtrado) ---
            const juegosRPG = filtrarJuegosPorGenero(games, 'rpg');
            renderizarCarruselChico(juegosRPG, 'carrusel-rpg');
            inicializarCarruselUniversal('carrusel-rpg', 'btn-prev-rpg', 'btn-next-rpg');

            // --- AVENTURA PURA (Carrusel Chico Filtrado) ---
            const juegosAventura = filtrarJuegosPorGenero(games, 'Adventure');
            renderizarCarruselChico(juegosAventura, 'carrusel-aventura');
            inicializarCarruselUniversal('carrusel-aventura', 'btn-prev-aventura', 'btn-next-aventura');

            // --- ACCIÓN (Carrusel Vertical) ---
            const juegosAccion = filtrarJuegosPorGenero(games, 'Action');
            renderizarCarruselVertical(juegosAccion, 'carrusel-accion');
            inicializarCarruselUniversal('carrusel-accion', 'btn-prev-accion', 'btn-next-accion');


            renderizarCarruselChico(games.slice(38, 47), 'carrusel-valoracion');
            inicializarCarruselUniversal('carrusel-valoracion', 'btn-prev-valoracion', 'btn-next-valoracion');
            // ==========================================
            // FUNCIÓN PARA FILTRAR JUEGOS POR GÉNERO
            // ==========================================
            function filtrarJuegosPorGenero(listaJuegos, genero) {
                return listaJuegos.filter(game =>
                    game.genres && game.genres.some(g => g.name.toLowerCase() === genero.toLowerCase())
                );
            }

        })
        .catch(error => console.error("Error al cargar los juegos de la API:", error));
});


/* ========================================================================= */
/*                   MÁQUINAS DEL CARRUSEL (Lógica de JS)                    */
/* ========================================================================= */

/* ========================================================================= */
/*                              MÁQUINA UNIVERSAL                  */
/* ========================================================================= */
function inicializarCarruselUniversal(trackId, btnPrevId, btnNextId, alMoverse = null, startIndex = 0, isCentered = false) {
    const track = document.getElementById(trackId);
    const btnNext = document.getElementById(btnNextId);
    const btnPrev = document.getElementById(btnPrevId);

    if (!track || !btnNext || !btnPrev) return;

    // Arrancamos enfocando la card que nos pasen (por defecto la 0)
    let currentIndex = startIndex;

    // 1. Averiguar cuánto mide 1 sola card real (+ su hueco)
    const getCardWidth = () => {
        const card = track.children[0];
        if (!card) return 0;
        // Leemos el gap exacto directo del CSS para que soporte cualquier diseño
        const gap = parseFloat(window.getComputedStyle(track).gap) || 0;
        return card.clientWidth + gap;
    };

    // 2. Averiguar cuántas cards entran enteras en el ancho actual del monitor
    const getCardsVisibles = () => {
        // IMPORTANTE: Si el carrusel es "centrado", la lógica de "cuántas entran en pantalla" no sirve.
        // Queremos poder llegar hasta la ultimísima carta dejándola en el centro de la pantalla.
        if (isCentered) return 1;

        const cardWidth = getCardWidth();
        if (cardWidth === 0) return 1;
        // Si entran 3.4 cards, redondea a 3. Si entra 0.8 (card gigante), devuelve mínimo 1.
        return Math.max(1, Math.floor(track.parentElement.clientWidth / cardWidth));
    };

    // 3. Averiguar cuál es el tope máximo para no pasarnos de largo
    const getMaxIndex = () => {
        const totalCards = track.children.length;
        const visibles = getCardsVisibles();
        return Math.max(0, totalCards - visibles);
    };

    const actualizar = () => {
        // SEGURO ANTI-BUGS DE RESIZE: si el usuario agrandó la pantalla, el límite máximo achica.
        // Nos aseguramos de no haber quedado varados fuera del mapa.
        const max = getMaxIndex();
        if (currentIndex > max) currentIndex = max;

        // Traducimos el índice a píxeles exactos
        let translatePosition = currentIndex * getCardWidth();

        // FIX: Evitar el "vacío" al final del carrusel cuando la última carta no llena toda la pantalla
        if (!isCentered) {
            // Calculamos el máximo scroll físico posible
            const maxTranslate = Math.max(0, track.scrollWidth - track.parentElement.clientWidth);
            if (translatePosition > maxTranslate) {
                translatePosition = maxTranslate + 30;
            }
        }

        track.style.transform = `translateX(-${translatePosition}px)`;

        // Controlamos las flechas
        btnPrev.disabled = currentIndex <= 0;
        btnNext.disabled = currentIndex >= getMaxIndex();

        // MAGIA: Si el carrusel tiene una función de estilo particular enchufada, la ejecutamos
        if (alMoverse) {
            alMoverse(currentIndex, track);
        }
    };

    const avanzar = () => {
        const salto = getCardsVisibles();
        currentIndex += salto;
        const max = getMaxIndex();
        if (currentIndex > max) currentIndex = max;
        actualizar();
    };

    const retroceder = () => {
        const salto = getCardsVisibles();
        currentIndex -= salto;
        if (currentIndex < 0) currentIndex = 0;
        actualizar();
    };

    const snap = (distanceMoved) => {
        const cardWidth = getCardWidth();
        let indicesMoved = Math.round(-distanceMoved / cardWidth);

        if (indicesMoved === 0 && distanceMoved < -50) indicesMoved = 1;
        if (indicesMoved === 0 && distanceMoved > 50) indicesMoved = -1;

        currentIndex += indicesMoved;

        if (currentIndex < 0) currentIndex = 0;
        const max = getMaxIndex();
        if (currentIndex > max) currentIndex = max;

        actualizar();
    };

    btnNext.addEventListener('click', avanzar);
    btnPrev.addEventListener('click', retroceder);

    // MÁGIA: Le agregamos capacidad de arrastre (touch/mouse)
    habilitarTouch(track, snap, () => currentIndex * getCardWidth());

    // Actualizamos al instante para pintar las clases CSS (ej: activo)
    actualizar();

    // Y recalculamos después por si tardan las imágenes o rotan el celular
    setTimeout(actualizar, 100);
    window.addEventListener('resize', actualizar);
}

/* ========================================================================= */
/*                              MÁQUINA HERO BANNER                  */
/* ========================================================================= */
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

    const avanzar = () => {
        if (currentIndex < slides.length - 1) goToSlide(currentIndex + 1);
        else goToSlide(currentIndex); // Vuelve a su lugar si choca contra la pared
    };

    const retroceder = () => {
        if (currentIndex > 0) goToSlide(currentIndex - 1);
        else goToSlide(currentIndex);
    };

    const snap = (distanceMoved) => {
        const slideWidth = getSlideWidth();
        let indicesMoved = Math.round(-distanceMoved / slideWidth);

        if (indicesMoved === 0 && distanceMoved < -50) indicesMoved = 1;
        if (indicesMoved === 0 && distanceMoved > 50) indicesMoved = -1;

        currentIndex += indicesMoved;

        if (currentIndex < 0) currentIndex = 0;
        if (currentIndex > slides.length - 1) currentIndex = slides.length - 1;

        goToSlide(currentIndex);
    };

    if (btnNext) btnNext.addEventListener('click', avanzar);
    if (btnPrev) btnPrev.addEventListener('click', retroceder);

    // MÁGIA: Le agregamos capacidad de arrastre al Hero Banner también
    habilitarTouch(track, snap, () => currentIndex * getSlideWidth());

    puntos.forEach((punto, index) => {
        punto.addEventListener('click', () => goToSlide(index));
    });

    // Arrancamos todo
    setTimeout(() => goToSlide(0), 100);

    // SEGURO ANTI-BUGS DE RESIZE: recalcula los anchos cuando el celular rota a PC
    window.addEventListener('resize', () => goToSlide(currentIndex));
}

/* ========================================================================= */
/*           FUNCIÓN DE ARRASTRE TÁCTIL (CELULARES Y MOUSE)            */
/* ========================================================================= */
function habilitarTouch(track, onSnap, getPosicionBase) {
    let isDragging = false;
    let startPos = 0;


    const touchStart = (event) => {
        isDragging = true;
        startPos = event.touches[0].clientX;
        track.style.transition = 'none';
    };

    const touchMove = (event) => {
        if (!isDragging) return;
        const currentPosition = event.touches[0].clientX;
        const distanceMoved = currentPosition - startPos;
        const baseTranslate = getPosicionBase();

        track.style.transform = `translateX(-${baseTranslate - distanceMoved}px)`;
    };

    const touchEnd = (event) => {
        if (!isDragging) return;
        isDragging = false;
        track.style.transition = 'transform 0.5s ease-in-out';

        const endPos = event.changedTouches[0].clientX;
        const distanceMoved = endPos - startPos;

        // Le mandamos los píxeles arrastrados a la función principal para que ella calcule a qué carta saltar
        onSnap(distanceMoved);
    };

    // Eventos táctiles EXCLUSIVOS para Celular
    track.addEventListener('touchstart', touchStart, { passive: true });
    track.addEventListener('touchmove', touchMove, { passive: true });
    track.addEventListener('touchend', touchEnd);
}

/* ========================================================================= */
/*                     FUNCIONES OBRERAS (Fabrican el HTML)                  */
/* ========================================================================= */
/* ========================================================================= */
/*             RENDER: CARRUSEL HERO BANNER                           */
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
/* ========================================================================= */
/*             RENDER: CARRUSEL CHICO                            */
/* ========================================================================= */
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
                    <h3 class="card-titulo h4" title="${game.name}">${game.name}</h3>
                </div>
            </article>
        `;
        track.insertAdjacentHTML('beforeend', slideHTML);
    });
}

/* ========================================================================= */
/*             RENDER: CARRUSEL VERTICAL (ACCIÓN)                            */
/* ========================================================================= */
function renderizarCarruselVertical(games, trackId) {
    const track = document.getElementById(trackId);
    if (!track) return;
    track.innerHTML = '';

    games.forEach(game => {
        const slideHTML = `
            <article class="card-vertical">
                <div class="card-imagen">
                    <img src="${game.background_image}" alt="${game.name}" loading="lazy">
                </div>
                <div class="card-overlay">
                    <h3 class="card-titulo h4" title="${game.name}">${game.name}</h3>
                </div>
            </article>
        `;
        track.insertAdjacentHTML('beforeend', slideHTML);
    });
}

/* ========================================================================= */
/*             RENDER: CARRUSEL CENTRADO (JUEGOS RECOMENDADOS)               */
/* ========================================================================= */

// DICCIONARIO DE ÍCONOS POR GÉNERO (Solo guardamos el SVG puro)
const iconosPorGenero = {
    "Action": `
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.5846 0.942319C10.7125 0.670198 10.9781 0.431311 11.3415 0.261434C11.7049 0.0915577 12.1466 -0.000165855 12.6004 2.25137e-07H29.3993C29.7319 0.000157999 30.0596 0.0496778 30.3556 0.144483C30.6515 0.239288 30.9072 0.376668 31.1016 0.545312C31.2959 0.713956 31.4235 0.909042 31.4736 1.11451C31.5238 1.31998 31.4951 1.52995 31.39 1.72715L23.9145 15.7491H39.8987C40.2919 15.7489 40.6773 15.8177 41.011 15.9478C41.3447 16.0778 41.6133 16.2638 41.7862 16.4845C41.9591 16.7053 42.0293 16.9519 41.9889 17.1964C41.9485 17.4409 41.799 17.6733 41.5576 17.8673L12.1595 41.4909C11.8583 41.7341 11.4301 41.9034 10.9495 41.9694C10.469 42.0354 9.96659 41.9938 9.53007 41.852C9.09356 41.7101 8.75061 41.4769 8.56109 41.1931C8.37156 40.9093 8.3475 40.593 8.49309 40.2992L16.0568 24.936H2.1011C1.77463 24.9361 1.45261 24.8887 1.16062 24.7974C0.868634 24.7061 0.614714 24.5736 0.41903 24.4103C0.223345 24.2469 0.0912864 24.0573 0.0333412 23.8565C-0.024604 23.6557 -0.00683961 23.4493 0.0852242 23.2535L10.5846 0.942319Z" fill="#0D0202"/>
        </svg>
    `,
    "Sports": `
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.2545 0C15.4035 0.171396 10.6012 2.01688 6.78022 5.53626L16.5568 15.3129C19.6137 11.8307 21.0118 6.64672 20.2545 0ZM22.0257 0.0104556C22.7728 6.9684 21.2642 12.6707 17.8021 16.5584L21 19.7561L35.2199 5.53626C31.4724 2.0845 26.7812 0.242045 22.0257 0.0104556ZM5.53627 6.7802C2.01679 10.6011 0.171396 15.4034 0 20.2544C6.64674 21.0117 11.8306 19.6137 15.313 16.5568L5.53627 6.7802ZM36.4638 6.7802L22.244 21L25.4403 24.1963C28.7446 21.2539 33.3603 19.7228 38.9432 19.7883C39.929 19.7998 40.9454 19.8619 41.9896 19.974C41.7581 15.2186 39.9154 10.5275 36.4637 6.7802H36.4638ZM16.5583 17.8019C12.6706 21.264 6.96832 22.7728 0.0104556 22.0255C0.242046 26.781 2.0846 31.4723 5.53637 35.2198L19.7561 21L16.5583 17.8019ZM38.5449 21.5415C33.5369 21.5457 29.5409 22.9379 26.6871 25.4432L36.4637 35.2198C39.9832 31.3989 41.8286 26.5966 42 21.7456C40.8005 21.6088 39.6476 21.5408 38.5447 21.5416L38.5449 21.5415ZM21 22.2439L6.78022 36.4637C10.5277 39.9155 15.2189 41.758 19.9744 41.9896C19.2273 35.0317 20.7359 29.3294 24.198 25.4417L21 22.2439ZM25.4433 26.6871C22.3864 30.1693 20.9883 35.3533 21.7456 42C26.5966 41.8286 31.3989 39.9831 35.2199 36.4637L25.4433 26.6871Z" fill="black"/>
        </svg>
    `,
    "RPG": `
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M35.6248 0.000106974C34.9722 -0.00254738 34.3404 0.0443462 33.8743 0.123977C33.4289 0.200069 33.1595 0.372602 33.1699 0.323054C32.6106 1.12555 32.0201 2.53148 31.8959 3.72682C31.8233 4.34175 31.8751 4.89563 32.0305 5.26547C32.1859 5.63442 32.362 5.80519 32.7038 5.91224C32.7349 5.92109 32.7452 5.92817 32.7556 5.93436C32.7556 5.92463 32.7659 5.90959 32.797 5.8857C32.9109 5.79988 33.1285 5.52913 33.346 5.16902C33.7707 4.44792 34.1229 3.41892 35.0137 2.6757C35.9666 1.88559 37.251 1.60511 38.1625 1.24677C38.6183 1.06804 38.9601 0.879584 39.1051 0.747751C39.1466 0.703512 39.1673 0.681392 39.188 0.654848C38.5458 0.341634 37.1889 0.0399223 35.9045 0.00630045V0.004531C35.8112 0.00187665 35.718 0.000991759 35.6248 0.000106974ZM32.7556 5.93436C32.7452 5.95029 32.7659 5.94675 32.7556 5.93436V5.93436ZM40.2445 2.01653C39.8509 2.31648 39.3952 2.51467 38.9394 2.69339C37.8621 3.11898 36.7227 3.47731 36.3188 3.81619C36.1945 3.92148 36.0495 4.11524 35.8941 4.35856C36.2463 4.63992 36.671 4.90359 37.1371 5.12744C38.1833 5.62469 39.2916 5.822 40.1513 5.75387C41.0214 5.69813 41.56 5.4203 41.8293 5.01773C42.0883 4.61515 42.0676 4.07189 41.6636 3.41626C41.3839 2.93848 40.8971 2.44212 40.2445 2.01653ZM35.0344 5.83792C35.0344 5.85296 35.024 5.86712 35.0137 5.88216C34.7651 6.30863 34.4957 6.73067 34.04 7.07751C33.6878 7.3341 33.1492 7.5199 32.6106 7.5022C31.8441 8.40469 30.9533 9.35141 29.8449 10.3512C32.1134 11.2006 33.781 11.9881 35.8319 13.1737C36.5674 10.714 37.5203 8.88247 38.5147 7.24562C37.7586 7.12175 36.9817 6.87401 36.2359 6.52098C35.8009 6.31748 35.3969 6.08743 35.0344 5.83792ZM24.4691 7.3341C21.9727 7.43142 20.7608 8.34275 20.0772 9.41334C19.3936 10.4751 19.3936 11.8023 19.5697 12.2447C19.6214 12.4039 19.6007 12.3597 19.6732 12.3685C19.7457 12.3862 19.984 12.3862 20.3154 12.2535C20.9784 11.9792 21.9002 11.2537 22.4699 10.1743L22.8946 9.37795L23.7751 9.81149C24.5416 10.1831 25.6292 9.86458 26.1367 9.32486C26.1885 8.82053 26.0228 8.30736 25.7017 7.93575C25.3702 7.55529 24.9455 7.34294 24.5519 7.3341H24.4691ZM26.7893 10.9794C25.9296 11.5014 24.8212 11.7138 23.744 11.4837C23.454 11.9084 23.1225 12.2889 22.7703 12.6163C29.5446 14.6867 31.1086 15.3503 36.1945 18.7478C36.3084 21.4376 36.6088 25.2864 36.2981 27.3214C36.0495 28.9406 38.1315 28.3831 38.1625 27.3391C38.204 25.7199 37.8414 23.9858 38.235 22.4993C38.3179 23.8884 39.768 23.6938 39.7991 22.5259L39.8716 18.6682L40.576 18.1108C33.9675 13.855 32.3413 12.8729 26.7893 10.9794ZM25.9296 15.2972L20.4605 23.7557L21.4134 25.3926L19.0828 25.8704L16.0272 30.5951L17.063 31.3206L19.3107 30.9933L28.7884 16.3589C27.9494 15.9961 27.0379 15.6688 25.9296 15.2972ZM30.4354 17.1287L21.6827 30.6482L25.5981 30.0819L29.4928 24.0565L29.3892 21.9331L31.2329 21.3756L33.0042 18.6417C32.0512 18.0312 31.2329 17.5445 30.4354 17.1287ZM10.4338 28.7194L0 33.6919V35.0721L10.2162 33.8777L12.5986 38.16L10.9206 38.8502L9.11828 35.6118L0 36.6736V42H38.349L37.7378 41.0444L30.0728 38.452L24.3344 40.372L23.6508 38.8856L30.0728 36.7355L36.3291 38.8502L36.2463 38.7263L27.7526 31.3914L18.8964 32.6744L21.4238 34.5236L20.2015 35.7269L16.0686 32.7009L10.4338 28.7194Z" fill="black"/>
        </svg>
    `,
    "Strategy": `
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M37 20H34V12C34 10.9391 33.5786 9.92172 32.8284 9.17157C32.0783 8.42143 31.0609 8 30 8H22V5C22 3.67392 21.4732 2.40215 20.5355 1.46447C19.5979 0.526784 18.3261 0 17 0C15.6739 0 14.4021 0.526784 13.4645 1.46447C12.5268 2.40215 12 3.67392 12 5V8H4C2.93913 8 1.92172 8.42143 1.17157 9.17157C0.421427 9.92172 0 10.9391 0 12V19.6H3C6 19.6 8.4 22 8.4 25C8.4 28 6 30.4 3 30.4H0V38C0 39.0609 0.421427 40.0783 1.17157 40.8284C1.92172 41.5786 2.93913 42 4 42H11.6V39C11.6 36 14 33.6 17 33.6C20 33.6 22.4 36 22.4 39V42H30C31.0609 42 32.0783 41.5786 32.8284 40.8284C33.5786 40.0783 34 39.0609 34 38V30H37C38.3261 30 39.5979 29.4732 40.5355 28.5355C41.4732 27.5979 42 26.3261 42 25C42 23.6739 41.4732 22.4021 40.5355 21.4645C39.5979 20.5268 38.3261 20 37 20Z" fill="black"/>
        </svg>
    `,
    "default": `
        <!-- Joystick generico por si viene otro genero -->
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 6H3C1.89543 6 1 6.89543 1 8V16C1 17.1046 1.89543 18 3 18H21C22.1046 18 23 17.1046 23 16V8C23 6.89543 22.1046 6 21 6Z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 12H10" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 10V14" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15 13V13.01" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18 11V11.01" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `
};
function renderizarCarruselCentrado(games, trackId) {
    const track = document.getElementById(trackId);
    if (!track) return;
    track.innerHTML = '';

    games.forEach((game, index) => {
        const article = document.createElement('article');
        article.classList.add('card-grande');

        // Sacamos el nombre del género de la API (ej: "Action")
        const nombreGenero = game.genres && game.genres.length > 0 ? game.genres[0].name : 'default';

        // Buscamos el ícono en el diccionario
        const svgIcono = iconosPorGenero[nombreGenero] || iconosPorGenero['default'];

        article.innerHTML = `
            <div class="card-grande-imagen">
                <img src="${game.background_image}" alt="${game.name}">
            </div>
            
            ${index === 2 ? `
            <div class="etiqueta-pro-carrusel">
                <svg width="31" height="25" viewBox="0 0 31 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M29.2792 2.69097C28.8093 2.50059 28.2917 2.45055 27.7924 2.54722C27.2931 2.64388 26.8347 2.88288 26.4755 3.23377L23.1497 6.46807L17.2517 0.732374C16.7693 0.263435 16.1152 0 15.4331 0C14.7511 0 14.097 0.263435 13.6146 0.732374L7.71657 6.46807L4.39073 3.23377C4.031 2.88405 3.57273 2.6459 3.07385 2.54943C2.57496 2.45296 2.05787 2.50249 1.58793 2.69177C1.11799 2.88105 0.71631 3.20158 0.433667 3.61283C0.151024 4.02409 0.000108609 4.5076 0 5.00225L0 18.2421C0.00204213 19.9001 0.680192 21.4895 1.8857 22.6618C3.0912 23.8342 4.72563 24.4936 6.43047 24.4956H24.4358C26.1406 24.4936 27.7751 23.8342 28.9806 22.6618C30.1861 21.4895 30.8642 19.9001 30.8663 18.2421V5.00225C30.8664 4.50756 30.7157 4.02394 30.4332 3.61254C30.1507 3.20114 29.7491 2.88043 29.2792 2.69097Z" fill="var(--primarioLuz2)"/>
                </svg>
                <h3 class="h3">PRO</h3>
            </div>
            ` : ''}

            <div class="card-overlay">
                <h3 class="card-titulo" title="${game.name}">${game.name}</h3>
                <div class="card-grande-icono">
                    ${svgIcono}
                </div>
            </div>
        `;
        track.appendChild(article);
    });
}

/* ========================================================================= */
/*             RENDER: CARRUSEL MIXTO (CARD GRANDE + 4 CHICAS)               */
/* ========================================================================= */
function renderizarCarruselMixto(juegos, trackId) {
    const track = document.getElementById(trackId);
    if (!track) return;
    track.innerHTML = '';

    let i = 0;
    let isBig = true; // Alternador: Arranca renderizando 1 grande, luego 4 chicas, luego 1 grande...

    while (i < juegos.length) {
        if (isBig) {
            // RENDER VAGÓN: 1 CARD GRANDE
            const game = juegos[i];
            const nombreGenero = game.genres && game.genres.length > 0 ? game.genres[0].name : 'default';
            const svgIcono = iconosPorGenero[nombreGenero] || iconosPorGenero['default'];

            const slideHTML = `
                <div class="carrusel-slide">
                    <!-- Le clavamos activo y opacity 1 porque en este carrusel no se opacan las cartas -->
                    <article class="card-grande activo" style="opacity: 1;">
                        <div class="card-grande-imagen">
                            <img src="${game.background_image}" alt="${game.name}">
                        </div>
                        
                        ${i === 0 ? `
                        <div class="etiqueta-pro-carrusel">
                            <svg width="31" height="25" viewBox="0 0 31 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M29.2792 2.69097C28.8093 2.50059 28.2917 2.45055 27.7924 2.54722C27.2931 2.64388 26.8347 2.88288 26.4755 3.23377L23.1497 6.46807L17.2517 0.732374C16.7693 0.263435 16.1152 0 15.4331 0C14.7511 0 14.097 0.263435 13.6146 0.732374L7.71657 6.46807L4.39073 3.23377C4.031 2.88405 3.57273 2.6459 3.07385 2.54943C2.57496 2.45296 2.05787 2.50249 1.58793 2.69177C1.11799 2.88105 0.71631 3.20158 0.433667 3.61283C0.151024 4.02409 0.000108609 4.5076 0 5.00225L0 18.2421C0.00204213 19.9001 0.680192 21.4895 1.8857 22.6618C3.0912 23.8342 4.72563 24.4936 6.43047 24.4956H24.4358C26.1406 24.4936 27.7751 23.8342 28.9806 22.6618C30.1861 21.4895 30.8642 19.9001 30.8663 18.2421V5.00225C30.8664 4.50756 30.7157 4.02394 30.4332 3.61254C30.1507 3.20114 29.7491 2.88043 29.2792 2.69097Z" fill="var(--primarioLuz2)"/>
                            </svg>
                            <h3 class="h3">PRO</h3>
                        </div>
                        ` : ''}

                        <div class="card-overlay">
                            <h3 class="card-titulo" title="${game.name}">${game.name}</h3>
                            <div class="card-grande-icono">
                                ${svgIcono}
                            </div>
                        </div>
                    </article>
                </div>
            `;
            track.insertAdjacentHTML('beforeend', slideHTML);
            i += 1;
        } else {
            // RENDER VAGÓN: 4 CARDS CHICAS (2x2)
            const gamesChunk = juegos.slice(i, i + 4);
            let cardsHTML = '';

            gamesChunk.forEach((game, idx) => {
                cardsHTML += `
                    <article class="card-juego">
                        <div class="card-imagen">
                            <img src="${game.background_image}" alt="${game.name}">
                        </div>
                        
                        ${(idx === 1 || idx === 2) ? `
                        <div class="etiqueta-pro-carrusel">
                            <svg viewBox="0 0 31 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M29.2792 2.69097C28.8093 2.50059 28.2917 2.45055 27.7924 2.54722C27.2931 2.64388 26.8347 2.88288 26.4755 3.23377L23.1497 6.46807L17.2517 0.732374C16.7693 0.263435 16.1152 0 15.4331 0C14.7511 0 14.097 0.263435 13.6146 0.732374L7.71657 6.46807L4.39073 3.23377C4.031 2.88405 3.57273 2.6459 3.07385 2.54943C2.57496 2.45296 2.05787 2.50249 1.58793 2.69177C1.11799 2.88105 0.71631 3.20158 0.433667 3.61283C0.151024 4.02409 0.000108609 4.5076 0 5.00225L0 18.2421C0.00204213 19.9001 0.680192 21.4895 1.8857 22.6618C3.0912 23.8342 4.72563 24.4936 6.43047 24.4956H24.4358C26.1406 24.4936 27.7751 23.8342 28.9806 22.6618C30.1861 21.4895 30.8642 19.9001 30.8663 18.2421V5.00225C30.8664 4.50756 30.7157 4.02394 30.4332 3.61254C30.1507 3.20114 29.7491 2.88043 29.2792 2.69097Z" fill="var(--primarioLuz2)"/>
                            </svg>
                            <span class="label">PRO</span>
                        </div>
                        ` : ''}

                        <div class="card-overlay">
                            <h3 class="card-titulo" title="${game.name}">${game.name}</h3>
                        </div>
                    </article>
                `;
            });

            // Si sobraron juegos para hacer el vagón pero no llegaron a 4, se meten igual y Grid los acomoda solos
            const slideHTML = `
                <div class="carrusel-slide slide-2x2">
                    ${cardsHTML}
                </div>
            `;
            track.insertAdjacentHTML('beforeend', slideHTML);
            i += 4;
        }

        // Alternar el estado para el próximo vagón
        isBig = !isBig;
    }
}

/* ========================================================================= */
/*                   LOGICA DE BOTONES GLOBALES                              */
/* ========================================================================= */

// Escuchador global para los botones de favoritos
document.addEventListener("click", (e) => {
    // Buscar si el clic se hizo en el botón de favoritos o adentro del botón
    const btnFav = e.target.closest('.btn-juego--fav, .btn-fav-hero, .btn-favoritos');
    
    if (btnFav) {
        // Le togglea (pone o saca) la clase 'activo' que dispara nuestra animación Matrix en CSS
        btnFav.classList.toggle('activo');
    }
});

/* ========================================================================= */
/*              SKEW DINÁMICO (Código nuevo, no toca lo existente)           */
/* ========================================================================= */
/* Le da "vida" a los carruseles: mientras el track se desplaza, el viewport  */
/* (el padre con overflow:hidden) se inclina unos grados hacia la dirección   */
/* del movimiento y vuelve a 0 al detenerse.                                  */
/*                                                                            */
/* CLAVE: el skew se aplica en el VIEWPORT, no en el track, así no chocamos   */
/* con los style.transform que ya escribe la máquina del carrusel.            */
document.addEventListener("DOMContentLoaded", () => {

    const SKEW_MAX = 10;       // Grados máximos de inclinación
    const VELOCIDAD_MAX = 2.5; // px/ms a los que se llega al tope de grados
    const SMOOTHING = 0.25;    // Suavizado del skew (0.1 = lento, 1 = instantáneo)
    const VENTANA_MEDICION = 700; // ms que medimos tras cada cambio (transición = 500ms)

    // Elegimos la "ventana" de cada carrusel (el padre con overflow:hidden)
    const viewports = document.querySelectorAll('.hero-viewport, .carrusel-viewport');

    viewports.forEach((viewport) => {
        const track = viewport.querySelector('.hero-track, .carrusel-track-chico, .carrusel-track-grande, .carrusel-track-mixto');
        if (!track) return;

        viewport.style.willChange = 'transform'; // Rendimiento: el navegador lo mantiene en GPU

        let ultimaX = null;       // Última posición X leída del track
        let ultimoTiempo = null;  // Último timestamp de lectura
        let skewActual = 0;       // Skew actual (grados)
        let skewObjetivo = 0;     // Hacia dónde tiende el skew
        let rafId = null;         // ID del bucle de render actual
        let medirId = null;       // ID del bucle de medición actual
        let finMedicion = 0;      // Timestamp hasta el cual seguimos midiendo

        // Lee la posición X real del track (refleja la transición en curso)
        const leerPosX = () => {
            const estilo = window.getComputedStyle(track).transform;
            if (!estilo || estilo === 'none') return 0;
            const matriz = new DOMMatrix(estilo);
            return matriz.m41; // Traducción en X
        };

        // --- Bucle de RENDER: interpola el skew del viewport hacia su objetivo ---
        const renderizar = () => {
            skewActual += (skewObjetivo - skewActual) * SMOOTHING;

            // Caso de cierre: sin objetivo y ya casi en 0 → limpiamos y paramos
            if (skewObjetivo === 0 && Math.abs(skewActual) < 0.1) {
                skewActual = 0;
                viewport.style.transform = '';
                rafId = null;
                return;
            }

            viewport.style.transform = `skewX(${skewActual.toFixed(2)}deg)`;
            rafId = requestAnimationFrame(renderizar);
        };

        const arrancarRender = () => {
            if (rafId === null) rafId = requestAnimationFrame(renderizar);
        };

        // --- Bucle de MEDICIÓN: lee el track frame a frame mientras se desplaza ---
        const medirFrame = () => {
            const ahora = performance.now();
            const x = leerPosX();

            if (ultimaX !== null && ultimoTiempo !== null) {
                const dt = ahora - ultimoTiempo;
                if (dt > 0) {
                    // Velocidad en px/ms (negativa = se mueve a la izquierda)
                    const velocidad = (x - ultimaX) / dt;

                    // Mapeamos la velocidad a grados con tope en SKEW_MAX
                    skewObjetivo = Math.max(
                        -SKEW_MAX,
                        Math.min(SKEW_MAX, (velocidad / VELOCIDAD_MAX) * SKEW_MAX)
                    );
                    arrancarRender();
                }
            }

            ultimaX = x;
            ultimoTiempo = ahora;

            if (ahora < finMedicion) {
                // Seguimos midiendo: la transición dura 500ms
                medirId = requestAnimationFrame(medirFrame);
            } else {
                // Terminó la ventana de medición: el track paró → skew vuelve a 0
                medirId = null;
                ultimaX = null;
                ultimoTiempo = null;
                skewObjetivo = 0;
                arrancarRender();
            }
        };

        // Activa la medición por frames (reinicia la ventana de 700ms)
        const activarMedicion = () => {
            finMedicion = performance.now() + VENTANA_MEDICION;
            if (medirId === null) {
                ultimaX = null; // Para que el primer frame solo tome la referencia
                ultimoTiempo = null;
                medirId = requestAnimationFrame(medirFrame);
            }
        };

        // Cada vez que la máquina existente toca el transform del track,
        // el observer reinicia la medición (flechas, dots, resize...)
        const observer = new MutationObserver(activarMedicion);
        observer.observe(track, { attributes: true, attributeFilter: ['style'] });

        // Para el arrastre (se escribe en cada move) medimos directo también
        track.addEventListener('touchmove', activarMedicion, { passive: true });
        track.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse' && e.buttons === 0) return;
            activarMedicion();
        }, { passive: true });
    });
});
