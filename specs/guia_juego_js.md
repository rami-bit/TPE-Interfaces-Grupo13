# Guía didáctica de `juego.js`

Cómo se cargan las fichas, para qué sirven `COL_X` y `ROW_Y`, y cómo funciona "comer" en el Peg Solitaire de Boca Juniors.

Esta guía está pensada para leerla con el código al lado. Explica el **porqué** de cada decisión, con ejemplos numéricos y diagramas. Para la versión formal y compacta de la lógica, ver [`logica_movimientos.md`](./logica_movimientos.md).

---

## 1. Mapa general

### 1.1 Archivos y orden de carga

En `game.html` los scripts se cargan en este orden:

```html
<script src="js/imagenesTapitas.js"></script>
<script src="js/ElementoJuego.js"></script>
<script src="js/FichaTapita.js"></script>
<script src="js/juego.js"></script>
```

Como son scripts clásicos, comparten el scope global y se ejecutan en orden. Cuando `juego.js` arranca, ya existen `IMG_TAPITAS`, `ElementoJuego` y `FichaTapita`.

| Archivo | Qué aporta |
| :--- | :--- |
| `imagenesTapitas.js` | `IMG_TAPITAS`: las rutas de las 4 tapitas disponibles. |
| `ElementoJuego.js` | Clase base: posición (`posX`, `posY`), imagen (`fill`), resaltado y el dibujo con recorte (`dibujarImagenEnClip`). |
| `FichaTapita.js` | Subclase circular: define el path del círculo, lo dibuja y detecta si un punto cae adentro (`isPointInside`). |
| `juego.js` | Todo lo demás: estado del tablero, reglas, render, menú, temporizador y funciones de debug. |

### 1.2 Los tres espacios de coordenadas

Casi toda la confusión con `COL_X` y `ROW_Y` viene de mezclar estos tres espacios:

| Espacio | Medidas | Quién lo usa |
| :--- | :--- | :--- |
| Imagen original (`tablero.jpeg`) | 2400 × 1792 px | `COL_X`, `ROW_Y`, `CROP` |
| Bitmap interno del canvas | 1600 × 1150 px | `getCellCenter`, todo el dibujo |
| Tamaño en pantalla (CSS) | Variable, responsivo | Eventos del mouse |

La cadena de conversión es:

```
tablero[row][col]                    ← índices lógicos (0..6)
      │  COL_X[col], ROW_Y[row]
      ▼
centro del agujero en la imagen      ← ej. (1202, 854)
      │  restar CROP.x y CROP.y
      ▼
centro del agujero en el canvas      ← ej. (799, 574)
      │  el CSS agranda o achica el canvas
      ▼
centro del agujero en pantalla       ← variable
```

Y al revés, para el mouse:

```
clientX / clientY
      │  restar rect.left / rect.top
      │  multiplicar canvas.width / rect.width
      ▼
coordenada interna del canvas
```

Esa conversión inversa la hace `obtenerPosicionMouse`, y es necesaria porque el canvas se muestra con un tamaño distinto al de su bitmap.

---

## 2. Cómo se cargan las fichas

### 2.1 Paso 0: las rutas

`imagenesTapitas.js` solo declara un arreglo de strings:

```javascript
const IMG_TAPITAS = [
    'img/peg/tapitas/tapitaRiquelme.png',
    'img/peg/tapitas/tapitaMerentiel.png',
    'img/peg/tapitas/tapitaEscudo.png',
    'img/peg/tapitas/tapitaBombonera.png'
];
```

El **índice** de cada ruta es la identidad de la tapita. Ese índice es lo que se guarda en `indiceFichaElegida`.

### 2.2 Paso 1: precarga asíncrona

Las imágenes no se pueden dibujar hasta que el navegador las terminó de descargar. Por eso se envuelve la carga en una Promesa:

```javascript
function cargarImagen(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo cargar ' + src));
        img.src = src;
    });
}
```

Después, `precargarTodo()` espera a que estén **todas**:

