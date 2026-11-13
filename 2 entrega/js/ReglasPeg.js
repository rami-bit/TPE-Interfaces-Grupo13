/**
 * Módulo de Reglas de Comer para Peg Solitaire.
 *
 * Sigue el mismo patrón que `js/filtros.js` (usado por el juego BLOCKA):
 * un único objeto expuesto en `window` cuyo cada método implementa una
 * variante de la regla de comer / salto.
 *
 * Cada función recibe el contexto del tablero (ficha, matriz, tamaño)
 * y devuelve un arreglo de movimientos válidos con esta forma:
 *
 *   [{
 *     direccion: 'arriba',                  // nombre de la dirección
 *     destino:   { row: number, col: number }, // casilla donde cae la ficha
 *     intermedio:{ row: number, col: number }, // primera casilla comida (o null)
 *     intermedios: [{row, col}, ...],          // todas las casillas comidas (1 o más)
 *     esDoble:   boolean,                      // true si la jugada implica >1 captura
 *     // Propiedades extras solo para 'damaDoble':
 *     camino:    [{origen, destino, intermedio, direccion}], // pasos obligatorios de la cadena
 *     totalComidas: number                     // total de fichas comidas en la cadena
 *   }]
 *
 * Uso desde juego.js:
 *   const movs = ReglasPeg.obtenerMovimientosValidos(ficha, tablero, TAM_TABLERO, {
 *       modo: 'damaDoble', distancia: 2
 *   });
 */
