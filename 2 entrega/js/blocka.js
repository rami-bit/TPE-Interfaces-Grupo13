document.addEventListener('DOMContentLoaded', () => {
    const BANCO_IMAGENES = [
        'assets/bancoImagenes/bombonera.jpg',
        'assets/bancoImagenes/escudoBoca.png',
        'assets/bancoImagenes/palermo.jpeg',
        'assets/bancoImagenes/paredes.jpeg',
        'assets/bancoImagenes/ennerGodLencia.jpeg',
        'assets/bancoImagenes/sancorSeguros.jpeg'
    ];
    const LADO_MAX = 420;
    const TOTAL_NIVELES = 4;
    const ANGULOS_BARAJA = [90, 180, 270];
    const CONFIG_GRILLAS = {
        4: { cols: 2, filas: 2 },
        6: { cols: 3, filas: 2 },
        8: { cols: 4, filas: 2 }
    };

    const canvas = document.getElementById('blocka-canvas');
    const ctx = canvas.getContext('2d');
    const btnComenzar = document.getElementById('blocka-comenzar');
    const elTiempo = document.getElementById('blocka-tiempo');
    const elRecord = document.getElementById('blocka-record');
    const elNivel = document.getElementById('blocka-nivel');
    const elFin = document.getElementById('blocka-fin');
    const elFinTitulo = document.getElementById('blocka-fin-titulo');
    const elSorteo = document.getElementById('blocka-sorteo');
    const thumbsSorteo = elSorteo ? Array.from(elSorteo.querySelectorAll('.blocka-sorteo__thumb')) : [];
    const btnsDificultad = Array.from(document.querySelectorAll('.btn-dificultad'));
    const elTiempoFinal = document.getElementById('blocka-tiempo-final');
    const btnReiniciar = document.getElementById('blocka-reiniciar');

    let nivelActual = 1;
    let cantPiezas = 4;
    let ultimaImagenSrc = null;
    let fuente = null;
    let piezas = [];
    let enJuego = false;
    let resuelto = false;
    let inicioMs = 0;
    let transcurridoMs = 0;
    let intervalo = null;
    let idSetup = 0;

    /* ---------- Filtros desacoplados en js/filtros.js ---------- */


    /* ---------- Banco de imágenes ---------- */

    function elegirImagenAlAzar() {
        const copia = BANCO_IMAGENES.slice();
        for (let i = copia.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = copia[i];
            copia[i] = copia[j];
            copia[j] = t;
        }
        return copia;
    }

    function cargarImagen(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('No se pudo cargar ' + src));
            img.src = src;
        });
    }

    async function cargarImagenSegura() {
        let orden = elegirImagenAlAzar();
        if (ultimaImagenSrc && orden.length > 1) {
            orden = orden.filter((src) => src !== ultimaImagenSrc).concat([ultimaImagenSrc]);
        }
        for (const src of orden) {
            try {
                const img = await cargarImagen(src);
                ultimaImagenSrc = src;
                return img;
            } catch (e) {
                console.warn(e.message);
            }
        }
        throw new Error('Ninguna imagen del banco pudo cargarse');
    }

    /* ---------- Selector de filtros según nivel ---------- */

    function aplicarFiltroSegunNivel(cv, indicePieza, nivel) {
        switch (nivel) {
            case 1:
                Filtros.grises(cv);
                break;
            case 2:
                Filtros.brillo(cv);
                break;
            case 3:
                Filtros.negativo(cv);
                break;
            case 4:
                switch (indicePieza % 4) {
                    case 0:
                        Filtros.grises(cv);
                        break;
                    case 1:
                        Filtros.brillo(cv);
                        break;
                    case 2:
                        Filtros.negativo(cv);
                        break;
                    default:
                        // Pieza con índice % 4 === 3: color original RGB (sin filtro)
                        break;
                }
                break;
            default:
                break;
        }
    }

    /* ---------- Animación de sorteo previo (Extra 1) ---------- */

    function animarSorteo(srcElegido, idActual) {
        return new Promise((resolve) => {
            if (!elSorteo || !thumbsSorteo.length) {
                resolve();
                return;
            }

            let targetIdx = thumbsSorteo.findIndex((th) => th.dataset.src === srcElegido);
            if (targetIdx === -1) targetIdx = 0;

            thumbsSorteo.forEach((th) => {
                th.classList.remove('activo', 'ganador', 'descarte');
            });
            elSorteo.hidden = false;

            const vueltas = 2;
            const totalPasos = vueltas * thumbsSorteo.length + targetIdx;
            let paso = 0;

            function ejecutarPaso() {
                if (idActual !== idSetup) {
                    resolve();
                    return;
                }

                const idxActual = paso % thumbsSorteo.length;
                thumbsSorteo.forEach((th, i) => {
                    if (i === idxActual) {
                        th.classList.add('activo');
                    } else {
                        th.classList.remove('activo');
                    }
                });

                if (paso >= totalPasos) {
                    thumbsSorteo.forEach((th, i) => {
                        th.classList.remove('activo');
                        if (i === targetIdx) {
                            th.classList.add('ganador');
                        } else {
                            th.classList.add('descarte');
                        }
                    });

                    setTimeout(() => {
                        if (idActual === idSetup) {
                            elSorteo.hidden = true;
                        }
                        resolve();
                    }, 800);
                    return;
                }

                paso++;
                const progreso = paso / totalPasos;
                const delay = 60 + Math.floor(Math.pow(progreso, 2) * 220);
                setTimeout(ejecutarPaso, delay);
            }

            ejecutarPaso();
        });
    }

    /* ---------- Setup del nivel: split dinámico en piezas + filtro + barajar ---------- */

    async function setupNivel() {
        const id = ++idSetup;
        enJuego = false;
        resuelto = false;
        detenerReloj();
        transcurridoMs = 0;
        mostrarTiempo(0);
        actualizarRetro();
        actualizarBotonesDificultad();
        if (elFinTitulo) elFinTitulo.textContent = '¡Imagen resuelta!';
        btnReiniciar.textContent = 'Jugar de nuevo';
        elFin.hidden = true;
        btnComenzar.hidden = true;
        canvas.classList.remove('blocka-canvas--activo');

        const img = await cargarImagenSegura();
        if (id !== idSetup) return;

        await animarSorteo(ultimaImagenSrc, id);
        if (id !== idSetup) return;

        btnComenzar.hidden = false;

        const config = CONFIG_GRILLAS[cantPiezas] || CONFIG_GRILLAS[4];
        const cols = config.cols;
        const filas = config.filas;

        // Cada sub-imagen es un cuadrado perfecto de lado "ladoPieza":
        const ladoPieza = Math.floor(LADO_MAX / cols);
        const cw = ladoPieza * cols;
        const ch = ladoPieza * filas;
        canvas.width = cw;
        canvas.height = ch;

        // Recorte central proporcional a la relación de aspecto de la grilla (cols : filas)
        const ratioGrilla = cols / filas;
        const ratioImg = img.naturalWidth / img.naturalHeight;
        let cropW, cropH, sx, sy;

        if (ratioImg > ratioGrilla) {
            cropH = img.naturalHeight;
            cropW = Math.round(cropH * ratioGrilla);
            sx = Math.round((img.naturalWidth - cropW) / 2);
            sy = 0;
        } else {
            cropW = img.naturalWidth;
            cropH = Math.round(cropW / ratioGrilla);
            sx = 0;
            sy = Math.round((img.naturalHeight - cropH) / 2);
        }

        fuente = document.createElement('canvas');
        fuente.width = cw;
        fuente.height = ch;
        fuente.getContext('2d').drawImage(img, sx, sy, cropW, cropH, 0, 0, cw, ch);

        piezas = [];
        for (let fila = 0; fila < filas; fila++) {
            for (let col = 0; col < cols; col++) {
                const idx = fila * cols + col;
                const x = col * ladoPieza;
                const y = fila * ladoPieza;
                const cv = document.createElement('canvas');
                cv.width = ladoPieza;
                cv.height = ladoPieza;
                cv.getContext('2d').drawImage(fuente, x, y, ladoPieza, ladoPieza, 0, 0, ladoPieza, ladoPieza);
                aplicarFiltroSegunNivel(cv, idx, nivelActual);
                piezas.push({
                    canvas: cv,
                    x,
                    y,
                    w: ladoPieza,
                    h: ladoPieza,
                    cx: x + ladoPieza / 2,
                    cy: y + ladoPieza / 2,
                    angulo: ANGULOS_BARAJA[Math.floor(Math.random() * ANGULOS_BARAJA.length)]
                });
            }
        }

        render();
    }

    /* ---------- Render ---------- */

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (resuelto && fuente) {
            ctx.drawImage(fuente, 0, 0);
            return;
        }
        for (const p of piezas) {
            ctx.save();
            ctx.translate(p.cx, p.cy);
            ctx.rotate(p.angulo * Math.PI / 180);
            ctx.drawImage(p.canvas, -p.w / 2, -p.h / 2);
            ctx.restore();
        }
    }

    /* ---------- Rotación ---------- */

    function piezaEn(x, y) {
        return piezas.find((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
    }

    function rotar(p, delta) {
        p.angulo = ((p.angulo + delta) % 360 + 360) % 360;
        render();
        verificarVictoria();
    }

    canvas.addEventListener('mousedown', (event) => {
        if (!enJuego || resuelto) return;
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (canvas.width / rect.width);
        const y = (event.clientY - rect.top) * (canvas.height / rect.height);
        const p = piezaEn(x, y);
        if (!p) return;
        if (event.button === 0) {
            rotar(p, -90);
        } else if (event.button === 2) {
            event.preventDefault();
            rotar(p, 90);
        }
    });

    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    /* ---------- Victoria, récord y temporizador ---------- */

    function verificarVictoria() {
        if (piezas.length && piezas.every((p) => p.angulo % 360 === 0)) {
            ganar();
        }
    }

    function ganar() {
        resuelto = true;
        enJuego = false;
        detenerReloj();
        render();
        actualizarBotonesDificultad();
        const seg = Math.floor(transcurridoMs / 1000);
        guardarRecord(seg, nivelActual, cantPiezas);
        elTiempoFinal.textContent = formatear(seg);

        if (nivelActual < TOTAL_NIVELES) {
            if (elFinTitulo) elFinTitulo.textContent = '¡Nivel ' + nivelActual + ' superado!';
            btnReiniciar.textContent = 'Siguiente nivel';
        } else {
            if (elFinTitulo) elFinTitulo.textContent = '¡Juego completado!';
            btnReiniciar.textContent = 'Volver a jugar';
        }

        elFin.hidden = false;
        btnComenzar.hidden = true;
        canvas.classList.remove('blocka-canvas--activo');
    }

    function claveRecord(nivel, piezas = cantPiezas) {
        return 'blocka-record-n' + nivel + '-p' + piezas;
    }

    function leerRecord(nivel = nivelActual, piezas = cantPiezas) {
        try {
            const v = localStorage.getItem(claveRecord(nivel, piezas));
            if (v !== null) return parseInt(v, 10);
            if (piezas === 4) {
                const vViejo = localStorage.getItem('blocka-record-nivel-' + nivel);
                if (vViejo !== null) return parseInt(vViejo, 10);
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function guardarRecord(seg, nivel = nivelActual, piezas = cantPiezas) {
        const previo = leerRecord(nivel, piezas);
        if (previo === null || seg < previo) {
            try {
                localStorage.setItem(claveRecord(nivel, piezas), String(seg));
            } catch (e) {
                /* sin localStorage sigue jugando igual */
            }
        }
        actualizarRetro();
    }

    function actualizarRetro() {
        if (elNivel) elNivel.textContent = 'Nivel ' + nivelActual;
        const r = leerRecord(nivelActual, cantPiezas);
        elRecord.textContent = 'Récord: ' + (r === null ? '--:--' : formatear(r));
    }

    function formatear(seg) {
        const m = Math.floor(seg / 60);
        const s = seg % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function mostrarTiempo(ms) {
        elTiempo.textContent = formatear(Math.floor(ms / 1000));
    }

    function tick() {
        transcurridoMs = Date.now() - inicioMs;
        mostrarTiempo(transcurridoMs);
    }

    function detenerReloj() {
        if (intervalo !== null) {
            clearInterval(intervalo);
            intervalo = null;
        }
    }

    function iniciarReloj() {
        inicioMs = Date.now() - transcurridoMs;
        detenerReloj();
        intervalo = setInterval(tick, 200);
    }

    /* ---------- Controles ---------- */

    function actualizarBotonesDificultad() {
        btnsDificultad.forEach((btn) => {
            const p = parseInt(btn.dataset.piezas, 10);
            if (p === cantPiezas) {
                btn.classList.add('btn-dificultad--activo');
            } else {
                btn.classList.remove('btn-dificultad--activo');
            }
            btn.disabled = enJuego;
        });
    }

    btnsDificultad.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (enJuego) return;
            const p = parseInt(btn.dataset.piezas, 10);
            if (p !== cantPiezas) {
                cantPiezas = p;
                setupNivel();
            }
        });
    });

    btnComenzar.addEventListener('click', () => {
        if (enJuego || resuelto) return;
        enJuego = true;
        btnComenzar.hidden = true;
        actualizarBotonesDificultad();
        canvas.classList.add('blocka-canvas--activo');
        iniciarReloj();
    });

    btnReiniciar.addEventListener('click', () => {
        if (resuelto) {
            if (nivelActual < TOTAL_NIVELES) {
                nivelActual++;
            } else {
                nivelActual = 1;
            }
        }
        setupNivel();
    });

    /* ---------- Arranque ---------- */

    actualizarRetro();
    setupNivel();

    window.BlockaJuego = {
        resolver: () => {
            if (!piezas.length) return;
            for (const p of piezas) p.angulo = 0;
            if (!enJuego) {
                enJuego = true;
                inicioMs = Date.now();
                transcurridoMs = 0;
            }
            ganar();
        },
        avanzarNivel: () => {
            if (nivelActual < TOTAL_NIVELES) {
                nivelActual++;
            } else {
                nivelActual = 1;
            }
            setupNivel();
        },
        irANivel: (n) => {
            if (n >= 1 && n <= TOTAL_NIVELES) {
                nivelActual = n;
                setupNivel();
            }
        },
        setPiezas: (cant) => {
            if ([4, 6, 8].includes(cant)) {
                cantPiezas = cant;
                setupNivel();
            }
        },
        estado: () => ({
            nivelActual,
            cantPiezas,
            enJuego,
            resuelto,
            angulos: piezas.map((p) => p.angulo),
            tiempoMs: transcurridoMs
        })
    };
});