```javascript
async function precargarTodo() {
    imgTablero = await cargarImagen('img/tablero.jpeg');
    canvas.width = CROP.w;      // 1600
    canvas.height = CROP.h;     // 1150

    imgTapitas = await Promise.all(IMG_TAPITAS.map(cargarImagen));
}
```

Puntos importantes:

- El tamaño lógico del canvas se fija acá, y coincide con los atributos `width`/`height` del HTML.
- `Promise.all` conserva el orden del arreglo: `imgTapitas[0]` siempre es Riquelme, etc.
- Al final del archivo se dispara la carga y recién cuando termina se dibuja:

```javascript
precargarTodo().then(() => {
    drawFigures();
}).catch(err => {
    console.error(err);
});
```

Si una imagen falla, se rechaza la promesa, el error se ve en consola y el canvas no se dibuja (el menú puede seguir mostrando las miniaturas, porque el navegador las carga por su cuenta).

### 2.3 Paso 2: elegir la tapita en el menú

`construirMenuFichas()` arma la grilla del menú previo dinámicamente:

```javascript
IMG_TAPITAS.forEach((src, i) => {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'peg-ficha';
    radio.value = String(i);
    radio.checked = i === indiceFichaElegida;
    radio.addEventListener('change', () => {
        if (radio.checked) indiceFichaElegida = i;
    });
    // ... label + img + nombre ...
});
```

- El `name` compartido hace que los radios sean mutuamente excluyentes.
- La variable global `indiceFichaElegida` es el único estado de la elección.
- `nombreFicha()` deriva el texto visible de la ruta: `'img/peg/tapitas/tapitaRiquelme.png'` → `'Riquelme'`.
- Elegir una tapita **no crea fichas todavía**; solo cambia el índice.

### 2.4 Paso 3: arrancar la partida

El botón "Jugar" llama a:

```javascript
function iniciarPartida() {
    partidaIniciada = true;
    ocultarMenu();
    reiniciarJuego();
}
```

`reiniciarJuego()` es el punto de entrada real: limpia selecciones, reinicia el reloj, llama a `initTablero()` y redibuja. El flag `partidaIniciada` evita que un reinicio se ejecute antes de que el usuario haya elegido tapita.

### 2.5 Paso 4: crear e insertar cada ficha

`initTablero()` recorre la plantilla y crea una ficha por cada `1`:

```javascript
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
```

`colocarFichaEnCelda` hace cuatro cosas:

```javascript
function colocarFichaEnCelda(row, col) {
    const center = getCellCenter(row, col);   // 1. matriz → píxeles
    const ficha = crearFicha(center.x, center.y); // 2. new FichaTapita
    ficha.row = row;                          // 3. posición lógica en el objeto
    ficha.col = col;
    tablero[row][col] = ficha;                // 4a. referencia en la matriz
    figuras.push(ficha);                      // 4b. referencia en la lista de dibujo
    return ficha;
}
```

Y `crearFicha` usa siempre la tapita elegida:

```javascript
function crearFicha(x, y) {
    return new FichaTapita(x, y, imgTapitas[indiceFichaElegida], false, ctx, FICHA_RADIO);
}
```

`FICHA_RADIO = 45`, así que cada ficha mide 90 px de diámetro.

La plantilla inicial tiene **32 fichas**: 3 + 3 + 7 + 6 + 7 + 3 + 3. En total hay 33 casillas jugables (32 ocupadas más el hueco central):

