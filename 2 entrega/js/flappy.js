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
        if (!marco || !lienzo || !pajaroEl) return;

        const overlay = document.getElementById('flappy-overlay');
        const overlayTitulo = document.getElementById('flappy-overlay-titulo');
        const overlayMensaje = document.getElementById('flappy-overlay-mensaje');
        const btnAccion = document.getElementById('flappy-btn-accion');
        const btnReiniciar = document.getElementById('flappy-btn-reiniciar-barra');
        const btnFull = document.getElementById('flappy-btn-full');
        const hudEstado = document.getElementById('flappy-hud-estado');
        const modal = overlay ? overlay.querySelector('.flappy-modal') : null;

        const config = window.FLAPPY_CONFIG;
        const pajaro = new FlappyPajaro(pajaroEl);
        const PASO = config.PASO;

        let estadoJuego = 'listo'; // listo | jugando | pausado | impacto | gameover
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
           Parallax: duración = tile / (velocidad del mundo * factor)
           La misma VEL_MUNDO de la física alimenta las animaciones.
           ------------------------------------------------------------ */
        // Una entrada por capa del bosque, de atrás hacia adelante.
        // tile = 1024px (ancho del lienzo lógico, al que se escala cada imagen).
        const capas = [
            { selector: '.flappy-capa--fondo', tile: 1024, factor: 0.05 },
            { selector: '.flappy-capa--copas-lejanas', tile: 1024, factor: 0.12 },
            { selector: '.flappy-capa--copas-medias', tile: 1024, factor: 0.20 },
            { selector: '.flappy-capa--arboles-medios', tile: 1024, factor: 0.32 },
            { selector: '.flappy-capa--arboles-cercanos', tile: 1024, factor: 0.50 },
            { selector: '.flappy-capa--tronco', tile: 1024, factor: 0.75 },
            { selector: '.flappy-capa--cartel', tile: 1024, factor: 1.00 }
        ];

        capas.forEach(function (capa) {
            const el = lienzo.querySelector(capa.selector);
            if (!el) return;

            const duracion = capa.tile / (FlappyFisica.VEL_MUNDO * capa.factor);
            el.style.animationDuration = duracion + 's';
        });

        function pausarParallax() {
            lienzo.classList.add('flappy-lienzo--pausado');
        }

        function reanudarParallax() {
            lienzo.classList.remove('flappy-lienzo--pausado');
        }

        function reiniciarParallax() {
            lienzo.classList.add('flappy-lienzo--pausado');
            lienzo.querySelectorAll('.flappy-capa').forEach(function (capa) {
                capa.getAnimations().forEach(function (animacion) {
                    animacion.currentTime = 0;
                });
            });
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
                pajaro.actualizar(PASO);
                acumulador -= PASO;
                pasos += 1;

                if (pajaro.estaEnSuelo()) {
                    pajaro.limitarAlSuelo();
                    pajaro.render();
                    terminarPartida();
                    return;
                }

                pajaro.limitarAlTecho();
            }

            if (pasos > 0) {
                pajaro.render();
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
            reanudarParallax();
            actualizarHud('En vuelo');
            pajaro.impulsar();
            iniciarLoop();
            marco.focus({ preventScroll: true });
        }

        function terminarPartida() {
            if (estadoJuego !== 'jugando') return;

            estadoJuego = 'impacto';
            pajaro.impactar();
            pausarParallax();
            actualizarHud('¡Ay!');
            detenerLoop();

            if (timeoutOverlay !== null) clearTimeout(timeoutOverlay);
            timeoutOverlay = window.setTimeout(function () {
                timeoutOverlay = null;
                estadoJuego = 'gameover';
                actualizarHud('Partida terminada');
                mostrarOverlay(
                    '¡Te estrellaste!',
                    'El pájaro tocó el suelo del bosque. ¿Probamos otra vez?',
                    'Reintentar',
                    true
                );
            }, 600);
        }

        function reiniciarPartida() {
            if (timeoutOverlay !== null) {
                clearTimeout(timeoutOverlay);
                timeoutOverlay = null;
            }

            detenerLoop();
            estadoJuego = 'listo';
            acumulador = 0;
            ultimo = 0;
            pajaro.reset();
            reiniciarParallax();
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
                    pausarParallax();
                    detenerLoop();
                    actualizarHud('En pausa');
                }
            } else if (estadoJuego === 'pausado') {
                estadoJuego = 'jugando';
                reanudarParallax();
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