const ReglasPeg = {
    // =====================================================================
    // CONFIGURACIÓN ACTIVA (se puede sobrescribir desde consola o juego.js)
    // =====================================================================
    // Valores válidos: 'clasico' | 'damaDoble' | 'diagonal' | 'saltoLargo' |
    //                  'comidaObligatoria' | 'distanciaVariable'
    modo: 'clasico',

    // Distancia de salto (solo se usa con modo 'distanciaVariable'). 2 = clásico.
    distancia: 2,

    // =====================================================================
    // DIRECCIONES BASE
    // =====================================================================
    ORTOGONALES: [
        { nombre: 'arriba',    dr: -1, dc:  0 },
        { nombre: 'abajo',     dr:  1, dc:  0 },
        { nombre: 'izquierda', dr:  0, dc: -1 },
        { nombre: 'derecha',   dr:  0, dc:  1 }
    ],

    DIAGONALES: [
        { nombre: 'diagonal-arriba-izq', dr: -1, dc: -1 },
        { nombre: 'diagonal-arriba-der', dr: -1, dc:  1 },
        { nombre: 'diagonal-abajo-izq',  dr:  1, dc: -1 },
        { nombre: 'diagonal-abajo-der',  dr:  1, dc:  1 }
    ],

    // =====================================================================
    // API PRINCIPAL
    // =====================================================================
    /**
     * Devuelve los movimientos válidos para una ficha según la regla activa.
     *
     * Para el modo 'damaDoble' devuelve los DESTINOS FINALES de cada cadena
     * de capturas encadenadas posible, no saltos sueltos. Cada movimiento
     * trae asociada su `camino` completo (pasos obligatorios) y todas las
     * `intermedios` que se comerán de una sola vez al ejecutar el movimiento.
     *
     * @param {Object} ficha      - { row, col }
     * @param {Array}  tablero    - matriz TAM_TABLERO x TAM_TABLERO
     * @param {number} TAM_TABLERO - tamaño del tablero (7)
     * @param {Object} opts       - { modo, distancia }
     * @returns {Array}
     */
    obtenerMovimientosValidos(ficha, tablero, TAM_TABLERO, opts = {}) {
        if (!ficha || ficha.row === undefined || ficha.col === undefined) return [];

        const modo = opts.modo || this.modo;
        const distancia = opts.distancia !== undefined ? opts.distancia : this.distancia;

        let movimientos = [];

        // 1. Calculamos saltos según la variante elegida
        switch (modo) {
            case 'diagonal':
                movimientos = this.diagonal(ficha, tablero, TAM_TABLERO);
                break;
            case 'saltoLargo':
                movimientos = this.saltoLargo(ficha, tablero, TAM_TABLERO);
                break;
            case 'distanciaVariable':
                movimientos = this.distanciaVariable(ficha, tablero, TAM_TABLERO, distancia);
                break;
            case 'damaDoble':
                movimientos = this.movimientosDamaDoble(ficha, tablero, TAM_TABLERO);
                break;
            case 'clasico':
            default:
                movimientos = this.clasico(ficha, tablero, TAM_TABLERO);
                break;
        }

        // 2. Comida obligatoria: si hay al menos un movimiento, se filtra para que solo queden los que capturan
        if (modo === 'comidaObligatoria') {
            movimientos = this.comidaObligatoria(ficha, tablero, TAM_TABLERO, movimientos);
        }

        return movimientos;
    },

    // ---------------------------------------------------------------------
    // VARIANTE: CLÁSICO (ortogonal, distancia 2, 1 intermedia)
    // ---------------------------------------------------------------------
    /**
     * Regla estándar de Peg Solitaire. Salto a 2 casillas ortogonales,
     * casilla del medio ocupada, destino vacío.
     */
    clasico(ficha, tablero, TAM_TABLERO) {
        const { row, col } = ficha;
        const movimientos = [];

        for (const dir of this.ORTOGONALES) {
            const mov = this._construirSalto(tablero, TAM_TABLERO, row, col, dir, 1);
            if (mov) movimientos.push(mov);
        }

        return movimientos;
    },

    // ---------------------------------------------------------------------
    // VARIANTE: DIAGONAL (idéntico al clásico pero en las 4 diagonales)
    // ---------------------------------------------------------------------
    diagonal(ficha, tablero, TAM_TABLERO) {
        const { row, col } = ficha;
        const movimientos = [];

        for (const dir of this.DIAGONALES) {
            const mov = this._construirSalto(tablero, TAM_TABLERO, row, col, dir, 1);
            if (mov) movimientos.push(mov);
        }

        return movimientos;
    },

    // ---------------------------------------------------------------------
    // VARIANTE: SALTO LARGO (distancia 3, 2 intermedias, come 2 de una vez)
    // ---------------------------------------------------------------------
    /**
     * La ficha salta 3 casillas. Las dos casillas intermedias deben estar
     * ocupadas (se comen ambas) y el destino debe estar vacío.
     */
    saltoLargo(ficha, tablero, TAM_TABLERO) {
        const { row, col } = ficha;
        const movimientos = [];

        for (const dir of this.ORTOGONALES) {
            const mov = this._construirSalto(tablero, TAM_TABLERO, row, col, dir, 2);
            if (mov) movimientos.push(mov);
        }

        return movimientos;
    },

    // ---------------------------------------------------------------------
    // VARIANTE: DISTANCIA VARIABLE (N casillas, N-1 intermedias ocupadas)
    // ---------------------------------------------------------------------
    /**
     * Salto a `distancia` casillas. Las `distancia - 1` casillas intermedias
     * deben estar ocupadas y el destino vacío. Come todas las intermedias.
     */
    distanciaVariable(ficha, tablero, TAM_TABLERO, distancia = 2) {
        const { row, col } = ficha;
        const movimientos = [];

        if (distancia < 2) return movimientos;

        for (const dir of this.ORTOGONALES) {
            const destR = row + dir.dr * distancia;
            const destC = col + dir.dc * distancia;

            // Límites
            if (destR < 0 || destR >= TAM_TABLERO || destC < 0 || destC >= TAM_TABLERO) continue;
            // Destino vacío
            if (tablero[destR][destC] !== 0) continue;

            // Todas las intermedias deben estar ocupadas por una ficha
            const intermedios = [];
            let valido = true;
            for (let k = 1; k < distancia; k++) {
                const mR = row + dir.dr * k;
                const mC = col + dir.dc * k;
                const casilla = tablero[mR][mC];
                if (casilla === 0 || casilla === -1) { valido = false; break; }
                intermedios.push({ row: mR, col: mC });
            }
            if (!valido) continue;

            movimientos.push({
                direccion: dir.nombre,
                destino: { row: destR, col: destC },
                intermedio: intermedios[0] || null,
                intermedios,
                saltos: intermedios.map((m, i) => ({
                    origen: i === 0 ? { row, col } : intermedios[i - 1],
                    destino: i === distancia - 1 ? { row: destR, col: destC } : intermedios[i + 1],
                    intermedio: m
                })),
                esDoble: intermedios.length > 1
            });
        }

        return movimientos;
    },

    // ---------------------------------------------------------------------
    // DAMA DOBLE: CADENAS DE CAPTURA ATÓMICAS (como en las damas, un solo movimiento)
    // ---------------------------------------------------------------------
    /**
     * Calcula todas las cadenas de capturas encadenadas posibles desde una ficha.
     * Cada cadena es un movimiento atómico: la ficha viaja hasta el destino final
     * y se comen todas las intermedias de la cadena de una sola vez.
     *
     * @returns {Array<{
     *   camino: Array<{origen, destino, intermedio, direccion}>,
     *   destinoFinal: {row, col},
     *   totalComidas: number,
     *   intermedias: Array<{row, col}>
     * }>}
     */
    obtenerCadenasCaptura(ficha, tablero, TAM_TABLERO) {
        const cadenas = [];

        const explorar = (actual, tableroSimulado, camino) => {
            const saltosPosibles = this.clasico(actual, tableroSimulado, TAM_TABLERO);

            // No hay más capturas desde esta posición: cerramos la cadena si tiene al menos un paso
            if (saltosPosibles.length === 0) {
                if (camino.length > 0) {
                    const destinoFinal = camino[camino.length - 1].destino;
                    const intermedias = camino.map(paso => paso.intermedio);
                    cadenas.push({
                        camino,   // cada rama ya recibe su propio arreglo (ver concat abajo)
                        destinoFinal,
                        totalComidas: camino.length,
                        intermedias
                    });
                }
                return;
            }

            for (const mov of saltosPosibles) {
                // Simular el salto en una copia del tablero
                const nuevoTablero = tableroSimulado.map(fila => fila.slice());
                const { row: oR, col: oC } = actual;
                const { row: dR, col: dC } = mov.destino;
                const { row: mR, col: mC } = mov.intermedio;

                nuevoTablero[oR][oC] = 0;
                nuevoTablero[mR][mC] = 0;
                nuevoTablero[dR][dC] = 1; // ficha (marca como ocupada)

                // concat devuelve un arreglo nuevo para esta rama, así no mutamos `camino`
                explorar({ row: dR, col: dC }, nuevoTablero, camino.concat({
                    origen: { row: oR, col: oC },
                    destino: { row: dR, col: dC },
                    intermedio: { row: mR, col: mC },
                    direccion: mov.direccion
                }));
            }
        };

        explorar(ficha, tablero.map(fila => fila.slice()), []);
        return cadenas;
    },

    /**
     * Devuelve los movimientos válidos para el modo 'damaDoble'.
     * Cada movimiento corresponde a una cadena completa de capturas.
     * El destino es el punto final de la cadena; `intermedios` contiene
     * todas las casillas que se comerán al ejecutar el movimiento.
     *
     * @returns {Array<{direccion, destino, intermedio, intermedios, camino, totalComidas, esDoble}>}
     */
    movimientosDamaDoble(ficha, tablero, TAM_TABLERO) {
        const cadenas = this.obtenerCadenasCaptura(ficha, tablero, TAM_TABLERO);
        const movimientos = [];

        for (const cadena of cadenas) {
            const primerPaso = cadena.camino[0];
            const destinoFinal = cadena.destinoFinal;

            movimientos.push({
                direccion: primerPaso ? primerPaso.direccion : 'cadena',
                destino: { row: destinoFinal.row, col: destinoFinal.col },
                intermedio: primerPaso ? { row: primerPaso.intermedio.row, col: primerPaso.intermedio.col } : null,
                intermedios: cadena.intermedias.map(i => ({ row: i.row, col: i.col })),
                camino: cadena.camino.map(paso => ({
                    origen: { row: paso.origen.row, col: paso.origen.col },
                    destino: { row: paso.destino.row, col: paso.destino.col },
                    intermedio: { row: paso.intermedio.row, col: paso.intermedio.col },
                    direccion: paso.direccion
                })),
                totalComidas: cadena.totalComidas,
                esDoble: cadena.totalComidas > 1
            });
        }

        return movimientos;
    },

    // ---------------------------------------------------------------------
    // WRAPPERS / COMBINADORAS
    // ---------------------------------------------------------------------
    /**
     * Comida obligatoria: devuelve solo los movimientos que capturan al menos una ficha.
     */
    comidaObligatoria(ficha, tablero, TAM_TABLERO, candidatos = null) {
        const lista = candidatos !== null ? candidatos : this.clasico(ficha, tablero, TAM_TABLERO);
        return lista.filter(m => m.intermedios && m.intermedios.length > 0);
    },

    // ---------------------------------------------------------------------
    // UTILIDAD INTERNA
    // ---------------------------------------------------------------------
    /**
     * Construye un movimiento de salto simple a distancia fija (N intermedios).
     */
    _construirSalto(tablero, TAM_TABLERO, row, col, dir, pasosIntermedios) {
        const distancia = pasosIntermedios + 1;
        const destR = row + dir.dr * distancia;
        const destC = col + dir.dc * distancia;

        // Límites del tablero
        if (destR < 0 || destR >= TAM_TABLERO || destC < 0 || destC >= TAM_TABLERO) return null;
        // Destino debe estar vacío
        if (tablero[destR][destC] !== 0) return null;

        // Casilla(s) intermedia(s): debe(n) estar ocupada(s)
        const intermedios = [];
        for (let k = 1; k <= pasosIntermedios; k++) {
            const mR = row + dir.dr * k;
            const mC = col + dir.dc * k;
            const casilla = tablero[mR][mC];
            if (casilla === 0 || casilla === -1) return null;
            intermedios.push({ row: mR, col: mC });
        }

        return {
            direccion: dir.nombre,
            destino: { row: destR, col: destC },
            intermedio: intermedios[0] || null,
            intermedios,
            saltos: intermedios.map((m, i) => ({
                origen: i === 0 ? { row, col } : intermedios[i - 1],
                destino: i === pasosIntermedios ? { row: destR, col: destC } : intermedios[i + 1],
                intermedio: m
            })),
            esDoble: intermedios.length > 1
        };
    },

    // =====================================================================
    // APLICAR COMIDA AL TABLERO REAL (mutación)
    // =====================================================================
    /**
     * Ejecuta la comida sobre el tablero y el arreglo de figuras según el movimiento.
     * Devuelve la lista de fichas comidas (para animación / puntuación).
     *
     * @param {Array} tablero  - matriz del juego
     * @param {Array} figuras  - arreglo de objetos ficha activos
     * @param {Object} mov     - movimiento válido (con .intermedios)
     * @returns {Array} fichas comidas eliminadas de `figuras`
     */
    aplicarComida(tablero, figuras, mov) {
        const comidas = [];

        for (const inter of mov.intermedios) {
            const fichaComida = tablero[inter.row][inter.col];
            if (fichaComida && fichaComida !== -1) {
                tablero[inter.row][inter.col] = 0;
                comidas.push(fichaComida);
            }
        }

        // Eliminar del arreglo de renderizado
        for (const comida of comidas) {
            const idx = figuras.indexOf(comida);
            if (idx > -1) figuras.splice(idx, 1);
        }

        return comidas;
    }
};

// Exposición global (igual que window.Filtros en filtros.js)
window.ReglasPeg = ReglasPeg;