```javascript
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

| Valor | Significado |
| :---: | :--- |
| `-1` | Fuera del tablero (esquina no jugable). |
| `0` | Casilla jugable vacía. |
| `1` | Casilla jugable que arranca con ficha. |

### 2.6 Las dos estructuras: `tablero` vs `figuras`

Esta es la dupla central del juego. **Guardan las mismas fichas, pero con propósitos distintos**:

| | `tablero[row][col]` | `figuras[]` |
| :--- | :--- | :--- |
| Forma | Matriz 7 × 7 | Arreglo plano |
| Contenido | `-1`, `0` o referencia a una ficha | Solo referencias a fichas |
| Propósito | Consultar reglas en O(1) | Recorrer para dibujar y detectar clicks |
| Orden | Fijo por posición | Orden de dibujo (z-index) |

La invariante que hay que respetar siempre: **toda ficha de `figuras` debe estar en `tablero`, y toda ficha de `tablero` debe estar en `figuras`**. Si se actualiza una y no la otra, aparecen fichas fantasma o movimientos imposibles.

El orden de `figuras` importa porque se dibuja de atrás hacia adelante. Al seleccionar una ficha se la mueve al final para que quede arriba:

```javascript
const idx = figuras.indexOf(clickFig);
if (idx > -1) {
    figuras.splice(idx, 1);
    figuras.push(clickFig);
}
```

Y `findClickedFigure` recorre al revés para respetar ese orden:

```javascript
for (let i = figuras.length - 1; i >= 0; i--) {
    if (figuras[i].isPointInside(x, y)) return figuras[i];
}
```

### 2.7 Cómo se dibuja una ficha

`drawFigures()` siempre redibuja todo, en capas:

```javascript
function drawFigures() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imgTablero) {
        ctx.drawImage(imgTablero, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, CROP.w, CROP.h);
    }
    drawHints();                    // pistas doradas
    figuras.forEach(f => f.draw()); // fichas
    dibujarTimerCanvas();           // reloj arriba a la izquierda
}
```

Cada ficha delega en la clase base:

```javascript
// FichaTapita
draw() {
    const diametro = this.radius * 2;
    this.dibujarImagenEnClip(diametro, diametro);
}

definirPath() {
    this.context.arc(this.posX, this.posY, this.radius, 0, 2 * Math.PI);
}
```

`dibujarImagenEnClip` hace `save → beginPath → definirPath → clip → drawImage` centrado en `(posX, posY)`, y después dibuja el borde amarillo si `resaltado` es `true`. El `clip` es lo que hace que la imagen cuadrada se vea como tapita circular.

La detección de click es pura geometría:

```javascript
isPointInside(x, y) {
    const dx = this.posX - x;
    const dy = this.posY - y;
    return Math.sqrt(dx * dx + dy * dy) <= this.radius;
}
```

### 2.8 Resumen del pipeline

```
IMG_TAPITAS
   │ cargarImagen() + Promise.all
   ▼
imgTapitas[]  ──────────────┐
                            │
menú: indiceFichaElegida ───┤
                            ▼
                     crearFicha(x, y)
                            │ new FichaTapita(..., FICHA_RADIO)
                            ▼
initTablero() ──► colocarFichaEnCelda(row, col)
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
      tablero[row][col] = ficha     figuras.push(ficha)
        (reglas, O(1))               (dibujo, z-order)
