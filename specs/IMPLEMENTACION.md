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
| `2 entrega/js/filtros.js` | **Módulo independiente de filtros**: grises (ITU-R BT.601), brillo (+30%) y negativo sobre `ImageData`. |
| `2 entrega/js/blocka.js` | **Toda la lógica del juego**: banco de imágenes, división dinámica en 4/6/8 piezas cuadradas, sorteo previo, progresión de 4 niveles, rotación, temporizador, récord por nivel/piezas y victoria. |
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
   * En niveles 1 a 3: el overlay muestra el tiempo y el botón **“Siguiente nivel”**, que carga una imagen distinta y aplica el siguiente filtro.
   * En nivel 4: el overlay anuncia **“¡Juego completado!”** y ofrece **“Volver a jugar”** reiniciando desde el Nivel 1.

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
   ├─ Si nivel < 4 ──→ Click “Siguiente nivel” ──→ setupNivel (nivel + 1)
   └─ Si nivel = 4 ──→ Click “Volver a jugar”  ──→ setupNivel (nivel 1)
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
