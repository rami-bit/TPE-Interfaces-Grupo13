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
       La imagen (2400×1792) tiene mucho fondo decorativo a los costados.
       El tablero ocupa ~56% del ancho y ~86% del alto de esta zona, así
       que se recorta un encuadre más apaisado (1600×1150) que incluye
       estadio lateral: al ocupar el 100% del ancho de su contenedor, el
       canvas queda más bajo y entra sin scroll. No se toca tablero.jpeg.
       ============================================================ */
    const CROP = { x: 403, y: 280, w: 1600, h: 1150 };

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

    const TAM_TABLERO = TABLERO_BASE.length;

    const DIRECCIONES = [
        { nombre: 'arriba',    dr: -1, dc:  0 },
        { nombre: 'abajo',     dr:  1, dc:  0 },
        { nombre: 'izquierda', dr:  0, dc: -1 },
        { nombre: 'derecha',   dr:  0, dc:  1 }
    ];

    /* ============================================================
       ESTADO DEL JUEGO
       ============================================================ */
    let tablero = [];
    let figuras = [];
    let imgTablero = null;
    let imgTapitas = [];
    let imgFichaElegida = null;
    let indiceFichaElegida = 0;
    let precargaPromesa = null;
    let partidaIniciada = false;

    let isMouseDown = false;
    let lastClickedFigure = null;
    let lastClickedPos = null;
    let destinosValidosActivos = [];
    let animHintsId = null;
    let juegoTerminado = false;

    // Estado de la animación de eliminación de ficha comida
    let escala = 1.0;
    let fichaAEliminar = null;
    let fase = "creciendo";

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
     * Precarga todas las imágenes del juego (tablero y cantera de tapitas)
     * y ajusta las dimensiones lógicas internas del Canvas.
     * @returns {Promise<void>}
     */
    async function precargarTodo() {
        imgTablero = await cargarImagen('img/tablero.jpeg');
        canvas.width = CROP.w;
        canvas.height = CROP.h;

        imgTapitas = await Promise.all(IMG_TAPITAS.map(cargarImagen));
        imgFichaElegida = imgTapitas[indiceFichaElegida];
    }

    /* ============================================================
       UTILIDADES DE GRILLA Y COORDENADAS
       ============================================================ */
    /**
     * Convierte una posición lógica de la matriz (fila, columna) a coordenadas
     * en píxeles (X, Y) dentro del área visible recortada del Canvas.
     * @param {number} row - Fila en la matriz (0 a TAM_TABLERO - 1).
     * @param {number} col - Columna en la matriz (0 a TAM_TABLERO - 1).
     * @returns {{x: number, y: number}} Coordenadas en píxeles del centro del agujero.
     */
    function getCellCenter(row, col) {
        return { x: COL_X[col] - CROP.x, y: ROW_Y[row] - CROP.y };
    }

    /**
     * Convierte las coordenadas de un evento de mouse en el viewport (CSS)
     * al espacio de coordenadas internas del bitmap del Canvas.
     * @param {MouseEvent} e - Evento del mouse.
     * @returns {{x: number, y: number}} Coordenadas internas (x, y) en el Canvas.
     */
    function obtenerPosicionMouse(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    /* ============================================================
       CREACIÓN DE FICHAS (un solo tipo por partida)
       ============================================================ */
    /**
     * Crea una ficha circular de tapita con la imagen elegida en el menú previo.
     * @param {number} x - Coordenada X del centro.
     * @param {number} y - Coordenada Y del centro.
     * @returns {FichaTapita}
     */
    function crearFicha(x, y) {
        const img = imgFichaElegida || imgTapitas[indiceFichaElegida] || imgTapitas[0];
        return new FichaTapita(x, y, img, false, ctx, FICHA_RADIO);
    }

    /**
     * Instancia una ficha con la imagen elegida, le asigna sus coordenadas lógicas (row, col)
     * y la registra tanto en la matriz del tablero como en el arreglo de renderizado.
     * @param {number} row - Fila de destino.
     * @param {number} col - Columna de destino.
     * @returns {ElementoJuego} La ficha creada y posicionada.
     */
    function colocarFichaEnCelda(row, col) {
        const center = getCellCenter(row, col);
        const ficha = crearFicha(center.x, center.y);
        ficha.row = row;
        ficha.col = col;
        tablero[row][col] = ficha;
        figuras.push(ficha);
        return ficha;
    }

    /* ============================================================
       INICIALIZACIÓN DEL TABLERO
       ============================================================ */
    /**
     * Deja el tablero completamente vacío (solo con 0 en huecos jugables y -1 en esquinas)
     * y vacía la lista de figuras activas. Útil para escenarios de prueba o reinicio limpio.
     */
    function limpiarTableroVacio() {
        tablero = [];
        figuras = [];

        for (let row = 0; row < TAM_TABLERO; row++) {
            tablero[row] = [];
            for (let col = 0; col < TAM_TABLERO; col++) {
                tablero[row][col] = TABLERO_BASE[row][col] === -1 ? -1 : 0;
            }
        }
    }

    /**
     * Inicializa la matriz del tablero y el arreglo de figuras activas
     * según la configuración clásica inglesa de TABLERO_BASE.
     */
    function initTablero() {
        tablero = [];
        figuras = [];

        for (let row = 0; row < TAM_TABLERO; row++) {
            tablero[row] = [];
            for (let col = 0; col < TAM_TABLERO; col++) {
                if (TABLERO_BASE[row][col] === 1) {
                    colocarFichaEnCelda(row, col);
                } else {
                    tablero[row][col] = TABLERO_BASE[row][col];
                }
            }
        }
    }

    /* ============================================================
       MENÚ PREVIO: ELECCIÓN DEL TIPO DE FICHA
       ============================================================ */
    /**
     * Deriva un nombre legible a partir de la ruta de una tapita
     * (ej. "img/peg/tapitas/tapitaRiquelme.png" → "Riquelme").
     * @param {string} ruta - Ruta de la imagen.
     * @param {number} indice - Índice de respaldo si no se puede derivar.
     * @returns {string} Nombre legible de la ficha.
     */
    function nombreFicha(ruta, indice) {
        const base = ruta.split('/').pop().replace(/\.[^.]+$/, '').replace(/^tapita/i, '');
        return base || `Ficha ${indice + 1}`;
    }

    /**
     * Construye la grilla de selección de fichas desde IMG_TAPITAS.
     * Cada tapita se expone como un radio nativo (accesible por teclado)
     * asociado a una miniatura circular.
     */
    function construirMenuFichas() {
        const grilla = document.getElementById('peg-menu-grilla');
        if (!grilla) return;
        grilla.innerHTML = '';

        IMG_TAPITAS.forEach((src, i) => {
            const id = `peg-ficha-${i}`;
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'peg-ficha';
            radio.id = id;
            radio.value = String(i);
            radio.className = 'peg-menu__radio';
            radio.checked = i === indiceFichaElegida;
            radio.addEventListener('change', () => {
                if (radio.checked) seleccionarFicha(i);
            });

            const label = document.createElement('label');
            label.className = 'peg-menu__opcion';
            label.htmlFor = id;

            const img = document.createElement('img');
            img.src = src;
            img.alt = `Tapita ${nombreFicha(src, i)}`;
            img.className = 'peg-menu__opcion-img';

            const nombre = document.createElement('span');
            nombre.className = 'peg-menu__nombre';
            nombre.textContent = nombreFicha(src, i);

            label.appendChild(img);
            label.appendChild(nombre);
            grilla.appendChild(radio);
            grilla.appendChild(label);
        });
    }

    /**
     * Registra la ficha elegida en el menú previo.
     * @param {number} indice - Índice dentro de IMG_TAPITAS.
     */
    function seleccionarFicha(indice) {
        indiceFichaElegida = indice;
        if (imgTapitas[indice]) {
            imgFichaElegida = imgTapitas[indice];
        }
    }

    /**
     * Muestra el menú previo de selección de fichas y sincroniza el radio seleccionado.
     */
    function mostrarMenu() {
        const menu = document.getElementById('peg-menu');
        if (menu) {
            menu.classList.remove('peg-overlay--oculto');
        }
        const radio = document.getElementById(`peg-ficha-${indiceFichaElegida}`);
        if (radio) {
            radio.checked = true;
        }
    }

    /**
     * Oculta el menú previo una vez que la partida arrancó.
     */
    function ocultarMenu() {
        const menu = document.getElementById('peg-menu');
        if (menu) {
            menu.classList.add('peg-overlay--oculto');
        }
    }

    /**
     * Detiene la partida actual, limpia estados y vuelve a abrir el menú de selección de fichas.
     */
    function abrirMenuFichas() {
        detenerTimer();
        ocultarFinDeJuego();
        juegoTerminado = false;
        isMouseDown = false;
        lastClickedFigure = null;
        lastClickedPos = null;
        destinosValidosActivos = [];
        detenerAnimacionHints();
        mostrarMenu();
    }

    /**
     * Inicia la partida con la ficha elegida: oculta el menú, reinicia el reloj,
     * inicializa el tablero y dibuja las figuras.
     */
    function iniciarPartida() {
        const arrancar = () => {
            imgFichaElegida = imgTapitas[indiceFichaElegida] || imgTapitas[0];
            if (imgFichaElegida) {
                indiceFichaElegida = imgTapitas.indexOf(imgFichaElegida);
            }
            partidaIniciada = true;
            juegoTerminado = false;
            ocultarMenu();
            ocultarFinDeJuego();
            resetearTimer();
            initTablero();
            drawFigures();
        };

        if (precargaPromesa) {
            precargaPromesa.then(arrancar).catch(err => console.error(err));
        } else {
            arrancar();
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
       ============================================================ */
    /**
     * Evalúa las 4 direcciones ortogonales (arriba, abajo, izquierda, derecha) para determinar
     * si la ficha puede saltar: debe haber un casillero vacío (0) a distancia 2 y una ficha intermedia a distancia 1.
     * @param {ElementoJuego} ficha - Ficha a evaluar (contiene ficha.row y ficha.col).
     * @returns {Array<{direccion: string, destino: {row: number, col: number}, intermedio: {row: number, col: number}}>}
     */
    function obtenerMovimientosValidos(ficha) {
        if (!ficha || ficha.row === undefined || ficha.col === undefined) return [];

        const { row, col } = ficha;
        const movimientosValidos = [];

        for (const dir of DIRECCIONES) {
            const destR = row + dir.dr * 2;
            const destC = col + dir.dc * 2;
            const medioR = row + dir.dr;
            const medioC = col + dir.dc;

            // 1. Destino dentro de los límites del tablero
            if (destR < 0 || destR >= TAM_TABLERO || destC < 0 || destC >= TAM_TABLERO) continue;

            // 2. A 2 casillas DEBE haber un 0 (hueco vacío jugable)
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
     * Comprueba si una ficha posee al menos un movimiento válido posible.
     * @param {ElementoJuego} ficha - Ficha a consultar.
     * @returns {boolean} True si tiene al menos un salto disponible.
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

        const { x: canvasX, y: canvasY } = obtenerPosicionMouse(e);
        const clickFig = findClickedFigure(canvasX, canvasY);

        if (clickFig != null) {
            // Traer la ficha seleccionada al tope de dibujado (Z-index superior)
            const idx = figuras.indexOf(clickFig);
            if (idx > -1) {
                figuras.splice(idx, 1);
                figuras.push(clickFig);
            }
            clickFig.setResaltado(true);
            lastClickedFigure = clickFig;
            lastClickedPos = { x: clickFig.getPosx(), y: clickFig.getPosY() };

            // Calcular una sola vez los destinos válidos para hints y para validar al soltar
            destinosValidosActivos = obtenerMovimientosValidos(clickFig);
            if (destinosValidosActivos.length > 0) {
                iniciarAnimacionHints();
            } else {
                detenerAnimacionHints();
            }
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

        const { x: canvasX, y: canvasY } = obtenerPosicionMouse(e);
        lastClickedFigure.setPos(canvasX, canvasY);
        drawFigures();
    }

    /**
     * Manejador del evento mouseup a nivel de documento:
     * Evalúa si la ficha se soltó sobre un hueco permitido (usando destinosValidosActivos):
     * - Si es válido: alinea con snap-to-grid, come la ficha intermedia, inicia la animación de rebote y evalúa fin de juego.
     * - Si es inválido (o fuera del canvas): realiza snap-back devolviendo la ficha a su posición de origen.
     * @param {MouseEvent} e
     */
    function onMouseUp(e) {
        if (!isMouseDown) return;
        isMouseDown = false;

        if (lastClickedFigure == null) return;

        const { x: canvasX, y: canvasY } = obtenerPosicionMouse(e);

        let movElegido = null;
        let menorDistancia = Infinity;

        // Reutiliza destinosValidosActivos calculados al seleccionar la ficha
        for (const mov of destinosValidosActivos) {
            const center = getCellCenter(mov.destino.row, mov.destino.col);
            const dx = canvasX - center.x;
            const dy = canvasY - center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

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
            if (fichaComida) {
                figuras = figuras.filter(f => f !== fichaAEliminar);
                animacionEliminarFicha();
            }

            console.log(`Movimiento completado: [${origRow}, ${origCol}] -> [${destRow}, ${destCol}], comida: [${medioRow}, ${medioCol}]`);
            console.log(`Fichas restantes: ${figuras.length}`);
        } else {
            // --- MOVIMIENTO INVÁLIDO O FUERA DEL CANVAS → Snap-back ---
            lastClickedFigure.setPos(lastClickedPos.x, lastClickedPos.y);
        }

        // Limpieza unificada del ciclo de arrastre
        destinosValidosActivos = [];
        detenerAnimacionHints();
        lastClickedFigure.setResaltado(false);
        lastClickedFigure = null;
        drawFigures();

        if (movElegido != null) {
            verificarFinDelJuego();
        }
    }

    /**
     * Animación basada en requestAnimationFrame que genera un efecto elástico de rebote (pop):
     * - Fase 1 (creciendo): infla la ficha hasta escala 1.32.
     * - Fase 2 (encogiendo): contrae la ficha con decaimiento ease-out multiplicativo hasta 0.
     */
    function animacionEliminarFicha() {
        if (fase === "creciendo") {
            escala += 0.08;
        } else if (fase === "encogiendo") {
            escala *= 0.88;
        }
        if (escala > 1.3) {
            fase = "encogiendo";
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

        if (escala > 0.03) {
            requestAnimationFrame(animacionEliminarFicha);
        } else {
            fichaAEliminar = null;
            escala = 1.0;
            fase = "creciendo";
            drawFigures();
        }
    }

    canvas.addEventListener('mousedown', onMouseDown, false);
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
            container.classList.toggle('peg-timer--peligro', tiempoRestante <= 30 && tiempoRestante > 0);
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
                mostrarFinDeJuego(null, "¡Tiempo agotado! No lograste completar el tablero antes de que termine el reloj.");
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
            if (puedeRealizarMovimiento(figuras[i])) {
                hayMovimiento = true;
            }
            i++;
        }

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
        if (!hayMovimientosPosiblesEnTablero()) {
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
            if(victoria!=null){
                tituloEl.textContent = victoria ? "¡VICTORIA BOSTERA!" : "¡SIN MOVIMIENTOS!";
            }else{
                tituloEl.textContent = "¡TIEMPO TERMINADO!"
            }
            
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
     * Restablece el tablero base, limpia selecciones, reinicia el reloj y vuelve a dibujar las figuras.
     */
    function reiniciarJuego() {
        if (!partidaIniciada) return;

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

    const btnJugar = document.getElementById('peg-menu-jugar');
    if (btnJugar) {
        btnJugar.addEventListener('click', iniciarPartida);
    }

    const btnCambiarFichaModal = document.getElementById('peg-btn-cambiar-ficha-modal');
    if (btnCambiarFichaModal) {
        btnCambiarFichaModal.addEventListener('click', abrirMenuFichas);
    }

    /* ============================================================
       FUNCIONES DE PRUEBA (DEBUG TESTING EN CONSOLA)
       ============================================================ */
    window.debugCasiGanar = function () {
        partidaIniciada = true;
        ocultarMenu();
        ocultarFinDeJuego();
        juegoTerminado = false;
        limpiarTableroVacio();

        colocarFichaEnCelda(3, 1);
        colocarFichaEnCelda(3, 2);

        drawFigures();
        iniciarTimer();
        console.log("TEST CASI GANAR CARGADO: Saltá la ficha de [3, 1] al centro [3, 3] para ganar!");
    };

    window.debugDerrota = function () {
        partidaIniciada = true;
        ocultarMenu();
        ocultarFinDeJuego();
        juegoTerminado = false;
        limpiarTableroVacio();

        [
            { r: 0, c: 2 },
            { r: 6, c: 4 },
            { r: 2, c: 0 }
        ].forEach(pos => colocarFichaEnCelda(pos.r, pos.c));

        drawFigures();
        verificarFinDelJuego();
        console.log("TEST DERROTA CARGADO: 3 fichas aisladas sin movimientos posibles.");
    };

    window.reiniciarJuego = reiniciarJuego;
    window.abrirMenuFichas = abrirMenuFichas;

    /* ============================================================
       ARRANQUE
       ============================================================ */
    construirMenuFichas();
    actualizarDisplayTimer();
    precargaPromesa = precargarTodo();
    precargaPromesa.catch(err => {
        console.error(err);
    });
});