```

### 2.9 Cargar escenarios a mano (debug)

Estas funciones de consola sirven para estudiar el estado sin jugar una partida completa:

| Función | Qué hace |
| :--- | :--- |
| `limpiarTableroVacio()` | Deja `-1` en las esquinas y `0` en el resto; vacía `figuras`. |
| `debugCasiGanar()` | Coloca fichas en `(3,1)` y `(3,2)`. Saltando `(3,1)` a `(3,3)` se come la de `(3,2)` y queda una sola: victoria. |
| `debugDerrota()` | Coloca 3 fichas aisladas y llama a `verificarFinDelJuego()`: derrota por bloqueo. |

Ejemplo: `debugCasiGanar()` demuestra que no hace falta una partida completa para probar el final.

---

## 3. `COL_X` y `ROW_Y`: la calibración del tablero

### 3.1 El problema que resuelven

El tablero no es un dibujo vectorial: es una **foto** (`tablero.jpeg`, 2400 × 1792). Los agujeros no están perfectamente equiespaciados en píxeles porque la cámara genera perspectiva. Si se usara una fórmula lineal, las fichas quedarían corridas respecto de los agujeros reales.

La solución es guardar el centro exacto de cada columna y cada fila, medido una vez sobre la imagen:

```javascript
const COL_X = [796, 931, 1058, 1202, 1346, 1475, 1610];
const ROW_Y = [405, 554, 707, 854, 1002, 1151, 1305];
```

### 3.2 Qué guarda cada posición

| Índice lógico | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `COL_X[índice]` (X en imagen) | 796 | 931 | 1058 | 1202 | 1346 | 1475 | 1610 |
| `ROW_Y[índice]` (Y en imagen) | 405 | 554 | 707 | 854 | 1002 | 1151 | 1305 |

Es decir:

- `COL_X[col]` responde: *¿en qué píxel X está la columna lógica `col`?*
- `ROW_Y[row]` responde: *¿en qué píxel Y está la fila lógica `row`?*
- `row` crece hacia **abajo** y `col` hacia la **derecha**, igual que en la matriz.

### 3.3 Por qué no una fórmula

Si se calculara el paso promedio:

- Columnas: `(1610 − 796) / 6 ≈ 135,67 px`.
- Filas: `(1305 − 405) / 6 = 150 px`.

Pero los saltos reales no son constantes:

| Tramo | 0→1 | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| ΔX | 135 | 127 | 144 | 144 | 129 | 135 |
| ΔY | 149 | 153 | 147 | 148 | 149 | 154 |

Dos observaciones:

1. Las columnas son **casi simétricas** (135, 127, 144 en un lado; 144, 129, 135 en el otro) y más anchas en el centro. Eso es lo que produce una cámara centrada: el centro de la escena se proyecta más grande.
2. La diferencia entre el paso más chico y el más grande es de 17 px en X y 7 px en Y. Con una fórmula única, el error se acumula y se nota contra un agujero de ~91 px.

Con la tabla, en cambio, el centro es exacto para cualquiera de las 49 combinaciones `(row, col)`, aunque solo 33 sean casillas jugables.

### 3.4 De la matriz al píxel: `getCellCenter`

```javascript
const CROP = { x: 403, y: 280, w: 1600, h: 1150 };

