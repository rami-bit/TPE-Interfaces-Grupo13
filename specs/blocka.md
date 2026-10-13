# Blocka — Documentación completa del juego

Este documento explica **cómo funciona** el juego Blocka tal como está implementado hoy en la
2ª entrega (`blocka.html` + `js/blocka.js` + `js/filtros.js` + `css/blocka.css`), **qué se puede
cambiar** y **qué saber para hacerlo más escalable**. Sirve como referencia para mantenerlo,
extenderlo o defenderlo.

Relacionados:

- [`IMPLEMENTACION.md`](IMPLEMENTACION.md) — implementación detallada (división en piezas, sorteo, etc.).
- [`DOCUMENTACION.md`](DOCUMENTACION.md) — mecánica general y filtros de la cátedra.
- [`EXTENSION.md`](EXTENSION.md) — extensiones del trabajo.

---

## 1. Visión general

Blocka es un rompecabezas: una imagen se parte en sub-imágenes cuadradas que arrancan **rotadas**
(90°, 180° o 270°) y con un **filtro de color** (grises, brillo o negativo). El jugador gira cada
pieza con los botones del mouse hasta que todas quedan en 0°. En ese momento se da la victoria, el
filtro visual desaparece (se dibuja la imagen `fuente` original) y se guarda el tiempo como récord.

Características actuales:

- 4 niveles con filtros distintos (el nivel 4 combina filtros por pieza).
- 3 cantidades de piezas: 4 (2×2), 6 (3×2) y 8 (4×2).
- **Niveles contrarreloj**: los niveles 3 y 4 tienen tiempo máximo (1:00 y 0:45 base); si se
  termina el tiempo, se pierde el nivel y hay que reintentar. El límite se bonifica con más
  piezas (+30% con 6, +60% con 8).
- Sorteo animado de una de 6 imágenes del banco antes de cada nivel.
- Cronómetro + récord persistente por nivel y cantidad de piezas (`localStorage`).
- **Ayudita**: bombilla que fija una pieza al azar y suma 5 segundos (1 uso por nivel), con
  aro de selección dibujado en canvas (glow del color primario sobre el borde de la celda).

---

## 2. Arquitectura de archivos

| Archivo | Rol | Quién lo toca para… |
|---|---|---|
| `2 entrega/blocka.html` | Página del juego: zona de ejecución (canvas + overlays + HUD), tarjetas "Cómo se juega" / "Niveles" / "Galería". | Agregar botones al HUD, thumbnails de imágenes, textos de ayuda. |
| `2 entrega/js/blocka.js` | **Toda la lógica**: banco de imágenes, setup del nivel, piezas, rotación, reloj, récord, victoria, ayudita y API pública. | Cambiar reglas del juego, tiempos, niveles, agregar power-ups. |
| `2 entrega/js/filtros.js` | Módulo independiente `Filtros` (global vía `window.Filtros`): grises, brillo, negativo sobre `ImageData`. | Agregar o ajustar filtros de color. |
| `2 entrega/css/blocka.css` | Layout de la zona de ejecución (canvas, HUD, dificultad, sorteo, fin, ayudita) y cards informativas. | Visual del HUD, animaciones, overlays. |
| `2 entrega/css/global.css` | Variables de diseño (`--primario`, etc.), tipografía (`Plus Jakarta Sans`) y botones globales (`btn-primario`, `btn-acento`). | Colores y estilos de botón compartidos por todo el sitio. |
| `2 entrega/assets/bancoImagenes/*` | Fotos jugables (6 actualmente). | Sumar fotos nuevas. |

Orden de carga de scripts en `blocka.html`:

```html
<script src="js/header.js"></script>   <!-- menú hamburguesa / header -->
<script src="js/juego.js"></script>    <!-- botones favorito/compartir de la barra del juego -->
<script src="js/filtros.js"></script>  <!-- define window.Filtros -->
<script src="js/blocka.js"></script>   <!-- todo el juego (espera DOMContentLoaded) -->
```

> `blocka.js` se ejecuta entero dentro de un `DOMContentLoaded`. Toda su lógica vive en un
> **cierre (closure)**: no hay variables globales salvo `window.BlockaJuego` y `window.Filtros`.

### HTML de la zona de ejecución

```html
<div class="blocka-mock">
  <div class="blocka-tablero">
    <div class="blocka-lienzo">
      <canvas id="blocka-canvas"></canvas>
      <div id="blocka-aviso-limite" hidden>⏱ Nivel contrarreloj — <strong id="blocka-aviso-tiempo">…</strong>…</div>
      <div id="blocka-sorteo" hidden>…ruleta de 6 miniaturas…</div>
      <div id="blocka-fin" hidden>…overlay de victoria/derrota + "Jugar de nuevo / Siguiente nivel / Reintentar"…</div>
    </div>
    <p class="blocka-ayuda">Clic izquierda: gira a la izquierda · Clic derecha: gira a la derecha</p>
  </div>
  <div class="blocka-hud">
    <span id="blocka-nivel">Nivel 1</span>
    <div class="blocka-dificultad">…botones 4 / 6 / 8…</div>
    <span id="blocka-tiempo" role="timer">00:00</span>
    <span id="blocka-limite" hidden>⏱ Límite <strong id="blocka-limite-tiempo">…</strong></span>
    <p id="blocka-aviso-a11y" class="visually-hidden" aria-live="polite"></p>
    <span id="blocka-record">Récord: --:--</span>
    <button id="blocka-ayudita" class="btn-primario blocka-ayudita" disabled>💡</button>
    <button id="blocka-comenzar" class="btn-primario">Comenzar</button>
  </div>
</div>
```

Elementos exclusivos de niveles contrarreloj:

| Elemento | Cuándo se ve | Rol |
|---|---|---|
| `#blocka-aviso-limite` | Después del sorteo y hasta apretar "Comenzar" | Aviso previo sobre el canvas: "Nivel contrarreloj — 01:00" |
| `#blocka-limite` | Durante todo el nivel (con límite) | Badge persistente en el HUD junto al reloj |
| `#blocka-fin-detalle` | Solo en el overlay de derrota | Mensaje explicativo bajo el título |
| `#blocka-aviso-a11y` | Invisible (para lectores de pantalla) | Anuncia umbrales (30/10/5 s) y la derrota vía `aria-live` |

---

## 3. Ciclo de vida de una partida

```
DOMContentLoaded
      │
      ▼
actualizarRetro()  ── muestra nivel y récord desde localStorage
      │
      ▼
setupNivel()  (async) ─────────────────────────────────────────┐
  1. id = ++idSetup                 ← token anti-carreras      │
  2. enJuego=false, resuelto=false, perdido=false, ayudaUsada  │
  3. limiteMs = límite efectivo del nivel (config + factor)     │
  4. reloj detenido; reloj muestra el límite completo (si hay)  │
  5. botón Ayudita deshabilitado; avisos/badge de límite        │
  6. btnComenzar.hidden = true, overlay fin oculto             │
  7. await cargarImagenSegura()     ← sorteo de foto           │
  8. await animarSorteo()           ← ruleta visual (Extra 1)  │
  9. btnComenzar.hidden = false                                │
 10. calcular grilla → canvas → recorte central → "fuente"     │
 11. crear piezas[] con ángulos barajados y filtro por nivel   │
 12. render()                                                  │
      │                                                        │
      ▼                                                        │
[Espera: jugador elige piezas / clickea "Comenzar"]            │
      │                                                        │
      ▼                                                        │
"Comenzar" → enJuego=true, inicia reloj, habilita Ayudita      │
      │                                                        │
      ▼                                                        │
mousedown en pieza → rotar(±90) → verificarVictoria() ─────────┘
      │
      ├─▶ (todas en 0°) ganar(): detiene reloj, guarda récord,
      │    overlay "¡Nivel superado!" → "Siguiente nivel" → setupNivel()
      │
      └─▶ (restante <= 0, solo niveles 3/4) perder(): congela el
           tablero, NO guarda récord, overlay "¡Se acabó el tiempo!"
           → "Reintentar" → setupNivel() (mismo nivel, nueva foto)
```

**Reglas del ciclo:**

- El reloj **solo corre** con `enJuego === true`.
- En niveles con tiempo máximo, `tick()` compara el **restante** contra 0; al llegar a 0 se
  dispara `perder()` (ver §9). La Ayudita **suma 5 s de margen** en contrarreloj.
- Ganar guarda récord; **perder nunca guarda récord**.
- "Reintentar" (tras perder) reinicia el **mismo nivel** con nueva foto; "Siguiente nivel"
  (tras ganar) avanza.
- Cambiar la dificultad (4/6/8) solo está permitido **antes** de apretar Comenzar; si se cambia,
  se llama `setupNivel()` de nuevo y se pierde el estado anterior. En niveles con límite, el
  límite efectivo se recalcula (ver bonificación en §9).
- Ganar el nivel 4 y apretar "Volver a jugar" reinicia en nivel 1.

### El token `idSetup` (importante)

`setupNivel()` es `async` (carga imagen + anima el sorteo). Si el jugador clickea rápido (cambia
dificultad mientras sortea), podrían superponerse dos ejecuciones. El patrón es:

```js
const id = ++idSetup;
…
const img = await cargarImagenSegura();
if (id !== idSetup) return;   // otra ejecución más nueva me ganó: me rindo
```

Cualquier `await` dentro de `setupNivel()` **debe** ir seguido de este chequeo. Si agregás pasos
async y olvidás el chequeo, vas a ver el tablero "parpadeando" entre dos configuraciones.

---

## 4. Modelo de estado

Todo el estado vive en variables del cierre de `blocka.js`:

| Variable | Tipo | Significado |
|---|---|---|
| `nivelActual` | number (1..4) | Nivel activo (define el filtro). |
| `cantPiezas` | number (4/6/8) | Cantidad de piezas de la grilla. |
| `ultimaImagenSrc` | string\|null | Última foto usada (se evita repetir en el próximo sorteo). |
| `fuente` | canvas offscreen | Imagen completa recortada **sin filtro** (RGB original). |
| `piezas[]` | array | Modelo de cada sub-imagen (ver abajo). |
| `enJuego` | boolean | ¿El reloj corre y se aceptan clics? |
| `resuelto` | boolean | ¿Nivel completado? |
| `perdido` | boolean | ¿Se agotó el tiempo? (solo niveles con límite; congela el tablero) |
| `limiteMs` | number\|null | Tiempo máximo **efectivo** del nivel (null = sin límite). Se recalcula en `setupNivel()` con `CONFIG_NIVELES` × factor de piezas |
| `estadoSemaforo` | string | Clase de urgencia aplicada al reloj (`''` / `advertencia` / `alerta` / `pulso`); evita tocar `classList` en cada tick |
| `ultimoUmbralAvisado` | number\|null | Último umbral anunciado a lectores de pantalla (30/10/5); evita repetir anuncios |
| `ayudaUsada` | boolean | ¿Se usó la Ayudita en este nivel? (1 uso por nivel) |
| `pulsoResaltado` | object\|null | Animación del aro: `{ pieza, inicio }` mientras dura el pulso (null = estado steady) |
| `inicioMs` | number | Epoch del inicio del cronómetro (se ajusta para pausar/penalizar). |
| `transcurridoMs` | number | Milisegundos transcurridos (espejo para mostrar). |
| `intervalo` | timer\|null | Handle del `setInterval` del reloj. |
| `idSetup` | number | Contador de generaciones de nivel (anti-carreras). |

### Objeto pieza

