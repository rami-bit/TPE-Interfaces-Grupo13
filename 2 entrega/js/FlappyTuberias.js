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
        GAP_INICIAL: 500,       // abertura inicial (px)
        GAP_MINIMO: 125,        // abertura mínima jugable (px)
        REDUCCION_GAP: 200,       // px que se achica por cada tubería creada
        DIST_MIN: 290,          // separación horizontal mínima entre pares (px)
        DIST_MAX: 420,          // separación horizontal máxima entre pares (px)
        MARGEN_VERTICAL: 75,    // margen libre arriba y abajo para el hueco (px)
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
        }

        calcularGap() {
            return Math.max(
                TUBERIAS_CONFIG.GAP_MINIMO,
                TUBERIAS_CONFIG.GAP_INICIAL - this.creadas * TUBERIAS_CONFIG.REDUCCION_GAP
            );
        }

        calcularCentroY(gap) {
            const minY = Math.ceil(TUBERIAS_CONFIG.MARGEN_VERTICAL + gap / 2);
            const maxY = Math.floor(this.sueloY - TUBERIAS_CONFIG.MARGEN_VERTICAL - gap / 2);
            const centroBase = (minY + maxY) / 2;

            // Antes de llegar al gap mínimo, las tuberías salen centradas
            if (gap > TUBERIAS_CONFIG.GAP_MINIMO) {
                return Math.round(centroBase);
            }

            // Cantidad de tuberías creadas desde que el gap llegó al mínimo
            const tuberiasHastaGapMin = Math.min(
                Math.floor((TUBERIAS_CONFIG.GAP_INICIAL - TUBERIAS_CONFIG.GAP_MINIMO) / TUBERIAS_CONFIG.REDUCCION_GAP),
                this.creadas
            );
            const progresoDesdeMin = Math.max(1, this.creadas - tuberiasHastaGapMin + 1);

            // El umbral empieza con una variación muy chica y crece a medida que se crean más tuberías (hasta 1)
            const factorCrecimiento = Math.min(1, progresoDesdeMin * 0.8);
            const umbral = Math.random() * factorCrecimiento;

            const amplitudMaxima = (maxY - minY) / 2;
            const direccion = Math.random() < 0.5 ? -1 : 1;
            const desplazamiento = direccion * umbral * amplitudMaxima;

            return Math.round(centroBase + desplazamiento);
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

            return new ParTuberias(this.contenedor, x, centroY, gap, this.sueloY, this.altoLienzo);
        }
    }

    global.ParTuberias = ParTuberias;
    global.FabricaTuberias = FabricaTuberias;
})(window);
