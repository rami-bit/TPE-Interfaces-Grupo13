# Documentación Técnica: Lógica de Tablero, Validación de Movimientos y Captura

Esta documentación detalla la arquitectura, el modelo de datos y los algoritmos implementados para el funcionamiento lógico del juego **Peg Solitaire (Edición Boca Juniors)** sobre HTML5 `<canvas>`, cubriendo el ciclo completo desde la interacción del usuario hasta la mutación del estado matricial y el redibujado gráfico.

---

## 1. Modelo de Datos del Tablero

El sistema implementa una arquitectura desacoplada donde el estado abstracto del juego y la capa visual se mantienen sincronizados mediante referencias de objetos y matrices bidimensionales.

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

Durante la ejecución, la matriz dinámica `tablero[row][col]` adopta una representación de acceso directo ($O(1)$):
* Las casillas inválidas conservan el valor numérico **`-1`**.
* Los huecos vacíos conservan el valor numérico **`0`**.
* Las casillas ocupadas almacenan **la referencia directa al objeto de la ficha** (`FichaTapita` o `FichaCamiseta`), que hereda de `ElementoJuego`.

Adicionalmente, cada instancia de ficha almacena sus coordenadas lógicas actuales (`ficha.row` y `ficha.col`), permitiendo consultar su posición en tiempo constante sin necesidad de recorrer la grilla.

---

## 2. Mapeo Espacial y Transformación de Coordenadas

El fondo del juego proviene de una fotografía real (`tablero.jpeg`, resolución original 2400×1792 px). Debido a la perspectiva fotográfica, la distancia entre agujeros presenta pequeñas variaciones simétricas, resolviéndose mediante calibración discreta por ejes:

```javascript
const COL_X = [796, 931, 1058, 1202, 1346, 1475, 1610];
const ROW_Y = [405, 554, 707, 854, 1002, 1151, 1305];
const CROP  = { x: 650, y: 290, w: 1100, h: 1150 };
```

### Cálculo del Centro de un Agujero (`getCellCenter`)
Para traducir índices de fila y columna al espacio de píxeles internos del canvas, se aplica la compensación del recorte (`CROP`):

$$\text{posX} = \text{COL\_X}[\text{col}] - \text{CROP.x}$$
$$\text{posY} = \text{ROW\_Y}[\text{row}] - \text{CROP.y}$$

### Conversión de Coordenadas de Eventos Mouse
Dado que el canvas se adapta responsivamente mediante CSS (`width: min(100%, ...)`), las coordenadas del mouse en el viewport (`clientX`, `clientY`) difieren de las coordenadas del bitmap interno. La normalización se realiza mediante:

$$\text{scaleX} = \frac{\text{canvas.width}}{\text{rect.width}}, \quad \text{scaleY} = \frac{\text{canvas.height}}{\text{rect.height}}$$
$$\text{canvasX} = (e.\text{clientX} - \text{rect.left}) \times \text{scaleX}$$
$$\text{canvasY} = (e.\text{clientY} - \text{rect.top}) \times \text{scaleY}$$

---

## 3. Algoritmo de Validación de Movimientos

El Peg Solitaire exige que un movimiento sea un salto ortogonal en línea recta de exactamente dos casillas por encima de una ficha adyacente, aterrizando en un hueco vacío.

La función `obtenerMovimientosValidos(ficha)` evalúa de forma determinista las 4 direcciones posibles:

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
   $$0 \le \text{destR} < 7 \quad \text{y} \quad 0 \le \text{destC} < 7$$
2. **Destino Válido y Libre**:
   $$\text{tablero}[\text{destR}][\text{destC}] === 0$$
   *(Si contiene `1`, `-1` o un objeto ficha, queda descartado).*
3. **Presencia de Ficha Intermedia**:
   La casilla intermedia situada a 1 paso ($\text{row} + dr, \text{col} + dc$) debe contener obligatoriamente una ficha activa:
   $$\text{tablero}[\text{medioR}][\text{medioC}] \ne 0 \quad \text{y} \quad \text{tablero}[\text{medioR}][\text{medioC}] \ne -1$$

La función retorna un arreglo de objetos describiendo los movimientos admisibles:
```javascript
{
    direccion: 'arriba' | 'abajo' | 'izquierda' | 'derecha',
    destino: { row: destR, col: destC },
    intermedio: { row: medioR, col: medioC }
}
```

---

## 4. Ciclo de Vida del Drag & Drop y Ejecución de Jugadas

La interacción se gestiona a través de tres fases bien diferenciadas en los manejadores de eventos:

```
[mousedown] ───► [mousemove] ───► [mouseup]
     │                 │               │
     ▼                 ▼               ▼
Seleccionar        Actualizar      ¿Destino Válido?
y traer al frente   posición         ├── SÍ ──► Snap-to-grid + Comer + Actualizar matriz
 (Z-Index top)      y redibujar      └── NO ──► Snap-back a posición de origen
```

### 4.1 Fase de Selección (`onMouseDown`)
* Se recorre `figuras[]` en orden inverso para priorizar la figura visiblemente superior (`findClickedFigure`).
* **Optimización de Profundidad (Z-Index)**: La ficha seleccionada se extrae de su posición actual en el arreglo `figuras[]` y se reinserta al final (`push`). Esto asegura que durante el arrastre se dibuje siempre por encima de las demás piezas.
* Se activa el resaltado perimetral (`setResaltado(true)`).
* Se almacena la posición de origen en `lastClickedPos` para permitir reversiones.