```js
{
  canvas,  // canvas offscreen chico con la sub-imagen YA filtrada
  x, y,    // destino dentro del canvas visible (esquina superior izquierda)
  w, h,    // tamaño (siempre cuadrado: w === h === ladoPieza)
  cx, cy,  // centro (para rotar alrededor del eje propio)
  angulo,  // 0 | 90 | 180 | 270 (grados)
  fija     // true = pieza bloqueada por la Ayudita (no se puede rotar; lleva borde de selección)
}
```

La condición de victoria es `angulo % 360 === 0` para **todas** las piezas
(`verificarVictoria()`, blocka.js:459).

---

## 5. Cómo se arma el tablero (`setupNivel`)

1. **Grilla** según `CONFIG_GRILLAS`:

   | Piezas | Cols × Filas | Lado de pieza | Canvas |
   |---|---|---|---|
   | 4 | 2 × 2 | `floor(420/2)=210` | 420 × 420 |
   | 6 | 3 × 2 | `floor(420/3)=140` | 420 × 280 |
   | 8 | 4 × 2 | `floor(420/4)=105` | 420 × 210 |

   Las piezas **deben** ser cuadradas: al rotar 90°/270° un rectángulo invadiría la celda vecina.

2. **Recorte central**: la foto se recorta por el centro respetando la proporción de la grilla
   (`cols/filas`), descartando sobrantes de lado (laterales o superior/inferior) de forma simétrica.

3. **`fuente`**: canvas offscreen con el recorte completo **sin filtros** (es lo que se dibuja al
   ganar y lo que se recorta por celda).

4. **Piezas**: por cada celda se crea un canvas chico copiado de `fuente`, se le aplica el filtro
   del nivel (`aplicarFiltroSegunNivel`) y se le asigna un ángulo al azar de
   `ANGULOS_BARAJA = [90, 180, 270]` (nunca arranca en 0).

---

## 6. Filtros (`js/filtros.js`)

`Filtros` es un objeto global con funciones que reciben un `canvas` y **mutan sus píxeles** vía
`ImageData`:

| Fórmula | Función | Uso |
|---|---|---|
| `0.299R + 0.587G + 0.114B` (ITU-R BT.601) | `grises(cv)` | Nivel 1 y pieza 0 del nivel 4 |
| `canal + 255*0.3` (con tope 255) | `brillo(cv, 0.3)` | Nivel 2 y pieza 1 del nivel 4 |
| `255 - canal` | `negativo(cv)` | Nivel 3 y pieza 2 del nivel 4 |

La asignación nivel → filtro vive en `aplicarFiltroSegunNivel(cv, indicePieza, nivel)`
(blocka.js:124). El nivel 4 usa `indicePieza % 4` para dar un filtro distinto por cuadrante
(queda 1 pieza sin filtro, en RGB original).

### Cómo agregar un filtro nuevo (2 pasos)

1. En `filtros.js`:

```js
sepia(cv) {
    const c = cv.getContext('2d');
    const d = c.getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        d[i]   = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        d[i+1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        d[i+2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    }
    c.putImageData(new ImageData(d, cv.width, cv.height), 0, 0);
}
```

2. En `aplicarFiltroSegunNivel`, agregar un `case` para el nivel nuevo.

> Los filtros se aplican **una sola vez**, al crear la pieza. No se reevalúan al rotar: la pieza
> ya contiene sus píxeles filtrados.

---

## 7. Banco de imágenes y sorteo

- `BANCO_IMAGENES` (blocka.js:2) lista las rutas jugables. `cargarImagenSegura()` hace un
  **Fisher–Yates** del listado y prueba en orden hasta cargar una; además manda la última usada
  al final para no repetir seguidas.
- Antes de mostrar el tablero, `animarSorteo()` recorre las miniaturas del overlay
  `#blocka-sorteo` con `setTimeout` (acelera al final, 2 vueltas + la ganadora) y aplica las
  clases CSS `.activo`, `.ganador`, `.descarte`.
- Si una imagen falla (`onerror`), se salta a la siguiente y se hace `console.warn`.

**Para sumar una foto:** agregar el archivo en `assets/bancoImagenes/`, sumar la ruta en
`BANCO_IMAGENES`, y agregar el `<img class="blocka-sorteo__thumb" data-src="…">` en el overlay de
sorteo **y** un `<img>` en la galería de "Imágenes Representativas". `data-src` debe coincidir
exactamente con la ruta de `BANCO_IMAGENES` (el sorteo lo usa para ubicar la ganadora).

---

## 8. Controles y rotación

- `mousedown` sobre el canvas (solo con `enJuego && !resuelto`):
  - **Clic izquierdo** → `rotar(p, -90)` (antihorario).
  - **Clic derecho** → `rotar(p, +90)` (horario); además `preventDefault()`.
  - `contextmenu` está bloqueado en el canvas para que el clic derecho no abra el menú.
- Coordenadas: se convierte de espacio CSS a espacio interno del canvas con
  `(clientX - rect.left) * (canvas.width / rect.width)` (necesario porque el canvas se escala con
  CSS).
- Hit-test: `piezaEn(x, y)` busca la pieza cuyo rectángulo contiene al punto.
- **Guard de pieza fija**: `rotar()` hace `if (p.fija) return;` → las piezas que arregló la
  Ayudita no giran más.

---

## 9. Victoria, temporizador y récord

### Reloj

```js
tick():        transcurridoMs = Date.now() - inicioMs;   // cada 200 ms
iniciarReloj(): inicioMs = Date.now() - transcurridoMs;  // reanuda desde donde iba
detenerReloj(): clearInterval(intervalo);
```

El reloj **no** acumula por sí solo: deriva de `inicioMs`. Por eso "congelarlo" es simplemente
`detenerReloj()`, y "sumar tiempo" es retroceder `inicioMs` (ver §10).

### Victoria

`verificarVictoria()` se llama después de **cada** rotación (y de la Ayudita). Si todas las
piezas están en 0° → `ganar()`:

1. `resuelto = true`, `enJuego = false`, detiene el reloj.
2. `render()` dibuja `fuente` completa (sin rotaciones ni separación visual).
3. `guardarRecord(segundos, nivel, piezas)` → solo guarda si es **menor** al récord previo.
4. Actualiza el overlay: "¡Nivel N superado!" o "¡Juego completado!".

### Récords (`localStorage`)

- Clave actual: `blocka-record-n{nivel}-p{piezas}` (ej. `blocka-record-n2-p8`), valor en
  **segundos** enteros.
- Clave legada `blocka-record-nivel-{nivel}`: si existe y la nueva no, se lee como 4 piezas
  (migración hacia atrás compatible).
- Todo rodeado en `try/catch`: sin `localStorage` el juego sigue funcionando, solo no persiste.
- El récord guarda **el tiempo final, incluida la penalización de la Ayudita** (si usaste la
  bombilla, los +5s entran en la cuenta del récord).

### Tiempo máximo (niveles 3 y 4, contrarreloj)

Los niveles avanzados tienen **límite de tiempo**: si el jugador no resuelve la imagen antes
de que se agote, **pierde el nivel** (sin récord) y puede reintentar.

**Config (data-driven):**

```js
const CONFIG_NIVELES = {          // límite BASE por nivel (null = sin límite)
    1: { limiteMs: null },
    2: { limiteMs: null },
    3: { limiteMs: 60000 },       // 1:00
    4: { limiteMs: 45000 }        // 0:45
};
const FACTOR_PIEZAS = { 4: 1, 6: 1.3, 8: 1.6 };   // bonificación por cantidad de piezas
```

`limiteEfectivoMs()` devuelve `base × factor` (redondeado); ese valor es `limiteMs` y es lo
que se muestra al jugador. Ejemplos: nivel 3 con 6 piezas → 78 s; nivel 4 con 8 piezas → 72 s.
La bonificación se aplica **para que la dificultad extra de 6/8 piezas no vuelva el nivel
imposible** (UX: desafío que escala, no frustración aleatoria). Como el límite se recalcula en
`setupNivel()`, cambiar 4/6/8 antes de "Comenzar" actualiza badge y aviso automáticamente.

**Qué ve el jugador (señales UX de urgencia):**

| Señal | Dónde | Cuándo |
|---|---|---|
| Aviso previo `#blocka-aviso-limite` | Franja sobre el canvas (z-index 4, tapada por el overlay de sorteo) | Después del sorteo y hasta apretar "Comenzar"; se oculta al empezar |
| Badge `#blocka-limite` ("⏱ Límite 01:00") | HUD, junto al reloj | Durante todo el nivel con límite |
| Cuenta **regresiva** | `#blocka-tiempo` muestra el **restante** (no el transcurrido) | Todo el nivel |
| Semáforo de color | `#blocka-tiempo` | Ámbar ≤30 s (`--advertencia`), rojo ≤10 s (`--alerta`), rojo **pulsante** ≤5 s (keyframes `blocka-tiempo-pulso`) |
| Anuncios a11y | `#blocka-aviso-a11y` (`aria-live="polite"`, oculto) | Una sola vez por umbral: "30/10/5 segundos restantes" y "Se acabó el tiempo" |
| `role="timer"` + `aria-label` | `#blocka-tiempo` | Describe "Tiempo restante mm:ss" (o "Tiempo transcurrido…" sin límite) |

El semáforo es **gradual a propósito** (UX de urgencia anticipada, no de susto): el jugador
recibe feedback accionable desde los 30 s y la última llamada de atención es el pulso a los 5 s.
Los cambios de clase los decide `pintarSemaforo(restante)` comparando contra
`UMBRAL_ADVERTENCIA_MS` / `UMBRAL_ALERTA_MS` / `UMBRAL_PULSO_MS`, y solo toca `classList`
cuando el estado cambia (evita trabajo por tick). Al entrar a un nivel **sin** límite,
`actualizarInfoLimite()` quita las tres clases del semáforo: así el rojo/pulso de un nivel
contrarreloj nunca queda "colgado" en los niveles 1-2 ni entre transiciones.

**Flujo de derrota (`perder()`):**

1. Guardas: `if (perdido || resuelto) return;` (idempotente).
2. `perdido = true`, `enJuego = false`, `detenerReloj()`, `pulsoResaltado = null`, `render()`
   (el tablero queda **congelado** visible debajo del overlay).
3. **No** se guarda récord ni se avanza de nivel.
4. Overlay de fin reutilizado con clase `blocka-fin--perdido`: título "¡Se acabó el tiempo!"
   en `--alerta`, detalle en `#blocka-fin-detalle`, `#blocka-tiempo-final` = límite,
   botón "Reintentar".
5. "Reintentar" → `setupNivel()` **sin avanzar** de nivel (el guard del handler es
   `resuelto && !perdido`): nuevo sorteo de foto, mismo nivel, Ayudita disponible de nuevo.
6. `setupNivel()` limpia todo el estado de derrota (clase `--perdido`, detalle, avisos).

**Interacciones:**

- **Ayudita:** en contrarreloj la ayuda **suma margen**: como el reloj cuenta hacia atrás,
  `usarAyudita()` invierte el signo (`inicioMs += 5000`), lo que hace que el **restante crezca
  5 s**. En niveles sin límite mantiene la semántica histórica (`inicioMs -= 5000`: +5 s de
  penalización sobre el tiempo final). El semáforo se repinta en el siguiente `tick()`.
- **Victoria x tiempo:** si la Ayudita (o una rotación) completa el tablero justo antes de
  agotarse, `verificarVictoria()` manda a `ganar()`; el orden en `usarAyudita()` es
  `tick()` → `verificarVictoria()`, así que gana antes de que el siguiente tick vea 0.
- **`perdido` congela el input:** los handlers de `mousedown` y `usarAyudita()` chequean
  `enJuego`, que `perder()` pone en `false`.
