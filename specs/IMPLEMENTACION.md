# Blocka — Implementación del juego

Este documento explica **cómo está implementado** el juego ejecutable de Blocka
(`2 entrega/blocka.html` + `js/blocka.js` + `js/filtros.js` + `css/blocka.css`), pensado para la
defensa y como referencia. La mecánica general y los filtros de
la cátedra están en [`DOCUMENTACION.md`](DOCUMENTACION.md); acá se describe la
implementación real dentro del sitio.

---

## 1. Archivos que conforman el juego

| Archivo | Rol |
|---|---|
| `2 entrega/blocka.html` | Página del juego. El `<article class="juego-card">` contiene la zona de ejecución: canvas + HUD (nivel, selector de 4/6/8 piezas, cronómetro, récord) + overlay de sorteo + overlay de fin. |
| `2 entrega/home.html` | Portal principal: contiene el segundo slide destacado del Hero Banner 
| `2 entrega/js/filtros.js` | **Módulo independiente de filtros**: grises (ITU-R BT.601), brillo (+30%), negativo y blur por filtro de vecinos (ventana 5×5) sobre `ImageData`. |
| `2 entrega/js/blocka.js` | **Toda la lógica del juego**: banco de imágenes, división dinámica en 4/6/8 piezas cuadradas, sorteo previo, progresión de 5 niveles, rotación, temporizador, récord por nivel/piezas y victoria. |
| `2 entrega/css/blocka.css` | Layout de la zona de ejecución (canvas, HUD, selector de dificultad, sorteo, overlay de fin, ayuda) y de las cards informativas. |
| `2 entrega/assets/bancoImagenes/*` | Banco de imágenes (6 fotos de Boca). |

El HTML relevante de la zona de ejecución:

```html
<div class="blocka-mock">
    <div class="blocka-tablero">
        <div class="blocka-lienzo">
            <canvas id="blocka-canvas" class="blocka-canvas"></canvas>
            <div id="blocka-sorteo" class="blocka-sorteo" hidden> … ruleta de 6 miniaturas … </div>
            <div id="blocka-fin" class="blocka-fin" hidden> … overlay de victoria … </div>
        </div>
        <p class="blocka-ayuda">Clic izquierda: gira a la izquierda · Clic derecha: gira a la derecha</p>
    </div>
    <div class="blocka-hud">
        <span id="blocka-nivel" class="label blocka-hud__nivel">Nivel 1</span>
        <div class="blocka-dificultad" role="group">
            <button class="btn-dificultad btn-dificultad--activo" data-piezas="4">4</button>
            <button class="btn-dificultad" data-piezas="6">6</button>
            <button class="btn-dificultad" data-piezas="8">8</button>
        </div>
        <span id="blocka-tiempo" class="blocka-hud__tiempo">00:00</span>
        <span id="blocka-record" class="body-small blocka-hud__record">Récord: --:--</span>
        <button type="button" id="blocka-comenzar" class="btn-primario">Comenzar</button>
    </div>
</div>
```

---

## 2. Cómo se divide la imagen en sub-imágenes (4, 6 u 8 piezas)

Todo ocurre en `setupNivel()` de `js/blocka.js`. El flujo es:

1. **Configuración de la grilla:**
   * **4 piezas:** 2 columnas × 2 filas (proporción 1:1, cuadrada).
   * **6 piezas:** 3 columnas × 2 filas (proporción 3:2).
   * **8 piezas:** 4 columnas × 2 filas (proporción 2:1).

   **¿Por qué las piezas deben ser cuadradas?** Si una sub-imagen fuera rectangular, al rotarla 90° o 270° su ancho y su alto se intercambiarían, invadiendo casilleros vecinos y dejando huecos. Al mantener cada celda como un cuadrado perfecto de `ladoPieza × ladoPieza`, cualquier rotación a 90°/180°/270° ocupa exactamente su mismo lugar.

2. **Dimensiones del canvas y recorte de la imagen `fuente`:**
   Se calcula `ladoPieza = Math.floor(LADO_MAX / cols)`, `cw = ladoPieza * cols` y `ch = ladoPieza * filas`.
   La imagen original se recorta por el centro respetando la proporción `cols / filas`:
   * Si la foto es más ancha que la grilla, se recortan los laterales sobrantes de manera simétrica.
   * Si la foto es más alta que la grilla, se recortan los extremos superior e inferior simétricamente.
   El canvas offscreen `fuente` almacena la imagen recortada **original sin filtros** en RGB.

