document.querySelectorAll('.btn-juego--fav').forEach(function (btn) {
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () {
        let activo = btn.classList.toggle('activo');
        btn.setAttribute('aria-pressed', activo ? 'true' : 'false');
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('peg-solitaire-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    /* ============================================================
       TAMAÑO DE FICHAS (al 100% del hueco ~91.5px diámetro)
       ============================================================ */
    const FICHA_RADIO = 45;
    const FICHA_ANCHO = 90;
    const FICHA_ALTO  = 90;

    /* ============================================================
       POSICIONES EXACTAS DEL TABLERO
       Imagen: tablero.jpeg (2400×1792).
       Centros de agujero detectados automáticamente.
       El espaciado de columnas NO es uniforme (simétrico pero
       irregular), por eso se guardan valores exactos por
       columna y fila en vez de una fórmula lineal.
       ============================================================ */
    const COL_X = [796, 931, 1058, 1202, 1346, 1475, 1610];
    const ROW_Y = [405, 554, 707, 854, 1002, 1151, 1305];

    /* ============================================================
       RECORTE VISIBLE DEL TABLERO
       La imagen (2400×1792) tiene mucho fondo decorativo: el tablero
       ocupa solo ~41% del ancho y ~58% del alto. Este recorte se usa
       como resolución interna del canvas para que las fichas se vean
       más grandes sin tocar el archivo tablero.jpeg.
       ============================================================ */
    const CROP = { x: 650, y: 290, w: 1100, h: 1150 };

    /* ============================================================
       MATRIZ DEL TABLERO (inglés estándar 7×7)
        1 → casilla con ficha al inicio
        0 → hueco vacío al inicio (centro)
       -1 → fuera del tablero (esquinas no jugables)
       ============================================================ */
    const TABLERO_BASE = [
        [-1, -1,  1,  1,  1, -1, -1],
        [-1, -1,  1,  1,  1, -1, -1],
        [ 1,  1,  1,  1,  1,  1,  1],
        [ 1,  1,  1,  0,  1,  1,  1],
        [ 1,  1,  1,  1,  1,  1,  1],
        [-1, -1,  1,  1,  1, -1, -1],
        [-1, -1,  1,  1,  1, -1, -1]
    ];

    /* ============================================================
       ESTADO DEL JUEGO
       ============================================================ */
    let tablero = [];
    let figuras = [];
    let imgTablero = null;
    let imgTapitas = [];
    let imgCamisetas = [];

    let isMouseDown = false;
    let lastClickedFigure = null;
    let lastClickedPos = null;

    /* ============================================================
       PRECARGA DE IMÁGENES
       ============================================================ */
    function cargarImagen(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('No se pudo cargar ' + src));
            img.src = src;
        });
    }

    async function precargarTodo() {
        imgTablero = await cargarImagen('img/tablero.jpeg');
        canvas.width = CROP.w;
        canvas.height = CROP.h;

        imgTapitas = await Promise.all(IMG_TAPITAS.map(cargarImagen));
        imgCamisetas = await Promise.all(IMG_CAMISETAS.map(cargarImagen));
    }

    /* ============================================================
       UTILIDADES DE GRILLA
       ============================================================ */
    function getCellCenter(row, col) {
        return { x: COL_X[col] - CROP.x, y: ROW_Y[row] - CROP.y };
    }

    /* ============================================================
       CREACIÓN DE FICHAS ALEATORIAS
       ============================================================ */
    function crearFichaAleatoria(x, y) {
        if (Math.random() < 0.5) {
            return crearTapita(x, y);
        } else {
            return crearCamiseta(x, y);
        }
    }

    function crearTapita(x, y) {
        const img = imgTapitas[Math.floor(Math.random() * imgTapitas.length)];
        return new FichaTapita(x, y, img, false, ctx, FICHA_RADIO);
    }

    function crearCamiseta(x, y) {
        const img = imgCamisetas[Math.floor(Math.random() * imgCamisetas.length)];
        return new FichaCamiseta(x, y, img, false, ctx, FICHA_ANCHO, FICHA_ALTO);
    }

    /* ============================================================
       INICIALIZACIÓN DEL TABLERO
       ============================================================ */
    function initTablero() {
        tablero = [];
        figuras = [];

        for (let row = 0; row < 7; row++) {
            tablero[row] = [];
            for (let col = 0; col < 7; col++) {
                if (TABLERO_BASE[row][col] === 1) {
                    const center = getCellCenter(row, col);
                    const ficha = crearFichaAleatoria(center.x, center.y);
                    ficha.row = row;
                    ficha.col = col;
                    tablero[row][col] = ficha;
                    figuras.push(ficha);
                } else {
                    tablero[row][col] = TABLERO_BASE[row][col] === 0 ? 0 : -1;
                }
            }
        }
    }

    /* ============================================================
       RENDER
       ============================================================ */
    function drawFigures() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (imgTablero) {
            ctx.drawImage(
                imgTablero,
                CROP.x, CROP.y, CROP.w, CROP.h,
                0, 0, CROP.w, CROP.h
            );
        }
        figuras.forEach(f => f.draw());
    }

    /* ============================================================
       BÚSQUEDA DE FICHA CLICKEADA
       ============================================================ */
    function findClickedFigure(x, y) {
        for (let i = figuras.length - 1; i >= 0; i--) {
            if (figuras[i].isPointInside(x, y)) {
                return figuras[i];
            }
        }
        return null;
    }

    /* ============================================================
       VALIDACIÓN: ¿PUEDE MOVERSE ESTA FICHA?
       Revisa las 4 direcciones (arriba, abajo, izquierda, derecha)
       a 2 posiciones de distancia.
       Para que pueda saltar:
         - A 2 posiciones DEBE haber un 0 (hueco vacío jugable).
           Si hay 1 o -1, no se puede mover hacia esa dirección.
         - A 1 posición (intermedia) DEBE haber una ficha para comer.
       ============================================================ */
    function obtenerCoordenadasFicha(ficha) {
        if (!ficha) return null;
        if (ficha.row !== undefined && ficha.col !== undefined) {
            return { row: ficha.row, col: ficha.col };
        }
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                if (tablero[r][c] === ficha) {
                    ficha.row = r;
                    ficha.col = c;
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }

    function obtenerMovimientosValidos(ficha) {
        const coords = obtenerCoordenadasFicha(ficha);
        if (!coords) return [];

        const { row, col } = coords;
        const direcciones = [
            { nombre: 'arriba',    dr: -1, dc:  0 },
            { nombre: 'abajo',     dr:  1, dc:  0 },
            { nombre: 'izquierda', dr:  0, dc: -1 },
            { nombre: 'derecha',   dr:  0, dc:  1 }
        ];

        const movimientosValidos = [];

        for (const dir of direcciones) {
            const destR = row + dir.dr * 2;
            const destC = col + dir.dc * 2;
            const medioR = row + dir.dr;
            const medioC = col + dir.dc;

            // 1. Destino dentro de los límites del tablero (0 a 6)
            if (destR < 0 || destR >= 7 || destC < 0 || destC >= 7) continue;

            // 2. A 2 casillas DEBE haber un 0 sí o sí (hueco vacío jugable).
            // Si es 1, -1 o no es 0, no se puede mover hacia esa dirección.
            if (tablero[destR][destC] !== 0) continue;

            // 3. En la casilla del medio (distancia 1) debe haber una ficha para saltar
            const fichaMedio = tablero[medioR][medioC];
            if (fichaMedio === 0 || fichaMedio === -1) continue;

            movimientosValidos.push({
                direccion: dir.nombre,
                destino: { row: destR, col: destC },
                intermedio: { row: medioR, col: medioC }
            });
        }

        return movimientosValidos;
    }

    function puedeRealizarMovimiento(ficha) {
        return obtenerMovimientosValidos(ficha).length > 0;
    }

    /* ============================================================
       DRAG & DROP — eventos a nivel documento
       ============================================================ */
    function onMouseDown(e) {
        isMouseDown = true;

        if (lastClickedFigure != null) {
            lastClickedFigure.setResaltado(false);
            lastClickedFigure = null;
        }

        // Convertir coordenadas CSS a coordenadas internas del canvas
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = e.offsetX * scaleX;
        const canvasY = e.offsetY * scaleY;

        const clickFig = findClickedFigure(canvasX, canvasY);

        if (clickFig != null) {
            const idx = figuras.indexOf(clickFig);
            if (idx > -1) {
                figuras.splice(idx, 1);
                figuras.push(clickFig);
            }
            clickFig.setResaltado(true);
            lastClickedFigure = clickFig;
            lastClickedPos = { x: clickFig.getPosx(), y: clickFig.getPosY() };
        }

        drawFigures();
    }

    function onMouseMove(e) {
        if (!isMouseDown || lastClickedFigure == null) return;

        // Convertir coordenadas del documento a coordenadas del canvas
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;

        lastClickedFigure.setPos(canvasX, canvasY);
        drawFigures();
    }

    function onMouseUp(e) {
        if (!isMouseDown) return;
        isMouseDown = false;

        if (lastClickedFigure == null) return;

        // Verificar si el punto de soltado está dentro del canvas
        const rect = canvas.getBoundingClientRect();
        const dentroCanvas =
            e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top  && e.clientY <= rect.bottom;

        if (!dentroCanvas) {
            // Soltó fuera del canvas → snap-back
            lastClickedFigure.setPos(lastClickedPos.x, lastClickedPos.y);
    
            lastClickedFigure.setResaltado(false);
            lastClickedFigure = null;
            drawFigures();
            return;
        }

        /* ================================================================
           TODO: LÓGICA DE COMER / VALIDAR MOVIMIENTO
           Acá hay que verificar si la posición del mouse coincide con un
           agujero de destino válido:
             1. Encontrar el agujero más cercano al punto de soltado
                (distancia euclidiana contra getCellCenter para cada
                posición válida del tablero).
             2. Verificar que el movimiento sea un salto válido
                (dos posiciones en línea recta, con ficha intermedia
                y destino vacío).
             3. Si es válido: alinear la ficha al centro del agujero
                destino (snap-to-grid), eliminar la ficha saltada
                del tablero y de figuras[], y actualizar la matriz.
             4. Si NO es válido: snap-back a la posición original.
           ================================================================ */
        // Coordenadas internas del canvas en el momento de soltar
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;

        // Movimientos válidos permitidos (hacia casillas con 0 a distancia 2 con ficha intermedia)
        const movimientos = obtenerMovimientosValidos(lastClickedFigure);


        let movElegido = null;
        let menorDistancia = Infinity;

        // Comprobar si el punto de soltado coincide con alguno de los huecos permitidos (0)
        for (const mov of movimientos) {
            const center = getCellCenter(mov.destino.row, mov.destino.col);
            const dx = canvasX - center.x;
            const dy = canvasY - center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Tolerancia de soltado: dentro del radio del agujero
            if (dist <= FICHA_RADIO && dist < menorDistancia) {
                menorDistancia = dist;
                movElegido = { mov, center };
            }
        }

        if (movElegido != null) {
            // --- MOVIMIENTO VÁLIDO ---
            const { mov, center } = movElegido;
            const origRow = lastClickedFigure.row;
            const origCol = lastClickedFigure.col;
            const destRow = mov.destino.row;
            const destCol = mov.destino.col;
            const medioRow = mov.intermedio.row;
            const medioCol = mov.intermedio.col;

            // 1. Centrar ficha en el agujero destino (snap-to-grid)
            lastClickedFigure.setPos(center.x, center.y);
            lastClickedFigure.row = destRow;
            lastClickedFigure.col = destCol;

            // 2. Actualizar casillas en la matriz del tablero
            tablero[origRow][origCol] = 0;
            tablero[destRow][destCol] = lastClickedFigure;

            // 3. Comer la ficha intermedia (quitar de matriz y de figuras[])
            const fichaComida = tablero[medioRow][medioCol];
            tablero[medioRow][medioCol] = 0;
            if (fichaComida) {
                figuras = figuras.filter(f => f !== fichaComida);
            }

            console.log(`Movimiento completado: [${origRow}, ${origCol}] -> [${destRow}, ${destCol}], comida: [${medioRow}, ${medioCol}]`);
            console.log(`Fichas restantes: ${figuras.length}`);
        } else {
            // --- MOVIMIENTO INVÁLIDO (intento a casilla con 1, -1, fuera de rango o salto incorrecto) ---
            // Snap-back a la posición de origen
            lastClickedFigure.setPos(lastClickedPos.x, lastClickedPos.y);
    
        }
        lastClickedFigure.setResaltado(false);
        lastClickedFigure = null;
        drawFigures();
    }

    // mousedown en el canvas (necesita offsetX/offsetY)
    canvas.addEventListener('mousedown', onMouseDown, false);
    // mousemove y mouseup a nivel documento para catch fuera del canvas
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('mouseup', onMouseUp, false);

    /* ============================================================
       ARRANQUE
       ============================================================ */
    precargarTodo().then(() => {
        initTablero();
        drawFigures();
    }).catch(err => {
        console.error(err);
    });
});
