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
       true  → posición jugable
       false → centro vacío al inicio
       null  → fuera del tablero
       ============================================================ */
    const TABLERO_BASE = [
        [null, null, true,  true,  true,  null, null],
        [null, null, true,  true,  true,  null, null],
        [true, true,  true,  true,  true,  true,  true],
        [true, true,  true,  false, true,  true,  true],
        [true, true,  true,  true,  true,  true,  true],
        [null, null, true,  true,  true,  null, null],
        [null, null, true,  true,  true,  null, null]
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
                if (TABLERO_BASE[row][col] === true) {
                    const center = getCellCenter(row, col);
                    const ficha = crearFichaAleatoria(center.x, center.y);
                    tablero[row][col] = ficha;
                    figuras.push(ficha);
                } else {
                    tablero[row][col] = null;
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
        // Por ahora siempre snap-back:
        lastClickedFigure.setPos(lastClickedPos.x, lastClickedPos.y);
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
