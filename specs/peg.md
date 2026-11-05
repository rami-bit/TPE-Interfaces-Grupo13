# Peg Solitaire — Documentación Técnica

Juego de Peg Solitaire con temática Boca Juniors. El tablero y las fichas se dibujan sobre un `<canvas>` HTML5 usando imágenes reales. Este documento describe la arquitectura e implementación **completa** del juego: carga del canvas, menú previo de selección de ficha, generación de fichas con la imagen elegida, herencia POO con Template Method, drag & drop, pistas animadas, captura con rebote, temporizador regresivo y detección de fin de partida.

---

## 1. Carga del canvas

### Orden de scripts

En `2 entrega/game.html` los scripts se cargan al final del `<body>`, en este orden:

```html
<script src="js/header.js"></script>
<script src="js/imagenesTapitas.js"></script>      <!-- IMG_TAPITAS[] -->
<script src="js/ElementoJuego.js"></script>        <!-- clase base (Template Method) -->
<script src="js/FichaTapita.js"></script>          <!-- subclase circular -->
<script src="js/juego.js"></script>                <!-- lógica principal -->
```

La clase debe definirse antes de `juego.js` porque `initTablero()` instancia `FichaTapita`.

### Inicialización y Precarga

`precargarTodo()` es `async` y resuelve en cadena:

1. Carga `img/tablero.jpeg` con una `Promise` (`new Image()` + `onload`/`onerror`).
2. Fija la **resolución interna** del canvas al recorte visible:
   ```js
   canvas.width  = CROP.w;   // 1600
   canvas.height = CROP.h;   // 1150
   ```
3. Precarga en paralelo con `Promise.all` la cantera de tapitas (`IMG_TAPITAS`).

La promesa de precarga se guarda en `precargaPromesa` y **no** inicializa el tablero: el arranque ocurre recién cuando el jugador elige una ficha en el menú previo y presiona **Jugar** (`iniciarPartida()`):

```js
precargaPromesa.then(() => {
    ocultarMenu();
    resetearTimer();
    initTablero();
    drawFigures();
}).catch(err => console.error(err));
```

### Menú previo de selección de ficha

Antes de cargar el tablero se muestra el overlay `#peg-menu` (estética Boca: azul/oro, reutilizando `.peg-overlay` y `.peg-modal`). `construirMenuFichas()` genera desde `IMG_TAPITAS` un par `input[type=radio]` + `label` circular por tapita, de modo que la selección y la navegación por teclado son nativas. La ficha elegida se guarda en `imgFichaElegida` y **todas** las fichas de la partida usan esa única imagen (no hay elección aleatoria). El botón ↻ de la barra y "Jugar de nuevo" del modal reinician con la misma ficha.

### Recorte visible (`CROP`) y Regla de Coordenadas

La imagen original mide **2400×1792**, por lo que se recorta la zona útil del tablero con un encuadre apaisado que incluye estadio a los costados (`CROP = { x: 403, y: 280, w: 1600, h: 1150 }`). Ese encuadre hace que, al ocupar el 100% del ancho de su contenedor, el canvas tenga menor altura y el juego entre sin scroll.

Todo el juego trabaja en **píxeles internos del canvas** (espacio 1600×1150). Los eventos del mouse llegan en píxeles CSS del viewport y se convierten mediante una única función centralizada `obtenerPosicionMouse(e)`:

```js
function obtenerPosicionMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}
```

---

## 2. Carga automática de fichas y Matriz Numérica

### Matriz lógica del tablero (`TABLERO_BASE`)

`TABLERO_BASE` es una matriz numérica 7×7 (`TAM_TABLERO = TABLERO_BASE.length`) que reproduce la cruz inglesa estándar:

```js
const TABLERO_BASE = [
    [-1, -1,  1,  1,  1, -1, -1],
    [-1, -1,  1,  1,  1, -1, -1],
    [ 1,  1,  1,  1,  1,  1,  1],
    [ 1,  1,  1,  0,  1,  1,  1],
    [ 1,  1,  1,  1,  1,  1,  1],
    [-1, -1,  1,  1,  1, -1, -1],
    [-1, -1,  1,  1,  1, -1, -1]
];
```

Valores en tiempo de ejecución dentro de `tablero[row][col]`:
- **`ficha` (`ElementoJuego`)** → Casilla ocupada por una ficha activa (donde `TABLERO_BASE` tenía `1`).
- **`0`** → Casilla jugable vacía (al inicio, solo el centro `(3, 3)`).
- **`-1`** → Esquina fuera del tablero (no jugable).

### Creación centralizada (`colocarFichaEnCelda`)

Para evitar duplicar código entre `initTablero()` y las funciones de prueba, el posicionamiento de cada pieza se delega a `colocarFichaEnCelda(row, col)`:

```js
function colocarFichaEnCelda(row, col) {
    const center = getCellCenter(row, col);
    const ficha = crearFicha(center.x, center.y);
    ficha.row = row;
    ficha.col = col;
    tablero[row][col] = ficha;
    figuras.push(ficha);
    return ficha;
}
```

---

## 3. Jerarquía POO y Patrón Template Method

```
                       ┌────────────────────────────────────┐
                       │           ElementoJuego            │
                       ├────────────────────────────────────┤
                       │ - posX, posY: number               │
                       │ - fill: HTMLImageElement           │
                       │ - resaltado: boolean               │
                       │ - resaltadoStyle: string           │
                       │ - context: CanvasRenderingContext2D│
                       ├────────────────────────────────────┤
                       │ + getPosx() / getPosY() / getPos() │
                       │ + setPos(x, y)                     │
                       │ + getResaltado() / setResaltado()  │
                       │ + definirPath()        (abstracto) │
                       │ + dibujarImagenEnClip(ancho, alto) │
                       └─────────────────┬──────────────────┘
                                         │ hereda
                               ┌─────────▼──────────┐
                               │    FichaTapita     │
                               ├────────────────────┤
                               │ - radius: number   │
                               ├────────────────────┤
                               │ + definirPath()    │  arc (círculo)
                               │ + draw()           │  usa dibujarImagenEnClip
                               │ + isPointInside()  │  distancia ≤ radio
                               └────────────────────┘
```

* **`ElementoJuego.dibujarImagenEnClip(ancho, alto)`** centraliza el ciclo `save()` → `beginPath()` → `this.definirPath()` → `clip()` → `drawImage(...)` → `restore()` y el dibujado del contorno de selección cuando `this.resaltado === true`.
* La subclase solo define su geometría en `definirPath()` y su colisión en `isPointInside(x, y)`, haciendo trivial agregar nuevas formas de fichas sin duplicar código de Canvas.

---

## 4. Drag & Drop, Pistas Animadas y Captura

1. **`onMouseDown`**:
   - Convierte coordenadas con `obtenerPosicionMouse(e)` y busca la ficha superior con `findClickedFigure`.
   - Mueve la ficha al final de `figuras[]` para que se dibuje por encima del resto durante el arrastre.
   - Calcula **una única vez** `destinosValidosActivos = obtenerMovimientosValidos(clickFig)` y arranca el loop `iniciarAnimacionHints()` con `requestAnimationFrame` (onda expansiva, pulso dorado y flecha oscilante).
2. **`onMouseMove`**:
   - Actualiza la posición de `lastClickedFigure` usando `obtenerPosicionMouse(e)` y redibuja.
3. **`onMouseUp`**:
   - Reutiliza `destinosValidosActivos` para medir la distancia euclidiana del cursor a cada destino permitido.
   - Si cae dentro de `FICHA_RADIO`: aplica **snap-to-grid**, actualiza `tablero`, quita la ficha comida de `figuras[]`, dispara `animacionEliminarFicha()` (efecto pop elástico de 1.0 a 1.32 y contracción ease-out `*= 0.88`) y llama a `verificarFinDelJuego()`.
   - Si no coincide con ningún destino válido (o se suelta fuera del canvas): aplica **snap-back** a `lastClickedPos` en un único bloque unificado.

---

## 5. Temporizador, Fin de Partida y Reinicio

* **Detección de Fin de Juego (`verificarFinDelJuego`)**:
  - **Victoria**: Queda exactamente `1` ficha (`figuras.length === 1`).
  - **Derrota**: `hayMovimientosPosiblesEnTablero()` recorre `figuras[]` con un bucle `while` que corta apenas `puedeRealizarMovimiento(figuras[i])` devuelve `true`. Si termina el `while` sin hallar saltos, declara derrota.
* **Temporizador Regresivo (`iniciarTimer`, `resetearTimer`, `detenerTimer`)**:
  - Cuenta regresiva de 5 minutos (`300` segundos) en `#peg-timer-display`.
  - Cuando quedan 30 segundos o menos, activa la clase `.peg-timer--peligro` (alerta roja pulsante).
  - Si llega a `0`, detiene la partida y abre el modal de derrota por tiempo.
* **Reinicio (`reiniciarJuego`)**:
  - Invocable en cualquier momento desde el botón `↻` de la barra (`#peg-btn-reiniciar-barra`), desde el botón del modal (`#peg-btn-reiniciar-modal`) o por consola (`window.reiniciarJuego()`).
* **Funciones de prueba rápida en consola**:
  - `window.debugCasiGanar()`: Deja 2 fichas listas para ganar en un solo salto al centro.
  - `window.debugDerrota()`: Deja 3 fichas aisladas y dispara el cartel de derrota.
