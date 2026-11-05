# Documentación Técnica: Lógica de Tablero, Validación de Movimientos, Captura y Fin de Juego

Esta documentación detalla la arquitectura, el modelo de datos y los algoritmos implementados para el funcionamiento lógico del juego **Peg Solitaire (Edición Boca Juniors)** sobre HTML5 `<canvas>`, cubriendo el ciclo completo desde la interacción del usuario hasta la mutación del estado matricial, las animaciones y el control de fin de partida.

---

## 1. Modelo de Datos del Tablero

El sistema implementa una arquitectura desacoplada donde el estado abstracto del juego y la capa visual se mantienen sincronizados mediante referencias de objetos y una matriz bidimensional parametrizada por `TAM_TABLERO = TABLERO_BASE.length`.

### 1.1 Plantilla Estática (`TABLERO_BASE`)

El tablero inglés tradicional de 7×7 casillas en forma de cruz se define mediante una matriz estática de valores numéricos enteros:

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

| Valor | Significado | Comportamiento en Juego |
| :---: | :--- | :--- |
| **`-1`** | Casilla no jugable | Esquinas muertas de la cuadrícula; fuera de los límites del tablero. |
| **`0`** | Casilla válida vacía | Agujero habilitado sin ficha; receptor potencial de un salto. |
| **`1`** | Casilla jugable ocupada | Agujero que inicia la partida con una ficha activa. |

### 1.2 Matriz de Estado en Tiempo de Ejecución (`tablero`)

Durante la ejecución, la matriz dinámica `tablero[row][col]` adopta una representación de acceso directo ($O(1)$) inicializada a través de `colocarFichaEnCelda(row, col)`:
* Las casillas inválidas conservan el valor numérico **`-1`**.
* Los huecos vacíos conservan el valor numérico **`0`**.
* Las casillas ocupadas almacenan **la referencia directa al objeto de la ficha** (`FichaTapita`), que hereda de `ElementoJuego`.
* Cada instancia almacena sus coordenadas lógicas (`ficha.row` y `ficha.col`), permitiendo consultar su posición en $O(1)$ sin recorrer la grilla.

---

## 2. Mapeo Espacial y Transformación de Coordenadas

El fondo del juego proviene de una fotografía real (`tablero.jpeg`, resolución original 2400×1792 px). Debido a la perspectiva fotográfica, la distancia entre agujeros se calibra por ejes:

```javascript
const COL_X = [796, 931, 1058, 1202, 1346, 1475, 1610];
const ROW_Y = [405, 554, 707, 854, 1002, 1151, 1305];
const CROP  = { x: 403, y: 280, w: 1600, h: 1150 };
```

### Cálculo del Centro de un Agujero (`getCellCenter`)
$$\text{posX} = \text{COL\_X}[\text{col}] - \text{CROP.x}, \quad \text{posY} = \text{ROW\_Y}[\text{row}] - \text{CROP.y}$$

### Conversión Centralizada de Eventos Mouse (`obtenerPosicionMouse`)
Dado que el canvas se adapta responsivamente mediante CSS, las coordenadas del mouse en el viewport (`clientX`, `clientY`) se normalizan en una única función reutilizada por `onMouseDown`, `onMouseMove` y `onMouseUp`:

$$\text{scaleX} = \frac{\text{canvas.width}}{\text{rect.width}}, \quad \text{scaleY} = \frac{\text{canvas.height}}{\text{rect.height}}$$
$$\text{x} = (e.\text{clientX} - \text{rect.left}) \times \text{scaleX}, \quad \text{y} = (e.\text{clientY} - \text{rect.top}) \times \text{scaleY}$$

---

## 3. Algoritmo de Validación de Movimientos

La función `obtenerMovimientosValidos(ficha)` lee directamente `ficha.row` y `ficha.col` y evalúa el arreglo constante `DIRECCIONES` (las 4 direcciones ortogonales):

```
           [Arriba] (row - 2, col)
                     ▲
                     │
 [Izquierda] ◄── Ficha ──► [Derecha]
(row, col - 2)       │      (row, col + 2)
                     ▼
           [Abajo] (row + 2, col)
```

### Condiciones Requeridas por Dirección (`dr`, `dc`):
1. **Límites de Grilla**:
   $$0 \le \text{destR} < \text{TAM\_TABLERO} \quad \text{y} \quad 0 \le \text{destC} < \text{TAM\_TABLERO}$$
