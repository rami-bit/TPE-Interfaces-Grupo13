/* ============================================================
   FLAPPY BIRD - AVES BONUS Y SU FÁBRICA
   Bird 3 asciende entre tuberías; bird 2 cruza el escenario.
   ============================================================ */

(function (global) {
    'use strict';

    const TAMANO_AVE = 32;
    const PROBABILIDAD_APARICION = 1 / 3;
    const PROBABILIDAD_BIRD2 = 0.5;
    const MARGEN_PENALIZADOR = 80;
    const AMPLITUD_FLOTAR_BIRD2 = 5;
    const VELOCIDAD_EXTRA_BIRD2 = 90; // px/s extra para despegarse de la tubería
    const VELOCIDAD_ASCENSO_BIRD3 = 50;

    function aleatorioEntre(min, max) {
        return min + Math.random() * (max - min);
    }

    class FlappyAveBonus {
        constructor(contenedor, tipo, x, centroY, centroYFinal) {
            this.tipo = tipo;
            this.x = x;
            this.centroY = centroY;
            this.ancho = TAMANO_AVE;
            this.alto = TAMANO_AVE;
            this.centroYFinal = centroYFinal;
            this.el = this.crearDOM(contenedor);
            this.render();
        }

        crearDOM(contenedor) {
            const ave = document.createElement('div');
            ave.className = 'flappy-ave-bonus flappy-ave-bonus--' + this.tipo;
            ave.setAttribute('aria-hidden', 'true');

            const orientacion = document.createElement('div');
            orientacion.className = 'flappy-ave-bonus__orientacion';

            const sprite = document.createElement('div');
            sprite.className = 'flappy-ave-bonus__sprite';
            orientacion.appendChild(sprite);
            ave.appendChild(orientacion);
            contenedor.appendChild(ave);
            return ave;
        }

        actualizar(dt, velocidad) {
            const desplazamiento = this.tipo === 'bird-2'
                ? velocidad + VELOCIDAD_EXTRA_BIRD2
                : velocidad;
            this.x -= desplazamiento * dt;

            if (this.tipo === 'bird-3') {
                this.centroY = Math.max(
                    this.centroYFinal,
                    this.centroY - VELOCIDAD_ASCENSO_BIRD3 * dt
                );
            }
        }

        render() {
            this.el.style.transform =
                'translate3d(' + this.x + 'px, ' + (this.centroY - this.alto / 2) + 'px, 0)';
        }

        colisionaCon(hitbox) {
            const arriba = this.centroY - this.alto / 2;
            const abajo = this.centroY + this.alto / 2;
            return hitbox.der > this.x &&
                hitbox.izq < this.x + this.ancho &&
                hitbox.abajo > arriba &&
                hitbox.arriba < abajo;
        }

        terminoRecorrido() {
            if (this.tipo === 'bird-3') {
                return this.centroY <= this.centroYFinal;
            }
            return this.x + this.ancho < 0;
        }

        destruir() {
            if (this.el && this.el.parentNode) {
                this.el.remove();
            }
        }
    }

    class FabricaAvesBonus {
        constructor(contenedorEscenario, contenedorTuberias) {
            this.contenedorEscenario = contenedorEscenario;
            this.contenedorTuberias = contenedorTuberias;
        }

        elegirTipo(permitirBird2) {
            if (Math.random() >= PROBABILIDAD_APARICION) return null;
            if (!permitirBird2) return 'bird-3';

            return Math.random() < PROBABILIDAD_BIRD2 ? 'bird-2' : 'bird-3';
        }

        crearBird2EnEscenario(anchoLienzo, altoLienzo) {
            const centroY = aleatorioEntre(
                MARGEN_PENALIZADOR + TAMANO_AVE / 2,
                altoLienzo / 2 - TAMANO_AVE / 2 - AMPLITUD_FLOTAR_BIRD2
            );
            return new FlappyAveBonus(
                this.contenedorEscenario,
                'bird-2',
                anchoLienzo,
                centroY
            );
        }

        crearBird3DesdeTuberia(tuberia) {
            const xInicial = tuberia.x + (tuberia.ancho - TAMANO_AVE) / 2;
            const centroYInicial = tuberia.huecoAbajo + TAMANO_AVE / 2;
            const centroYFinal = tuberia.huecoArriba - TAMANO_AVE / 2;
            return new FlappyAveBonus(
                this.contenedorTuberias,
                'bird-3',
                xInicial,
                centroYInicial,
                centroYFinal
            );
        }
    }

    global.FlappyAveBonus = FlappyAveBonus;
    global.FabricaAvesBonus = FabricaAvesBonus;
})(window);