function getCellCenter(row, col) {
    return {
        x: COL_X[col] - CROP.x,
        y: ROW_Y[row] - CROP.y
    };
}
```

¿Por qué se resta `CROP`? Porque la imagen tiene mucho fondo decorativo a los costados. En lugar de mostrarla completa, se recorta un rectángulo de 1600 × 1150 y se dibuja ocupando todo el canvas:

```javascript
ctx.drawImage(
    imgTablero,
    CROP.x, CROP.y, CROP.w, CROP.h,  // porción de la imagen
    0, 0, CROP.w, CROP.h             // destino en el canvas
);
```

Entonces el píxel `(0, 0)` del canvas corresponde al píxel `(403, 280)` de la imagen. Restar `CROP` traduce de un espacio al otro.

**Ejemplo resuelto: el hueco central `(3, 3)`**

```
x = COL_X[3] - CROP.x = 1202 - 403 = 799
y = ROW_Y[3] - CROP.y =  854 - 280 = 574
```

El canvas mide 1600 × 1150, así que su centro es `(800, 575)`. El hueco central cae a 1 px de ese centro: el recorte está bien encuadrado.

**Ejemplo resuelto: la fila 3 completa**

| `col` | `COL_X[col]` | X en canvas (`− 403`) |
| ---: | ---: | ---: |
| 0 | 796 | 393 |
| 1 | 931 | 528 |
| 2 | 1058 | 655 |
| 3 | 1202 | 799 |
| 4 | 1346 | 943 |
| 5 | 1475 | 1072 |
| 6 | 1610 | 1207 |

Los márgenes del recorte también confirman que está centrado:

- Horizontal: `796 − 403 = 393` a la izquierda y `(403 + 1600) − 1610 = 393` a la derecha.
- Vertical: `405 − 280 = 125` arriba y `(280 + 1150) − 1305 = 125` abajo.

### 3.5 Por qué no hay un mapeo inverso píxel → celda

`COL_X` y `ROW_Y` se usan para **posicionar** fichas y **medir distancias**, no para interpretar el click. El juego nunca hace `pixelToCell(x, y)`. En cambio:

1. Al presionar, `findClickedFigure` pregunta ficha por ficha `isPointInside(x, y)`.
2. Al soltar, se calcula la distancia euclidiana entre el cursor y el centro de cada destino válido; si es `<= FICHA_RADIO`, se acepta.

```javascript
const dx = canvasX - center.x;
const dy = canvasY - center.y;
const dist = Math.sqrt(dx * dx + dy * dy);
if (dist <= FICHA_RADIO && dist < menorDistancia) { ... }
```

Ventaja: no hace falta convertir el click a una celda ni tolerar redondeos. Desventaja: solo se puede soltar sobre un destino **ya validado**; no existe "la celda más cercana" genérica.

### 3.6 Si algún día cambiás la imagen del tablero

Checklist:

1. Medir los 7 centros X y los 7 centros Y en la nueva imagen.
2. Actualizar `COL_X` y `ROW_Y` en el mismo orden (izquierda→derecha, arriba→abajo).
3. Elegir un `CROP` que deje el tablero centrado y sin fondo de más.
4. Actualizar `CROP.w` y `CROP.h` (también definen el tamaño del canvas).
5. Verificar que el diámetro de ficha (`2 × 45`) siga entrando en el agujero más chico.

---

## 4. Cómo funciona "comer"

### 4.1 La regla

En Peg Solitaire se salta **dos casillas en línea recta**, siempre en horizontal o vertical:

```
antes:      [F] [C] [ ]        F = ficha que salta
             ↑   ↑   ↑          C = ficha comida
            origen medio destino

después:    [ ] [ ] [F]
```

Condiciones para que el salto sea válido:

1. El destino está dentro de la matriz (0..6 en fila y columna).
2. El destino está **vacío** (`tablero[dest] === 0`).
3. La casilla del medio tiene **una ficha** (no es `0` ni `-1`).

El origen, obviamente, tiene que tener la ficha que se mueve: eso ya está garantizado porque se seleccionó con el mouse.

### 4.2 `obtenerMovimientosValidos(ficha)`

Es la función que decide todo. Recorre las 4 direcciones:

```javascript
const DIRECCIONES = [
    { nombre: 'arriba',    dr: -1, dc:  0 },
    { nombre: 'abajo',     dr:  1, dc:  0 },
    { nombre: 'izquierda', dr:  0, dc: -1 },
    { nombre: 'derecha',   dr:  0, dc:  1 }
];
```

Y para cada una calcula tres posiciones:

```javascript
for (const dir of DIRECCIONES) {
    const destR  = row + dir.dr * 2;
    const destC  = col + dir.dc * 2;
    const medioR = row + dir.dr;
    const medioC = col + dir.dc;

    // 1. destino dentro de los límites
    if (destR < 0 || destR >= TAM_TABLERO || destC < 0 || destC >= TAM_TABLERO) continue;

    // 2. a 2 casillas debe haber un hueco vacío
    if (tablero[destR][destC] !== 0) continue;

    // 3. a 1 casilla debe haber una ficha
    const fichaMedio = tablero[medioR][medioC];
    if (fichaMedio === 0 || fichaMedio === -1) continue;

    movimientosValidos.push({
        direccion: dir.nombre,
        destino: { row: destR, col: destC },
        intermedio: { row: medioR, col: medioC }
    });
}
```

Detalles finos:

- El chequeo de límites se hace **solo sobre el destino**. Es suficiente: si el destino está dentro, la casilla del medio también, porque está entre el origen y el destino.
- El `continue` descarta esa dirección y pasa a la siguiente; no aborta el bucle.
- Devuelve un arreglo de objetos con `direccion`, `destino` e `intermedio`. Ese `intermedio` es el que después se usa para comer.
- Si la ficha no tiene `row`/`col`, devuelve `[]`.

`puedeRealizarMovimiento(ficha)` es solo un atajo:

```javascript
return obtenerMovimientosValidos(ficha).length > 0;
```

### 4.3 Ejemplo completo con el tablero inicial

Fila 3 del tablero inicial:

```
col:    0    1    2    3    4    5    6
       [1]  [1]  [1]  [0]  [1]  [1]  [1]
