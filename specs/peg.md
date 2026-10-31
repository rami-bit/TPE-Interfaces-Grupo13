# Peg Solitaire — Documentación Técnica

Juego de Peg Solitaire con temática Boca Juniors. El tablero y las fichas se dibujan sobre un `<canvas>` HTML5 usando imágenes reales. Este documento describe el estado **actual implementado**: carga del canvas, generación automática de fichas y drag & drop.

---

## 1. Carga del canvas

### Orden de scripts

En `2 entrega/game.html` los scripts se cargan al final del `<body>`, en este orden:

```html
<script src="js/header.js"></script>
<script src="js/imagenesTapitas.js"></script>      <!-- IMG_TAPITAS[] -->
<script src="js/imagenesCamisetas.js"></script>    <!-- IMG_CAMISETAS[] -->
<script src="js/ElementoJuego.js"></script>        <!-- clase base -->
<script src="js/FichaTapita.js"></script>          <!-- subclase -->
<script src="js/FichaCamiseta.js"></script>        <!-- subclase -->
<script src="js/juego.js"></script>                <!-- lógica principal -->
```

Las clases deben definirse antes de `juego.js` porque `initTablero()` instancia `FichaTapita` y `FichaCamiseta`.

### Inicialización

`juego.js` espera `DOMContentLoaded`, obtiene el canvas y su contexto 2D:

```js
const canvas = document.getElementById('peg-solitaire-canvas');
if (!canvas) return;
const ctx = canvas.getContext('2d');
```

### Precarga de imágenes

`precargarTodo()` es `async` y resuelve en cadena:

1. Carga `img/tablero.jpeg` con una `Promise` (`new Image()` + `onload`/`onerror`).
2. Fija la **resolución interna** del canvas al recorte visible:
   ```js
   canvas.width  = CROP.w;   // 1100
   canvas.height = CROP.h;   // 1150
   ```
3. Precarga en paralelo con `Promise.all` las tapitas (`IMG_TAPITAS`) y camisetas (`IMG_CAMISETAS`).

Recién cuando todo resolvió se ejecuta `initTablero()` y `drawFigures()`:

```js
precargarTodo()
    .then(() => { initTablero(); drawFigures(); })
    .catch(err => console.error(err));
```

### Recorte visible (`CROP`)

La imagen original mide **2400×1792**, pero el tablero ocupa solo ~41% del ancho y ~58% del alto; el resto es fondo decorativo (tribuna, brush strokes). Para que las fichas no se vean chicas se recorta la zona útil y se usa como resolución interna:

```js
const CROP = { x: 650, y: 290, w: 1100, h: 1150 };
```

El fondo se dibuja tomando el sub-rectángulo de origen y escalándolo al bitmap interno:

```js
ctx.drawImage(
    imgTablero,
    CROP.x, CROP.y, CROP.w, CROP.h,   // rectángulo fuente
    0, 0, CROP.w, CROP.h              // destino = todo el canvas
);
```

### Resolución interna vs. visualización

| Concepto | Valor | Quién lo controla |
|---|---|---|
| Resolución interna | `canvas.width/height` = 1100×1150 | `precargarTodo()` |
| Tamaño en pantalla | CSS `width` / `height:auto` | `game.css` |

Regla: **nunca** cambiar `canvas.width/height` para agrandar en pantalla. El bitmap interno define el espacio de coordenadas; el CSS solo escala. Como `height:auto` y la proporción CSS coinciden con `CROP`, no hay distorsión.

CSS relevante (`game.css`):

```css
.juego-card--peg { width: min(950px, 100%); }

.peg-solitaire-canvas {
    width: min(100%, calc(85vh * 1100 / 1150));
    height: auto;
}
```

El `85vh` es el presupuesto de alto para 1080p sin scroll (header + migas + barra inferior dejan ~920 px). La proporción `1100/1150` es la del recorte.

### Regla de coordenadas