3. **Generación dinámica de piezas:**
   Mediante dos bucles (`fila` y `col`), cada zona se extrae a un canvas propio:
   ```js
   const cv = document.createElement('canvas');
   cv.width = ladoPieza; cv.height = ladoPieza;
   cv.getContext('2d').drawImage(fuente, x, y, ladoPieza, ladoPieza, 0, 0, ladoPieza, ladoPieza);
   aplicarFiltroSegunNivel(cv, idx, nivelActual);
   ```

4. **Estado de cada pieza.** El array `piezas` es el modelo de estado del juego:
   ```js
   { canvas,          // canvas offscreen con la sub-imagen YA filtrada
     x, y, w, h,      // rectángulo de destino dentro del canvas visible
     cx, cy,          // centro de rotación (pivote)
     angulo }         // 0 | 90 | 180 | 270 (arranca barajado en 90/180/270)
   ```

**Cambio importante respecto al ejercicio de la cátedra:** la doc original
rotaba “sacando un snapshot” con `canvas.toDataURL()` en cada click. Acá
**no se re-rastrea el canvas**: el ángulo vive en el estado (`p.angulo`) y en
cada acción se **redibuja el canvas visible desde las piezas**. Se evita la
pérdida de calidad del dataURL y se mantiene el filtro por pieza intacto.

---

## 3. Cómo se dibuja (render)

```js
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (resuelto && fuente) {
        ctx.drawImage(fuente, 0, 0);      // al ganar: imagen original en RGB
        return;
    }
    for (const p of piezas) {
        ctx.save();
        ctx.translate(p.cx, p.cy);                    // pivote = centro del cuadrante
        ctx.rotate(p.angulo * Math.PI / 180);         // grados → radianes
        ctx.drawImage(p.canvas, -p.w / 2, -p.h / 2);  // centrada en el pivote
        ctx.restore();
    }
}
```

Secuencia clásica de canvas: `save` → `translate` al pivote → `rotate` →
`drawImage` centrada (por eso se resta `w/2, h/2`) → `restore`. La rotación de
0°/90°/180°/270° de un cuadrante cuadrado siempre cae dentro de su lugar.

---

## 4. Rotación con los botones del mouse

```js
canvas.addEventListener('mousedown', (event) => {
    if (!enJuego || resuelto) return;          // ① sólo después de “Comenzar”
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    const p = piezaEn(x, y);                   // ② ¿en qué cuadrante clickeé?
    if (!p) return;
    if (event.button === 0) rotar(p, -90);     // ③ izquierda
    else if (event.button === 2) {             // ④ derecha
        event.preventDefault();
        rotar(p, 90);
    }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // sin menú contextual
```

- `event.button`: `0` = izquierdo, `2` = derecho (igual que la cátedra).
- El cuadrante se deduce comparando el click contra los rectángulos `x,y,w,h`
  de cada pieza (no hay “piezas sueltas”: cada cuadrante ocupa su lugar fijo y
  sólo gira sobre su centro).
- Ángulo normalizado: `p.angulo = ((p.angulo + delta) % 360 + 360) % 360`.
- **Los clicks están bloqueados antes de apretar “Comenzar”** (bandera
  `enJuego`): el nivel se juega contra el cronómetro.

---

## 5. Módulo de filtros y progresión de niveles

Los filtros viven en `2 entrega/js/filtros.js` y se invocan desde `blocka.js` mediante la función `aplicarFiltroSegunNivel(cv, indicePieza, nivel)`:

| Nivel | Filtro aplicado | Descripción |
|---|---|---|
| **Nivel 1** | Escala de grises (`Filtros.grises`) | Fórmula estándar de luminosidad ITU-R BT.601 (`0.299*R + 0.587*G + 0.114*B`). |
| **Nivel 2** | Brillo +30% (`Filtros.brillo`) | Suma offset aditivo de +76.5 (`255 * 0.3`) con clamping `[0, 255]`. |
| **Nivel 3** | Negativo (`Filtros.negativo`) | Inversión de cada canal haciendo `255 - valor`. |
| **Nivel 4** | Combinación de filtros | Cuadrantes alternan grises, brillo, negativo y color original RGB usando `indicePieza % 4`. |
| **Nivel 5** | Blur de vecinos (`Filtros.blur`) | Cada píxel pasa a ser el promedio de su ventana 5×5 (radio `K = 2`); en los bordes se divide por los vecinos que existen (`n < 25`). Contrarreloj 0:30. |

