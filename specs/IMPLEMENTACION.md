# Blocka — Implementación del juego (Nivel 1)

Este documento explica **cómo está implementado** el juego ejecutable de Blocka
(`2 entrega/blocka.html` + `js/blocka.js` + `css/blocka.css`), pensado para la
defensa y como referencia para modificarlo. La mecánica general y los filtros de
la cátedra están en [`DOCUMENTACION.md`](DOCUMENTACION.md); acá se describe la
implementación real dentro del sitio.

---

## 1. Archivos que conforman el juego

| Archivo | Rol |
|---|---|
| `2 entrega/blocka.html` | Página del juego. El `<article class="juego-card">` contiene la zona de ejecución: canvas + HUD + overlay de fin. |
| `2 entrega/js/blocka.js` | **Toda la lógica**: banco de imágenes, split en 4 piezas, filtro gris, rotación, temporizador, récord y victoria. |
| `2 entrega/css/blocka.css` | Layout de la zona de ejecución (canvas, HUD, overlay, ayuda) y de las cards informativas de la página. |
| `2 entrega/assets/bancoImagenes/*` | Banco de imágenes (6 fotos de Boca). |

El HTML relevant de la zona de ejecución:

```html
<div class="blocka-mock">
    <div class="blocka-tablero">
        <div class="blocka-lienzo">
            <canvas id="blocka-canvas" class="blocka-canvas"></canvas>
            <div id="blocka-fin" class="blocka-fin" hidden> … overlay de victoria … </div>
        </div>
        <p class="blocka-ayuda">Clic izquierda: gira a la izquierda · Clic derecha: gira a la derecha</p>
    </div>
    <div class="blocka-hud">
        <span class="blocka-hud__nivel">Nivel 1</span>
        <span id="blocka-tiempo" class="blocka-hud__tiempo">00:00</span>
        <span id="blocka-record" class="blocka-hud__record">Récord: --:--</span>
        <button type="button" id="blocka-comenzar" class="btn-primario">Comenzar</button>
    </div>
</div>
```

---

## 2. Cómo se divide la imagen en 4 sub-imágenes (las piezas)

Todo ocurre en `setupNivel()` de `js/blocka.js`. El flujo es:

1. **Recorte central a cuadrado.** La imagen se recorta por el centro a un
   cuadrado de lado `min(ancho, alto)`:

   ```js
   const lado = Math.min(img.naturalWidth, img.naturalHeight);
   const sx = (img.naturalWidth - lado) / 2;   // desplazamiento horizontal
   const sy = (img.naturalHeight - lado) / 2;  // desplazamiento vertical
   ```

   **¿Por qué?** Los cuadrantes deben ser **cuadrados**: si la pieza no es
   cuadrada, al rotarla 90° descubre huecos negros entre piezas (el ancho y el
   alto se intercambian). Con recorte cuadrado, una pieza rotada 90° ocupa
   exactamente su mismo lugar en el tablero.

2. **Canvas fuente.** El cuadrado se dibuja escalado (lado máximo 420 px) en un
   canvas offscreen llamado `fuente`:

   ```js
   fuente.getContext('2d').drawImage(img, sx, sy, lado, lado, 0, 0, cw, ch);
   ```

   `fuente` guarda la imagen **original sin filtro** (se usa al ganar, para
   mostrar el RGB).

3. **Split en 4 cuadrantes.** Se calculan los límites con mitades enteras (para
   lados impares el sobrante va a la derecha/abajo):

   ```js
   const anchoIzq = Math.floor(cw / 2);
   const anchoDer = cw - anchoIzq;
   const altoArr = Math.floor(ch / 2);
   const altoAba = ch - altoArr;
   const zonas = [
       { x: 0,         y: 0,        w: anchoIzq, h: altoArr }, // sup-izq
       { x: anchoIzq,  y: 0,        w: anchoDer, h: altoArr }, // sup-der
       { x: 0,         y: altoArr,  w: anchoIzq, h: altoAba }, // inf-izq
       { x: anchoIzq,  y: altoArr,  w: anchoDer, h: altoAba }  // inf-der
   ];
   ```

