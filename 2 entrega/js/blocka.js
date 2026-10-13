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
    const TOTAL_NIVELES = 3;
    const ANGULOS_BARAJA = [90, 180, 270];

    const canvas = document.getElementById('blocka-canvas');
    const ctx = canvas.getContext('2d');
    const btnComenzar = document.getElementById('blocka-comenzar');
    const elTiempo = document.getElementById('blocka-tiempo');
    const elRecord = document.getElementById('blocka-record');
    const elNivel = document.getElementById('blocka-nivel');
    const elFin = document.getElementById('blocka-fin');
    const elFinTitulo = document.getElementById('blocka-fin-titulo');
    const elTiempoFinal = document.getElementById('blocka-tiempo-final');
    const btnReiniciar = document.getElementById('blocka-reiniciar');

    let nivelActual = 1;
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
        if (nivel === 1) {
            Filtros.grises(cv);
        } else if (nivel === 2) {
            Filtros.brillo(cv);
        } else if (nivel === 3) {
            if (typeof Filtros.negativo === 'function') {
                if (indicePieza % 3 === 0) Filtros.grises(cv);
                else if (indicePieza % 3 === 1) Filtros.brillo(cv);
                else Filtros.negativo(cv);
            } else {
                if (indicePieza % 2 === 0) Filtros.grises(cv);
                else Filtros.brillo(cv);
            }
        }
    }

    /* ---------- Setup del nivel: split en 4 cuadrantes + filtro + barajar ---------- */

    async function setupNivel() {
        const id = ++idSetup;
        enJuego = false;
        resuelto = false;
        detenerReloj();
        transcurridoMs = 0;
        mostrarTiempo(0);
        actualizarRetro();
        if (elFinTitulo) elFinTitulo.textContent = '¡Imagen resuelta!';
        btnReiniciar.textContent = 'Jugar de nuevo';
        elFin.hidden = true;
        btnComenzar.hidden = false;
        canvas.classList.remove('blocka-canvas--activo');

        const img = await cargarImagenSegura();
        if (id !== idSetup) return;

        // Recorte central a cuadrado: los cuadrantes quedan cuadrados y
        // rotarlos 90° no descubre huecos entre piezas.
        const lado = Math.min(img.naturalWidth, img.naturalHeight);
        const escala = LADO_MAX / lado;
        const cw = Math.max(2, Math.round(lado * escala));
        const ch = cw;
        const sx = (img.naturalWidth - lado) / 2;
        const sy = (img.naturalHeight - lado) / 2;
        canvas.width = cw;
        canvas.height = ch;

        fuente = document.createElement('canvas');
        fuente.width = cw;
        fuente.height = ch;
        fuente.getContext('2d').drawImage(img, sx, sy, lado, lado, 0, 0, cw, ch);

        const anchoIzq = Math.floor(cw / 2);
        const anchoDer = cw - anchoIzq;
        const altoArr = Math.floor(ch / 2);
        const altoAba = ch - altoArr;
        const zonas = [
            { x: 0, y: 0, w: anchoIzq, h: altoArr },
            { x: anchoIzq, y: 0, w: anchoDer, h: altoArr },
            { x: 0, y: altoArr, w: anchoIzq, h: altoAba },
            { x: anchoIzq, y: altoArr, w: anchoDer, h: altoAba }
        ];

        piezas = zonas.map((z, idx) => {
            const cv = document.createElement('canvas');
            cv.width = z.w;
            cv.height = z.h;
            cv.getContext('2d').drawImage(fuente, z.x, z.y, z.w, z.h, 0, 0, z.w, z.h);
            aplicarFiltroSegunNivel(cv, idx, nivelActual);
            return {
                canvas: cv,
                x: z.x,
                y: z.y,
                w: z.w,
                h: z.h,
                cx: z.x + z.w / 2,
                cy: z.y + z.h / 2,
                angulo: ANGULOS_BARAJA[Math.floor(Math.random() * ANGULOS_BARAJA.length)]
            };
        });

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
        const seg = Math.floor(transcurridoMs / 1000);
        guardarRecord(seg, nivelActual);
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

    function claveRecord(nivel) {
        return 'blocka-record-nivel-' + nivel;
    }

    function leerRecord(nivel = nivelActual) {
        try {
            const v = localStorage.getItem(claveRecord(nivel));
            return v === null ? null : parseInt(v, 10);
        } catch (e) {
            return null;
        }
    }

    function guardarRecord(seg, nivel = nivelActual) {
        const previo = leerRecord(nivel);
        if (previo === null || seg < previo) {
            try {
                localStorage.setItem(claveRecord(nivel), String(seg));
            } catch (e) {
                /* sin localStorage sigue jugando igual */
            }
        }
        actualizarRetro();
    }

    function actualizarRetro() {
        if (elNivel) elNivel.textContent = 'Nivel ' + nivelActual;
        const r = leerRecord(nivelActual);
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

    btnComenzar.addEventListener('click', () => {
        if (enJuego || resuelto) return;
        enJuego = true;
        btnComenzar.hidden = true;
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
        estado: () => ({
            nivelActual,
            enJuego,
            resuelto,
            angulos: piezas.map((p) => p.angulo),
            tiempoMs: transcurridoMs
        })
    };
});