2. **Destino Válido y Libre**:
   $$\text{tablero}[\text{destR}][\text{destC}] === 0$$
3. **Presencia de Ficha Intermedia**:
   $$\text{tablero}[\text{medioR}][\text{medioC}] \ne 0 \quad \text{y} \quad \text{tablero}[\text{medioR}][\text{medioC}] \ne -1$$

---

## 4. Ciclo de Vida del Drag & Drop y Ejecución de Jugadas

```
[mousedown] ───► [mousemove] ───► [mouseup]
     │                 │               │
     ▼                 ▼               ▼
Seleccionar,       Actualizar      ¿Cae en uno de destinosValidosActivos?
traer al frente     posición         ├── SÍ ──► Snap-to-grid + Comer (animación pop) + Verificar fin
y calcular hints   y redibujar       └── NO ──► Snap-back unificado a posición de origen
```

1. **`onMouseDown`**:
   * Convierte la posición con `obtenerPosicionMouse(e)` y busca la figura superior con `findClickedFigure`.
   * Reubica la ficha al final de `figuras[]` (Z-Index superior).
   * Calcula **una sola vez** `destinosValidosActivos = obtenerMovimientosValidos(clickFig)` y activa `iniciarAnimacionHints()`.
2. **`onMouseMove`**:
   * Actualiza `lastClickedFigure.setPos(canvasX, canvasY)` y redibuja.
3. **`onMouseUp`**:
   * Reutiliza `destinosValidosActivos` sin recalcular movimientos.
   * Si la distancia euclidiana a algún destino válido es $\le \text{FICHA\_RADIO}$, centra la ficha (**snap-to-grid**), actualiza `tablero`, retira la ficha intermedia de `figuras[]`, lanza `animacionEliminarFicha()` y evalúa `verificarFinDelJuego()`.
   * En cualquier otro caso (movimiento inválido o soltado fuera del canvas), ejecuta **snap-back** a `lastClickedPos` y limpia el estado en un único flujo de salida.

---

## 5. Animaciones Visuales (`requestAnimationFrame`)

1. **Pistas de Destino (`drawHints`)**:
   * Onda expansiva periódica exterior (`1s`), fondo dorado con pulso senoidal, diana central y flecha superior flotante (`dibujarFlechaIndicadora`).
2. **Eliminación con Rebote Elástico (`animacionEliminarFicha`)**:
   * **Fase `"creciendo"`**: Incrementa `escala += 0.08` hasta superar `1.3` (efecto *pop* de impacto).
   * **Fase `"encogiendo"`**: Contrae la ficha multiplicativamente (`escala *= 0.88`, decaimiento *ease-out*) escalando desde su propio centro (`translate(x, y)` → `scale` → `translate(-x, -y)`) hasta `escala <= 0.03`.

---

## 6. Detección de Fin de Partida, Temporizador y Reinicio

* **Búsqueda de Movimientos con Corte Temprano (`hayMovimientosPosiblesEnTablero`)**:
  Recorre `figuras[]` con un bucle `while (i < figuras.length && !hayMovimiento)` que invoca `puedeRealizarMovimiento(figuras[i])`. En cuanto una sola ficha tiene al menos un salto disponible, corta la iteración devolviendo `true`.
* **Verificación Posterior a Cada Salto (`verificarFinDelJuego` y `mostrarFinDeJuego`)**:
  1. **Victoria**: `figuras.length === 1` → invoca `mostrarFinDeJuego(true, ...)`.
  2. **Derrota por Bloqueo**: `!hayMovimientosPosiblesEnTablero()` → invoca `mostrarFinDeJuego(false, ...)`.
  3. **`mostrarFinDeJuego(victoria, mensaje)`** centraliza la parada del reloj (`detenerTimer()`), la limpieza de `destinosValidosActivos`, la cancelación de `animHintsId` y la activación del modal.
* **Temporizador Regresivo (`300s` / `05:00`)**:
  Actualiza `#peg-timer-display` cada segundo, activa `.peg-timer--peligro` en los últimos 30 segundos y finaliza la partida con `mostrarFinDeJuego(null, ...)` al llegar a `0`.
* **Reinicio y Cambio de Tapita (`reiniciarJuego` y `abrirMenuFichas`)**:
  `reiniciarJuego()` restablece el tablero, limpia selecciones y reinicia el cronómetro (también invocado desde `iniciarPartida()`), mientras que `abrirMenuFichas()` permite volver al selector de tapitas al terminar una partida.