- **`resolver()` (debug):** sigue funcionando sobre nivel con límite (fuerza `ganar()`).

**Constantes:** `UMBRAL_ADVERTENCIA_MS = 30000`, `UMBRAL_ALERTA_MS = 10000`,
`UMBRAL_PULSO_MS = 5000` (blocka.js). Ajustá los umbrales según la dificultad de prueba;
todo lo demás se adapta.

---

## 10. Ayudita (bombilla)

**Requerimiento:** si el nivel es difícil, el jugador puede usar la "Ayudita": el sistema ubica
correctamente una sub-imagen y la deja fija; a cambio suma 5 segundos al contador.

**UI:** botón `#blocka-ayudita` en el HUD, con la clase base `btn-primario` (se reutiliza el
mismo estilo/fuente del resto de los botones del sitio) + clase propia `blocka-ayudita` (solo
tamaño del icono y estados). El icono es un SVG inline de bombilla con `fill: currentColor`.

**Comportamiento (`usarAyudita()`, blocka.js:403):**

1. Guardas: solo si `enJuego && !resuelto && !ayudaUsada`.
2. Filtra las piezas **todavía rotadas** (`angulo % 360 !== 0`) y elige **una al azar**.
3. `p.angulo = 0` (queda correctamente ubicada) y `p.fija = true` (no se puede volver a girar).
4. Marca `ayudaUsada = true` y deshabilita el botón (**1 uso por nivel**).
5. Ajuste del reloj: **sin límite** `inicioMs -= 5000` + `tick()` → el cronómetro salta +5 s
   (penalización); **con límite** `inicioMs += 5000` → el restante crece 5 s (margen).
6. `animarPulsoResaltado(p)` → **aro de selección** en la celda de la pieza (ver abajo) y
   `verificarVictoria()` (si esa era la última pieza, gana igual).
7. Animación del botón: agrega la clase `blocka-ayudita--flash` (keyframes con `--primario`:
   glow + `scale`) y la quita en `animationend`.

### Resaltado de la pieza ayudada (dibujado en canvas)

Para que el jugador sepa **cuál** sub-imagen se resolvió, `render()` dibuja un aro sobre la
celda de cada pieza con `fija === true` (`dibujarResaltado()`, blocka.js:354):

- **Trazo:** el path va **centrado en el borde de la celda** (`ctx.roundRect(x, y, w, h, 10)`
  con fallback a `ctx.rect()` si no existe `roundRect`), `lineWidth = 4` → el aro queda 2 px
  sobre la imagen y 2 px afuera (sobre la celda vecina). En los bordes externos del canvas el
  trazo se recorta a la mitad: siempre queda visible.
- **Color/glow:** `COLOR_SELECCION` se lee una vez al arrancar de la variable CSS `--primario`
  (`getComputedStyle`, fallback `#FFB8F5`), con `shadowColor` + `shadowBlur = 8` para el glow —
  el mismo lenguaje visual que `.blocka-sorteo__thumb.ganador`.
- **Pulso (1.5 s):** `animarPulsoResaltado(p)` setea `pulsoResaltado = { pieza, inicio }` y
  corre un `requestAnimationFrame` que llama `render()`; `dibujarResaltado()` modula
  `lineWidth` (4→7) y `shadowBlur` (8→28) con una onda coseno **decayendo**
  (`(0.5 + 0.5·cos(t·4π))·(1−t)`), de modo que termina exactamente en el estado steady.
  El bucle se corta solo al terminar, al ganar o si la pieza ya no existe (cambio de nivel).
- **Limpieza:** `pulsoResaltado = null` en `setupNivel()` y en `ganar()`. Además `render()`
  en modo resuelto dibuja `fuente` completa y hace `return` antes del aro, así que al ganar
  no queda ningún rastro.
- **Por qué canvas y no un div:** el aro se dibuja en el **mismo espacio** que la pieza: no hay
  que mapear coordenadas CSS (`getBoundingClientRect`), ni observar resizes, ni crear/destruir
  nodos DOM. Un `ResizeObserver`/`resize` era necesario con la versión DOM; con canvas el
  escalado del canvas lo resuelve solo.

**Ciclo de vida del botón:**

| Momento | Estado |
|---|---|
| Al cargar / `setupNivel()` | `disabled = true` (y se limpia el flash); `ayudaUsada = false` |
| Apretar "Comenzar" | `disabled = false` |
| Tras usarla | `disabled = true` |
| Al ganar | `disabled = true` |
| Siguiente nivel (o nueva foto) | vuelve al inicio del ciclo |

**Constante:** `PENALIZACION_AYUDA_MS = 5000` (blocka.js:13). Cambiá ese número para ajustar la
penalización/margen (el signo del ajuste depende de si el nivel tiene límite, ver §9); todo el
resto se adapta solo.

**Por qué `inicioMs -= 5000` suma 5 s:** `tick()` calcula `Date.now() - inicioMs`; retroceder el
origen hace que la diferencia crezca 5000 ms sin tocar el `setInterval` ni el estado del juego.
Funciona igual con el reloj corriendo. **En niveles con tiempo máximo el signo se invierte**
(`inicioMs += 5000`): al ser cuenta regresiva, hacer crecer el origen hace que el restante
crezca 5000 ms — ver §9.

---

## 11. Qué se puede cambiar (puntos de configuración)

