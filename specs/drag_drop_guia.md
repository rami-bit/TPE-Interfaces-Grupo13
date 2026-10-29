# Guía de Implementación: Drag & Drop de Figuras en Canvas y Consideraciones para PEG Solitary

Esta guía explica en detalle cómo implementar la funcionalidad de **Drag & Drop** (Arrastrar y Soltar) para figuras geométricas en un elemento HTML5 `<canvas>` utilizando JavaScript orientado a objetos, analizando el funcionamiento de las funciones provistas por la cátedra (`onMouseDown`, `onMouseMove`, `onMouseUp`) y estableciendo pautas clave para agentes de desarrollo al construir el juego **PEG Solitary**.

---

## 1. Arquitectura Base y Detección de Colisiones

Para lograr que las figuras respondan a eventos del mouse, el sistema se apoya en una estructura orientada a objetos:
- **`Figure`**: Clase base que almacena posición (`posX`, `posY`), color (`fill`), estado de selección (`resaltado`) y referencia al contexto 2D del canvas (`ctx`).
- **`Circle` / `Rectangle`**: Subclases que extienden `Figure` e implementan su propio método de renderizado (`draw()`) y de detección geométrica (`isPointInside(x, y)`).

### Detección de Impacto (`isPointInside`)
Antes de iniciar un arrastre, es necesario saber si el cursor del usuario se encuentra dentro de los límites de una figura:
- **Círculo**: Utiliza la distancia euclidiana entre el punto del mouse y el centro del círculo comparada con su radio.
- **Rectángulo**: Verifica si las coordenadas `(x, y)` se encuentran dentro del rango de ancho y alto del rectángulo.

Para manejar la **superposición** (cuando una figura está visualmente encima de otra), el arreglo de figuras se recorre en **orden inverso** (desde la última dibujada —la que está más arriba— hasta la primera):

```javascript
function findClickedFigure(x, y) {
    for (let i = figures.length - 1; i >= 0; i--) {
        let f = figures[i];
        if (f.isPointInside(x, y)) {
            return f;
        }
    }
    return null;
}
```

---

## 2. Análisis de las Funciones Provistas por la Cátedra

Las interacciones del mouse sobre el canvas se controlan mediante tres eventos principales vinculados a las funciones provistas:

### A. `onMouseDown(e)`
Se ejecuta al presionar el botón del mouse sobre el canvas. Su objetivo es iniciar el ciclo de selección y preparación para el arrastre.

```javascript
function onMouseDown(e) {
    isMouseDown = true;

    // Si ya había una figura seleccionada previamente, se le quita el resaltado
    if (lastClickedFigure != null) {
        lastClickedFigure.setResaltado(false);
        lastClickedFigure = null;
    }

    // Se busca qué figura fue clickeada usando las coordenadas relativas del evento (offsetX, offsetY)
    let clickFig = findClickedFigure(e.offsetX, e.offsetY);

    if (clickFig != null) {
        clickFig.setResaltado(true);
        lastClickedFigure = clickFig;   
    }
    
    // Se redibuja el canvas para reflejar el estado de resaltado
    drawFigures();
}
```
* **Puntos clave**:
  * `isMouseDown = true`: Activa la bandera que indica que el usuario está "agarrando" el mouse.
  * `e.offsetX` y `e.offsetY`: Coordenadas exactas del cursor relativas al canvas.
  * **Resaltado**: Permite identificar visualmente qué figura está activa.

---

### B. `onMouseMove(e)`
Se ejecuta continuamente mientras el mouse se desplaza sobre el canvas. Es el motor del movimiento fluido de la figura seleccionada.

```javascript
function onMouseMove(e) {
    // Solo se mueve si el botón está presionado y hay una figura activa
    if (isMouseDown && lastClickedFigure != null) {
        lastClickedFigure.setPosition(e.offsetX, e.offsetY);
        drawFigures();
    }
}
```
* **Puntos clave**:
  * **Condición de guardia**: Requiere tanto `isMouseDown === true` como tener una `lastClickedFigure` válida. Evita que las figuras se muevan solas sin haber sido clickeadas.
  * **Actualización en tiempo real**: Modifica la posición de la figura con las nuevas coordenadas del mouse y llama inmediatamente a `drawFigures()` (que limpia el canvas con `clearRect` y redibuja todos los elementos).

---

### C. `onMouseUp(e)`
Se ejecuta al soltar el botón del mouse. Finaliza la acción de arrastre.

```javascript
function onMouseUp(e) {
    isMouseDown = false;
}
```
* **Puntos clave**:
  * `isMouseDown = false`: Desactiva la bandera de arrastre, deteniendo el seguimiento del mouse en `onMouseMove`.
  * *Nota de diseño*: En aplicaciones genéricas solo limpia el estado, pero en juegos interactivos es el punto neurálgico para validar reglas de negocio (como soltar una ficha en un casillero válido).

---

## 3. Consideraciones para Agentes (IA) en el Desarrollo de PEG Solitary

Cuando un agente de IA diseña o implementa el juego **PEG Solitary** sobre un canvas utilizando estas funciones base, debe tener en cuenta las siguientes consideraciones arquitectónicas y lógicas:

### 1. Validación de Reglas de Negocio vs. Movimiento Libre
* **Problema**: El comportamiento por defecto de `onMouseMove` permite soltar la ficha en *cualquier* coordenada libre de la pantalla.
* **Solución del Agente**: Al dispararse `onMouseUp`, el sistema no debe simplemente dejar la ficha donde quedó el cursor. Debe evaluar si la posición final coincide con un **agujero de destino válido** según las reglas de PEG Solitary (es decir, saltar una ficha adyacente hacia un espacio vacío).

### 2. Mecanismo de "Snap-to-Grid" (Alineación Magnética) y Rollback
* **Movimiento Válido**: Si el usuario suelta la ficha sobre un casillero de destino permitido, la posición de la ficha debe ajustarse automáticamente al centro exacto de dicho casillero (`hole.getX()`, `hole.getY()`).
* **Movimiento Inválido (Rollback)**: Si el usuario suelta la ficha en un espacio vacío no permitido o fuera del tablero, el agente debe implementar un mecanismo de **reversión** que devuelva la ficha a su posición original antes de iniciar el arrastre.

### 3. Separación entre Modelo de Datos (Lógica) y Vista (Canvas)
* El agente debe mantener una estructura de datos abstracta del tablero (por ejemplo, una matriz bidimensional o un grafo de posiciones) totalmente independiente de las coordenadas en píxeles del canvas.
* La detección de sobre qué agujero se soltó la ficha debe calcularse mediante la distancia euclidiana entre el centro de la ficha soltada y las posiciones predefinidas de los agujeros del tablero.

### 4. Rendimiento y Ciclo de Renderizado (`drawFigures`)
* Redibujar todo el canvas completo con `ctx.clearRect()` y bucles `forEach` en cada evento `mousemove` puede causar parpadeo (*flickering*) o caídas de rendimiento si hay muchos elementos.
* El agente debe optimizar el redibujo, ya sea validando si hubo cambios reales antes de redibujar, o separando las capas estáticas (tablero y agujeros fijos) de las capas dinámicas (fichas en movimiento).
