/* ============================================================
   FLAPPY BIRD - CONTROLADOR PRINCIPAL
   Loop con timestep variable: la física avanza con el tiempo
   real de cada frame, acotado para evitar saltos tras un tirón.
   ============================================================ */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        const marco = document.getElementById('flappy-marco');
        const lienzo = document.getElementById('flappy-lienzo');
        const pajaroEl = document.getElementById('flappy-pajaro');
        const tuberiasEl = document.getElementById('flappy-tuberias');
        const avesBonusEl = document.getElementById('flappy-aves-bonus');
        const avesTuberiaEl = document.getElementById('flappy-aves-tuberia');
        if (!marco || !lienzo || !pajaroEl || !tuberiasEl || !avesBonusEl || !avesTuberiaEl) return;

        const overlay = document.getElementById('flappy-overlay');
        const overlayTitulo = document.getElementById('flappy-overlay-titulo');
        const overlayMensaje = document.getElementById('flappy-overlay-mensaje');
        const btnAccion = document.getElementById('flappy-btn-accion');
        const btnFull = document.getElementById('flappy-btn-full');
        const hudEstado = document.getElementById('flappy-hud-estado');
        const hudPuntos = document.getElementById('flappy-hud-puntos');
        const hudTiempo = document.getElementById('flappy-hud-tiempo');
        const modal = overlay ? overlay.querySelector('.flappy-modal') : null;

        const config = window.FLAPPY_CONFIG;
        const pajaro = new FlappyPajaro(pajaroEl);
        const fabricaTuberias = new FabricaTuberias(tuberiasEl, config.SUELO_Y, config.ALTO_LIENZO);
        const fabricaAvesBonus = new FabricaAvesBonus(avesBonusEl, avesTuberiaEl);
        const DT_MAXIMO = 1 / 30; // 33 ms: evita saltos y mantiene estable la colisión
        const TIEMPO_PARTIDA = 120; // segundos de límite de partida
        const PUNTAJE_META = 50;
        const TUBERIAS_POR_NIVEL = 15;
        const NIVELES_VELOCIDAD = 3;
        const AUMENTO_VELOCIDAD = 0.1;

        let estadoJuego = 'listo'; // listo | jugando | pausado | impacto | gameover | victoria
        let velocidadActual = FlappyFisica.VEL_MUNDO;
        let puntos = 0;
        let tuberiasSuperadas = 0;
        let tiempoRestante = TIEMPO_PARTIDA;
        let ultimoSegundoMostrado = TIEMPO_PARTIDA;
        let tuberias = [];
        let avesBonus = [];
        let distanciaProximoTubo = 0;
        let ultimo = null;
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
        function actualizarVelocidad() {
            const niveles = Math.min(
                NIVELES_VELOCIDAD,
                Math.floor(tuberiasSuperadas / TUBERIAS_POR_NIVEL)
            );
            velocidadActual = FlappyFisica.VEL_MUNDO * (1 + niveles * AUMENTO_VELOCIDAD);
        }

        function prepararAveBonus(tuberia) {
            if (avesBonus.length > 0) return;

            const tipo = fabricaAvesBonus.elegirTipo(pajaro.puedeAumentarTamano());
            if (tipo === 'bird-2') {
                avesBonus.push(fabricaAvesBonus.crearBird2EnEscenario(
                    config.ANCHO_LIENZO,
                    config.ALTO_LIENZO
                ));
            } else if (tipo === 'bird-3') {
                avesBonus.push(fabricaAvesBonus.crearBird3DesdeTuberia(tuberia));
            }
        }

        function actualizarTuberias(dt, velocidad) {
            distanciaProximoTubo -= velocidad * dt;
            if (distanciaProximoTubo <= 0) {
                const nuevoPar = fabricaTuberias.crear(config.ANCHO_LIENZO + 20);
                tuberias.push(nuevoPar);
                prepararAveBonus(nuevoPar);
                distanciaProximoTubo = fabricaTuberias.siguienteDistancia();
            }

            for (let i = tuberias.length - 1; i >= 0; i--) {
                const tubo = tuberias[i];
                tubo.actualizar(dt, velocidad);

                // Suma +1 punto cuando el pájaro supera completamente el par de tuberías
                if (!tubo.superado && tubo.x + tubo.ancho < config.X_PANTALLA) {
                    tubo.superado = true;
                    tuberiasSuperadas += 1;
                    actualizarVelocidad();
                    sumarPuntos(1);
                    if (estadoJuego !== 'jugando') return;
                }

                if (tubo.estaFueraDePantalla()) {
                    tubo.destruir();
                    tuberias.splice(i, 1);
                }
            }
        }

        function actualizarAvesBonus(dt, velocidad) {
            const hitbox = pajaro.getHitbox();

            for (let i = avesBonus.length - 1; i >= 0; i--) {
                const ave = avesBonus[i];
                ave.actualizar(dt, velocidad);

                if (ave.tipo === 'bird-2' && ave.colisionaCon(hitbox)) {
                    pajaro.aumentarTamano();
                    pajaro.mostrarPenalizacion();
                    ave.destruir();
                    avesBonus.splice(i, 1);
                    if (estadoJuego !== 'jugando') return;
                } else if (ave.terminoRecorrido()) {
                    ave.destruir();
                    avesBonus.splice(i, 1);
                }
            }
        }

        function dibujarTuberias() {
            for (let i = 0; i < tuberias.length; i++) {
                tuberias[i].render();
            }
        }

        function dibujarAvesBonus() {
            for (let i = 0; i < avesBonus.length; i++) {
                avesBonus[i].render();
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

        function limpiarAvesBonus() {
            for (let i = 0; i < avesBonus.length; i++) {
                avesBonus[i].destruir();
            }
            avesBonus = [];
        }

        function dibujarEscena() {
            pajaro.render();
            dibujarParallax();
            dibujarTuberias();
            dibujarAvesBonus();
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
            if (hudPuntos) {
                hudPuntos.textContent = 'Puntos: ' + puntos + ' / ' + PUNTAJE_META;
            }
            if (estadoJuego === 'jugando' && puntos >= PUNTAJE_META) {
                ganarPartida();
            }
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
           Loop con timestep variable
           ------------------------------------------------------------ */
        function iniciarLoop() {
            if (rafId !== null) return;
            ultimo = null;
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

            if (ultimo === null) ultimo = ahora;
            let dt = (ahora - ultimo) / 1000;
            ultimo = ahora;

            if (!Number.isFinite(dt) || dt < 0) dt = 0;
            dt = Math.min(dt, DT_MAXIMO);

            if (dt > 0) {
                const velocidadFrame = velocidadActual;
                pajaro.actualizar(dt, velocidadFrame);
                actualizarParallax(dt, velocidadFrame);
                actualizarTuberias(dt, velocidadFrame);
                if (estadoJuego !== 'jugando') return;
                actualizarAvesBonus(dt, velocidadFrame);
                if (estadoJuego !== 'jugando') return;
                tiempoRestante = Math.max(0, tiempoRestante - dt);

                const segundoActual = Math.ceil(tiempoRestante);
                if (segundoActual !== ultimoSegundoMostrado) {
                    ultimoSegundoMostrado = segundoActual;
                    dibujarTiempo();
                }

                if (pajaro.estaEnSuelo()) {
                    pajaro.limitarAlSuelo();
                    dibujarEscena();
                    terminarPartida('suelo');
                    return;
                }

                pajaro.limitarAlTecho();

                if (hayColisionConTuberias()) {
                    dibujarEscena();
                    terminarPartida('tubo');
                    return;
                }

                if (tiempoRestante <= 0) {
                    dibujarEscena();
                    terminarPorTiempo();
                    return;
                }
            }

            dibujarEscena();
        }

        /* ------------------------------------------------------------
           Estados de la partida
           ------------------------------------------------------------ */
        function iniciarPartida() {
            if (estadoJuego === 'jugando') {
                pajaro.impulsar(velocidadActual);
                return;
            }

            if (estadoJuego === 'impacto') return;

            if (estadoJuego === 'gameover' || estadoJuego === 'victoria') {
                reiniciarPartida();
                iniciarPartida();
                return;
            }

            estadoJuego = 'jugando';
            ocultarOverlay();
            actualizarHud('En vuelo');
            pajaro.impulsar(velocidadActual);
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
                ? 'El pájaro chocó contra una tubería. Puntaje final: ' + puntos + ' de ' + PUNTAJE_META + '.'
                : 'El pájaro tocó el suelo del bosque. Puntaje final: ' + puntos + ' de ' + PUNTAJE_META + '.';

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

        function ganarPartida() {
            if (estadoJuego !== 'jugando') return;

            estadoJuego = 'victoria';
            detenerLoop();
            actualizarHud('¡Victoria!');
            mostrarOverlay(
                '¡Ganaste!',
                'Alcanzaste ' + puntos + ' puntos y superaste el desafío.',
                'Jugar de nuevo',
                true
            );
        }

        function terminarPorTiempo() {
            if (estadoJuego !== 'jugando') return;

            estadoJuego = 'gameover';
            detenerLoop();
            pajaro.setSprite('inicio', false);
            actualizarHud('¡Tiempo cumplido!');
            mostrarOverlay(
                '¡Tiempo cumplido!',
                'Se agotaron los ' + TIEMPO_PARTIDA + ' segundos. Sumaste ' + puntos +
                    ' de ' + PUNTAJE_META + ' puntos.',
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
            tuberiasSuperadas = 0;
            tiempoRestante = TIEMPO_PARTIDA;
            ultimoSegundoMostrado = TIEMPO_PARTIDA;
            ultimo = null;
            pajaro.reset();
            reiniciarParallax();
            limpiarTuberias();
            limpiarAvesBonus();
            sumarPuntos(0);
            dibujarTiempo();
            actualizarHud('Listo para volar');
            mostrarOverlay(
                'Flappy Bird',
                'Aleteá y alcanzá 50 puntos antes de que se agoten los 120 segundos.',
                'Jugar',
                false
            );
        }

        /* ------------------------------------------------------------
           Input
           ------------------------------------------------------------ */
        function esElementoInteractivo(target) {
            return Boolean(
                target && target.closest &&
                target.closest('button, a, input, textarea, select')
            );
        }

        function ejecutarAccionVuelo() {
            if (estadoJuego === 'jugando') {
                pajaro.impulsar(velocidadActual);
                return true;
            }
            if (estadoJuego === 'listo') {
                iniciarPartida();
                return true;
            }
            return false;
        }

        function alPresionar(e) {
            if (esElementoInteractivo(e.target)) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            if (ejecutarAccionVuelo()) {
                e.preventDefault();
            }
        }

        function alTeclear(e) {
            if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
            if (esElementoInteractivo(e.target)) return;

            e.preventDefault();
            if (e.repeat) return;

            ejecutarAccionVuelo();
        }

        marco.addEventListener('pointerdown', alPresionar);
        document.addEventListener('keydown', alTeclear);

        if (btnAccion) {
            btnAccion.addEventListener('click', function (e) {
                e.stopPropagation();

                if (estadoJuego === 'gameover' || estadoJuego === 'victoria') {
                    reiniciarPartida();
                    iniciarPartida();
                } else if (estadoJuego === 'listo') {
                    iniciarPartida();
                }
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
                iniciarLoop();
            }
        });

        function debugCasiGanar() {
            reiniciarPartida();

            tuberiasSuperadas = TUBERIAS_POR_NIVEL * NIVELES_VELOCIDAD;
            actualizarVelocidad();
            puntos = PUNTAJE_META - 1;
            sumarPuntos(0);

            const tubo = fabricaTuberias.crear(config.X_PANTALLA);
            // Queda un paso antes de cruzar la línea que suma el último punto.
            tubo.x = config.X_PANTALLA - tubo.ancho + 1;
            tubo.render();
            tuberias.push(tubo);

            pajaro.prepararParaDebug(tubo.centroY);
            estadoJuego = 'jugando';
            distanciaProximoTubo = config.ANCHO_LIENZO;
            ocultarOverlay();
            actualizarHud('Debug: casi victoria');
            dibujarEscena();
            iniciarLoop();
        }

        window.FlappyDebug = {
            debugCasiGanar: debugCasiGanar
        };

        /* ------------------------------------------------------------
           Arranque
           ------------------------------------------------------------ */
        reiniciarPartida();
    });
})();
