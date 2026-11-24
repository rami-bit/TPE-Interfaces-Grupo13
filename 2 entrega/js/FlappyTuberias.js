/* ============================================================
   FLAPPY BIRD - CLASE PAR DE TUBERÍAS
   Representa un obstáculo (tubo superior + tubo inferior) con
   un hueco vertical por donde debe pasar el pájaro.
   ============================================================ */

(function (global) {
    'use strict';

    const ANCHO_TUBO = 96;
    const ALTO_BOCA = 48;

    const TUBERIAS_CONFIG = {
        GAP_INICIAL: 185,       // abertura inicial (px)
        GAP_MINIMO: 125,        // abertura mínima jugable (px)
        REDUCCION_GAP: 4,       // px que se achica por cada tubería creada
        DIST_MIN: 290,          // separación horizontal mínima entre pares (px)
        DIST_MAX: 420,          // separación horizontal máxima entre pares (px)
        MARGEN_VERTICAL: 75,    // margen libre arriba y abajo para el hueco (px)
        CAMBIO_ALTURA_MIN: 55   // diferencia mínima en Y respecto al tubo anterior
    };

    function aleatorioEntre(min, max) {
        return min + Math.random() * (max - min);
    }

    class ParTuberias {
        /**
         * @param {HTMLElement} contenedor elemento #flappy-tuberias
         * @param {number} x posición horizontal inicial (px lógicos)
         * @param {number} centroY centro vertical del hueco (px lógicos)
         * @param {number} gap alto del hueco por donde pasa el pájaro (px)
         * @param {number} sueloY coordenada Y donde empieza el suelo jugable (px)
         * @param {number} [altoLienzo] alto total del lienzo para que el tubo llegue hasta abajo (px)
         */
        constructor(contenedor, x, centroY, gap, sueloY, altoLienzo) {
            this.x = x;
            this.ancho = ANCHO_TUBO;
            this.centroY = centroY;
            this.gap = gap;
            this.sueloY = sueloY;
            this.altoLienzo = altoLienzo || sueloY;
            this.superado = false;

            // Bordes verticales del hueco libre
            this.huecoArriba = Math.max(ALTO_BOCA, centroY - gap / 2);
            this.huecoAbajo = Math.min(sueloY - ALTO_BOCA, centroY + gap / 2);

            this.el = this.crearDOM();
            contenedor.appendChild(this.el);
            this.render();
        }

        crearDOM() {
            const par = document.createElement('div');
            par.className = 'flappy-tubo-par';

            const altoArriba = this.huecoArriba;
            const altoAbajo = this.altoLienzo - this.huecoAbajo;

            // Tubo superior: cuelga desde y = 0 hasta huecoArriba (boca mirando abajo)
            const tuboArriba = document.createElement('div');
            tuboArriba.className = 'flappy-tubo flappy-tubo--arriba';
            tuboArriba.style.height = altoArriba + 'px';

            const cuerpoArriba = document.createElement('div');
            cuerpoArriba.className = 'flappy-tubo__cuerpo';
            const bocaArriba = document.createElement('div');
            bocaArriba.className = 'flappy-tubo__boca flappy-tubo__boca--arriba';
            tuboArriba.appendChild(cuerpoArriba);
            tuboArriba.appendChild(bocaArriba);

            // Tubo inferior: nace en huecoAbajo hasta sueloY (boca mirando arriba)
            const tuboAbajo = document.createElement('div');
            tuboAbajo.className = 'flappy-tubo flappy-tubo--abajo';
            tuboAbajo.style.top = this.huecoAbajo + 'px';
            tuboAbajo.style.height = altoAbajo + 'px';

            const bocaAbajo = document.createElement('div');
            bocaAbajo.className = 'flappy-tubo__boca flappy-tubo__boca--abajo';
            const cuerpoAbajo = document.createElement('div');
            cuerpoAbajo.className = 'flappy-tubo__cuerpo';
            tuboAbajo.appendChild(bocaAbajo);
            tuboAbajo.appendChild(cuerpoAbajo);

            par.appendChild(tuboArriba);
            par.appendChild(tuboAbajo);
            return par;
        }

        actualizar(dt, velocidad) {
            this.x -= velocidad * dt;
        }

        render() {
            this.el.style.transform = `translate3d(${this.x}px, 0, 0)`;
        }

        /**
         * Verifica colisión AABB contra el tubo superior o el inferior.
         * @param {{izq:number, der:number, arriba:number, abajo:number}} hitbox
         * @returns {boolean}
         */
        colisionaCon(hitbox) {
            const seSuperponeX = hitbox.der > this.x && hitbox.izq < this.x + this.ancho;
            if (!seSuperponeX) return false;

            return hitbox.arriba < this.huecoArriba || hitbox.abajo > this.huecoAbajo;
        }

        estaFueraDePantalla() {
            return this.x + this.ancho < 0;
        }

        destruir() {
            if (this.el && this.el.parentNode) {
                this.el.remove();
            }
        }
    }

    /**
     * Factory Method encargado de fabricar pares de tuberías aplicando
     * las 3 reglas de variación: distancia horizontal variable, hueco
     * vertical que se achica progresivamente y altura no alineada.
     */
    class FabricaTuberias {
        /**
         * @param {HTMLElement} contenedor elemento #flappy-tuberias
         * @param {number} sueloY coordenada Y donde empieza el suelo jugable
         * @param {number} [altoLienzo] alto total del lienzo (para que el tubo baje hasta el borde)
         */
        constructor(contenedor, sueloY, altoLienzo) {
            this.contenedor = contenedor;
            this.sueloY = sueloY;
            this.altoLienzo = altoLienzo || sueloY;
            this.reset();
        }

        reset() {
            this.creadas = 0;
            this.ultimoCentroY = null;
        }

        calcularGap() {
            return Math.max(
                TUBERIAS_CONFIG.GAP_MINIMO,
                TUBERIAS_CONFIG.GAP_INICIAL - this.creadas * TUBERIAS_CONFIG.REDUCCION_GAP
            );
        }

        calcularCentroY(gap) {
            const minY = TUBERIAS_CONFIG.MARGEN_VERTICAL + gap / 2;
            const maxY = this.sueloY - TUBERIAS_CONFIG.MARGEN_VERTICAL - gap / 2;

            let centroY = aleatorioEntre(minY, maxY);

            // Evita que dos tuberías seguidas queden alineadas a la misma altura
            if (this.ultimoCentroY !== null) {
                for (let intentos = 0; intentos < 8; intentos++) {
                    if (Math.abs(centroY - this.ultimoCentroY) >= TUBERIAS_CONFIG.CAMBIO_ALTURA_MIN) {
                        break;
                    }
                    centroY = aleatorioEntre(minY, maxY);
                }
            }

            return Math.round(centroY);
        }

        siguienteDistancia() {
            return aleatorioEntre(TUBERIAS_CONFIG.DIST_MIN, TUBERIAS_CONFIG.DIST_MAX);
        }

        /**
         * Método fábrica: crea y devuelve un nuevo ParTuberias configurado.
         * @param {number} x coordenada horizontal de aparición
         * @returns {ParTuberias}
         */
        crear(x) {
            const gap = this.calcularGap();
            const centroY = this.calcularCentroY(gap);

            this.creadas += 1;
            this.ultimoCentroY = centroY;

            return new ParTuberias(this.contenedor, x, centroY, gap, this.sueloY, this.altoLienzo);
        }
    }

    global.ParTuberias = ParTuberias;
    global.FabricaTuberias = FabricaTuberias;
})(window);
