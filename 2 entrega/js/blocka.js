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
    const PENALIZACION_AYUDA_MS = 5000;
    const DURACION_PULSO_MS = 1500;
    /* Niveles contrarreloj: límite base por nivel y bonificación por cantidad de piezas */
    const CONFIG_NIVELES = {
        1: { limiteMs: null },
        2: { limiteMs: null },
        3: { limiteMs: 60000 },
        4: { limiteMs: 45000 }
    };
    const FACTOR_PIEZAS = { 4: 1, 6: 1.3, 8: 1.6 };
    /* Semáforo de urgencia: umbrales sobre el tiempo RESTANTE */
    const UMBRAL_ADVERTENCIA_MS = 30000;
    const UMBRAL_ALERTA_MS = 10000;
    const UMBRAL_PULSO_MS = 5000;
    const COLOR_SELECCION = (() => {
        try {
            const v = getComputedStyle(document.documentElement).getPropertyValue('--primario').trim();
            return v || '#FFB8F5';
        } catch (e) {
            return '#FFB8F5';
        }
    })();
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
    const btnAyudita = document.getElementById('blocka-ayudita');
    const elLimite = document.getElementById('blocka-limite');
    const elLimiteTiempo = document.getElementById('blocka-limite-tiempo');
    const elAvisoLimite = document.getElementById('blocka-aviso-limite');
    const elAvisoTiempo = document.getElementById('blocka-aviso-tiempo');
    const elFinDetalle = document.getElementById('blocka-fin-detalle');
    const elAvisoA11y = document.getElementById('blocka-aviso-a11y');

    let nivelActual = 1;
    let cantPiezas = 4;
    let ultimaImagenSrc = null;
    let fuente = null;
    let piezas = [];
    let enJuego = false;
    let resuelto = false;
    let perdido = false;
    let ayudaUsada = false;
    let pulsoResaltado = null;
    let limiteMs = null;
    let estadoSemaforo = '';
    let ultimoUmbralAvisado = null;
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
        perdido = false;
        ayudaUsada = false;
        pulsoResaltado = null;
        limiteMs = limiteEfectivoMs();
        estadoSemaforo = '';
        ultimoUmbralAvisado = null;
        detenerReloj();
        transcurridoMs = 0;
        mostrarTiempo(limiteMs !== null ? limiteMs : 0);
        actualizarAriaTiempo();
        actualizarInfoLimite();
        actualizarRetro();
        actualizarBotonesDificultad();
        if (btnAyudita) {
            btnAyudita.disabled = true;
            btnAyudita.classList.remove('blocka-ayudita--flash');
        }
        if (elFinTitulo) elFinTitulo.textContent = '¡Imagen resuelta!';
        if (elFin) elFin.classList.remove('blocka-fin--perdido');
        if (elFinDetalle) elFinDetalle.hidden = true;
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
                    angulo: ANGULOS_BARAJA[Math.floor(Math.random() * ANGULOS_BARAJA.length)],
                    fija: false
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
        dibujarResaltado();
    }

    /* ---------- Rotación ---------- */

    function piezaEn(x, y) {
        return piezas.find((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
    }

    function rotar(p, delta) {
        if (p.fija) return;
        p.angulo = ((p.angulo + delta) % 360 + 360) % 360;
        render();
        verificarVictoria();
    }

    /* ---------- Resaltado de la pieza ayudada (dibujado en canvas) ---------- */

    function dibujarResaltado() {
        for (const p of piezas) {
            if (!p.fija) continue;
            let onda = 0;
            if (pulsoResaltado && pulsoResaltado.pieza === p) {
                const t = Math.min(1, (performance.now() - pulsoResaltado.inicio) / DURACION_PULSO_MS);
                if (t < 1) {
                    onda = (0.5 + 0.5 * Math.cos(t * 4 * Math.PI)) * (1 - t);
                }
            }
            ctx.save();
            ctx.strokeStyle = COLOR_SELECCION;
            ctx.lineWidth = 4 + 3 * onda;
            ctx.shadowColor = COLOR_SELECCION;
            ctx.shadowBlur = 8 + 20 * onda;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(p.x, p.y, p.w, p.h, 10);
            } else {
                ctx.rect(p.x, p.y, p.w, p.h);
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    function animarPulsoResaltado(pieza) {
        pulsoResaltado = { pieza, inicio: performance.now() };
        function paso() {
            if (!pulsoResaltado || pulsoResaltado.pieza !== pieza) return;
            if (piezas.indexOf(pieza) === -1 || resuelto) {
                pulsoResaltado = null;
                render();
                return;
            }
            if (performance.now() - pulsoResaltado.inicio >= DURACION_PULSO_MS) {
                pulsoResaltado = null;
                render();
                return;
            }
            render();
            requestAnimationFrame(paso);
        }
        render();
        requestAnimationFrame(paso);
    }

    /* ---------- Ayudita: fija una pieza al azar y suma 5s ---------- */

    function usarAyudita() {
        if (!enJuego || resuelto || ayudaUsada || !btnAyudita) return;
        const candidatas = piezas.filter((p) => p.angulo % 360 !== 0);
        if (!candidatas.length) return;

        const p = candidatas[Math.floor(Math.random() * candidatas.length)];
        p.angulo = 0;
        p.fija = true;

        ayudaUsada = true;
        btnAyudita.disabled = true;

        if (limiteMs !== null) {
            /* Cuenta regresiva: mover el origen hacia adelante RESTA lo transcurrido
               → el jugador gana 5 s de margen (la ayuda premia en contrarreloj). */
            inicioMs += PENALIZACION_AYUDA_MS;
        } else {
            /* Cuenta progresiva: retroceder el origen suma 5 s al tiempo final (penalización). */
            inicioMs -= PENALIZACION_AYUDA_MS;
        }
        tick();

        animarPulsoResaltado(p);
        verificarVictoria();

        btnAyudita.classList.remove('blocka-ayudita--flash');
        void btnAyudita.offsetWidth;
        btnAyudita.classList.add('blocka-ayudita--flash');
        btnAyudita.addEventListener('animationend', () => {
            btnAyudita.classList.remove('blocka-ayudita--flash');
        }, { once: true });
    }

    if (btnAyudita) {
        btnAyudita.addEventListener('click', usarAyudita);
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
        pulsoResaltado = null;
        render();
        actualizarBotonesDificultad();
        if (btnAyudita) btnAyudita.disabled = true;
        const seg = Math.floor(transcurridoMs / 1000);
        guardarRecord(seg, nivelActual, cantPiezas);
        elTiempoFinal.textContent = formatear(seg);

        if (elFin) elFin.classList.remove('blocka-fin--perdido');
        if (elFinDetalle) elFinDetalle.hidden = true;
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

    function perder() {
        if (perdido || resuelto) return;
        perdido = true;
        enJuego = false;
        detenerReloj();
        pulsoResaltado = null;
        render();
        actualizarBotonesDificultad();
        if (btnAyudita) btnAyudita.disabled = true;
        if (elAvisoA11y) elAvisoA11y.textContent = 'Se acabó el tiempo. Perdiste el nivel.';

        const segLimite = limiteMs !== null
            ? Math.round(limiteMs / 1000)
            : Math.floor(transcurridoMs / 1000);
        if (elFinTitulo) elFinTitulo.textContent = '¡Se acabó el tiempo!';
        if (elFinDetalle) {
            elFinDetalle.textContent = 'Perdiste el nivel: no alcanzaste a resolver la imagen a tiempo.';
            elFinDetalle.hidden = false;
        }
        elTiempoFinal.textContent = formatear(segLimite);
        btnReiniciar.textContent = 'Reintentar';
        if (elFin) elFin.classList.add('blocka-fin--perdido');
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

    /* ---------- Niveles contrarreloj: límite, semáforo y avisos ---------- */

    function limiteEfectivoMs() {
        const cfg = CONFIG_NIVELES[nivelActual];
        if (!cfg || cfg.limiteMs == null) return null;
        return Math.round(cfg.limiteMs * (FACTOR_PIEZAS[cantPiezas] || 1));
    }

    function actualizarInfoLimite() {
        const tieneLimite = limiteMs !== null;
        if (tieneLimite) {
            const txt = formatear(Math.round(limiteMs / 1000));
            if (elLimite && elLimiteTiempo) {
                elLimiteTiempo.textContent = txt;
                elLimite.hidden = false;
            }
            if (elAvisoLimite && elAvisoTiempo) {
                elAvisoTiempo.textContent = txt;
                elAvisoLimite.hidden = false;
            }
        } else {
            if (elLimite) elLimite.hidden = true;
            if (elAvisoLimite) elAvisoLimite.hidden = true;
            /* Sin límite no puede quedar el semáforo "colgado" del nivel anterior */
            if (elTiempo) {
                elTiempo.classList.remove('blocka-hud__tiempo--advertencia',
                    'blocka-hud__tiempo--alerta', 'blocka-hud__tiempo--pulso');
            }
        }
    }

    function actualizarAriaTiempo() {
        if (!elTiempo) return;
        if (limiteMs !== null) {
            const restante = Math.max(0, limiteMs - transcurridoMs);
            elTiempo.setAttribute('aria-label', 'Tiempo restante ' + formatear(Math.floor(restante / 1000)));
        } else {
            elTiempo.setAttribute('aria-label', 'Tiempo transcurrido ' + formatear(Math.floor(transcurridoMs / 1000)));
        }
    }

    function pintarSemaforo(restante) {
        if (!elTiempo) return;
        let estado = '';
        if (restante <= UMBRAL_PULSO_MS) estado = 'pulso';
        else if (restante <= UMBRAL_ALERTA_MS) estado = 'alerta';
        else if (restante <= UMBRAL_ADVERTENCIA_MS) estado = 'advertencia';
        if (estado === estadoSemaforo) return;
        estadoSemaforo = estado;
        elTiempo.classList.toggle('blocka-hud__tiempo--advertencia', estado === 'advertencia');
        elTiempo.classList.toggle('blocka-hud__tiempo--alerta', estado === 'alerta' || estado === 'pulso');
        elTiempo.classList.toggle('blocka-hud__tiempo--pulso', estado === 'pulso');
    }

    function anunciarUmbral(restante) {
        let umbral = null;
        if (restante <= UMBRAL_PULSO_MS) umbral = 5;
        else if (restante <= UMBRAL_ALERTA_MS) umbral = 10;
        else if (restante <= UMBRAL_ADVERTENCIA_MS) umbral = 30;
        if (umbral !== null && umbral !== ultimoUmbralAvisado) {
            ultimoUmbralAvisado = umbral;
            if (elAvisoA11y) elAvisoA11y.textContent = umbral + ' segundos restantes';
        }
    }

    function mostrarTiempo(ms) {
        elTiempo.textContent = formatear(Math.floor(ms / 1000));
    }

    function tick() {
        if (perdido) return;
        transcurridoMs = Date.now() - inicioMs;
        if (limiteMs !== null) {
            const restante = Math.max(0, limiteMs - transcurridoMs);
            mostrarTiempo(restante);
            pintarSemaforo(restante);
            anunciarUmbral(restante);
            actualizarAriaTiempo();
            if (restante <= 0) {
                perder();
                return;
            }
        } else {
            mostrarTiempo(transcurridoMs);
            actualizarAriaTiempo();
        }
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
        if (elAvisoLimite) elAvisoLimite.hidden = true;
        actualizarBotonesDificultad();
        canvas.classList.add('blocka-canvas--activo');
        iniciarReloj();
        if (btnAyudita) btnAyudita.disabled = false;
    });

    btnReiniciar.addEventListener('click', () => {
        if (resuelto && !perdido) {
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
        perder: () => {
            perder();
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
            perdido,
            limiteMs,
            restanteMs: limiteMs !== null ? Math.max(0, limiteMs - transcurridoMs) : null,
            angulos: piezas.map((p) => p.angulo),
            fijas: piezas.map((p) => p.fija),
            tiempoMs: transcurridoMs
        })
    };
});