### 5.1 Qué significa "filtrar por vecinos"

**Filtro por píxel vs. filtro por vecinos.** Los filtros de los niveles 1-4 (grises, brillo,
negativo) son **por píxel**: el valor nuevo de un píxel sale de fórmulas sobre sus propios
canales R, G y B. Dos píxeles con los mismos RGB dan exactamente el mismo resultado, estén
donde estén. Ese tipo de filtro **no puede desenfocar**: nunca "mira" a nadie más.

El blur del nivel 5 es un **filtro por vecinos**: el valor nuevo de un píxel sale de mirar su
**vecindad** (un grupo de píxeles alrededor). Al mezclar valores de alrededor, los cambios
bruscos se suavizan — eso es exactamente "difuminar/desenfocar". Es la familia de filtros que
la cátedra llama *"filtros que miran a los vecinos"*.

| | Por píxel (niveles 1-4) | Por vecinos (nivel 5, blur) |
|---|---|---|
| Qué entra en el cálculo | Sólo el píxel actual | El píxel actual + su ventana |
| Fórmula | `f(R, G, B)` | `f(R, G, B de los vecinos)` |
| ¿Puede desenfocar? | No | Sí |
| Costo por píxel | 1 operación | `(2K+1)²` sumas |
| ¿Necesita buffer extra? | No (in-place) | Sí (leer de uno, escribir en otro) |

**La ventana (la vecindad).** Un entero `K` define el **radio**: se mira desde `K` píxeles a la
izquierda/arriba hasta `K` a la derecha/abajo. La ventana es cuadrada, de lado `2K+1`:

```
K = 1  →  3×3  =  9 vecinos
K = 2  →  5×5  = 25 vecinos      ← el del juego (K = 2, default de filtros.js:62)
K = 3  →  7×7  = 49 vecinos
```

Con `K = 2`, la vecindad del píxel `(x, y)` es la grilla de offsets `dy, dx ∈ [-2, 2]`:

```
        dx=-2  dx=-1  dx=0  dx=+1  dx=+2
dy=-2 [ (x-2,y-2)  (x-1,y-2)  (x,y-2)  (x+1,y-2)  (x+2,y-2) ]
dy=-1 [ (x-2,y-1)  (x-1,y-1)  (x,y-1)  (x+1,y-1)  (x+2,y-1) ]
dy= 0 [ (x-2,y)    (x-1,y)    ◉ (x,y)  (x+1,y)    (x+2,y)   ]   ◉ = píxel central
dy=+1 [ (x-2,y+1)  (x-1,y+1)  (x,y+1)  (x+1,y+1)  (x+2,y+1) ]
dy=+2 [ (x-2,y+2)  (x-1,y+2)  (x,y+2)  (x+1,y+2)  (x+2,y+2) ]
```

**De coordenadas a índice (cómo se "lee" un vecino).** Un `ImageData` no es una grilla: es **un
array plano gigante** que guarda los píxeles fila por fila, con 4 posiciones por píxel
(`R, G, B, A`). Para pasar de un vecino con coordenadas `(nx, ny)` a su posición en el array:

```
posición de fila/columna en el array = ny * width + nx      // fila anterior completa + columna
posición del píxel dentro del array   = (ny * width + nx) * 4   // × 4 bytes por píxel
canal R en j, G en j+1, B en j+2, A en j+3
```

Ejemplo con una pieza de 210×210 (`ladoPieza` de 4 piezas): el vecino `(14, 10)` está en
`j = (10·210 + 14)·4 = (2100 + 14)·4 = 8456`; `src[8456]` es su R, `src[8457]` su G, `src[8458]` su B.

**Ejemplo trabajado (el de la lámina de la cátedra).** Para el píxel `(12, 150)`, canal R, se
suman los 25 valores de la ventana:

```
suma = 2241        n = 25        promedio = 2241 / 25 = 89,64 → 90
```

Eso es literalmente `dst[i] = r / n` (línea 82): el píxel pasa de su valor original a la media
de su vecindad.

**El borde: la pregunta de la cátedra.** *"¿En el borde de la imagen, cuántos vecinos tengo?"*
→ **menos de 25**. La ventana se recorta contra los límites del canvas:

| Zona del píxel | Vecinos que existen (K=2) |
|---|---|
| Interior | 25 |
| Borde de fila/columna (no esquina) | 15 |
| Esquina | 9 |