Todo el juego trabaja en **píxeles internos del canvas** (espacio 1100×1150). Los eventos del mouse llegan en píxeles CSS, por eso siempre se escalan:

```js
const rect = canvas.getBoundingClientRect();
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;

// mousedown (offsetX/offsetY son relativos al canvas)
const canvasX = e.offsetX * scaleX;
const canvasY = e.offsetY * scaleY;

// mousemove / mouseup (clientX/clientY son del viewport)
const canvasX = (e.clientX - rect.left) * scaleX;
const canvasY = (e.clientY - rect.top) * scaleY;
```

Si se omite el escalado, el click no coincide con las fichas.

---

## 2. Carga automática de fichas

### Matriz lógica del tablero

`TABLERO_BASE` es una matriz 7×7 que reproduce el cruz inglés estándar:

```
Col:    0    1    2    3    4    5    6
Fila 0:  —    —   [X]  [X]  [X]   —    —
Fila 1:  —    —   [X]  [X]  [X]   —    —
Fila 2: [X]  [X]  [X]  [X]  [X]  [X]  [X]
Fila 3: [X]  [X]  [X]  [ ]  [X]  [X]  [X]   ← centro vacío
Fila 4: [X]  [X]  [X]  [X]  [X]  [X]  [X]
Fila 5:  —    —   [X]  [X]  [X]   —    —
Fila 6:  —    —   [X]  [X]  [X]   —    —
```

Valores posibles:
- `true` → posición jugable (recibe ficha al inicio).
- `false` → posición jugable vacía al inicio (solo el centro `(3,3)`).
- `null` → fuera del tablero.

Hay **33 posiciones jugables**; con el centro vacío se generan **32 fichas**.

### Mapeo índice → píxel

El espaciado de los agujeros **no es uniforme** en la imagen, por eso no se usa una fórmula lineal (daba errores de hasta 12 px). Se guardan centros exactos por columna y fila:

```js
const COL_X = [796, 931, 1058, 1202, 1346, 1475, 1610];
const ROW_Y = [405, 554, 707, 854, 1002, 1151, 1305];

function getCellCenter(row, col) {
    return { x: COL_X[col] - CROP.x, y: ROW_Y[row] - CROP.y };
}
```

`getCellCenter` descuenta el origen del recorte para devolver coordenadas del bitmap interno.

### Generación

`initTablero()` recorre la matriz y, por cada `true`, crea una ficha aleatoria:

```js
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
```

Cada ficha se asigna aleatoriamente:
- `Math.random() < 0.5` → `FichaTapita` (círculo, radio 45) con una imagen al azar de `IMG_TAPITAS`.
- Si no → `FichaCamiseta` (rectángulo 90×90) con una imagen al azar de `IMG_CAMISETAS`.

El tipo e imagen se fijan una sola vez al inicio y no cambian durante la partida.

### Render

```js
function drawFigures() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgTablero, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, CROP.w, CROP.h);
    figuras.forEach(f => f.draw());
}
```

Se redibuja todo el canvas en cada cambio: fondo recortado + todas las fichas de `figuras[]`.

---

## 3. Drag & Drop

### Estado

```js
let isMouseDown = false;
let lastClickedFigure = null;   // ficha que se está arrastrando
let lastClickedPos = null;      // { x, y } original para snap-back
```

### `onMouseDown` (en el canvas)

1. Marca `isMouseDown = true` y limpia el resaltado anterior.
2. Escala las coordenadas del click a píxeles internos.
3. `findClickedFigure(x, y)` recorre `figuras[]` en orden inverso (la última dibujada queda arriba) y devuelve la primera que contiene el punto.
4. Si hay ficha: `setResaltado(true)`, se guarda en `lastClickedFigure` y su posición en `lastClickedPos`.
5. Redibuja.

### `onMouseMove` (en `document`)

Solo actúa si hay arrastre activo. Escala las coordenadas, mueve la ficha con `setPos(x, y)` y redibuja. Se escucha en `document` para que el arrastre no se corte al salir del canvas.

