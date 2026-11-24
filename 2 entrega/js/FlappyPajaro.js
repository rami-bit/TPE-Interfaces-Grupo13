/* ============================================================
   FLAPPY BIRD - FÍSICA Y SPRITE DEL PÁJARO
   La física permanece separada del render para adaptarse a cada
   nivel de velocidad.
   ============================================================ */

(function (global) {
    'use strict';

    const FlappyFisica = {
        GRAVEDAD: 1400,        // px/s²
        IMPULSO: -450,         // px/s
        VEL_MAX_CAIDA: 650,    // px/s
        VEL_MUNDO: 150,        // px/s de avance horizontal

        factorVelocidad(velMundo) {
            const velocidad = velMundo !== undefined ? velMundo : FlappyFisica.VEL_MUNDO;
            return velocidad / FlappyFisica.VEL_MUNDO;
        },

        /**
         * Actualiza el estado del pájaro con el tiempo transcurrido.
         * @param {{y:number, vy:number, xMundo:number, rot:number}} estado
         * @param {number} dt segundos
         * @param {number} [velMundo] velocidad horizontal actual en px/s
         */
        actualizar(estado, dt, velMundo) {
            const vel = velMundo !== undefined ? velMundo : FlappyFisica.VEL_MUNDO;
            const factor = FlappyFisica.factorVelocidad(vel);
            const gravedadActual = FlappyFisica.GRAVEDAD * factor * factor;
            const velocidadMaximaCaida = FlappyFisica.VEL_MAX_CAIDA * factor;

            estado.vy = Math.min(
                estado.vy + gravedadActual * dt,
                velocidadMaximaCaida
            );
            estado.y += estado.vy * dt;
            estado.xMundo += vel * dt;
            estado.rot = Math.max(-25, Math.min(75, estado.vy * 0.12));
        },

        /**
         * Aplica un impulso vertical instantáneo.
         * @param {{vy:number}} estado
         */
        impulsar(estado, velMundo) {
            const factor = FlappyFisica.factorVelocidad(velMundo);
            estado.vy = FlappyFisica.IMPULSO * factor;
        }
    };

    const CONFIG = {
        ANCHO_LIENZO: 1024,
        ALTO_LIENZO: 576,
        ANCHO_SPRITE: 64,
        ALTO_SPRITE: 64,
        X_PANTALLA: 220,
        Y_INICIAL: 230,
        SUELO_Y: 535,
        OFFSET_PIES: 30,
        OFFSET_CABEZA: 29,
        HITBOX_ANCHO: 26,
        HITBOX_ALTO: 26,
        ESCALA_INICIAL: 1,
        ESCALA_MAXIMA: 1.5,
        AUMENTO_ESCALA: 0.1,
        TIEMPO_ALETEO: 0.28
    };

    // Centro visible del pájaro dentro del frame renderizado de 64x64.
    const ANCLA_X = CONFIG.ANCHO_SPRITE * 0.54;
    const ANCLA_Y = CONFIG.ALTO_SPRITE * 0.53;

    class FlappyPajaro {
        /**
         * @param {HTMLElement} el contenedor .flappy-pajaro
         */
        constructor(el) {
            this.el = el;
            this.sprite = el.querySelector('.flappy-pajaro__sprite');
            this.estado = {
                xMundo: 0,
                y: CONFIG.Y_INICIAL,
                vy: 0,
                rot: 0,
                tiempoAleteo: 0
            };
            this.escala = CONFIG.ESCALA_INICIAL;
            this.modo = 'listo'; // listo | jugando | impacto
            this.reset();
        }

        reset() {
            this.escala = CONFIG.ESCALA_INICIAL;
            this.estado.xMundo = 0;
            this.estado.y = CONFIG.Y_INICIAL;
            this.estado.vy = 0;
            this.estado.rot = 0;
            this.estado.tiempoAleteo = 0;
            this.modo = 'listo';
            this.el.classList.remove('flappy-pajaro--penalizado');
            this.setSprite('inicio', true);
            this.render();
        }

        /**
         * Impulso del jugador. Si el juego no empezó, lo inicia.
         * @returns {boolean}
         */
        impulsar(velMundo) {
            if (this.modo === 'impacto') return false;
            if (this.modo === 'listo') this.modo = 'jugando';
            FlappyFisica.impulsar(this.estado, velMundo);
            this.estado.tiempoAleteo = CONFIG.TIEMPO_ALETEO;
            this.setSprite('aleteo', true);
            return true;
        }

        /**
         * Solo actualiza el estado; el render se hace una vez por frame.
         * @param {number} dt
         * @param {number} [velMundo] velocidad horizontal actual en px/s
         */
        actualizar(dt, velMundo) {
            if (this.modo !== 'jugando') return;

            FlappyFisica.actualizar(this.estado, dt, velMundo);

            if (this.estado.tiempoAleteo > 0) {
                this.estado.tiempoAleteo = Math.max(0, this.estado.tiempoAleteo - dt);
                if (this.estado.tiempoAleteo === 0) {
                    this.setSprite('planeo');
                }
            }
        }

        render() {
            const x = CONFIG.X_PANTALLA - ANCLA_X;
            const y = this.estado.y - ANCLA_Y;
            this.el.style.transform =
                `translate3d(${x}px, ${y}px, 0) rotate(${this.estado.rot}deg) scale(${this.escala})`;
        }

        puedeAumentarTamano() {
            return this.escala < CONFIG.ESCALA_MAXIMA;
        }

        aumentarTamano() {
            if (!this.puedeAumentarTamano()) return false;

            this.escala = Math.min(
                CONFIG.ESCALA_MAXIMA,
                Math.round((this.escala + CONFIG.AUMENTO_ESCALA) * 100) / 100
            );
            this.render();
            return true;
        }

        mostrarPenalizacion() {
            this.el.classList.remove('flappy-pajaro--penalizado');
            void this.el.offsetWidth;
            this.el.classList.add('flappy-pajaro--penalizado');
        }

        prepararParaDebug(y) {
            this.modo = 'jugando';
            this.estado.y = y;
            this.estado.vy = 0;
            this.estado.rot = 0;
            this.estado.tiempoAleteo = 0;
            this.setSprite('planeo', true);
            this.render();
        }

        /**
         * Cambia el estado visual del sprite.
         * @param {'inicio'|'aleteo'|'planeo'|'impacto'} nombre
         * @param {boolean} reiniciar fuerza el reinicio de la animación
         */
        setSprite(nombre, reiniciar) {
            const clases = ['inicio', 'aleteo', 'planeo', 'impacto'].map(
                (estado) => `flappy-pajaro__sprite--${estado}`
            );
            clases.forEach((clase) => this.sprite.classList.remove(clase));

            if (reiniciar) {
                // Fuerza reflow para que el keyframe vuelva a empezar.
                void this.sprite.offsetWidth;
            }

            this.sprite.classList.add(`flappy-pajaro__sprite--${nombre}`);
        }

        impactar() {
            if (this.modo === 'impacto') return;
            this.modo = 'impacto';
            this.estado.vy = 0;
            this.setSprite('impacto', true);
        }

        estaEnSuelo() {
            return this.estado.y + CONFIG.OFFSET_PIES * this.escala >= CONFIG.SUELO_Y;
        }

        limitarAlSuelo() {
            this.estado.y = CONFIG.SUELO_Y - CONFIG.OFFSET_PIES * this.escala;
        }

        limitarAlTecho() {
            const yMin = CONFIG.OFFSET_CABEZA * this.escala;
            if (this.estado.y < yMin) {
                this.estado.y = yMin;
                this.estado.vy = 0;
            }
        }

        /**
         * Caja de colisión (AABB) centrada en el cuerpo del pájaro.
         * @returns {{izq:number, der:number, arriba:number, abajo:number}}
         */
        getHitbox() {
            const mitadAncho = CONFIG.HITBOX_ANCHO * this.escala / 2;
            const mitadAlto = CONFIG.HITBOX_ALTO * this.escala / 2;
            return {
                izq: CONFIG.X_PANTALLA - mitadAncho,
                der: CONFIG.X_PANTALLA + mitadAncho,
                arriba: this.estado.y - mitadAlto,
                abajo: this.estado.y + mitadAlto
            };
        }
    }

    global.FlappyFisica = FlappyFisica;
    global.FlappyPajaro = FlappyPajaro;
    global.FLAPPY_CONFIG = CONFIG;
})(window);
