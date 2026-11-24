/* ============================================================
   FLAPPY BIRD - CONTROLADOR PRINCIPAL
   Loop con timestep fijo + acumulador (opción A):
   la física avanza siempre en pasos de 1/120 s, sin importar
   los FPS reales del equipo.
   ============================================================ */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        const marco = document.getElementById('flappy-marco');
        const lienzo = document.getElementById('flappy-lienzo');
        const pajaroEl = document.getElementById('flappy-pajaro');
        const tuberiasEl = document.getElementById('flappy-tuberias');
        if (!marco || !lienzo || !pajaroEl || !tuberiasEl) return;

        const overlay = document.getElementById('flappy-overlay');
        const overlayTitulo = document.getElementById('flappy-overlay-titulo');
        const overlayMensaje = document.getElementById('flappy-overlay-mensaje');
        const btnAccion = document.getElementById('flappy-btn-accion');
        const btnReiniciar = document.getElementById('flappy-btn-reiniciar-barra');
        const btnFull = document.getElementById('flappy-btn-full');
        const hudEstado = document.getElementById('flappy-hud-estado');
        const hudPuntos = document.getElementById('flappy-hud-puntos');
        const hudTiempo = document.getElementById('flappy-hud-tiempo');
        const modal = overlay ? overlay.querySelector('.flappy-modal') : null;

        const config = window.FLAPPY_CONFIG;
        const pajaro = new FlappyPajaro(pajaroEl);
        const fabricaTuberias = new FabricaTuberias(tuberiasEl, config.SUELO_Y, config.ALTO_LIENZO);
        const PASO = config.PASO;
        const TIEMPO_PARTIDA = 60; // segundos de límite de partida

        let estadoJuego = 'listo'; // listo | jugando | pausado | impacto | gameover
        let velocidadActual = FlappyFisica.VEL_MUNDO;
        let puntos = 0;
        let tiempoRestante = TIEMPO_PARTIDA;
        let ultimoSegundoMostrado = TIEMPO_PARTIDA;
        let tuberias = [];
        let distanciaProximoTubo = 0;
        let acumulador = 0;
        let ultimo = 0;
        let rafId = null;
        let timeoutOverlay = null;

        /* ------------------------------------------------------------
           Escalado responsive del lienzo lógico 1024x576
           ------------------------------------------------------------ */
        function ajustarEscala() {
            const ancho = marco.clientWidth;
            const alto = marco.clientHeight;
            if (!ancho || !alto) return;

            const escala = Math.min(
                ancho / config.ANCHO_LIENZO,
                alto / config.ALTO_LIENZO
            );
            lienzo.style.setProperty('--flappy-escala', String(escala));
            marco.classList.add('flappy-marco--listo');
        }

        ajustarEscala();
        if ('ResizeObserver' in window) {
            new ResizeObserver(ajustarEscala).observe(marco);
        } else {
            window.addEventListener('resize', ajustarEscala);
        }

        /* ------------------------------------------------------------
           Parallax controlado por JS: avanza con velocidadActual * factor * dt
           para mantenerse siempre sincronizado si el juego acelera o frena.
           ------------------------------------------------------------ */
        // Una entrada por capa del bosque, de atrás hacia adelante.
        // tile = 1024px (ancho del lienzo lógico, al que se escala cada imagen).
        const capas = [
            { el: lienzo.querySelector('.flappy-capa--fondo'), tile: 1024, factor: 0.05, x: 0 },
            { el: lienzo.querySelector('.flappy-capa--copas-lejanas'), tile: 1024, factor: 0.12, x: 0 },
            { el: lienzo.querySelector('.flappy-capa--copas-medias'), tile: 1024, factor: 0.20, x: 0 },
            { el: lienzo.querySelector('.flappy-capa--arboles-medios'), tile: 1024, factor: 0.32, x: 0 },
            { el: lienzo.querySelector('.flappy-capa--arboles-cercanos'), tile: 1024, factor: 0.50, x: 0 },
            { el: lienzo.querySelector('.flappy-capa--tronco'), tile: 1024, factor: 0.75, x: 0 },
            { el: lienzo.querySelector('.flappy-capa--cartel'), tile: 1024, factor: 1.00, x: 0 }
        ];

        function actualizarParallax(dt, velocidad) {
            for (let i = 0; i < capas.length; i++) {
                const capa = capas[i];
                capa.x = (capa.x + velocidad * capa.factor * dt) % capa.tile;
            }
        }

        function dibujarParallax() {
            for (let i = 0; i < capas.length; i++) {
                const capa = capas[i];
                if (capa.el) {
                    capa.el.style.backgroundPositionX = -capa.x + 'px';
                }
            }
        }

        function reiniciarParallax() {
            for (let i = 0; i < capas.length; i++) {
                capas[i].x = 0;
            }
            dibujarParallax();
        }

        /* ------------------------------------------------------------
           Tuberías: creación con Factory Method, movimiento y limpieza
           ------------------------------------------------------------ */
        function actualizarTuberias(dt, velocidad) {
            distanciaProximoTubo -= velocidad * dt;
            if (distanciaProximoTubo <= 0) {
                const nuevoPar = fabricaTuberias.crear(config.ANCHO_LIENZO + 20);
                tuberias.push(nuevoPar);
                distanciaProximoTubo = fabricaTuberias.siguienteDistancia();
            }

            for (let i = tuberias.length - 1; i >= 0; i--) {
                const tubo = tuberias[i];
                tubo.actualizar(dt, velocidad);

                // Suma +1 punto cuando el pájaro supera completamente el par de tuberías
                if (!tubo.superado && tubo.x + tubo.ancho < config.X_PANTALLA) {
                    tubo.superado = true;
                    sumarPuntos(1);
                }

                if (tubo.estaFueraDePantalla()) {
                    tubo.destruir();
                    tuberias.splice(i, 1);
                }
            }
        }

        function dibujarTuberias() {
            for (let i = 0; i < tuberias.length; i++) {
                tuberias[i].render();
            }
        }

        function hayColisionConTuberias() {
            const hitbox = pajaro.getHitbox();
            for (let i = 0; i < tuberias.length; i++) {
                if (tuberias[i].colisionaCon(hitbox)) return true;
            }
            return false;
        }

        function limpiarTuberias() {
            for (let i = 0; i < tuberias.length; i++) {
                tuberias[i].destruir();
            }
            tuberias = [];
            fabricaTuberias.reset();
            distanciaProximoTubo = 120;
        }

        /* ------------------------------------------------------------
           Overlay de inicio / fin de partida
           ------------------------------------------------------------ */
        function mostrarOverlay(titulo, mensaje, boton, enfocar) {
            if (!overlay) return;

            if (overlayTitulo) overlayTitulo.textContent = titulo;
            if (overlayMensaje) overlayMensaje.textContent = mensaje;
            if (btnAccion) btnAccion.textContent = boton;

            overlay.classList.remove('flappy-overlay--oculto');
            overlay.setAttribute('aria-hidden', 'false');
            overlay.inert = false;

            if (modal) {
                modal.style.animation = 'none';
                void modal.offsetWidth;
                modal.style.animation = '';
            }

            if (enfocar && btnAccion) {
                btnAccion.focus({ preventScroll: true });
            }
        }

        function ocultarOverlay() {
            if (!overlay) return;

            overlay.classList.add('flappy-overlay--oculto');
            overlay.setAttribute('aria-hidden', 'true');
            overlay.inert = true;
        }

        function actualizarHud(texto) {
            if (hudEstado) hudEstado.textContent = texto;
        }

        function formatearTiempo(segundos) {
            const total = Math.ceil(Math.max(0, segundos));
            const min = Math.floor(total / 60);
            const seg = total % 60;
            return String(min).padStart(2, '0') + ':' + String(seg).padStart(2, '0');
        }

        function sumarPuntos(cantidad) {
            puntos = Math.max(0, puntos + cantidad);
            if (hudPuntos) hudPuntos.textContent = 'Puntos: ' + puntos;
        }

        function dibujarTiempo() {
            if (!hudTiempo) return;
            hudTiempo.textContent = formatearTiempo(tiempoRestante);
            hudTiempo.classList.toggle(
                'flappy-hud__chip--peligro',
                tiempoRestante <= 10 && tiempoRestante > 0
            );
        }

        /* ------------------------------------------------------------
           Loop con timestep fijo
           ------------------------------------------------------------ */
        function iniciarLoop() {
            if (rafId !== null) return;
            ultimo = performance.now();
            rafId = requestAnimationFrame(loop);
        }

        function detenerLoop() {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        }

        function loop(ahora) {
            rafId = requestAnimationFrame(loop);

            if (estadoJuego !== 'jugando') return;

            let dt = (ahora - ultimo) / 1000;
            ultimo = ahora;

            if (!Number.isFinite(dt) || dt < 0) dt = 0;
            dt = Math.min(dt, 0.1);

            acumulador += dt;
            let pasos = 0;

            while (acumulador >= PASO) {
                pajaro.actualizar(PASO, velocidadActual);
                actualizarParallax(PASO, velocidadActual);
                actualizarTuberias(PASO, velocidadActual);
                tiempoRestante = Math.max(0, tiempoRestante - PASO);
                acumulador -= PASO;
                pasos += 1;

                const segundoActual = Math.ceil(tiempoRestante);
                if (segundoActual !== ultimoSegundoMostrado) {
                    ultimoSegundoMostrado = segundoActual;
                    dibujarTiempo();
                }

                if (pajaro.estaEnSuelo()) {
                    pajaro.limitarAlSuelo();
                    pajaro.render();
                    dibujarParallax();
                    dibujarTuberias();
                    terminarPartida('suelo');
                    return;
                }

                pajaro.limitarAlTecho();

                if (hayColisionConTuberias()) {
                    pajaro.render();
                    dibujarParallax();
                    dibujarTuberias();
                    terminarPartida('tubo');
                    return;
                }

                if (tiempoRestante <= 0) {
                    pajaro.render();
                    dibujarParallax();
                    dibujarTuberias();
                    terminarPorTiempo();
                    return;
                }
            }

            if (pasos > 0) {
                pajaro.render();
                dibujarParallax();
                dibujarTuberias();
            }
        }

        /* ------------------------------------------------------------
           Estados de la partida
           ------------------------------------------------------------ */
        function iniciarPartida() {
            if (estadoJuego === 'jugando') {
                pajaro.impulsar();
                return;
            }

            if (estadoJuego === 'impacto') return;

            if (estadoJuego === 'gameover') {
                reiniciarPartida();
                iniciarPartida();
                return;
            }

            estadoJuego = 'jugando';
            acumulador = 0;
            ocultarOverlay();
            actualizarHud('En vuelo');
            pajaro.impulsar();
            iniciarLoop();
            marco.focus({ preventScroll: true });
        }

        function terminarPartida(motivo) {
            if (estadoJuego !== 'jugando') return;

            estadoJuego = 'impacto';
            pajaro.impactar();
            actualizarHud('¡Ay!');
            detenerLoop();

            const mensajeChoque = motivo === 'tubo'
                ? 'El pájaro chocó contra una tubería. Puntaje final: ' + puntos + '.'
                : 'El pájaro tocó el suelo del bosque. Puntaje final: ' + puntos + '.';

            if (timeoutOverlay !== null) clearTimeout(timeoutOverlay);
            timeoutOverlay = window.setTimeout(function () {
                timeoutOverlay = null;
                estadoJuego = 'gameover';
                actualizarHud('Partida terminada');
                mostrarOverlay(
                    '¡Te estrellaste!',
                    mensajeChoque,
                    'Reintentar',
                    true
                );
            }, 600);
        }

        function terminarPorTiempo() {
            if (estadoJuego !== 'jugando') return;

            estadoJuego = 'gameover';
            detenerLoop();
            pajaro.setSprite('inicio', false);
            actualizarHud('¡Tiempo cumplido!');
            mostrarOverlay(
                '¡Tiempo cumplido!',
                'Completaste los ' + TIEMPO_PARTIDA + ' segundos con ' + puntos + ' puntos.',
                'Jugar de nuevo',
                true
            );
        }

        function reiniciarPartida() {
            if (timeoutOverlay !== null) {
                clearTimeout(timeoutOverlay);
                timeoutOverlay = null;
            }

            detenerLoop();
            estadoJuego = 'listo';
            velocidadActual = FlappyFisica.VEL_MUNDO;
            puntos = 0;
            tiempoRestante = TIEMPO_PARTIDA;
            ultimoSegundoMostrado = TIEMPO_PARTIDA;
            acumulador = 0;
            ultimo = 0;
            pajaro.reset();
            reiniciarParallax();
            limpiarTuberias();
            sumarPuntos(0);
            dibujarTiempo();
            actualizarHud('Listo para volar');
            mostrarOverlay(
                'Flappy Bird',
                'Hacé clic o presioná Espacio para aletear y mantener el vuelo.',
                'Jugar',
                false
            );
        }

        /* ------------------------------------------------------------
           Input
           ------------------------------------------------------------ */
        function alPresionar(e) {
            if (e.target.closest && e.target.closest('button, a, input, textarea, select')) {
                return;
            }
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            if (estadoJuego === 'jugando') {
                e.preventDefault();
                pajaro.impulsar();
            } else if (estadoJuego === 'listo') {
                e.preventDefault();
                iniciarPartida();
            }
        }

        function alTeclear(e) {
            if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
            if (e.target && e.target.closest &&
                e.target.closest('input, textarea, select, button, a')) {
                return;
            }

            e.preventDefault();
            if (e.repeat) return;

            if (estadoJuego === 'jugando') {
                pajaro.impulsar();
            } else if (estadoJuego === 'listo') {
                iniciarPartida();
            }
        }

        marco.addEventListener('pointerdown', alPresionar);
        document.addEventListener('keydown', alTeclear);

        if (btnAccion) {
            btnAccion.addEventListener('click', function (e) {
                e.stopPropagation();

                if (estadoJuego === 'gameover') {
                    reiniciarPartida();
                    iniciarPartida();
                } else if (estadoJuego === 'listo') {
                    iniciarPartida();
                }
            });
        }

        if (btnReiniciar) {
            btnReiniciar.addEventListener('click', function (e) {
                e.stopPropagation();
                reiniciarPartida();
                iniciarPartida();
            });
        }

        if (btnFull) {
            btnFull.addEventListener('click', function (e) {
                e.stopPropagation();

                if (!document.fullscreenElement) {
                    const promesa = marco.requestFullscreen
                        ? marco.requestFullscreen()
                        : null;
                    if (promesa && promesa.catch) promesa.catch(function () {});
                } else if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            });
        }

        document.addEventListener('fullscreenchange', function () {
            requestAnimationFrame(ajustarEscala);
        });

        /* ------------------------------------------------------------
           Pausa automática al cambiar de pestaña
           ------------------------------------------------------------ */
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                if (estadoJuego === 'jugando') {
                    estadoJuego = 'pausado';
                    detenerLoop();
                    actualizarHud('En pausa');
                }
            } else if (estadoJuego === 'pausado') {
                estadoJuego = 'jugando';
                actualizarHud('En vuelo');
                ultimo = performance.now();
                acumulador = 0;
                iniciarLoop();
            }
        });

        /* ------------------------------------------------------------
           Arranque
           ------------------------------------------------------------ */
        reiniciarPartida();
    });
})();