### `onMouseUp` (en `document`)

- Corta el arrastre (`isMouseDown = false`).
- Si el puntero quedó fuera del canvas → **snap-back** a `lastClickedPos`.
- **Estado actual:** si quedó dentro, también hace snap-back. La validación de saltos y la eliminación de la ficha comida están pendientes (ver sección 5).

### Detección de impacto

Cada ficha implementa `isPointInside(x, y)`:
- `FichaTapita`: distancia euclidiana ≤ `radius`.
- `FichaCamiseta`: bounding box centrado en `(posX, posY)`.

---

## 4. Diagrama de objetos

```
                       ┌──────────────────────────────┐
                       │        ElementoJuego         │
                       ├──────────────────────────────┤
                       │ - posX: number               │
                       │ - posY: number               │
                       │ - fill: HTMLImageElement     │
                       │ - resaltado: boolean         │
                       │ - resaltadoStyle: string     │
                       │ - context: CanvasRenderingContext2D │
                       ├──────────────────────────────┤
                       │ + getPosx() / getPosY()      │
                       │ + getPos()                   │
                       │ + setPos(x, y)               │
                       │ + getFill() / setFill()      │
                       │ + getResaltado() / setResaltado() │
                       │ + definirPath()   (abstracto)│
                       │ + dibujarImagenEnClip()      │
                       └──────────────┬───────────────┘
                                      │ hereda
                 ┌────────────────────┴────────────────────┐
                 │                                         │
        ┌────────▼─────────┐                     ┌─────────▼────────┐
        │   FichaTapita    │                     │  FichaCamiseta   │
        ├──────────────────┤                     ├──────────────────┤
        │ - radius: number │                     │ - ancho: number  │
        ├──────────────────┤                     │ - alto: number   │
        │ + definirPath()  │  círculo            ├──────────────────┤
        │ + draw()         │                     │ + definirPath()  │ rectángulo
        │ + isPointInside()│  distancia ≤ radio  │ + draw()         │
        └──────────────────┘                     │ + isPointInside()│ bounding box
                                                 └──────────────────┘

Estructuras en juego.js
───────────────────────
tablero : Array<Array<ElementoJuego | null>>   // 7×7, estado lógico
figuras : Array<ElementoJuego>                  // todas las fichas dibujables
TABLERO_BASE : Array<Array<true | false | null>>// plantilla estática
COL_X, ROW_Y : number[7]                         // mapeo índice → píxel
CROP : { x, y, w, h }                            // recorte visible
```

Flujo de una ficha:

```
IMG_TAPITAS / IMG_CAMISETAS
        │  precargarTodo()
        ▼
   HTMLImageElement
        │  crearFichaAleatoria() / initTablero()
        ▼
ElementoJuego (FichaTapita | FichaCamiseta)
        │  se guarda en tablero[row][col] y en figuras[]
        ▼
   drawFigures() → ficha.draw() → clip + drawImage
```

---

## 5. TODOs — Pendientes

> Esta sección lista lo que falta y **la mejor práctica para encararlo**, sin implementar la solución.

### 5.1 Comer ficha / validar movimiento (IMPLEMENTADO - Ver specs/logica_movimientos.md)

**Falta:** en `onMouseUp`, decidir si el arrastre es un salto válido y aplicarlo.

**Mejor práctica:**
- Separar la **regla** del **evento**: una función pura `esSaltoValido(origen, destino)` que consulte `TABLERO_BASE` y `tablero`, sin tocar el DOM ni el canvas.
- Guardar `row`/`col` en cada ficha al crearla. Así el origen se obtiene directo y no se reconstruye desde el píxel.
- Resolver el destino buscando la celda jugable más cercana al punto de soltado (distancia euclidiana sobre `getCellCenter`), con un umbral para no aceptar drops lejanos.
- Validar: destino dentro del tablero, destino vacío, exactamente dos celdas en línea recta (horizontal/vertical), ficha intermedia presente.
- Aplicar los cambios de forma atómica y centralizada: mover en `tablero`, quitar la comida de `tablero` y `figuras`, hacer `setPos` al centro exacto y redibujar.
- Feedback: resaltar destinos válidos al `mousedown` o cambiar el cursor; invalidar siempre con snap-back, nunca dejar la ficha a mitad de camino.

