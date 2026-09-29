document.addEventListener("DOMContentLoaded", () => {
    const track = document.getElementById('hero-track');

    // 1. OBTENER JUEGOS DE LA API (v2)
    fetch('https://vj.interfaces.jima.com.ar/api/v2')
        .then(response => response.json())
        .then(games => {
            // Tomamos los 3 primeros juegos de la API para acompañar al de Boca (que ya está en el HTML)
            const carouselGames = games.slice(0, 3);

            carouselGames.forEach((game, index) => {
                // Sacamos el primer género y el año de lanzamiento
                const genero = game.genres && game.genres.length > 0 ? game.genres[0].name : 'Acción';
                const añoLanzamiento = game.released ? game.released.substring(0, 4) : '2020';

                // Recortamos la descripción para que no rompa el diseño si es muy larga
                let descCorta = game.description;
                if (descCorta.length > 150) {
                    descCorta = descCorta.substring(0, 150) + '...';
                }

                // Creamos el HTML del vagón (slide) idéntico al que armamos para Boca
                // OJO: Usamos background_image como dice el README para las Hero Images
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

            // 2. UNA VEZ QUE EL TREN ESTÁ ARMADO, PRENDEMOS LOS MOTORES
            iniciarCarrusel();
        })
        .catch(error => console.error("Error al cargar los juegos de la API:", error));


    // Función para manejar las flechas y los puntitos
    function iniciarCarrusel() {
        const btnNext = document.getElementById('btn-next');
        const btnPrev = document.getElementById('btn-prev');
        const slides = document.querySelectorAll('.hero-slide');
        const puntos = document.querySelectorAll('.punto');

        let currentIndex = 0;

        // Calculamos el ancho de un slide para saber exactamente cuántos píxeles desplazar
        const getSlideWidth = () => slides[0].clientWidth;

        // Función que actualiza el estado de los botones (Activo/Inactivo)
        const actualizarBotones = () => {
            btnPrev.disabled = currentIndex === 0;
            btnNext.disabled = currentIndex === slides.length - 1;
        };

        // Función que mueve la cinta al slide indicado
        const goToSlide = (index) => {
            if (index < 0 || index >= slides.length) return;
            currentIndex = index;

            track.scrollLeft = currentIndex * getSlideWidth();

            // Actualizamos los puntitos manualmente acá también
            puntos.forEach((p, i) => {
                p.classList.toggle('activo', i === currentIndex);
            });

            actualizarBotones();
        };

        // Escuchadores de eventos para los botones (PC)
        btnNext.addEventListener('click', () => {
            if (currentIndex < slides.length - 1) {
                goToSlide(currentIndex + 1);
            }
        });

        btnPrev.addEventListener('click', () => {
            if (currentIndex > 0) {
                goToSlide(currentIndex - 1);
            }
        });

        // Sincronizar el scroll manual (Dedo en celular) con los puntitos
        track.addEventListener('scroll', () => {
            // Dividimos los pixeles scrolleados por el ancho de la caja para saber en qué slide estamos
            let indexScroll = Math.round(track.scrollLeft / getSlideWidth());

            if (indexScroll !== currentIndex) {
                currentIndex = indexScroll;

                // Actualizamos las clases de los puntitos
                puntos.forEach((p, i) => {
                    p.classList.toggle('activo', i === currentIndex);
                });

                actualizarBotones();
            }
        });

        // Hacer que los puntitos sean clickeables
        puntos.forEach((punto, index) => {
            punto.addEventListener('click', () => {
                goToSlide(index);
            });
        });

        // Llamamos a la función una vez al iniciar para que el botón "Anterior" arranque apagado (opacidad 30%)
        actualizarBotones();
    }
});
