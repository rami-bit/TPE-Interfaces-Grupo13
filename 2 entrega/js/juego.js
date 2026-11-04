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
    let destinosValidosActivos = [];
    let animHintsId = null;
    let juegoTerminado = false;

    // Configuración del Temporizador (5 minutos de límite de juego)
    const TIEMPO_LIMITE_SEGUNDOS = 300;
    let tiempoRestante = TIEMPO_LIMITE_SEGUNDOS;
    let timerIntervalId = null;

    /* ============================================================
       PRECARGA DE IMÁGENES
       ============================================================ */
    /**
     * Carga una imagen de forma asíncrona devolviendo una Promesa.
     * @param {string} src - Ruta relativa de la imagen.
     * @returns {Promise<HTMLImageElement>} Promesa que resuelve la imagen cargada.
     */
    function cargarImagen(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('No se pudo cargar ' + src));
            img.src = src;
        });
    }

    /**
     * Precarga todas las imágenes del juego (tablero, tapitas y camisetas)
     * y ajusta las dimensiones lógicas internas del Canvas.
     * @returns {Promise<void>}
     */
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
    /**
     * Convierte una posición lógica de la matriz (fila, columna) a coordenadas
     * en píxeles (X, Y) dentro del área visible recortada del Canvas.
     * @param {number} row - Fila en la matriz (0 a 6).
     * @param {number} col - Columna en la matriz (0 a 6).
     * @returns {{x: number, y: number}} Coordenadas en píxeles del centro del agujero.
     */
    function getCellCenter(row, col) {
        return { x: COL_X[col] - CROP.x, y: ROW_Y[row] - CROP.y };
    }

    /* ============================================================
       CREACIÓN DE FICHAS ALEATORIAS
       ============================================================ */
    /**
     * Crea aleatoriamente una ficha tipo tapita o camiseta con 50% de probabilidad.
     * @param {number} x - Posición X inicial.
     * @param {number} y - Posición Y inicial.
     * @returns {FichaTapita|FichaCamiseta} Instancia de la ficha creada.
     */
    function crearFichaAleatoria(x, y) {
        if (Math.random() < 0.5) {
            return crearTapita(x, y);
        } else {
            return crearCamiseta(x, y);
        }
    }

    /**
     * Crea una ficha circular de tapita eligiendo aleatoriamente una textura de Boca.
     * @param {number} x - Coordenada X del centro.
     * @param {number} y - Coordenada Y del centro.
     * @returns {FichaTapita}
     */
    function crearTapita(x, y) {
        const img = imgTapitas[Math.floor(Math.random() * imgTapitas.length)];
        return new FichaTapita(x, y, img, false, ctx, FICHA_RADIO);
    }

    /**
     * Crea una ficha rectangular de camiseta eligiendo aleatoriamente un diseño de Boca.
     * @param {number} x - Coordenada X del centro.
     * @param {number} y - Coordenada Y del centro.
     * @returns {FichaCamiseta}
     */
    function crearCamiseta(x, y) {
        const img = imgCamisetas[Math.floor(Math.random() * imgCamisetas.length)];
        return new FichaCamiseta(x, y, img, false, ctx, FICHA_ANCHO, FICHA_ALTO);
    }

    /* ============================================================
       INICIALIZACIÓN DEL TABLERO
       ============================================================ */
    /**
     * Inicializa la matriz 7x7 del tablero y el arreglo de figuras activas
     * según la configuración clásica inglesa de TABLERO_BASE.
     */
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
    /**
     * Redibuja la escena completa en el Canvas:
     * 1. Limpia el lienzo.
     * 2. Pinta el fondo del tablero recortado.
     * 3. Dibuja las pistas visuales animadas (si hay una ficha seleccionada).
     * 4. Dibuja todas las fichas activas.
     */
    function drawFigures() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (imgTablero) {
            ctx.drawImage(
                imgTablero,
                CROP.x, CROP.y, CROP.w, CROP.h,
                0, 0, CROP.w, CROP.h
            );
        }
        drawHints();
        figuras.forEach(f => f.draw());
    }

    /* ============================================================
       PISTAS VISUALES (HINTS) DE DESTINO VÁLIDO
       ============================================================ */
    /**
     * Dibuja una flecha dorada vertical orientada hacia abajo, con efecto de oscilación flotante.
     * @param {number} x - Coordenada X del centro del agujero destino.
     * @param {number} y - Coordenada Y del centro del agujero destino.
     * @param {number} oscilacion - Desplazamiento vertical calculado por función seno.
     */
    function dibujarFlechaIndicadora(x, y, oscilacion) {
        const topY = y - FICHA_RADIO - 28 + oscilacion;
        ctx.save();
        ctx.fillStyle = "#FFD700";
        ctx.strokeStyle = "#050E1F";
        ctx.lineWidth = 2;
        ctx.shadowColor = "rgba(255, 215, 0, 0.85)";
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(x - 5, topY);
        ctx.lineTo(x + 5, topY);
        ctx.lineTo(x + 5, topY + 12);
        ctx.lineTo(x + 12, topY + 12);
        ctx.lineTo(x, topY + 24);
        ctx.lineTo(x - 12, topY + 12);
        ctx.lineTo(x - 5, topY + 12);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Inicia el bucle de animación a 60 FPS para renderizar las pistas (hints)
     * pulsantes y flechas indicadoras mientras el usuario sostiene una ficha.
     */
    function iniciarAnimacionHints() {
        if (animHintsId != null) return;

        function loop() {
            if (destinosValidosActivos && destinosValidosActivos.length > 0) {
                drawFigures();
                animHintsId = requestAnimationFrame(loop);
            } else {
                animHintsId = null;
            }
        }
        animHintsId = requestAnimationFrame(loop);
    }

    /**
     * Detiene el bucle de animación de pistas visuales y libera el requestAnimationFrame.
     */
    function detenerAnimacionHints() {
        if (animHintsId != null) {
            cancelAnimationFrame(animHintsId);
            animHintsId = null;
        }
    }

    /**
     * Renderiza las ayudas visuales sobre cada uno de los huecos válidos a donde puede saltar
     * la ficha actualmente seleccionada: onda expansiva, pulso dorado y flecha indicadora.
     */
    function drawHints() {
        if (!destinosValidosActivos || destinosValidosActivos.length === 0) return;

        const now = performance.now();
        const t = now / 250;
        const oscilacion = Math.sin(t) * 5;
        const pulseRadio = (FICHA_RADIO - 6) + Math.sin(t) * 3;
        const alphaFondo = 0.35 + Math.sin(t) * 0.15;

        // Onda expansiva que se expande hacia afuera del agujero cada 1s
        const ondaProgreso = (now % 1000) / 1000;
        const radioOnda = (FICHA_RADIO - 6) + ondaProgreso * 24;
        const alphaOnda = Math.max(0, (1 - ondaProgreso) * 0.65);

        destinosValidosActivos.forEach(mov => {
            const center = getCellCenter(mov.destino.row, mov.destino.col);
            ctx.save();

            // 1. Onda expansiva exterior
            ctx.beginPath();
            ctx.arc(center.x, center.y, radioOnda, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(255, 215, 0, ${alphaOnda})`;
            ctx.lineWidth = 3;
            ctx.stroke();

            // 2. Fondo dorado pulsante dentro del hueco
            ctx.beginPath();
            ctx.arc(center.x, center.y, pulseRadio, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(255, 215, 0, ${alphaFondo})`;
            ctx.shadowColor = "rgba(255, 215, 0, 0.8)";
            ctx.shadowBlur = 12;
            ctx.fill();

            // 3. Borde circular dorado resaltado
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#FFD700";
            ctx.stroke();

            // 4. Diana central
            ctx.beginPath();
            ctx.arc(center.x, center.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = "#FFD700";
            ctx.fill();

            ctx.restore();

            // 5. Flecha indicadora superior animada
            dibujarFlechaIndicadora(center.x, center.y, oscilacion);
        });
    }

    /* ============================================================
       BÚSQUEDA DE FICHA CLICKEADA
       ============================================================ */
    /**
     * Busca qué ficha contiene el punto (x, y) del mouse, recorriendo de adelante hacia atrás
     * para respetar el orden visual de apilamiento (Z-index).
     * @param {number} x - Coordenada X en píxeles del Canvas.
     * @param {number} y - Coordenada Y en píxeles del Canvas.
     * @returns {ElementoJuego|null} Ficha clickeada o null si no se tocó ninguna.
     */
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
    /**
     * Obtiene la posición en fila y columna (matriz) de una ficha en el tablero.
     * @param {ElementoJuego} ficha - Ficha a consultar.
     * @returns {{row: number, col: number}|null} Objeto con fila y columna o null.
     */
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

    /**
     * Evalúa las 4 direcciones ortogonales (arriba, abajo, izquierda, derecha) para determinar
     * si la ficha puede saltar: debe haber un casillero vacío (0) a distancia 2 y una ficha intermedia a distancia 1.
     * @param {ElementoJuego} ficha - Ficha a evaluar.
     * @returns {Array<{direccion: string, destino: {row: number, col: number}, intermedio: {row: number, col: number}}>}
     */
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

    /**
     * Comprueba de forma rápida si una ficha posee al menos un movimiento válido posible.
     * @param {ElementoJuego} ficha
     * @returns {boolean} True si tiene movimientos válidos.
     */
    function puedeRealizarMovimiento(ficha) {
        return obtenerMovimientosValidos(ficha).length > 0;
    }

    /* ============================================================
       DRAG & DROP — eventos a nivel documento
       ============================================================ */
    /**
     * Manejador del evento mousedown sobre el Canvas:
     * Detecta si se clickeó una ficha, la trae al frente visual y calcula/activa sus pistas animadas.
     * @param {MouseEvent} e
     */
    function onMouseDown(e) {
        if (juegoTerminado) return;
        isMouseDown = true;

        if (lastClickedFigure != null) {
            lastClickedFigure.setResaltado(false);
            lastClickedFigure = null;
            destinosValidosActivos = [];
            detenerAnimacionHints();
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
            // Resaltar e iniciar animación de los huecos válidos a donde puede saltar
            destinosValidosActivos = obtenerMovimientosValidos(clickFig);
            if (destinosValidosActivos.length > 0) {
                iniciarAnimacionHints();
            } else {
                detenerAnimacionHints();
            }
        } else {
            destinosValidosActivos = [];
            detenerAnimacionHints();
        }

        drawFigures();
    }

    /**
     * Manejador del evento mousemove a nivel de documento:
     * Si se está arrastrando una ficha, actualiza su posición con el cursor y redibuja la escena.
     * @param {MouseEvent} e
     */
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

    /**
     * Manejador del evento mouseup a nivel de documento:
     * Evalúa si la ficha se soltó sobre un hueco permitido:
     * - Si es válido: alinea con snap-to-grid, come la ficha intermedia, inicia la animación de rebote y evalúa fin de juego.
     * - Si es inválido: realiza snap-back devolviendo la ficha a su posición de origen.
     * @param {MouseEvent} e
     */
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
            destinosValidosActivos = [];
            detenerAnimacionHints();
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
            fichaAEliminar = fichaComida;
            if(fichaComida){
                figuras = figuras.filter(f => f !== fichaAEliminar);
                animacionEliminarFicha(); 
            }
            

            console.log(`Movimiento completado: [${origRow}, ${origCol}] -> [${destRow}, ${destCol}], comida: [${medioRow}, ${medioCol}]`);
            console.log(`Fichas restantes: ${figuras.length}`);
        } else {
            // --- MOVIMIENTO INVÁLIDO (intento a casilla con 1, -1, fuera de rango o salto incorrecto) ---
            // Snap-back a la posición de origen
            lastClickedFigure.setPos(lastClickedPos.x, lastClickedPos.y);
    
        }
        destinosValidosActivos = [];
        detenerAnimacionHints();
        lastClickedFigure.setResaltado(false);
        lastClickedFigure = null;
        drawFigures();

        // Si se realizó un movimiento válido, verificar si concluyó la partida
        if (movElegido != null) {
            verificarFinDelJuego();
        }
    }
    let escala = 1.0;
    let fichaAEliminar = null;
    let fase = "creciendo";

    /**
     * Animación basada en requestAnimationFrame que genera un efecto elástico de rebote (pop):
     * - Fase 1 (creciendo): infla la ficha hasta escala 1.32.
     * - Fase 2 (encogiendo): contrae la ficha con decaimiento ease-out multiplicativo hasta 0.
     */
    function animacionEliminarFicha(){
        if(fase==="creciendo"){
            escala += 0.08;
        }else if(fase==="encogiendo"){
            escala *= 0.88;
        }
        if(escala>1.3){
            fase="encogiendo";
        }

        // 1. Redibuja el tablero y las demás fichas
        drawFigures();

        // 2. Dibuja la ficha comida escalándose desde su propio centro
        if (fichaAEliminar && escala > 0) {
            const x = fichaAEliminar.getPosx();
            const y = fichaAEliminar.getPosY();

            ctx.save();
            ctx.translate(x, y);
            ctx.scale(escala, escala);
            ctx.translate(-x, -y);
            fichaAEliminar.draw();
            ctx.restore();
        }
        if(escala>0.03){
            requestAnimationFrame(animacionEliminarFicha);
        }else{
            fichaAEliminar=null;
            escala=1.0;
            fase = "creciendo"
            drawFigures();
        }

        
    }

    // mousedown en el canvas (necesita offsetX/offsetY)
    canvas.addEventListener('mousedown', onMouseDown, false);
    // mousemove y mouseup a nivel documento para catch fuera del canvas
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('mouseup', onMouseUp, false);

    /* ============================================================
       TEMPORIZADOR REGRESIVO (LÍMITE DE TIEMPO DE JUEGO)
       ============================================================ */
    /**
     * Formatea una cantidad de segundos a formato visual "MM:SS".
     * @param {number} totalSegundos - Segundos a convertir.
     * @returns {string} Tiempo formateado con dos dígitos por campo (ej. "04:59").
     */
    function formatearTiempo(totalSegundos) {
        const minutos = Math.floor(totalSegundos / 60);
        const segundos = totalSegundos % 60;
        const minStr = minutos < 10 ? '0' + minutos : minutos;
        const segStr = segundos < 10 ? '0' + segundos : segundos;
        return `${minStr}:${segStr}`;
    }

    /**
     * Actualiza el texto en el display del temporizador y añade advertencia
     * visual pulsante en rojo si quedan 30 segundos o menos.
     */
    function actualizarDisplayTimer() {
        const display = document.getElementById('peg-timer-display');
        const container = document.getElementById('peg-timer');
        if (display) {
            display.textContent = formatearTiempo(tiempoRestante);
        }
        if (container) {
            if (tiempoRestante <= 30 && tiempoRestante > 0) {
                container.classList.add('peg-timer--peligro');
            } else {
                container.classList.remove('peg-timer--peligro');
            }
        }
    }

    /**
     * Inicia la cuenta regresiva del temporizador segundo a segundo.
     * Si el tiempo llega a 0, detiene el juego y muestra el modal de tiempo agotado.
     */
    function iniciarTimer() {
        if (timerIntervalId != null) return;

        actualizarDisplayTimer();
        timerIntervalId = setInterval(() => {
            if (juegoTerminado) {
                detenerTimer();
                return;
            }

            tiempoRestante--;
            actualizarDisplayTimer();

            if (tiempoRestante <= 0) {
                detenerTimer();
                juegoTerminado = true;
                destinosValidosActivos = [];
                detenerAnimacionHints();
                mostrarFinDeJuego(false, "¡Tiempo agotado! No lograste completar el tablero antes de que termine el reloj.");
            }
        }, 1000);
    }

    /**
     * Detiene el intervalo del temporizador si está corriendo.
     */
    function detenerTimer() {
        if (timerIntervalId != null) {
            clearInterval(timerIntervalId);
            timerIntervalId = null;
        }
    }

    /**
     * Resetea el tiempo restante al límite inicial (5 minutos) y reinicia el reloj.
     */
    function resetearTimer() {
        detenerTimer();
        tiempoRestante = TIEMPO_LIMITE_SEGUNDOS;
        actualizarDisplayTimer();
        iniciarTimer();
    }

    /* ============================================================
       CONTROL DE FIN DE PARTIDA Y REINICIO
       ============================================================ */
    /**
     * Recorre las fichas del tablero con un bucle while que corta inmediatamente
     * apenas encuentra una ficha con saltos válidos disponibles.
     * @returns {boolean} True si todavía hay al menos un movimiento posible en la partida.
     */
    function hayMovimientosPosiblesEnTablero() {
        if (figuras.length <= 1) return false;

        let i = 0;
        let hayMovimiento = false;

        // Bucle while que recorre las fichas y corta apenas encuentra una con movimientos válidos
        while (i < figuras.length && !hayMovimiento) {
            const ficha = figuras[i];
            const movs = obtenerMovimientosValidos(ficha);
            if (movs.length > 0) {
                hayMovimiento = true; // Corta el while apenas una ficha puede moverse
            }
            i++;
        }

        // Si llegó al final del while sin encontrar movimientos válidos, devuelve false
        return hayMovimiento;
    }

    /**
     * Verifica si la partida llegó a su término:
     * - Victoria: cuando queda exactamente 1 sola ficha.
     * - Derrota: cuando ninguna ficha restante puede realizar saltos.
     * @returns {boolean} True si el juego terminó.
     */
    function verificarFinDelJuego() {
        // 1. Caso VICTORIA: Queda exactamente 1 sola ficha
        if (figuras.length === 1) {
            detenerTimer();
            juegoTerminado = true;
            destinosValidosActivos = [];
            detenerAnimacionHints();
            mostrarFinDeJuego(true, "¡Mística pura! Dejaste exactamente una sola ficha en el tablero.");
            return true;
        }

        // 2. Caso DERROTA: Verificamos con el while si quedan movimientos posibles
        const hayMovimientos = hayMovimientosPosiblesEnTablero();

        if (!hayMovimientos) {
            detenerTimer();
            juegoTerminado = true;
            destinosValidosActivos = [];
            detenerAnimacionHints();
            mostrarFinDeJuego(false, `Fin de la partida: perdiste, no quedan movimientos válidos. Fichas restantes: ${figuras.length}.`);
            return true;
        }

        return false;
    }

    /**
     * Muestra el modal superpuesto de fin de juego con el título y mensaje correspondientes.
     * @param {boolean} victoria - True para victoria, false para derrota.
     * @param {string} mensaje - Texto explicativo del desenlace de la partida.
     */
    function mostrarFinDeJuego(victoria, mensaje) {
        const overlay = document.getElementById('peg-overlay');
        const tituloEl = document.getElementById('peg-overlay-titulo');
        const mensajeEl = document.getElementById('peg-overlay-mensaje');

        if (overlay && tituloEl && mensajeEl) {
            tituloEl.textContent = victoria ? "¡VICTORIA BOSTERA!" : "¡SIN MOVIMIENTOS!";
            tituloEl.style.color = victoria ? "#FFD700" : "#FF6B6B";
            mensajeEl.textContent = mensaje;
            overlay.classList.remove('peg-overlay--oculto');
        } else {
            alert(mensaje);
        }
    }

    /**
     * Oculta el modal superpuesto de fin de juego.
     */
    function ocultarFinDeJuego() {
        const overlay = document.getElementById('peg-overlay');
        if (overlay) {
            overlay.classList.add('peg-overlay--oculto');
        }
    }

    /**
     * Reinicia por completo el juego a su estado inicial:
     * Restablece el tablero base, limpia selecciones y vuelve a dibujar las figuras.
     */
    function reiniciarJuego() {
        ocultarFinDeJuego();
        juegoTerminado = false;
        isMouseDown = false;
        lastClickedFigure = null;
        lastClickedPos = null;
        destinosValidosActivos = [];
        detenerAnimacionHints();

        resetearTimer();

        initTablero();
        drawFigures();
        console.log("Juego reiniciado. Fichas en el tablero:", figuras.length);
    }

    const btnReiniciarModal = document.getElementById('peg-btn-reiniciar-modal');
    if (btnReiniciarModal) {
        btnReiniciarModal.addEventListener('click', reiniciarJuego);
    }

    const btnReiniciarBarra = document.getElementById('peg-btn-reiniciar-barra');
    if (btnReiniciarBarra) {
        btnReiniciarBarra.addEventListener('click', reiniciarJuego);
    }

    /* ============================================================
       FUNCIONES DE PRUEBA (DEBUG TESTING EN CONSOLA)
       ============================================================ */
    window.debugCasiGanar = function () {
        ocultarFinDeJuego();
        juegoTerminado = false;
        figuras = [];

        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                tablero[r][c] = TABLERO_BASE[r][c] === -1 ? -1 : 0;
            }
        }

        const c1 = getCellCenter(3, 1);
        const f1 = crearFichaAleatoria(c1.x, c1.y);
        f1.row = 3;
        f1.col = 1;
        tablero[3][1] = f1;
        figuras.push(f1);

        const c2 = getCellCenter(3, 2);
        const f2 = crearFichaAleatoria(c2.x, c2.y);
        f2.row = 3;
        f2.col = 2;
        tablero[3][2] = f2;
        figuras.push(f2);

        drawFigures();
        console.log("TEST CASI GANAR CARGADO: Saltá la ficha de [3, 1] al centro [3, 3] para ganar!");
    };

    window.debugDerrota = function () {
        ocultarFinDeJuego();
        juegoTerminado = false;
        figuras = [];

        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                tablero[r][c] = TABLERO_BASE[r][c] === -1 ? -1 : 0;
            }
        }

        const isolated = [
            { r: 0, c: 2 },
            { r: 6, c: 4 },
            { r: 2, c: 0 }
        ];

        isolated.forEach(pos => {
            const center = getCellCenter(pos.r, pos.c);
            const f = crearFichaAleatoria(center.x, center.y);
            f.row = pos.r;
            f.col = pos.c;
            tablero[pos.r][pos.c] = f;
            figuras.push(f);
        });

        drawFigures();
        verificarFinDelJuego();
        console.log("TEST DERROTA CARGADO: 3 fichas aisladas sin movimientos posibles.");
    };

    window.reiniciarJuego = reiniciarJuego;

    /* ============================================================
       ARRANQUE
       ============================================================ */
    precargarTodo().then(() => {
        initTablero();
        drawFigures();
        iniciarTimer();
    }).catch(err => {
        console.error(err);
    });
});
