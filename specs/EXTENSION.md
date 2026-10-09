# Blocka — Guía de extensión

Guía para agentes/personas que quieran **extender el juego** (más niveles,
filtros, imágenes, controles táctiles, etc.). Lee primero
[`IMPLEMENTACION.md`](IMPLEMENTACION.md) para entender el modelo actual.

Punto de partida: **nivel 1 funcional** (imagen aleatoria del banco, 4 piezas
barajadas, filtro gris, temporizador con “Comenzar”, récord en
`localStorage`, overlay de victoria con “Jugar de nuevo”).

---

## 0. Reglas de oro antes de tocar nada

1. El juego se sirve **por HTTP** (nunca `file://`): `getImageData` falla con
   el canvas “tainted” de `file://`.
2. El estado del juego vive en `js/blocka.js` (`piezas`, `enJuego`,
   `resuelto`, tiempos). **No** guardes estado en el DOM.
3. El canvas visible **nunca se filtra ni se “snapshottea”**: siempre se
   redibuja desde las piezas (y desde `fuente` al ganar).
4. Los filtros se aplican **una sola vez, en el setup**, por pieza.

---

## 1. Cambiar o agregar imágenes al banco

En `js/blocka.js`, la constante `BANCO_IMAGENES`:

```js
const BANCO_IMAGENES = [
    'assets/bancoImagenes/bombonera.jpg',
    // agregar nuevas rutas acá
];
```

- Sólo hay que agregar la ruta (relativa a `2 entrega/`) y dropear el archivo
  en `assets/bancoImagenes/`.
- La selección aleatoria usa Fisher–Yates y, si una imagen falla al cargar
  (`onerror`), se intenta con la siguiente del barajado.
- No hace falta que sean cuadradas: el setup recorta al centro a cuadrado.

---

## 2. Cambiar el filtro de un nivel (o agregar uno nuevo)

Los filtros son funciones `(canvas) => void` que mutan los píxeles con
`getImageData` / `putImageData`, igual que la cátedra. Ya existe
`aplicarFiltroGrises`. Para sumar brillo y negativo:

```js
function aplicarFiltroBrillo(cv) {                    // brillo +30%
    const c = cv.getContext('2d');
    const imageData = c.getImageData(0, 0, cv.width, cv.height);
    const data = imageData.data;
    const amount = 255 * 0.3;                          // 30% del rango
    for (let i = 0; i < data.length; i += 4) {
        data[i]     = Math.min(255, data[i] + amount);
        data[i + 1] = Math.min(255, data[i + 1] + amount);
        data[i + 2] = Math.min(255, data[i + 2] + amount);
    }
    c.putImageData(imageData, 0, 0);
}

function aplicarFiltroNegativo(cv) {                   // negativo
    const c = cv.getContext('2d');
    const imageData = c.getImageData(0, 0, cv.width, cv.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i]     = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
    }
    c.putImageData(imageData, 0, 0);
}
```

El único punto donde se aplica un filtro es el `map` de zonas dentro de
`setupNivel()`:

```js
aplicarFiltroGrises(cv);   // ← acá se decide qué filtro recibe la pieza
```

---

## 3. Agregar los niveles 2 y 3 (siguiendo el diseño de la cátedra)

| Nivel | Filtro | Dónde |
|---|---|---|
| 1 | Grises, imagen completa | **Hecho** — `aplicarFiltroGrises` a las 4 piezas (como si fuera “completa”). |
| 2 | Brillo 30%, imagen completa | Igual que el 1 pero llamando `aplicarFiltroBrillo` en las 4 piezas. |
| 3 | Negativo **distinto por pieza** | Elegir el filtro **por índice de zona** en el `map`. |

Esquema sugerido de configuración por nivel (todo junto en un objeto, arriba
del archivo):

```js
const NIVELES = [
    { nombre: 'Nivel 1', recordKey: 'blocka-record-nivel-1', filtro: aplicarFiltroGrises },
    { nombre: 'Nivel 2', recordKey: 'blocka-record-nivel-2', filtro: aplicarFiltroBrillo },
    { nombre: 'Nivel 3', recordKey: 'blocka-record-nivel-3', filtro: null } // ver abajo
];

// dentro del map de zonas (i = índice de la zona 0..3):
const nivel = NIVELES[nivelActual];
if (nivel.filtro) {
    nivel.filtro(cv);
} else {
    // nivel 3: un filtro distinto por pieza
    const filtros = [aplicarFiltroGrises, aplicarFiltroBrillo, aplicarFiltroNegativo];
    filtros[i % filtros.length](cv);
}
```