### 4.2 Fase de Arrastre (`onMouseMove`)
* Escuchado sobre el objeto `document` para evitar pérdidas de captura por movimientos rápidos fuera del lienzo.
* Actualiza continuamente las coordenadas de la ficha (`setPos(x, y)`) y solicita el redibujado de la escena (`drawFigures()`).

### 4.3 Fase de Resolución (`onMouseUp`)
Al soltar el botón del mouse, se calcula el destino final:

1. **Chequeo de Límites del Canvas**: Si el usuario soltó fuera del área visible, se aborta y se aplica *snap-back*.
2. **Cálculo de Proximidad al Destino**:
   Se computa la distancia euclidiana entre el punto del mouse y el centro geométrico de cada destino válido reportado por `obtenerMovimientosValidos`:
   $$d = \sqrt{(\text{canvasX} - \text{center.x})^2 + (\text{canvasY} - \text{center.y})^2}$$
   Se acepta la jugada si $d \le \text{FICHA\_RADIO}$ (tolerancia basada en el radio del hueco).

3. **Rama A: Movimiento Válido**:
   * **Snap-to-grid**: Se posiciona la ficha en el centro exacto del nuevo agujero (`setPos(center.x, center.y)`).
   * **Actualización Matricial**:
     * `tablero[origRow][origCol] = 0` (el origen queda liberado).
     * `tablero[destRow][destCol] = lastClickedFigure` (el destino adopta la ficha).
     * `lastClickedFigure.row = destRow; lastClickedFigure.col = destCol;`
   * **Captura de la Ficha Intermedia**:
     * Se recupera la referencia de la ficha comida: `const comida = tablero[medioRow][medioCol]`.
     * Se limpia la celda: `tablero[medioRow][medioCol] = 0`.
     * Se elimina del arreglo de render: `figuras = figuras.filter(f => f !== comida)`.

4. **Rama B: Movimiento Inválido (o caída fuera de tolerancia)**:
   * **Snap-back**: La ficha retorna a `lastClickedPos.x` e `y`.
   * El estado del tablero y el arreglo de figuras permanecen inalterados.

5. **Cierre de Ciclo**:
   * Se apaga el resaltado (`setResaltado(false)`).
   * Se desasigna `lastClickedFigure = null`.
   * Se ejecuta `drawFigures()`.

---

## 5. Pistas Visuales Animadas de Destino (Hints)

Cumpliendo con la consigna obligatoria del trabajo práctico (*"Hints ANIMADOS indicando de dónde puedo largar la ficha, ej: flechas, hints, animaciones"*), el sistema implementa un ciclo de animación continuo mediante `requestAnimationFrame`:

* **Activación eficiente**: El ciclo de animación (`iniciarAnimacionHints()`) se dispara únicamente cuando el usuario selecciona o arrastra una ficha con movimientos válidos. Al soltarla o deseleccionarla, se cancela inmediatamente (`cancelAnimationFrame(animHintsId)`), consumiendo 0% de procesamiento en reposo.
* **Composición visual de cada destino**:
  1. **Onda expansiva periódica**: Un anillo dorado exterior que brota desde el agujero y se disipa hacia afuera cada 1.0 segundo (`radioOnda` y `alphaOnda` graduales).
  2. **Pulso senoidal de fondo**: El radio interno del agujero y la intensidad del resplandor dorado oscilan armónicamente mediante funciones trigonométricas basadas en `performance.now()`.
  3. **Borde perimetral y diana central**: Anillo dorado sólido de 4px con punto indicador en las coordenadas exactas de caída.
  4. **Flecha indicadora animada**: Una flecha dorada con sombra y borde oscuro (`dibujarFlechaIndicadora`) situada arriba del agujero que oscila verticalmente arriba y abajo apuntando al hueco receptor.

---

## 6. Pruebas y Comportamiento Esperado

| Acción del Usuario | Resultado Esperado | Justificación Técnica |
| :--- | :--- | :--- |
| Arrastrar una ficha adyacente al centro hacia `(3, 3)` | La ficha aterriza en el centro, la ficha intermedia desaparece y el total de figuras pasa de 32 a 31. | Cumple: destino es `0`, distancia es 2 y hay ficha intermedia en la posición `1`. |
| Arrastrar una ficha hacia otra casilla ocupada | Snap-back a la casilla de origen. | La casilla destino contiene un objeto ficha (distinto de `0`), por lo que no es un movimiento permitido. |
| Arrastrar una ficha hacia las esquinas | Snap-back a la casilla de origen. | La casilla destino tiene valor `-1`. |
| Arrastrar una ficha en diagonal | Snap-back a la casilla de origen. | El vector de desplazamiento no coincide con ninguna de las 4 direcciones ortogonales. |
| Arrastrar una ficha y soltarla a mitad de camino | Snap-back a la casilla de origen. | La distancia euclidiana supera la tolerancia del radio de hueco (`FICHA_RADIO`). |
| Soltar la ficha fuera del lienzo | Snap-back a la casilla de origen. | El manejador detecta que el puntero excede `getBoundingClientRect()`. |

---

## 7. Puntos de Extensión Futura

La arquitectura actual deja desacopladas las bases para las siguientes etapas:
1. **Detección de Fin de Partida**:
   * **Victoria**: `figuras.length === 1`.
   * **Derrota por Bloqueo**: Iterar sobre `figuras` evaluando `obtenerMovimientosValidos(f).length > 0`. Si ninguna ficha puede moverse y `figuras.length > 1`, se declara bloqueo.
2. **HUD / Temporizador y Reinicio**:
   * Contador de piezas restantes y botón para reiniciar la partida sin recargar la página.