| Qué | Dónde | Efecto |
|---|---|---|
| Penalización de la Ayudita | `PENALIZACION_AYUDA_MS` | Segundos sumados por uso (en contrarreloj: margen extra). |
| Tiempo máximo por nivel | `CONFIG_NIVELES` | `limiteMs` base por nivel (`null` = sin límite). Nivel 3: 60000, nivel 4: 45000. |
| Bonificación por piezas | `FACTOR_PIEZAS` | Multiplica el límite base según 4/6/8 piezas (1 / 1.3 / 1.6). |
| Umbrales del semáforo | `UMBRAL_ADVERTENCIA_MS` / `UMBRAL_ALERTA_MS` / `UMBRAL_PULSO_MS` | Restante en ámbar (30 s), rojo (10 s), rojo pulsante (5 s). |
| Colores del semáforo y del overlay de derrota | variables `--advertencia` / `--alerta` en `global.css`; clases `.blocka-hud__tiempo--*`, `.blocka-fin--perdido` | Design tokens compartidos. |
| Color del aro de selección | variable CSS `--primario` (leída por `COLOR_SELECCION` al arrancar) | Color del trazo y del glow del aro. |
| Grosor/estado steady del aro | `dibujarResaltado()` → `lineWidth = 4 + 3·onda`, `shadowBlur = 8 + 20·onda` | En estado steady `onda = 0`. |
| Duración del pulso | `DURACION_PULSO_MS` | Milisegundos de la onda animada del aro. |
| Forma del aro | `dibujarResaltado()` → `ctx.roundRect(…, 10)` | Radio de esquina (fallback `rect()` si `roundRect` no existe). |
| Usos de la Ayudita por nivel | flag `ayudaUsada` + guard en `usarAyudita()` | Poner un contador (`ayudasRestantes = 2`) en vez de booleano. |
| Cantidad de niveles | `TOTAL_NIVELES` | Hasta dónde avanza "Siguiente nivel". |
| Filtros por nivel | `aplicarFiltroSegunNivel()` | Agregar/quitar casos. |
| Cantidades de piezas | `CONFIG_GRILLAS` + botones `data-piezas` del HTML + validación de `setPiezas()` en la API | Requiere tocar HTML **y** JS. |
| Ángulos de barajado | `ANGULOS_BARAJA` | Podés incluir `0` para que alguna pieza arranque bien. |
| Tamaño máximo del tablero | `LADO_MAX` | Escala todo (canvas y piezas). |
| Banco de imágenes | `BANCO_IMAGENES` + thumbs HTML (§7) | Fotos jugables. |
| Frecuencia del reloj | `setInterval(tick, 200)` | Suavidad vs. costo. |
| Textos de fin de nivel | `ganar()` | Títulos y labels de los botones. |
| Colores/animación de la bombilla | `css/blocka.css` (`.blocka-ayudita*`) | Usa las variables `--primario` / `--primarioSombra1` de `global.css`. |

### Checklist de "cambios seguros" (no rompen la lógica)

- Sumar fotos al banco, cambiar textos del HTML, ajustar CSS/variables de color.
- Cambiar constantes numéricas (`PENALIZACION_AYUDA_MS`, `ANGULOS_BARAJA`, `LADO_MAX`).
- Agregar filtros nuevos y sumarles un `case`.
- Agregar casos a `aplicarFiltroSegunNivel` o piezas a `CONFIG_GRILLAS` (con su botón en HTML).

### Cambios que requieren cuidado

- **Mover `btnComenzar.hidden = false`**: define el momento en que el tablero queda "listo";
  cualquier nuevo paso async debe ir antes y respetar el token `idSetup`.
- **Tocar `verificarVictoria`/`ganar`**: se llaman desde rotación y desde la Ayudita.
- **Cambiar el esquema de claves de `localStorage`**: mantener la lectura de la clave legada o
  migrar datos viejos.
- **Agregar interacción táctil**: hoy el juego usa `mousedown`/`button` de mouse ver §13.

---

## 12. API pública: `window.BlockaJuego`

Exponda métodos para consola, pruebas o integraciones:

| Método | Qué hace |
|---|---|
| `resolver()` | Pone todas las piezas en 0° y fuerza `ganar()` (si no estaba jugando, arranca el reloj en 0). Útil para pruebas. |
| `perder()` | Fuerza la derrota por tiempo (`perder()`): congela el tablero y muestra el overlay "¡Se acabó el tiempo!". Debug/pruebas. |
| `avanzarNivel()` | Siguiente nivel (al 4 vuelve al 1) + `setupNivel()`. |
| `irANivel(n)` | Salta a un nivel (1..TOTAL_NIVELES). |
| `setPiezas(cant)` | Cambia a 4/6/8 + `setupNivel()`. |
| `estado()` | Snapshot: `{ nivelActual, cantPiezas, enJuego, resuelto, perdido, limiteMs, restanteMs, angulos: number[], fijas: boolean[], tiempoMs }`. |

`estado()` expone `angulos` y `fijas` (flag de pieza ayudada/bloqueada), y en contrarreloj
`perdido`, `limiteMs` (límite efectivo) y `restanteMs` (`null` en niveles sin límite).
No expone las coordenadas de cada celda; si las necesitás para tests de render, calculalas como
`col = i % cols`, `fila = floor(i / cols)`, `x = col * ladoPieza` (ver `CONFIG_GRILLAS`).

---

## 13. Escalabilidad: qué saber para hacerlo crecer

### 13.1 Estructura de código

- **Hoy**: todo en un closure gigante dentro de `DOMContentLoaded`, sin módulos ni dependencias.
- **Escalar**: pasar a ES modules (`type="module"`) y separar responsabilidades:
  `state.js` (modelo), `setup.js` (tablero), `render.js` (dibujo), `input.js` (mouse/touch),
  `clock.js`, `records.js`, `help.js`. El HUD pasaría a "suscribirse" a cambios de estado en
  vez de ser manipulado desde diez lugares distintos.
- **Config data-driven**: mover `BANCO_IMAGENES`, `CONFIG_GRILLAS`, niveles/filtros y
  penalizaciones a un JSON (`config/blocka.json`). Agregar un nivel pasaría a ser sumar un objeto
  sin tocar código.
- Tipado: JSDoc con `// @ts-check` (ya hay algo) o migrar a TypeScript si el equipo lo conoce.

### 13.2 Render y animación