4. **Canvas por pieza.** Cada zona se extrae con `drawImage` a un canvas propio
   (mismo primitivo que la cátedra, con la fuente como origen):

   ```js
   const cv = document.createElement('canvas');
   cv.width = z.w; cv.height = z.h;
   cv.getContext('2d').drawImage(fuente, z.x, z.y, z.w, z.h, 0, 0, z.w, z.h);
   aplicarFiltroGrises(cv);            // el filtro vive en la pieza, no en el canvas visible
   ```

5. **Estado de cada pieza.** El array `piezas` es el modelo de estado del juego:

   ```js
   { canvas,          // canvas offscreen con la pieza YA filtrada
     x, y, w, h,      // rectángulo de destino dentro del canvas visible
     cx, cy,          // centro de rotación (= centro del cuadrante)
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

## 5. Filtro del nivel 1: escala de grises

`aplicarFiltroGrises(cv)` aplica la fórmula de luminancia ITU-R BT.601 de la
cátedra **a cada canvas de pieza**, en el setup:

```js
const gris = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
data[i] = data[i + 1] = data[i + 2] = gris;
```

Claves del diseño:

- El filtro se aplica **por pieza y una sola vez**, en el setup del nivel
  (nunca durante el juego), como pide el enunciado.
- El canvas visible **nunca se filtra**: siempre se dibuja desde las piezas ya
  filtradas. Así, al ganar basta dibujar `fuente` (que nunca se tocó) para ver
  la foto original en RGB.
- Al estar el filtro acoplado a la creación de la pieza, el nivel 3 (filtro
  distinto por pieza) sólo requiere cambiar **qué función** se llama en el
  `map` de zonas (ver `EXTENSION.md`).

---

## 6. Temporizador y récord

- **Temporizador**: arranca con el botón **“Comenzar”**
  (`iniciarReloj()`: `setInterval` cada 200 ms que calcula
  `Date.now() - inicioMs` y muestra `mm:ss`). Se frena al resolver.
- **Récord**: se guarda en `localStorage` con la clave `blocka-record-nivel-1`
  (sólo segundos; sólo se actualiza si el tiempo nuevo es mejor). Se muestra en
  el HUD como `Récord: mm:ss`. Si el navegador no da `localStorage`, el juego
  sigue funcionando sin persistir el récord (`try/catch`).

---

## 7. Condición de victoria y fin de nivel

Después de **cada** rotación se llama `verificarVictoria()`:

```js
if (piezas.every((p) => p.angulo % 360 === 0)) ganar();
```

Es decir: **las 4 piezas en ángulo 0** ⇒ imagen armada. En `ganar()`:

1. `resuelto = true` (los clicks quedan bloqueados y `render()` dibuja `fuente`
   sin filtros → RGB).
2. Se frena el cronómetro.
3. Se guarda/actualiza el récord.
4. Se muestra el overlay `#blocka-fin` con el tiempo final y los botones
   **“Jugar de nuevo”** (nueva imagen al azar, mismo nivel) y **“Menú Ppal”**
   (link a `home.html`). El botón “Comenzar” se oculta.

“Jugar de nuevo” llama `setupNivel()`: nueva imagen aleatoria, nuevo split,
nuevo barajo de ángulos, cronómetro a 00:00.

---

## 8. Estados del nivel

```
setup (imagen aleatoria, barajada, gris, clicks BLOQUEADOS)
   │  click “Comenzar”
   ▼
en juego (timer ON, clicks activos: izq -90° / der +90°)
   │  4/4 ángulos = 0
   ▼
resuelto (sin filtros, RGB, timer OFF, récord, overlay)
   │                    │
“Jugar de nuevo”    “Menú Ppal” → home.html
   │
   └──→ setup (loop)
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