```

Analizando la ficha de `(3, 1)`:

| Dirección | Destino | ¿Destino vacío? | ¿Medio con ficha? | Resultado |
| :--- | :--- | :--- | :--- | :--- |
| arriba | `(1, 1)` | No: es `-1` | — | inválido |
| abajo | `(5, 1)` | No: es `-1` | — | inválido |
| izquierda | `(3, -1)` | Fuera de la matriz | — | inválido |
| derecha | `(3, 3)` | Sí: es `0` | Sí: `(3, 2)` | **válido** |

En píxeles:

```
origen  (3,1) → x = 931 − 403 = 528,  y = 574
medio   (3,2) → x = 1058 − 403 = 655, y = 574
destino (3,3) → x = 1202 − 403 = 799, y = 574
```

La ficha recorre 271 px, pero en dos tramos distintos: 127 px hasta el medio y 144 px hasta el destino. El paso no es constante; por eso el snap final usa el centro exacto del destino y no una suma de pasos.

### 4.4 El ciclo del arrastre

| Evento | Función | Qué pasa |
| :--- | :--- | :--- |
| `mousedown` (canvas) | `onMouseDown` | Busca la ficha clickeada, la trae al frente, la resalta, calcula `destinosValidosActivos` y arranca las pistas animadas. |
| `mousemove` (document) | `onMouseMove` | Mueve la ficha con el cursor y redibuja. No valida nada. |
| `mouseup` (document) | `onMouseUp` | Busca el destino válido más cercano. Si existe, ejecuta la jugada; si no, hace snap-back. |

Dos decisiones de diseño:

- `destinosValidosActivos` se calcula **una sola vez** en `mousedown`. El tablero no cambia mientras se arrastra, así que recalcularlo en `mouseup` sería trabajo repetido.
- `mousemove` y `mouseup` se escuchan en `document`, no en el canvas, para que el arrastre no se corte si el cursor sale del lienzo.

### 4.5 Las mutaciones de `onMouseUp` (el "comer" real)

Cuando el destino elegido es válido:

```javascript
// 1. Snap-to-grid: centrar la ficha en el agujero destino
lastClickedFigure.setPos(center.x, center.y);
lastClickedFigure.row = destRow;
lastClickedFigure.col = destCol;

// 2. Actualizar la matriz del tablero
tablero[origRow][origCol] = 0;
tablero[destRow][destCol] = lastClickedFigure;

