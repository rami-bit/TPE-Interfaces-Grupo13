# Peg Solitaire — Documentación de Refactorización y Escalabilidad

Este documento detalla las mejoras de arquitectura, limpieza y escalabilidad aplicadas sobre el código de **Peg Solitaire** (`ElementoJuego.js`, `FichaTapita.js`, `FichaCamiseta.js` y `juego.js`), manteniendo intacto el comportamiento funcional del juego pero reduciendo la duplicación y facilitando futuras extensiones.

---

## 1. Aplicación del Patrón *Template Method* en la Jerarquía POO

### Problema previo
En `ElementoJuego.js` existía el método `dibujarImagenEnClip()`, pero ni `FichaTapita` ni `FichaCamiseta` lo invocaban. Ambas subclases repetían manualmente toda la secuencia de contexto 2D (`ctx.save()`, `ctx.beginPath()`, `this.definirPath()`, `ctx.clip()`, `ctx.drawImage(...)`, `ctx.restore()`) y el bloque condicional `if (this.resaltado)` para trazar el borde de selección.

### Solución implementada
Se parametrizó `dibujarImagenEnClip(ancho, alto)` en la clase base `ElementoJuego` para que centralice:
1. El recorte (`clip`) usando la figura geométrica definida polimórficamente por `this.definirPath()`.
2. El dibujado de la imagen centrada en `(this.posX - ancho / 2, this.posY - alto / 2)`.
3. El trazado del contorno de selección (`this.resaltado`) fuera del clip reutilizando el mismo `this.definirPath()`.

```javascript
// En FichaTapita.js
draw() {
    const diametro = this.radius * 2;
    this.dibujarImagenEnClip(diametro, diametro);
}

// En FichaCamiseta.js
draw() {
    this.dibujarImagenEnClip(this.ancho, this.alto);
}
```

* **Ventaja de escalabilidad**: Si en la defensa o en una futura entrega se pide agregar una nueva forma de ficha (por ejemplo, `FichaEscudo` o `FichaBombonera`), la nueva subclase solo necesita implementar `definirPath()` e `isPointInside(x, y)`.

---

## 2. Eliminación de Recálculo Redundante en `onMouseUp`

### Problema previo
Al seleccionar una ficha en `onMouseDown`, se calculaban sus saltos posibles mediante `obtenerMovimientosValidos(clickFig)` y se guardaban en `destinosValidosActivos`. Sin embargo, al soltar el mouse en `onMouseUp`, se volvía a llamar a `obtenerMovimientosValidos(lastClickedFigure)` sobre el mismo tablero sin cambios.

### Solución implementada
`onMouseUp` ahora itera directamente sobre `destinosValidosActivos`, evitando recalcular las 4 direcciones ortogonales dos veces por jugada.

---

## 3. Flujo Único de Salida y *Snap-back* en `onMouseUp`

### Problema previo
`onMouseUp` tenía dos bloques casi idénticos para revertir el movimiento y limpiar el estado:
1. Un bloque temprano `if (!dentroCanvas)` cuando el cursor se soltaba fuera del `<canvas>`.
2. Un bloque final `else` cuando `movElegido == null`.

### Solución implementada
Se eliminó el bloque temprano `if (!dentroCanvas)`. Si el jugador suelta la ficha fuera del canvas, la distancia euclidiana hacia cualquier agujero válido del tablero es siempre mayor a `FICHA_RADIO`, por lo que `movElegido` resulta `null` y el flujo cae naturalmente en el único bloque `else` de *snap-back* y limpieza final.

---

## 4. Acceso Directo $O(1)$ a Coordenadas de Ficha (`ficha.row`, `ficha.col`)

### Problema previo
Existía una función auxiliar `obtenerCoordenadasFicha(ficha)` con un doble bucle `for` de respaldo para buscar la ficha en la matriz 7×7. Dado que todas las fichas reciben sus propiedades `.row` y `.col` al instanciarse, dicho bucle era código muerto.

### Solución implementada
Se eliminó `obtenerCoordenadasFicha` y `obtenerMovimientosValidos(ficha)` lee directamente `const { row, col } = ficha`. Además, el bucle `while` de `hayMovimientosPosiblesEnTablero()` ahora reutiliza la función `puedeRealizarMovimiento(ficha)` para mejorar la legibilidad semántica.

---

## 5. Centralización de Conversión de Coordenadas del Mouse (`obtenerPosicionMouse`)

### Problema previo
La fórmula de escalado entre píxeles CSS del viewport (`getBoundingClientRect()`) y píxeles internos del canvas (`canvas.width / rect.width`) estaba escrita tres veces (`onMouseDown`, `onMouseMove` y `onMouseUp`).

### Solución implementada
Se extrajo la función `obtenerPosicionMouse(e)` que retorna `{ x, y }` ya escalados a la resolución interna `1100×1150`, invocándola en una sola línea dentro de los tres eventos de mouse.

---

## 6. Centralización de Instanciación en el Tablero (`colocarFichaEnCelda` y `limpiarTableroVacio`)

### Problema previo
Los 6 pasos para dar de alta una ficha en una celda (calcular centro en píxeles, crear ficha aleatoria, asignar `.row` y `.col`, guardarla en `tablero[r][c]` y agregarla a `figuras[]`) estaban triplicados entre `initTablero()`, `debugCasiGanar()` y `debugDerrota()`.

### Solución implementada
* Se creó `colocarFichaEnCelda(row, col)` que encapsula esos 6 pasos en un único punto.
* Se creó `limpiarTableroVacio()` para inicializar la grilla sin fichas en las pruebas de consola.
* En `initTablero()`, las celdas sin ficha inicial copian directamente `tablero[row][col] = TABLERO_BASE[row][col]` sin operadores ternarios redundantes.

---

## 7. Desacoplamiento de Constantes (`TAM_TABLERO` y `DIRECCIONES`)

### Problema previo
El literal numérico `7` aparecía hardcodeado en múltiples bucles y validaciones de bordes, y el arreglo de direcciones se recreaba en cada llamada a `obtenerMovimientosValidos`.

### Solución implementada
* Se definió `const TAM_TABLERO = TABLERO_BASE.length;` para todos los recorridos y chequeos de límites.
* Se declaró `const DIRECCIONES` una única vez a nivel de módulo. Si se quisiera cambiar las dimensiones del tablero o agregar nuevas direcciones de salto, se modifica únicamente la configuración superior sin tocar la lógica algorítmica.