Por eso se cuenta `n` en cada píxel y se **divide por los que existen**, nunca por 25 fijo.
Opciones que se podrían haber usado y por qué no:

- **Asumir 25**: los píxeles que faltan contarían como 0 → bordes más oscuros de lo real
  (artefacto oscuro alrededor de la imagen).
- **Repetir el píxel del borde** (*clamp/extend*): funciona, pero cambia el resultado y agrega
  "duplicados" en el promedio; es más código para un efecto mínimo.
- **Descartar los píxeles de borde**: recortaría la imagen.

Contar `n` es la solución más simple y es la que responde la lámina.

**Por qué dos buffers (`origen` / `destino`).** El promedio de un píxel necesita los valores
**previos** de sus vecinos. Si se leyera y escribiera sobre el mismo array, al procesar el
píxel siguiente ya se habrían pisado algunos vecinos con sus promedios recién calculados: la
contaminación se propagaría y el resultado dependería del orden del barrido. Con `src` (siempre
la imagen original) y `dst` (siempre la imagen nueva), todos los píxeles se calculan con el
mismo estado de entrada — el mismo motivo por el que una convolución clásica lee de una imagen
y escribe en otra.

**Naturaleza del filtro: es un *box blur*.** La ventana tiene peso uniforme (todos los vecinos
valen `1/n`): es un filtro de caja, una convolución con kernel constante. Es barato y se nota,
pero deja una apariencia ligeramente "cuadrada". Aplicar 2 o 3 pasadas seguidas (el resultado
de la pasada 1 entra a la pasada 2) se acerca a una gaussiana — es el truco clásico
(box blur iterado ≈ gaussiana) y la forma barata de ganar intensidad sin agrandar `K`.

**Costo.** Es `O(width · height · (2K+1)²)` por pieza. Con una pieza de 210×210 y `K=2`:
`210 · 210 · 25 ≈ 1,1 M` de iteraciones; con `K=4` (9×9) serían ≈ 3,6 M. Se ejecuta **una sola
vez**, en el `setupNivel()` (no por frame), así que es imperceptible — ver §5.3.

**Particularidad del juego: se aplica por pieza, no sobre la imagen completa.** El filtro corre
sobre el canvas chico de cada cuadrante, así que la ventana **no cruza los cortes** entre piezas.
Con `K=2` no se nota; si la intensidad sube mucho, el borde de cada pieza promedia sólo adentro
de sí misma y empieza a verse una "grilla" de costuras. Si se quisiera intensidad alta sin
costuras, habría que difuminar `fuente` completa **antes** del doble `for` que corta las piezas
(`blocka.js:292-307`) y no filtrar pieza por pieza en el nivel 5.

### 5.2 El filtro blur, código línea por línea (`2 entrega/js/filtros.js:62-89`)

```js
blur(cv, K = 2) {                                                    // 62
    const c = cv.getContext('2d');                                   // 63
    const origen = c.getImageData(0, 0, cv.width, cv.height);        // 64
    const destino = c.createImageData(cv.width, cv.height);          // 65
    const src = origen.data, dst = destino.data;                     // 66
    const width = cv.width, height = cv.height;                      // 67
    for (let y = 0; y < height; y++) {                               // 69
        for (let x = 0; x < width; x++) {                            // 70
            let r = 0, g = 0, b = 0, n = 0;                          // 71
            for (let dy = -K; dy <= K; dy++) {                       // 72
                for (let dx = -K; dx <= K; dx++) {                   // 73
                    const nx = x + dx, ny = y + dy;                  // 74
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;  // 75
                    const j = (nx + ny * width) * 4;                 // 76
                    r += src[j]; g += src[j + 1]; b += src[j + 2];   // 77
                    n++;                                             // 78
                }
            }
            const i = (x + y * width) * 4;                           // 81
            dst[i] = r / n; dst[i + 1] = g / n; dst[i + 2] = b / n;  // 82-84
            dst[i + 3] = src[i + 3];                                 // 85
        }
    }
    c.putImageData(destino, 0, 0);                                   // 88
}
```