// 3. Comer la ficha intermedia
const fichaComida = tablero[medioRow][medioCol];
tablero[medioRow][medioCol] = 0;
fichaAEliminar = fichaComida;
if (fichaComida) {
    figuras = figuras.filter(f => f !== fichaAEliminar);
    animacionEliminarFicha();
}
```

Paso a paso, con el ejemplo `(3,1) → (3,3)`:

| Estado | `tablero[3]` |
| :--- | :--- |
| Inicial | `[1, 1, 1, 0, 1, 1, 1]` |
| Después del paso 2 (origen y destino) | `[1, 0, 1, F, 1, 1, 1]` |
| Después del paso 3 (comer el medio) | `[1, 0, 0, F, 1, 1, 1]` |

Donde `F` es el objeto `FichaTapita` que se movió. `figuras` pasa de 32 a 31.

Por qué el orden importa:

- Primero se guarda `fichaComida` en una variable y **después** se pone `0` en el medio. Si se zeroeara antes, se perdería la referencia al objeto.
- La ficha comida se saca de `figuras` con `filter`, pero la referencia sigue viva en `fichaAEliminar` para poder animarla.
- `tablero` y `figuras` quedan sincronizados: la posición vieja y la del medio son `0`; la nueva tiene la ficha; `figuras` ya no contiene la comida.

Si el destino no es válido (o se soltó fuera del canvas), no se toca la matriz: se ejecuta el snap-back a `lastClickedPos`, la posición que tenía la ficha al empezar el arrastre.

Un click sin arrastre tampoco mueve nada: el origen no puede ser destino válido, porque el destino exige `0` y el origen contiene la ficha.

### 4.6 La animación de la ficha comida

El "pop" lo hace `animacionEliminarFicha()` con `requestAnimationFrame`:

- **Fase `"creciendo"`**: `escala += 0.08` en cada frame hasta superar `1.3`.
- **Fase `"encogiendo"`**: `escala *= 0.88` (decrecimiento multiplicativo, tipo ease-out) hasta bajar de `0.03`.
- Al terminar, se limpia `fichaAEliminar`, `escala` vuelve a `1.0` y `fase` a `"creciendo"`.

Cada frame hace dos dibujos:

```javascript
drawFigures();   // tablero + fichas restantes + timer

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
```

El truco del `translate → scale → translate` es escalar **desde el propio centro** de la ficha y no desde la esquina `(0, 0)` del canvas.

Como la ficha comida ya no está en `figuras`, `drawFigures()` no la dibuja en tamaño normal; el único que la dibuja es este bloque, con la escala animada. No hay doble dibujo.

Dos detalles a tener en cuenta:

- La animación **no bloquea la entrada**. Si el usuario empieza otro arrastre mientras dura el pop, los dos bucles de dibujo conviven. Es una simplificación aceptable por lo breve del efecto.
- `verificarFinDelJuego()` se llama inmediatamente después de lanzar la animación, así que el modal de fin puede aparecer mientras la ficha todavía se está achicando.

### 4.7 Cómo se detecta el final

Después de cada jugada válida:

```javascript
if (movElegido != null) {
    verificarFinDelJuego();
}
```

`verificarFinDelJuego()` distingue dos casos:

```javascript
// Victoria: queda exactamente 1 ficha
if (figuras.length === 1) {
    mostrarFinDeJuego(true, "¡Mística pura! ...");
    return true;
}

// Derrota: ninguna ficha puede saltar
if (!hayMovimientosPosiblesEnTablero()) {
    mostrarFinDeJuego(false, `... Fichas restantes: ${figuras.length}.`);
    return true;
}
```

`hayMovimientosPosiblesEnTablero()` recorre `figuras` con un `while` que corta apenas encuentra una ficha con jugada:

```javascript
if (figuras.length <= 1) return false;

