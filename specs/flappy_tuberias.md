# Sistema de Tuberías en Flappy Bird

Guía corta para entender y explicar cómo se crean, dibujan, mueven y chocan las tuberías del juego.

---

## 1. Arquitectura general (2 clases + controlador)

El sistema vive en [`2 entrega/js/FlappyTuberias.js`](../2%20entrega/js/FlappyTuberias.js) y usa el patrón **Factory Method** para separar *qué es una tubería* de *cómo se decide su dificultad*:

* **`ParTuberias` (el objeto en pantalla):** representa un obstáculo concreto (tubo de arriba + tubo de abajo + hueco en el medio). Sabe crearse en el DOM, moverse, dibujarse, chequear colisión y borrarse.
* **`FabricaTuberias` (la fábrica):** decide **dónde** y **con qué tamaño de hueco** nace cada nuevo par de tuberías, aplicando las 3 reglas del TP sin ensuciar el controlador principal.
* **`flappy.js` (el controlador):** en el `loop()`, solo le pide tubos a la fábrica, los mueve a la misma `velocidadActual` que el parallax y chequea si el pájaro chocó.

---

## 2. Cómo se renderiza cada par de tuberías

El juego **no usa `<canvas>`**, sino `<div>` reales dentro de `#flappy-tuberias` (`z-index: 8`, entre el fondo y el pájaro).

Cuando `new ParTuberias(contenedor, x, centroY, gap, sueloY)` se instancia:
1. Calcula los bordes del hueco libre:
   * `huecoArriba = centroY - gap / 2` (alto del tubo superior).
   * `huecoAbajo = centroY + gap / 2` (donde empieza el tubo inferior hasta `sueloY`).
2. Arma esta estructura HTML con flexbox vertical:
   ```text
   .flappy-tubo-par  (ancho 96px, se mueve con translate3d)
     ├── .flappy-tubo--arriba  (de y = 0 hasta huecoArriba)
     │     ├── .flappy-tubo__cuerpo  (flex: 1, se estira al alto necesario)
     │     └── .flappy-tubo__boca    (48px fijos, boca hacia abajo)
     └── .flappy-tubo--abajo   (de huecoAbajo hasta el borde inferior 576px)
           ├── .flappy-tubo__boca    (48px fijos, boca hacia arriba)
           └── .flappy-tubo__cuerpo  (flex: 1, se estira al alto necesario)
   ```
3. **Recorte del sprite (`PipeStyle4.png` en [`flappy.css`](../2%20entrega/css/flappy.css)):**
   La imagen mide `128×96` (8 tubos de `32×48`). Al escalarla 3× (`384×288`), cada tubo mide `96px` de ancho (acorde al sprite del pájaro). Separar **boca fija (`48px`)** y **cuerpo flexible (`flex: 1`)** evita que la boca se estire cuando cambia la altura del tubo; el cuerpo solo estira la franja central verde (`background-size: 384px 600%; background-position: 0 20%`).

---

## 3. Las 3 reglas de la consigna en `FabricaTuberias`

Cada vez que `flappy.js` pide un tubo nuevo con `fabricaTuberias.crear(x)`:

1. **Distancia horizontal variable:** `siguienteDistancia()` sortea cuántos píxeles deben pasar hasta el próximo tubo entre `290px` y `420px` (nunca quedan equidistantes).
2. **Hueco vertical cada vez más chico:** `calcularGap()` arranca en `185px` y resta `4px` por cada tubería creada, con un piso jugable mínimo de `125px`.
3. **Altura variable no alineada:** `calcularCentroY(gap)` sortea `centroY` respetando un margen de `75px` arriba y abajo, y exige al menos `55px` de diferencia respecto al tubo anterior para que no salgan dos huecos a la misma altura.

Al reiniciar la partida, `fabricaTuberias.reset()` vuelve `creadas = 0` y `ultimoCentroY = null`.

---

## 4. Movimiento, colisión y limpieza en el `loop()`

Dentro del bucle de timestep variable (`dt` real de cada frame, acotado a 33 ms) de [`flappy.js`](../2%20entrega/js/flappy.js):

1. **Spawn y movimiento (`actualizarTuberias`):** descuenta `distanciaProximoTubo -= velocidadActual * dt`. Cuando llega a `0`, crea un nuevo par fuera del borde derecho (`x = 1044`) y sortea la próxima distancia. Todos los tubos activos restan `this.x -= velocidadActual * dt`.
2. **Borrado automático:** cuando un tubo sale por la izquierda (`this.x + 96 < 0`), se llama a `tubo.destruir()` (lo elimina del DOM con `.remove()`) y se saca del array `tuberias` para no acumular basura en memoria.
3. **Colisión AABB (`colisionaCon` + `pajaro.getHitbox()`):**
   * `pajaro.getHitbox()` devuelve una caja justa de `26×26px` centrada en el cuerpo del pájaro (más chica que el sprite de `64×64` para no chocar con el aire).
   * Un tubo choca si hay superposición en X (`hitbox.der > this.x && hitbox.izq < this.x + this.ancho`) **y** el pájaro sale del hueco vertical (`hitbox.arriba < this.huecoArriba || hitbox.abajo > this.huecoAbajo`).
   * Si choca, se dispara `pajaro.impactar()` y `terminarPartida('tubo')`.
4. **Render (`dibujarTuberias`):** una sola vez por frame (al final del `loop`), cada tubo actualiza su posición con `translate3d(${this.x}px, 0, 0)`.