| Línea | Qué hace |
|---|---|
| 62 | Firma: recibe el canvas de la pieza. `K` es el **radio** de la ventana: `K=2` ⇒ offsets de -2 a +2 ⇒ ventana 5×5 = 25 celdas. Cambiar el default (o llamar `Filtros.blur(cv, 3)`) aumenta la intensidad (7×7). |
| 63 | Obtiene el contexto 2D del canvas. |
| 64 | **Lee** los píxeles actuales a un `ImageData` (`origen`): array plano `[R,G,B,A,R,G,B,A…]`. Es el estado previo. |
| 65 | Crea un `ImageData` nuevo **vacío** del mismo tamaño: el buffer de escritura. |
| 66 | Atajos: `src` **sólo se lee**, `dst` **sólo se escribe**. |
| 67 | Guarda las dimensiones (evita repetir `cv.width` dentro de los bucles). |
| 69-70 | Bucle doble que recorre **cada píxel** de la imagen (`y` fila, `x` columna). |
| 71 | Acumuladores **por píxel**: sumas de R/G/B de la ventana y `n` = contador de vecinos válidos. |
| 72-73 | Bucle de la **ventana**: `dy`/`dx` son los offsets respecto del píxel central; con K=2 son 5×5 = 25 combinaciones. |
| 74 | Coordenadas del vecino: píxel actual + offset. |
| 75 | **Salto de bordes**: si el vecino cae fuera de la imagen, no existe ⇒ no se suma y `n` no crece (esquina ⇒ n=9, borde ⇒ n=15, centro ⇒ n=25). |
| 76 | Índice lineal del vecino en el array: `(fila·ancho + columna)·4` (×4 porque cada píxel ocupa 4 posiciones: R, G, B, A). |
| 77 | Acumula R, G y B del vecino **desde `src`** (siempre el original, sin modificar). El alfa no participa. |
| 78 | Cuenta el vecino que sí existía. |
| 81 | Índice lineal del píxel **destino** (centro de la ventana). |
| 82-84 | **El promedio**: cada canal = suma ÷ `n`. Nunca se divide por 25 fijo → los bordes no se oscurecen. |
| 85 | El **alfa** se copia tal cual (las piezas son opacas: 255). |
| 88 | Escribe el resultado en el canvas (`putImageData`): es lo que el jugador ve en la pieza. |

**Cadena de llamadas:** `setupNivel()` → `aplicarFiltroSegunNivel(cv, idx, nivelActual)` (`blocka.js:307`, una vez por pieza, al crearla) → `case 5: Filtros.blur(cv)` (`blocka.js:152-154`).

**Dos motivos de defensa:**

1. **Dos buffers separados** (`src` para leer, `dst` para escribir): si se escribiera sobre el mismo array, los promedios se contaminarían con valores ya modificados en la misma pasada.
2. **División por `n` y no por 25**: es la respuesta al clásico "¿cuántos vecinos tengo en el borde?". En el borde faltan vecinos, y dividir por los que existen evita oscurecer los extremos de la imagen.

### 5.3 Cómo aumentar la intensidad del blur

Hay tres palancas (se pueden combinar), de menor a mayor cambio:

| Palanca | Qué se toca | Efecto | Costo |
|---|---|---|---|
| **Radio `K`** | El default de `filtros.js:62` (`K = 2`) o la llamada en `blocka.js:153` → `Filtros.blur(cv, 3)` | Ventana 5×5 → 7×7 (49) o 9×9 (81): la vecindad crece y el desenfoque se nota más | Lineal en `(2K+1)²`; con `K=4` y pieza 210×210 ≈ 3,6 M de iteraciones (sigue siendo instantáneo) |
| **Pasadas (`pasos`)** | Sumar un parámetro que repita el bucle de filtrado 2-3 veces dentro de `blur()` | 2-3 pases de 5×5 ≈ gaussiana: mucho más suave que un solo pase, sin agrandar la ventana | Lineal en la cantidad de pasadas |
| **Difuminar `fuente` antes de cortar** | Mover la llamada al bloque previo al doble `for` de piezas (`blocka.js:292-307`) en vez de filtrar en `blocka.js:307` | La ventana cruza los cortes ⇒ **sin costuras** entre piezas, incluso con intensidad alta | Un solo filtrado sobre la imagen completa en vez de por pieza |

Si sube la intensidad conviene revisar el **tiempo del nivel 5** (`CONFIG_NIVELES[5].limiteMs`,
hoy 30000 ms en `blocka.js:21`): un blur más fuerte hace la imagen más difícil de leer y, con
4 piezas, el reloj ya arranca en ámbar (su límite base es igual al umbral de advertencia).

Al ganar cualquier nivel, se remueven todos los filtros dibujando `fuente` (que nunca se mutó) para revelar la foto original en RGB.

---

## 6. Temporizador y récord por nivel y dificultad