Checklist al agregar un nivel:

- [ ] Cambiar `Nivel 1` del HUD por el número real (hoy está hardcodeado en el
      HTML: `<span class="blocka-hud__nivel">Nivel 1</span>`; conviene moverlo
      a un `id` y setearlo desde JS).
- [ ] Cambiar `CLAVE_RECORD` por nivel (hoy es fija:
      `'blocka-record-nivel-1'`); usar `nivel.recordKey`.
- [ ] Mantener el filtro **sólo en el setup**.

---

## 4. Flujo “siguiente nivel” (cuando exista más de un nivel)

Hoy el overlay de victoria tiene **“Jugar de nuevo”** (repite el nivel 1 con
imagen nueva) y **“Menú Ppal”**. Cuando haya varios niveles, en `ganar()`
agregar un botón “Siguiente nivel”:

```js
// en ganar(), al mostrar el overlay:
btnSiguiente.hidden = false;

// listener:
btnSiguiente.addEventListener('click', () => {
    nivelActual = Math.min(nivelActual + 1, NIVELES.length - 1);
    setupNivel();
});
```

- Al pasar de nivel: `setupNivel()` ya resetea `enJuego`, `resuelto`, el
  cronómetro y el overlay; sólo falta que use el `NIVELES[nivelActual]`.
- “Jugar de nuevo” puede quedar como “repetir este nivel” (misma imagen al
  azar, mismo filtro).
- El overlay está en el HTML de `blocka.html` (`.blocka-fin`); el botón nuevo
  se agrega en `.blocka-fin__acciones` y se oculta con `hidden` **y** una regla
  CSS `[hidden] { display: none }` (o clase específica), porque los botones
  `.btn-primario` usan `display: inline-flex` y pisan el `hidden` nativo.

---

## 5. Cambiar cuántas piezas tiene la blocka (por ahora, no recomendado)

El split actual calcula 2×2 zonas. Para un N×N habría que:

1. Reemplazar el array `zonas` por un doble `for` con
   `w = floor(cw / N)`, sobrante a la última fila/columna.
2. `piezaEn(x, y)` sigue funcionando si cada pieza guarda su `x,y,w,h`.
3. La condición de victoria sigue siendo `every(angulo % 360 === 0)`.
4. El `cx, cy` de cada pieza es su centro, sin cambios.

No está implementado: el enunciado pide 4 partes.

---

## 6. Controles táctiles (pendiente conocido)

En celular no existe click derecho ⇒ sólo se puede girar a la izquierda.
Alternativas (por orden de simplicidad):

1. **Dos botones flotantes** sobre el canvas (“↺” / “↻”) que rotan la pieza
   seleccionada; seleccionar pieza con un tap.
2. **Tap gira a la izquierda, doble-tap gira a la derecha.**
3. **Long-press = derecha.**

Implementación mínima sugerida: detectar el evento táctil en el canvas
(`touchstart`), elegir la pieza con `changedTouches[0]` (misma matemática que
el `mousedown`) y rotar −90°; agregar los botones ↺/↻ en
`blocka.html` dentro de `.blocka-lienzo` (ocultos en desktop con
`@media (hover: hover)`).

---

## 7. Cómo testear cambios

- Manual por HTTP: `python -m http.server 8123` desde `2 entrega` →
  `http://127.0.0.1:8123/blocka.html`.
- Automatizado (como se hizo para el nivel 1): página temporal que incluya el
  mismo markup + `js/blocka.js` y ejerza el flujo con `dispatchEvent` de
  `MouseEvent`, usando el hook:

  ```js
  BlockaJuego.estado();   // { enJuego, resuelto, angulos, tiempoMs }
  BlockaJuego.resolver(); // fuerza la victoria (para probar el overlay/fin)
  ```

  Verificar: clicks ignorados antes de “Comenzar”; rotación izq (−90) y der
  (+90); victoria ⇒ overlay visible, “Comenzar” oculto, imagen en RGB;
  “Jugar de nuevo” ⇒ estado limpio y ángulos barajados.

---

## 8. Deudas / pendientes del backlog

- [ ] Nivel 2 (brillo 30%) y nivel 3 (filtro distinto por pieza).
- [ ] Botón “Siguiente nivel” + numeración real de niveles en el HUD.
- [ ] Controles táctiles (ver sección 6).
- [ ] Opcional: `devicePixelRatio` para canvas más nítido en pantallas hiDPI.
- [ ] Opcional: sonidos / feedback al rotar o al resolver.