- **Hoy**: la rotación es un salto seco (`p.angulo = …; render()`).
- **Escalar**: interpolar el ángulo con `requestAnimationFrame` (tween de 150–200 ms) y disparar
  `verificarVictoria()` al terminar la animación. Requiere separar "estado" (ángulo lógico) de
  "presentación" (ángulo animado) — hoy están en el mismo número.
- Un loop único de `requestAnimationFrame` permitiría además animar el overlay de fin o el
  destello de la pieza fija.

### 13.3 Entrada (input)

- **Hoy**: solo mouse (`mousedown` + `event.button`), sin touch ni teclado.
- **Escalar**: usar **Pointer Events** (`pointerdown`, `event.button`) que unifican mouse,
  touch y stylus con el mismo código; para giro táctil conviene botones +/- o tap largo.
- Accesibilidad: el canvas es opaco para lectores de pantalla. Ideas: un `aria-live` que anuncie
  "pieza 3 de 4 correcta", navegación de piezas con teclado (flechas + Enter), y que la Ayudita
  tenga foco visible (hoy hereda el de `btn-primario`).

### 13.4 Rendimiento

- Los filtros corren en el hilo principal sobre `ImageData`; con 8 piezas de 105 px es rápido,
  pero si sube la resolución conviene: cachear las piezas ya filtradas (se regeneran en cada
  `setupNivel`), o mover filtros a un **Web Worker** con `OffscreenCanvas`.
- `render()` redibuja todas las piezas en cada clic; está bien para 8 piezas, pero si hay
  animación convendría redibujar solo la región sucia o usar un canvas por pieza en el DOM.

### 13.5 Persistencia

- Los récords son strings sueltos. Para escalar: un único objeto versionado
  (`{ v: 2, records: { "n1-p4": 42, … } }`) con una función de migración, o `IndexedStorage`
  si se guardan replays/estadísticas.
- Definir si el tiempo con Ayudita debe competir en la misma tabla que sin Ayudita (hoy sí:
  el +5s entra en el récord).

### 13.6 Pruebas

- No hay suite. Lo que ya se hizo sirve de plantilla: **smoke test con Chrome headless**
  (`--headless --virtual-time-budget --dump-dom`) sobre una copia de la página con asserts
  (ver §14).
- Para testear en serio, extraer funciones puras (`formatear`, `claveRecord`, `aplicarFiltroSegunNivel`,
  lógica de recorte) a un módulo sin DOM y testearlas con Node/Vitest.
- Cuidado conocido al testear: **servir por HTTP**, no `file://`. Bajo `file://` Chrome taintinga
  los canvas y `getImageData()` de los filtros lanza `SecurityError` → las piezas quedan vacías.

### 13.7 Contenido y localización

- Textos duros codificados en HTML y JS (es). Si hace falta i18n, centralizar cadenas en un
  objeto `STRINGS.es/…` y renderizar desde JS, o usar `data-i18n` + archivo de traducciones.

### 13.8 Deuda / riesgos conocidos

- `window.BlockaJuego.resolver()` manipula `inicioMs` directamente: si se llama antes de jugar
  arranca el reloj en 0; es una API de debug, no de producción.
- El overlay de sorteo y el de fin se apilan sobre el canvas con `z-index`; si agregás overlays,
  respetar esa escala (sorteo z-index 5).
- `btnsDificultad` se deshabilita con `btn.disabled = enJuego`; cualquier control nuevo del HUD
  debería seguir la misma regla (deshabilitado durante la partida y antes de Comenzar).
- Las cards de info ("Niveles y Filtros") listan 4 niveles a mano: si agregás un nivel, actualizar
  ese `<ul>` del HTML.

---

## 14. Cómo probarlo manualmente

1. Servir la carpeta por HTTP (no abrir el archivo con doble clic):
   `python -m http.server 8000` dentro de `2 entrega/`, y abrir
   `http://localhost:8000/blocka.html`.
2. Checklist rápido:
   - [ ] La bombilla aparece deshabilitada antes de "Comenzar".
   - [ ] Al apretar "Comenzar" se habilita y el reloj corre.
   - [ ] Clic en la bombilla: una pieza pasa a 0°, el cronómetro salta +5 s, la bombilla hace el
         flash rosa y queda deshabilitada.
   - [ ] La pieza ayudada se **resalta**: se dibuja en canvas un aro con esquinas redondeadas y
         glow del color primario **sobre el borde de la imagen** (pulso ~1.5 s y luego glow
         fijo; desaparece al ganar o al pasar de nivel).
   - [ ] Clics sobre la pieza fija **no** la giran.
   - [ ] Un segundo clic en la bombilla no hace nada (1 uso por nivel).
   - [ ] Al ganar, "Siguiente nivel" habilita la bombilla de nuevo (nuevo uso).
   - [ ] Si la bombilla completó el tablero, se dispara la victoria normalmente.
   - [ ] Cambiar 4/6/8 antes de Comenzar reinicia el tablero y resetea la bombilla.
   - [ ] El récord se guarda solo si mejora y respeta nivel + cantidad de piezas.
   - [ ] **Niveles 1 y 2**: no hay aviso de contrarreloj, ni badge "⏱ Límite", ni cuenta
         regresiva (el reloj cuenta hacia arriba como siempre).
   - [ ] **Nivel 3**: antes de "Comenzar" aparece el aviso "Nivel contrarreloj — 01:00" sobre
         el canvas; con 6 piezas el aviso/badge muestran 01:18 y con 8 piezas 01:36.
   - [ ] **Nivel 4**: aviso/badge muestran 00:45 (4 piezas), 00:58 (6), 01:12 (8).
   - [ ] Al apretar "Comenzar" el aviso desaparece y el badge queda; el reloj cuenta **hacia
         atrás** desde el límite.
   - [ ] Semáforo: ≤30 s el reloj se pone ámbar, ≤10 s rojo, ≤5 s rojo pulsante.
   - [ ] En el nivel 3, apretar la bombilla **sube** el tiempo restante 5 s (la ayuda premia).
   - [ ] Agotar el tiempo: se congela el tablero y aparece el overlay "¡Se acabó el tiempo!"
         con el tiempo límite y botón "Reintentar"; **no** se guarda récord ni se avanza de nivel.
   - [ ] "Reintentar" arma el mismo nivel con otra foto y la bombilla vuelve a estar disponible.
   - [ ] (a11y) Con lector de pantalla, el reloj anuncia "Tiempo restante…", los umbrales
         30/10/5 s se anuncian una sola vez cada uno, y la derrota se anuncia al aparecer.