### 5.2 Lógica del juego / estado de partida

**Falta:** un modelo de estado que distinga inicio, jugando, victoria y derrota.

**Mejor práctica:**
- Modelar la partida con una **máquina de estados** explícita (`inicio`, `jugando`, `victoria`, `derrota`, `timeout`) y una única función que cambie de estado y dispare la UI.
- Mantener la lógica de reglas en un módulo/funciones independientes del render, para poder testearla sin navegador.
- Derivar la UI (HUD, overlays, botones) del estado, no al revés.
- Evitar lógica de victoria/derrota dispersa en los handlers: evaluar el estado **después** de cada movimiento válido, en un único punto.

### 5.3 Hint animado

**Falta:** indicar visualmente los destinos válidos de una ficha.

**Mejor práctica:**
- Calcular los movimientos válidos con la misma función de reglas de 5.1 (una sola fuente de verdad).
- Mantener los hints como una **capa de presentación separada** del estado del tablero: una lista de celdas a resaltar que se dibuja después del fondo y antes/junto a las fichas.
- Animar con `requestAnimationFrame` y un timestamp, no con `setInterval`, para que sea fluido y cancelable.
- Cancelar el loop al soltar/seleccionar otra ficha para no dejar animaciones huérfanas.
- Accesibilidad: además del color, usar forma o pulso; no depender solo del tono.

### 5.4 Tiempo límite (3:00 recomendado)

**Falta:** cronómetro de partida con límite.

**Mejor práctica:**
- Usar una marca de tiempo de inicio y calcular el restante por diferencia (`Date.now()`), no acumular con `setInterval` (que deriva y se pausa en segundo plano).
- Un solo `requestAnimationFrame` o intervalo que actualice el HUD y, al llegar a 0, dispare el estado `timeout` de la máquina de 5.2.
- Pausar/reanudar ajustando la marca de inicio, no el contador.
- Mostrar alerta visual en los últimos segundos (color/pulso) y detener el cronómetro al ganar o perder.

### 5.5 Sin movimientos (derrota) y victoria

**Falta:** detectar fin de partida por bloqueo o por quedar 1 ficha.

**Mejor práctica:**
- Una función `hayMovimientos()` que recorra las fichas y las 4 direcciones usando `esSaltoValido`; reutilizarla tanto para el chequeo de derrota como para hints.
- Evaluarla solo después de un movimiento válido (no en cada `mousemove`).
- Victoria: 1 ficha restante (idealmente en el centro). Definir la condición en un solo lugar.
- Orden de evaluación: primero victoria, luego derrota, luego tiempo, para que un empate técnico tenga regla clara.
- No optimizar prematuramente: 49 celdas × 4 direcciones es despreciable.

### 5.6 Fondos blancos de las tapitas

**Falta:** las imágenes de `img/peg/tapitas/` tienen fondo blanco visible en los bordes del clip circular.

**Mejor práctica:** procesar los PNG una sola vez (transparencia real) en lugar de resolverlo por código; mantiene el render simple y el asset reutilizable.

---

## 6. Cómo ejecutar

Abrir `2 entrega/game.html` en un navegador. Las imágenes se precargan y el tablero se dibuja con 32 fichas aleatorias y el centro vacío. Para recalibrar la alineación con los agujeros de la imagen, ajustar `COL_X`, `ROW_Y` y `CROP` en `juego.js`; si cambia la proporción del recorte, actualizar también el `calc(...)` de `.peg-solitaire-canvas` en `game.css`.