let i = 0;
let hayMovimiento = false;
while (i < figuras.length && !hayMovimiento) {
    if (puedeRealizarMovimiento(figuras[i])) {
        hayMovimiento = true;
    }
    i++;
}
return hayMovimiento;
```

Es un **corte temprano**: no hace falta analizar todas las fichas si la primera ya puede mover.

`mostrarFinDeJuego(victoria, mensaje)` centraliza el cierre: detiene el reloj, marca `juegoTerminado = true`, limpia pistas y muestra el overlay. Con `victoria = true` el título es dorado; con `false` o `null` (tiempo agotado), rojo. El temporizador de 300 s llama a esta misma función con `null` al llegar a cero.

`reiniciarJuego()` vuelve todo al estado inicial: resetea flags, reloj, selecciones y reconstruye el tablero con `initTablero()`.

### 4.8 Tabla resumen de funciones

| Función | Recibe | Lee / modifica | Rol |
| :--- | :--- | :--- | :--- |
| `getCellCenter(row, col)` | Fila y columna lógicas | `COL_X`, `ROW_Y`, `CROP` | Matriz → píxeles del canvas. |
| `obtenerPosicionMouse(e)` | Evento del mouse | `canvas`, `getBoundingClientRect` | Pantalla → píxeles del canvas. |
| `findClickedFigure(x, y)` | Coordenadas del canvas | `figuras` | Devuelve la ficha clickeada (la de arriba). |
| `obtenerMovimientosValidos(ficha)` | Ficha | `tablero`, `DIRECCIONES` | Lista de saltos posibles con destino e intermedio. |
| `puedeRealizarMovimiento(ficha)` | Ficha | `tablero` | Booleano: ¿tiene al menos un salto? |
| `onMouseDown(e)` | Evento | `figuras`, `destinosValidosActivos` | Selecciona, resalta y calcula destinos. |
| `onMouseMove(e)` | Evento | `posX`/`posY` de la ficha | Arrastra y redibuja. |
| `onMouseUp(e)` | Evento | `tablero`, `figuras`, ficha | Ejecuta el salto + captura, o snap-back. |
| `animacionEliminarFicha()` | — | `escala`, `fase`, `fichaAEliminar` | Efecto pop de la ficha comida. |
| `hayMovimientosPosiblesEnTablero()` | — | `figuras`, `tablero` | ¿Queda alguna jugada? (corte temprano) |
| `verificarFinDelJuego()` | — | `figuras` | Decide victoria o derrota. |
| `mostrarFinDeJuego(victoria, mensaje)` | Resultado y texto | Timer, overlay | Cierra la partida y muestra el modal. |
| `reiniciarJuego()` | — | Todo el estado | Vuelve al tablero inicial. |

---

## 5. Glosario y errores comunes

### 5.1 Glosario

| Término | Significado |
| :--- | :--- |
| **Ficha / tapita** | Objeto `FichaTapita`, hereda de `ElementoJuego`, se dibuja como círculo con imagen. |
| **Casilla / celda** | Posición lógica `(row, col)` de la matriz. |
| **Hueco** | Agujero del tablero; en la matriz es un `0`. |
| **Snap-to-grid** | Centrar la ficha en el centro exacto del agujero destino. |
| **Snap-back** | Devolver la ficha a su posición original si el movimiento no es válido. |
| **Hint** | Pista visual dorada (onda, pulso y flecha) sobre los destinos posibles. |
| **Z-order** | Orden de dibujo; la última ficha de `figuras` se ve arriba. |
| **Crop** | Recorte de la imagen original que se muestra en el canvas. |

### 5.2 Errores comunes

1. **Confundir fila/columna con X/Y.** `row` indexa `ROW_Y` (vertical) y `col` indexa `COL_X` (horizontal).
2. **Olvidar restar `CROP`.** Sin `- CROP.x` / `- CROP.y`, todas las fichas aparecen 403 px a la derecha y 280 px abajo.
3. **Tocar `tablero` sin tocar `figuras` (o al revés).** Rompe la invariante: la ficha se sigue dibujando aunque la lógica la considere comida, o desaparece del render pero bloquea saltos.
4. **Creer que el click se convierte a celda.** No existe mapeo inverso; se usa `isPointInside` y distancia al destino.
5. **Usar `e.offsetX` / `e.offsetY`.** El canvas es responsivo; hay que escalar con `getBoundingClientRect`, como hace `obtenerPosicionMouse`.
6. **Validar solo el destino.** También hay que validar que el medio tenga ficha; si no, se "come" aire.
7. **Recalcular movimientos en `mouseup`.** Se reutilizan los de `mousedown` (`destinosValidosActivos`).
8. **Guardar la ficha comida después de poner `0` en el medio.** Hay que guardar la referencia primero.

### 5.3 Para seguir leyendo

- [`logica_movimientos.md`](./logica_movimientos.md): versión técnica y compacta del modelo de datos, validación, drag & drop y fin de juego.
- [`drag_drop_guia.md`](./drag_drop_guia.md): fundamentos generales de drag & drop sobre canvas.
- [`peg.md`](./peg.md): especificación del juego.