### Smoke test automatizado (referencia)

Se creó una copia temporal de `blocka.html` con un bloque de asserts que se ejecuta en Chrome
headless (`--headless=new --virtual-time-budget=120000 --dump-dom`) servida por HTTP. El aro se
verifica **leyendo píxeles del canvas** (`getImageData` sobre los bordes de la celda fija, con
tolerancia ±12 por canal contra `rgb(255, 184, 245)`), y el flujo contrarreloj usa
`BlockaJuego.irANivel()` / `setPiezas()` / `perder()`:

```
SMOKE OK (38/38)
PASS bombilla deshabilitada antes de comenzar
PASS bombilla habilitada al comenzar
PASS hay 4 piezas barajadas [90,180,270,270]
PASS nivel 1 sin tiempo maximo [limiteMs=null]
PASS nivel 1 sin aviso ni badge de limite
PASS ayudita fija exactamente una pieza [true,false,false,false]
PASS suma 5 segundos al reloj [dt=5000]
PASS bombilla deshabilitada tras usarse
PASS animacion de iluminado aplicada
PASS estado() expone fijas [true,false,false,false]
PASS solo un uso por nivel [dt2=0]
PASS sin div .blocka-resaltado en el DOM
PASS aro sobre los 4 bordes de la celda fija [true,true,true,true]
PASS el aro no pinta adentro de la celda [[24,19,24],[24,19,24]]
PASS celda sin ayuda no tiene aro (diagonal) [false,false,false,false]
PASS pieza fija no rota con clics [angulo=0]
PASS resolver() deja el estado resuelto
PASS aro eliminado al resolverse la imagen [false,false,false,false]
PASS nivel 3 tiene limite 60s [limiteMs=60000 restanteMs=60000]
PASS aviso previo visible con 01:00 [01:00]
PASS badge de limite visible con 01:00
PASS reloj muestra el limite completo antes de comenzar
PASS reloj con role=timer y region a11y presente
PASS bonificacion 6 piezas = 78s [limiteMs=78000]
PASS nivel 4 con 8 piezas = 72s [limiteMs=72000]
PASS nivel 4 con 4 piezas = 45s [limiteMs=45000]
PASS al comenzar se oculta el aviso y queda el badge
PASS bombilla habilitada en nivel contrarreloj
PASS ayudita suma 5s de margen en contrarreloj [delta=5000]
PASS perder() congela el nivel sin resolverlo
PASS overlay de derrota con titulo y clase --perdido
PASS boton Reintentar y detalle visibles
PASS Reintentar reinicia el mismo nivel sin limite de piezas raras
PASS tras reintentar vuelve el aviso previo y la bombilla deshabilitada
PASS nivel 1 limpia las clases del semaforo del nivel anterior
PASS nivel 1 muestra 00:00 sin aviso ni badge [00:00]
PASS nivel 3 en pre-partida arranca sin clases de semaforo
PASS nivel 3 pre-partida muestra 01:00 [01:00]
```

Notas del entorno de test:

- El aro se verifica por píxeles en el **estado steady**: el pulso (`requestAnimationFrame`)
  no avanza de forma predecible bajo `--virtual-time-budget`, así que el test valida el borde
  persistente (lo que el jugador ve el 99 % del tiempo) y la ausencia de aro en celdas sin
  ayuda, adentro de la celda y tras `resolver()`.
- El muestreo usa offsets de ±2 px alrededor del borde para cubrir tanto `lineWidth = 4`
  (steady) como `7` (pulso), y samplea a ~30 % del lado para esquivar las esquinas redondeadas.
- `getImageData` exige **servir por HTTP** (bajo `file://` los canvas quedan tainteados).
- El archivo temporal se elimina después de cada corrida; conviene versionarlo como
  `specs/smoke-test.html` si se quiere automatizar en CI.

---

## 15. Resumen para la defensa

1. **Un solo archivo de lógica** (`blocka.js`) con estado en closure y `filtros.js` desacoplado.
2. **Setup async con token anti-carreras** (`idSetup`) y sorteo animado previo.
3. **Piezas cuadradas** para que rotar 90° no rompa la grilla; recorte central proporcional.
4. **Filtros por `ImageData`** aplicados una vez al crear cada pieza.
5. **Reloj derivado de `inicioMs`**, lo que hace trivial pausarlo y penalizar +5 s.
6. **Ayudita**: 1 uso por nivel, fija una pieza al azar (`fija = true`), +5 s, flash del botón y
   **aro de selección dibujado en canvas** sobre la celda (pulso 1.5 s con `requestAnimationFrame`
   y glow persistente en el color primario leído de `--primario`); no toca el flujo principal
   (solo agrega un guard en `rotar()`).
7. **Niveles contrarreloj** (3 y 4) con config data-driven (`CONFIG_NIVELES` + `FACTOR_PIEZAS`),
   cuenta regresiva y **semáforo de urgencia gradual** (ámbar 30 s / rojo 10 s / pulso 5 s),
   avisos redundantes (aviso previo + badge persistente + a11y `aria-live`) y derrota con
   reintentar sin avanzar de nivel. La Ayudita suma margen en lugar de penalizar.
8. **Récords por nivel y piezas** en `localStorage` con migración de clave legada.
9. Próximos pasos de escalabilidad: módulos, config en JSON, animación con `rAF`, Pointer
   Events y test suite con smoke test headless.