- **Temporizador**: arranca únicamente al presionar el botón **“Comenzar”** (`setInterval` cada 200 ms que calcula `Date.now() - inicioMs`). Se detiene al completar la imagen.
- **Récord independiente**: se almacena en `localStorage` con una clave compuesta por nivel y piezas: `blocka-record-n{nivel}-p{piezas}` (por ejemplo, `blocka-record-n1-p4`, `blocka-record-n2-p6`). Si el usuario juega en otra dificultad o avanza de nivel, cada combinación mantiene su propia mejor marca.

---

## 7. Condición de victoria, avance y extras implementados

1. **Sorteo previo de imágenes (Punto Extra 1)**:
   Al iniciar o cambiar de nivel, un overlay muestra la grilla de las 6 miniaturas. Una animación con desaceleración natural (*easing*) recorre las opciones y se detiene con un resplandor en la foto elegida. Al finalizar, revela el tablero barajado y habilita el botón "Comenzar".

2. **Configuración de dificultad (Punto Extra 2)**:
   El HUD incluye botones para seleccionar **4, 6 u 8 piezas**. Mientras el cronómetro corre, los botones se bloquean para evitar cambios durante la partida.

3. **Avance entre niveles y victoria final**:
   Al resolver el nivel (`piezas.every((p) => p.angulo % 360 === 0)`):
   * En niveles 1 a 4: el overlay muestra el tiempo y el botón **“Siguiente nivel”**, que carga una imagen distinta y aplica el siguiente filtro.
   * En nivel 5 (el último): el overlay anuncia **“¡Juego completado!”** y ofrece **“Volver a jugar”** reiniciando desde el Nivel 1.

---

## 8. Estados del juego

```
setupNivel (carga imagen) → Sorteo de miniaturas (Extra 1) → Espera click “Comenzar”
   │
   ▼
enJuego (timer ON, clicks activos: izq -90° / der +90°, dificultad bloqueada)
   │
   ▼
resuelto (RGB original, timer OFF, récord actualizado)
   │
   ├─ Si nivel < 5 ──→ Click “Siguiente nivel” ──→ setupNivel (nivel + 1)
   └─ Si nivel = 5 ──→ Click “Volver a jugar”  ──→ setupNivel (nivel 1)
```

---

## 9. Decisiones y limitaciones conocidas

| Tema | Decisión |
|---|---|
| Recorte cuadrado | La foto se recorta al centro a cuadrado; se pierde un poco de borde pero las rotaciones de cuadrantes cuadrados no dejan huecos. |
| Calidad de rotación | No se usa `toDataURL` (degrada y complica los filtros); el estado de ángulo + redibujado mantiene la calidad. |
| `file://` no sirve | Chrome “taintea” el canvas con imágenes de `file://` y `getImageData` lanza `SecurityError`. **El juego hay que servirlo por HTTP**: Live Server, `python -m http.server`, o el despliegue (GitHub Pages). |
| Táctil | En celular no hay botón derecho: sólo funciona el tap (= gira a la izquierda). Pendiente agregar botones en pantalla (ver `EXTENSION.md`). |
| Hook de test | `window.BlockaJuego` expone `estado()` y `resolver()` para tests automatizados; no afecta el juego. |
| Hilos de rotación | Sólo 0/90/180/270: cualquier rotación compuesta se reduce con el módulo 360. |
| Blur por vecinos vs. por píxel | Los niveles 1-4 son **por píxel** (cada píxel se calcula solo: no pueden desenfocar); el nivel 5 mira la **ventana 5×5** de cada píxel y promedia. Se implementó a mano con dos buffers en vez de `ctx.filter = 'blur(2px)'` porque el enunciado es "filtros que miran a los vecinos", permite verificar valores exactos en tests y controlar el tema del borde (`n` en vez de 25). Ver §5.1. |

---

## 10. Cómo probarlo

1. Servir la carpeta `2 entrega` por HTTP, por ejemplo:
   `python -m http.server 8123` (desde `2 entrega`) y abrir
   `http://127.0.0.1:8123/blocka.html`.
2. Flujo manual: verificar que los clicks **no** giran nada antes de
   “Comenzar”; apretar “Comenzar” (el tiempo arranca); girar piezas con clic
   izq/der; al armar la imagen se quitan los grises, se frena el tiempo y
   aparece el overlay con el récord.
3. Consola (opcional): `BlockaJuego.estado()` muestra ángulos y estado;
   `BlockaJuego.resolver()` fuerza la victoria (útil para tests headless).
