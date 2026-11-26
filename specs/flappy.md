# Flappy Bird — Implementación y defensa

Documento técnico del Flappy Bird de **Code Play** (`2 entrega/flappybird.html`). Explica cómo está implementado el juego, por qué se tomaron las decisiones principales y qué conviene responder en la defensa.

Está pensado para leerse con el código al lado. Si algo de este documento no coincide con el código, **manda el código**.

---

## Dos aclaraciones antes de empezar

1. **“Misma performance” no significa mismos FPS.** Los FPS dependen del dispositivo. Lo que el juego garantiza es que la **velocidad de simulación** sea la misma: toda la física está expresada en píxeles por segundo y el avance de cada frame se calcula con el tiempo real transcurrido. Un equipo de 144 Hz y uno de 60 Hz mueven el mundo a la misma velocidad relativa.
2. **“Agarrar al enemigo” es una colisión con `bird-2`.** En esta implementación, tocar ese ave no la captura ni suma puntos: la elimina y **agranda al jugador un 10% como penalización** (hasta 1,5×). El `bird-3` es visual y no colisiona. Ninguna de las dos termina la partida.

---

## Contenido

0. Cómo se cubre la consigna
1. Resumen ejecutivo
2. Archivos y arquitectura
3. Escenario lógico y responsive
4. Movimiento del escenario
5. Movimiento del jugador
6. Timestamp y loop
7. Animaciones y keyframes
8. Colisiones
9. Fábrica y ciclo de vida
10. Dificultad, puntaje y estados
11. Input y accesibilidad
12. Performance y decisiones
13. Guion corto de defensa
14. Preguntas probables
15. Cheat sheet
16. Cómo probarlo
17. Glosario y referencias

---

## Cómo se cubre la consigna

| Punto de la consigna | Dónde está en el código | Sección |
|---|---|---|
| Animaciones y keyframes | `flappy.css` (sprites, `@keyframes`, `step-end`), `FlappyPajaro.setSprite` | §7 |
| Movimiento del escenario y del jugador | `flappy.js` (parallax, tuberías, aves), `FlappyPajaro.js` / `FlappyFisica` | §4 y §5 |
| Colisiones con tuberías y con el enemigo | `ParTuberias.colisionaCon`, `FlappyAveBonus.colisionaCon`, `FlappyPajaro.getHitbox` | §8 |
| Timestamp y misma velocidad en cualquier dispositivo | `loop(ahora)`, `dt`, `DT_MAXIMO` | §6 |
| Factory para cargar y borrar elementos | `FabricaTuberias`, `FabricaAvesBonus`, arrays y `splice` | §9 |
| Contexto y decisiones extra | Escalado, dificultad, estados, input, accesibilidad, performance | §3, §10, §11 y §12 |

> Si en la defensa se pregunta “¿dónde está cada cosa?”, esta tabla es el atajo: cada punto de la consigna tiene una sección y un archivo concretos.

---

## 1. Resumen ejecutivo

- **No usa `<canvas>`**: el juego está hecho con `<div>` reales y CSS. Las capas del bosque, las tuberías, las aves y el pájaro son elementos del DOM que se mueven con `transform`.
- **El escenario es lógico y fijo**: 1024×576 px. El CSS lo escala al tamaño disponible, pero la física, las colisiones y las velocidades siempre trabajan en ese sistema de coordenadas.
- **El tiempo manda**: el loop usa el timestamp de `requestAnimationFrame`, calcula un `dt` en segundos y lo acota a `1/30` para que un tirón no teletransporte al pájaro.
- **El jugador no avanza en X**: queda fijo en `X_PANTALLA = 220`. El mundo se desplaza hacia la izquierda: tuberías, aves y capas de parallax.
- **La creación está encapsulada**: `FabricaTuberias` y `FabricaAvesBonus` deciden cómo nace cada obstáculo o ave. El controlador solo pide, actualiza, dibuja y destruye.
- **Las colisiones son AABB**: una hitbox de 26×26 px, más chica que el sprite de 64×64, para que el juego sea justo. La colisión con tuberías primero descarta por X y después pregunta si el pájaro se salió del hueco.
- **Las animaciones viven en CSS**: sprite sheets de 4 frames, `step-end` / `steps(1, end)` y keyframes para aleteo, flote, impacto, penalización y modal. El loop solo mueve contenedores.
- **La partida tiene estado y objetivo**: 50 puntos en 120 segundos; la velocidad sube cada 15 tuberías y el hueco se achica hasta un mínimo de 125 px.

> **La frase de la defensa:** “El juego no depende de los FPS: toda la física está en unidades por segundo y cada frame avanza según el timestamp de `requestAnimationFrame`, acotado para que un tirón no rompa las colisiones.”

---

## 2. Archivos y arquitectura

### 2.1 Archivos

| Archivo | Rol |
|---|---|
| `2 entrega/flappybird.html` | Página del juego. Contiene el marco, el lienzo lógico, las capas, los contenedores de tuberías/aves, el pájaro, el HUD y el overlay. |
| `2 entrega/css/flappy.css` | Estilos del juego: escalado, parallax, tuberías, aves, pájaro, keyframes, HUD, overlay y responsive. |
| `2 entrega/js/FlappyPajaro.js` | Física (`FlappyFisica`), configuración global (`FLAPPY_CONFIG`) y clase `FlappyPajaro` (estado, sprite, hitbox, suelo/techo). |
| `2 entrega/js/FlappyTuberias.js` | Clase `ParTuberias` (producto) y `FabricaTuberias` (fábrica con las reglas de dificultad). |
| `2 entrega/js/FlappyAvesBonus.js` | Clase `FlappyAveBonus` (ave) y `FabricaAvesBonus` (variantes `bird-2` / `bird-3`). |
| `2 entrega/js/flappy.js` | Controlador principal: estado de partida, loop, input, HUD, puntaje, colisiones, overlay y debug. |
| `2 entrega/js/header.js` | Header compartido del sitio; no participa de la lógica del juego. |

### 2.2 Orden de carga

Al final del `<body>` de `flappybird.html`:

```html
<script src="js/header.js"></script>
<script src="js/FlappyPajaro.js"></script>
<script src="js/FlappyTuberias.js"></script>
<script src="js/FlappyAvesBonus.js"></script>
<script src="js/flappy.js"></script>
```

Son scripts clásicos, no módulos: comparten el scope global y se ejecutan en orden. Cuando arranca `flappy.js`, ya existen `FlappyFisica`, `FLAPPY_CONFIG`, `FlappyPajaro`, `ParTuberias`, `FabricaTuberias`, `FlappyAveBonus` y `FabricaAvesBonus`.

`flappy.js` es una IIFE con `'use strict'`: el estado de la partida queda en un closure privado y solo se expone `window.FlappyDebug` para la demo.

### 2.3 Responsabilidades

| Capa | Sabe de... | No sabe de... |
|---|---|---|
| `FlappyPajaro` | Su estado físico, su sprite, su hitbox, suelo/techo. | Tuberías, puntaje, input. |
| `ParTuberias` | Su posición, su hueco, su DOM, su colisión. | Cuándo spawnear, dificultad global. |
| `FabricaTuberias` | Gap, altura, distancia, reglas de creación. | Loop, colisiones, puntaje. |
| `FlappyAveBonus` | Su tipo, posición, movimiento, colisión. | Cuándo aparece, puntaje. |
| `FabricaAvesBonus` | Probabilidades y variantes. | Loop, partida. |
| `flappy.js` | Estado de partida, loop, input, HUD, colisiones, puntaje. | Cómo se calcula un gap o un sprite. |

Esa separación es la que permite defender el código: el controlador no tiene un `if` gigante con las reglas de las tuberías, y las clases no dependen de la partida.

### 2.4 Estructura del DOM y capas

```text
.flappy-marco                  ← área de input y fullscreen
├── .flappy-lienzo             ← 1024×576 lógico, escalado por CSS
│   ├── .flappy-capa (×7)      ← parallax, z-index 1..7
│   ├── #flappy-aves-tuberia   ← bird-3, z-index 7 (detrás de tuberías)
│   ├── #flappy-tuberias       ← pares de tubos, z-index 8
│   ├── #flappy-aves-bonus     ← bird-2, z-index 9
│   └── #flappy-pajaro         ← jugador, z-index 9
├── .flappy-hud                ← z-index 10, fuera del lienzo escalado
└── .flappy-overlay            ← z-index 20, modal de inicio/fin
```

Dos detalles importantes:

- El HUD y el overlay están **fuera** de `.flappy-lienzo`. El lienzo se escala, pero los textos y botones conservan su tamaño legible.
- `#flappy-aves-tuberia` está debajo de `#flappy-tuberias` a propósito: así el `bird-3` parece salir y esconderse dentro de las bocas de los tubos.

---

## 3. Escenario lógico y responsive

### 3.1 El lienzo lógico

El juego define un escenario fijo de **1024×576 px** (16:9). Ese es el sistema de coordenadas de toda la lógica: posiciones, velocidades, hitboxes y tuberías se expresan ahí.

```css
.flappy-lienzo {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1024px;
    height: 576px;
    transform: translate(-50%, -50%) scale(var(--flappy-escala, 1));
    transform-origin: center center;
    visibility: hidden;
}
```

El marco mantiene la proporción:

```css
.flappy-marco {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
}
```

Y la card se limita para entrar en el viewport:

```css
.juego-card--flappy {
    width: min(1023px, 100%, calc((100vh - 210px) * 16 / 9));
}
```

### 3.2 El escalado

`flappy.js` calcula la escala una vez al cargar y cada vez que cambia el tamaño del marco:

```js
function ajustarEscala() {
    const ancho = marco.clientWidth;
    const alto = marco.clientHeight;
    if (!ancho || !alto) return;

    const escala = Math.min(
        ancho / config.ANCHO_LIENZO,
        alto / config.ALTO_LIENZO
    );
    lienzo.style.setProperty('--flappy-escala', String(escala));
    marco.classList.add('flappy-marco--listo');
}
```

- `Math.min` garantiza que el escenario entre completo: si el marco es más ancho que 16:9, sobra espacio a los costados; si es más alto, sobra arriba/abajo.
- La escala se aplica con `transform: scale(...)`, no cambiando `width`/`height`. Así no se recalculan posiciones ni se dispara layout dentro del juego.
- `flappy-marco--listo` recién muestra el lienzo cuando ya tiene una escala válida; evita el flash de un canvas sin escalar.

### 3.3 ResizeObserver y fullscreen

```js
if ('ResizeObserver' in window) {
    new ResizeObserver(ajustarEscala).observe(marco);
} else {
    window.addEventListener('resize', ajustarEscala);
}
```

- `ResizeObserver` detecta cambios del marco aunque no cambie la ventana (por ejemplo, al entrar/salir de fullscreen o al cambiar el layout).
- Si no existe, se usa `resize` como fallback.
- Al cambiar a fullscreen se vuelve a calcular la escala en el próximo frame:

```js
document.addEventListener('fullscreenchange', function () {
    requestAnimationFrame(ajustarEscala);
});
```

### 3.4 Por qué esto importa para la defensa

La dificultad no cambia con la pantalla. Un tubo de 96 px lógicos, un hueco de 125 px lógicos y una hitbox de 26 px lógicos ocupan el mismo porcentaje del escenario en un teléfono y en un monitor 4K. Lo único que cambia es el tamaño físico de los píxeles.

> **Para la defensa:** “La pantalla cambia; el mundo lógico no. Por eso la misma partida se juega igual en cualquier dispositivo.”

### 3.5 Trade-offs

- No se usa `devicePixelRatio` para renderizar un canvas más nítido: el escalado es CSS. En pantallas HiDPI el pixel art puede verse algo suave, pero `image-rendering: pixelated` ayuda y el estilo elegido tolera la escala no entera.
- El HUD y el overlay no se escalan con el lienzo: mantienen tamaño de lectura. Eso es deliberado, no un olvido.

---

## 4. Movimiento del escenario

### 4.1 El mundo se mueve, el jugador no

El pájaro se queda en `X_PANTALLA = 220`. Lo que avanza es el mundo:

- Las tuberías restan `velocidad * dt` a su `x`.
- Las aves restan `velocidad * dt` (el `bird-2` suma 90 px/s extra).
- Las capas de parallax avanzan `velocidad * factor * dt`.
- El fondo, las copas, los árboles, el tronco y el cartel se desplazan a distintas velocidades.

Esto es el clásico Flappy: el jugador solo controla la altura y el escenario da la sensación de avance. También simplifica las colisiones: la hitbox del pájaro siempre está en el mismo X.

### 4.2 Las siete capas del parallax

| Capa | Archivo | Factor | z-index |
|---|---|---:|---:|
| Fondo | `elementosParallax/1.png` | 0,05 | 1 |
| Copas lejanas | `elementosParallax/2.png` | 0,12 | 2 |
| Copas medias | `elementosParallax/3.png` | 0,20 | 3 |
| Árboles medios | `elementosParallax/4.png` | 0,32 | 4 |
| Árboles cercanos | `elementosParallax/5.png` | 0,50 | 5 |
| Tronco | `elementosParallax/6.png` | 0,75 | 6 |
| Cartel | `elementosParallax/7.png` | 1,00 | 7 |

Las imágenes miden 576×324 y se muestran a 1024×576 con `background-size: 1024px 576px` y `background-repeat: repeat-x`. Cada capa tiene un tile de 1024 px, que coincide con el ancho lógico del lienzo.

### 4.3 La fórmula del parallax

```js
const capas = [
    { el: fondo,        tile: 1024, factor: 0.05, x: 0 },
    { el: copasLejanas, tile: 1024, factor: 0.12, x: 0 },
    // ...
    { el: cartel,       tile: 1024, factor: 1.00, x: 0 }
];

function actualizarParallax(dt, velocidad) {
    for (const capa of capas) {
        capa.x = (capa.x + velocidad * capa.factor * dt) % capa.tile;
    }
}

function dibujarParallax() {
    for (const capa of capas) {
        capa.el.style.backgroundPositionX = -capa.x + 'px';
    }
}
```

- `capa.x` acumula el desplazamiento de esa capa.
- El módulo `% 1024` mantiene el valor acotado: cuando llega al ancho del tile, vuelve a 0. Como la imagen se repite en X, el ojo ve un scroll infinito.
- `backgroundPositionX = -capa.x` mueve la imagen hacia la izquierda.
- La capa del cartel usa factor `1.00`: se mueve exactamente a la velocidad del mundo. El fondo usa `0.05`: casi queda quieto. Esa diferencia es la que produce la profundidad.

### 4.4 Por qué el parallax se hace en JS y no con keyframes CSS

Una animación CSS de `background-position` podría repetir el fondo, pero tendría dos problemas:

1. **No se sincroniza con la velocidad del juego.** Si la dificultad sube un 10%, habría que cambiar la duración de la animación y eso puede producir saltos o desfasajes entre capas.
2. **No se puede pausar con el resto de la simulación.** El juego se pausa al cambiar de pestaña; las animaciones CSS no están atadas a ese estado.

Con JS, todas las capas usan la misma `velocidadActual` y el mismo `dt` que las tuberías. Si el mundo acelera, el parallax acelera; si el juego se pausa, el parallax se detiene. Una sola fuente de verdad.

### 4.5 Reset

`reiniciarPartida()` llama a `reiniciarParallax()`, que pone todas las `capa.x` en 0 y vuelve a dibujar. Así la nueva partida arranca siempre desde el mismo encuadre.

> **Para la defensa:** “El parallax no es decoración: es la misma velocidad del mundo multiplicada por un factor. Por eso acelera y frena junto con la dificultad.”

---

## 5. Movimiento del jugador

### 5.1 El estado del pájaro

`FlappyPajaro` guarda:

```js
this.estado = {
    xMundo: 0,       // acumulado, no se usa para renderizar ni colisionar
    y: 230,          // centro vertical lógico
    vy: 0,           // velocidad vertical en px/s
    rot: 0,          // rotación visual en grados
    tiempoAleteo: 0  // temporizador del sprite de aleteo
};
```

`xMundo` se acumula con `vel * dt`, pero el pájaro siempre se dibuja en `X_PANTALLA` y la colisión usa ese mismo X. Es un dato que quedó disponible para una futura mecánica; no participa del juego actual.

### 5.2 Constantes

| Constante | Valor | Unidad | Qué hace |
|---|---:|---|---|
| `ANCHO_LIENZO` | 1024 | px | Ancho lógico |
| `ALTO_LIENZO` | 576 | px | Alto lógico |
| `X_PANTALLA` | 220 | px | X fijo del pájaro |
| `Y_INICIAL` | 230 | px | Altura inicial |
| `SUELO_Y` | 535 | px | Línea de colisión con el suelo |
| `OFFSET_PIES` | 30 | px | Distancia del centro a los pies |
| `OFFSET_CABEZA` | 29 | px | Distancia del centro a la cabeza |
| `HITBOX_ANCHO` | 26 | px | Ancho base de la hitbox |
| `HITBOX_ALTO` | 26 | px | Alto base de la hitbox |
| `GRAVEDAD` | 1400 | px/s² | Aceleración hacia abajo |
| `IMPULSO` | -450 | px/s | Velocidad instantánea al aletear |
| `VEL_MAX_CAIDA` | 650 | px/s | Tope de caída |
| `VEL_MUNDO` | 150 | px/s | Velocidad horizontal base |
| `TIEMPO_ALETEO` | 0,28 | s | Duración del sprite de aleteo |
| `ESCALA_INICIAL` | 1,0 | × | Tamaño inicial |
| `ESCALA_MAXIMA` | 1,5 | × | Tamaño máximo por penalización |
| `AUMENTO_ESCALA` | 0,10 | × | Cuánto crece por `bird-2` |

### 5.3 La física

`FlappyFisica.actualizar` es el corazón del movimiento vertical:

```js
actualizar(estado, dt, velMundo) {
    const factor = velMundo / FlappyFisica.VEL_MUNDO;
    const gravedadActual = FlappyFisica.GRAVEDAD * factor * factor;
    const velocidadMaximaCaida = FlappyFisica.VEL_MAX_CAIDA * factor;

    estado.vy = Math.min(
        estado.vy + gravedadActual * dt,
        velocidadMaximaCaida
    );
    estado.y += estado.vy * dt;
    estado.xMundo += velMundo * dt;
    estado.rot = Math.max(-25, Math.min(75, estado.vy * 0.12));
}
```

Es una integración **semi-implícita**: primero se actualiza `vy` con la gravedad y después se mueve `y` con la `vy` nueva. Es más estable que usar la `vy` vieja para mover y es adecuada para fuerzas constantes como esta.

- `vy` crece con la gravedad y se limita a `VEL_MAX_CAIDA` para que el pájaro no caiga indefinidamente.
- `y` se mueve con `vy * dt`.
- `rot` es proporcional a `vy`, con clamp entre −25° y 75°: el pájaro apunta hacia arriba cuando sube y hacia abajo cuando cae.

### 5.4 Por qué la gravedad escala con `factor²`

Cuando la velocidad del mundo sube, el tiempo entre tuberías baja. Si solo se aumentara la velocidad horizontal, el pájaro tendría menos tiempo para hacer el mismo salto y la dificultad se rompería.

La escala correcta es:

- **Velocidad del mundo:** `f`.
- **Tiempo disponible:** `1/f` (el mundo recorre más en el mismo tiempo).
- **Altura del salto:** `y ≈ ½ · g · t²`. Para conservar `y` cuando `t` se reduce `1/f`, `g` debe escalar `f²`.
- **Impulso:** `v` escala `f`. La altura máxima `v² / (2g)` queda constante porque `f² / f² = 1`.
- **Tiempo al apex:** `v / g` escala `1/f`, justo lo que dura el mundo en pasar.

| Magnitud | Base (`f = 1,0`) | Máxima (`f = 1,3`) |
|---|---:|---:|
| Gravedad | 1400 px/s² | 2366 px/s² |
| Impulso | −450 px/s | −585 px/s |
| Caída máxima | 650 px/s | 845 px/s |
| Altura del salto | ≈ 72 px | ≈ 72 px |
| Tiempo al apex | ≈ 0,32 s | ≈ 0,25 s |

La altura del salto se mantiene; el salto se vuelve más rápido. Eso acompaña el aumento de velocidad del mundo y mantiene la sensación de control.

### 5.5 Rotación y ancla visual

El sprite no está perfectamente centrado en su frame de 64×64. El centro visible del pájaro está en:

```js
const ANCLA_X = 64 * 0.54; // 34,56
const ANCLA_Y = 64 * 0.53; // 33,92
```

`render()` resta esas anclas para que el cuerpo del pájaro quede en `(220, y)`. El `transform-origin` del contenedor también es `54% 53%`, así la rotación y el crecimiento ocurren sobre el cuerpo y no sobre la esquina del frame.

```js
render() {
    const x = CONFIG.X_PANTALLA - ANCLA_X;
    const y = this.estado.y - ANCLA_Y;
    this.el.style.transform =
        `translate3d(${x}px, ${y}px, 0) rotate(${this.estado.rot}deg) scale(${this.escala})`;
}
```

### 5.6 Suelo y techo

- **Suelo:** `estaEnSuelo()` compara `y + OFFSET_PIES * escala >= SUELO_Y`. Si se cumple, `limitarAlSuelo()` acomoda el pájaro justo sobre la línea y `terminarPartida('suelo')` termina la partida.
- **Techo:** `limitarAlTecho()` calcula `yMin = OFFSET_CABEZA * escala`. Si el pájaro sube más, lo clampa y pone `vy = 0`. No muere: el techo es un límite, no un obstáculo.

### 5.7 El pájaro no rota la hitbox

La hitbox es un AABB fijo, centrado en `(220, y)`. No rota con el sprite: solo escala cuando el pájaro crece. Para un pájaro chico y un juego de reflejos, es una simplificación justa y barata. La rotación es puramente visual.

> **Para la defensa:** “El jugador solo controla la altura; el avance lo pone el mundo. Eso hace que la colisión sea más simple y que el parallax y las tuberías compartan la misma velocidad.”

---

## 6. Timestamp y loop

### 6.1 Qué es el timestamp de `requestAnimationFrame`

`requestAnimationFrame` no llama a la función “cada 16 ms” ni “cada 60 fps”. Le pasa un **timestamp de alta resolución** (`DOMHighResTimeStamp`), medido en milisegundos desde el origen de tiempos de la página. Es monótono: no salta para atrás si se cambia el reloj del sistema.

El loop del juego lo recibe como `ahora`:

```js
function loop(ahora) {
    rafId = requestAnimationFrame(loop);

    if (estadoJuego !== 'jugando') return;

    if (ultimo === null) ultimo = ahora;
    let dt = (ahora - ultimo) / 1000;
    ultimo = ahora;

    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, DT_MAXIMO);

    if (dt > 0) {
        // física, parallax, tuberías, aves, timer, colisiones...
    }

    dibujarEscena();
}
```

- La primera vez, `ultimo === null`: se toma `ahora` como referencia y `dt = 0`. No hay salto inicial.
- `dt` se convierte a segundos porque todas las velocidades están en px/s.
- `Number.isFinite(dt)` descarta `NaN` o `Infinity`.
- `dt < 0` descarta un timestamp raro.
- `Math.min(dt, DT_MAXIMO)` es el seguro contra tirones.

`DT_MAXIMO` vale `1 / 30`, o sea **33,3 ms**.

### 6.2 Por qué no se usa “un píxel por frame”

Si el código hiciera `y += 1` en cada frame, un equipo de 144 Hz movería el pájaro 2,4 veces más rápido que uno de 60 Hz. El juego sería distinto en cada dispositivo.

Con `dt`, la operación es siempre “velocidad × tiempo”:

```text
y += vy * dt
x -= velocidad * dt
```

Si un frame dura la mitad, el desplazamiento es la mitad. La velocidad física no cambia.

### 6.3 Qué pasa en cada frecuencia

| Equipo | Intervalo entre frames | `dt` usado | Avance simulado por segundo real | Efecto |
|---|---:|---:|---:|---|
| 144 Hz | 6,9 ms | 6,9 ms | 100 % | pasos más finos, mismo ritmo |
| 60 Hz | 16,7 ms | 16,7 ms | 100 % | referencia |
| 30 Hz | 33,3 ms | 33,3 ms | 100 % | justo en el cap |
| 20 Hz | 50 ms | 33,3 ms | 66,7 % | cámara lenta breve |
| Stall de 200 ms | 200 ms | 33,3 ms | 16,7 % durante ese frame | no teletransporta |

A partir de 30 Hz el juego entra en **cámara lenta** en lugar de dar saltos. Es una decisión deliberada: se prefiere que el movimiento y las colisiones sigan siendo legibles antes que mantener el tiempo real exacto en un equipo que no puede con el frame.

### 6.4 El temporizador también es tiempo de simulación

`tiempoRestante` se descuenta con `dt`, no con `Date.now()`:

```js
tiempoRestante = Math.max(0, tiempoRestante - dt);
```

Consecuencia: si el dispositivo va lento y el `dt` se capa, el reloj de la partida también se ralentiza. El jugador no pierde 120 segundos de pared mientras el juego avanza a tirones. La dificultad por tubo se mantiene; lo que cambia es cuánto tarda la partida en tiempo real.

### 6.5 Pausa y reanudación

```js
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        if (estadoJuego === 'jugando') {
            estadoJuego = 'pausado';
            detenerLoop();
        }
    } else if (estadoJuego === 'pausado') {
        estadoJuego = 'jugando';
        iniciarLoop();
    }
});
```

`iniciarLoop()` hace `ultimo = null`. Al volver de una pestaña oculta, el primer frame tiene `dt = 0` y no se produce un salto gigante. Sin ese reset, el timestamp podría haber avanzado varios segundos y el pájaro aparecería teletransportado.

### 6.6 Por qué no `setInterval` o `setTimeout`

- `setInterval` no está sincronizado con el pintado: puede ejecutarse varias veces entre frames o ninguna.
- Deriva con el tiempo: un intervalo de 16 ms no es exactamente 16 ms.
- En pestañas de fondo se throttlea de forma impredecible.
- No tiene un timestamp de alta resolución asociado al frame que se va a pintar.

`requestAnimationFrame` se ejecuta antes del próximo repintado y entrega el timestamp correcto. Es la herramienta pensada para animación.

### 6.7 Determinismo: qué se garantiza y qué no

**No** se garantiza una partida bit a bit idéntica entre dispositivos:

- El `dt` varía con el frame pacing.
- Las tuberías usan `Math.random()` para distancia, gap y altura.
- Las aves usan `Math.random()` para aparecer y elegir variante.

Lo que sí se garantiza es la **misma velocidad relativa** y la misma dificultad por unidad de distancia. Si se necesitara reproducibilidad exacta (por ejemplo, para tests o replays), habría que usar un timestep fijo con acumulador y un RNG con semilla. No es el objetivo de este TPE.

### 6.8 Tunneling: el límite del cap

El cap también acota cuánto puede moverse un objeto entre dos chequeos de colisión:

- Tubería a velocidad máxima: `195 px/s × 0,0333 s ≈ 6,5 px` por frame. El tubo mide 96 px: no hay forma de atravesarlo.
- Pájaro en caída máxima: `845 px/s × 0,0333 s ≈ 28 px` por frame. La hitbox base mide 26 px y el gap mínimo 125 px.

En el peor caso teórico (caída máxima justo en el borde de un tubo, a 30 Hz) el desplazamiento vertical es del mismo orden que la hitbox. En la práctica no se observa tunneling; para una garantía formal se podría usar *swept AABB* o sub-stepping. El cap actual es suficiente para este juego.

### 6.9 Integración estable

La combinación de `dt` chico (≤ 33 ms), gravedad constante e integración semi-implícita es estable para este modelo. No hay resortes, fricción compleja ni fuerzas que dependan de la posición; el error de integración es despreciable para la escala del juego.

> **Para la defensa:** “El timestamp no se usa para medir FPS: se usa para saber cuánto tiempo pasó y avanzar la física esa cantidad. Por eso 60 Hz y 144 Hz se sienten igual.”

---

## 7. Animaciones y keyframes

### 7.1 La técnica: sprite sheets

Las imágenes del pájaro y de las aves son **tiras horizontales** de 4 frames de 16×16:

| Imagen | Tamaño real | Frames | Se muestra a |
|---|---:|---:|---:|
| `sprites/Bird1-6.png` | 64×16 | 4 de 16×16 | 64×64 |
| `sprites/Bird2-2.png` | 64×16 | 4 de 16×16 | 32×32 |
| `sprites/Bird2-3.png` | 64×16 | 4 de 16×16 | 32×32 |

Para el pájaro:

```css
.flappy-pajaro__sprite {
    width: 100%;
    height: 100%;
    background-image: url("../img/flappyBird/sprites/Bird1-6.png");
    background-repeat: no-repeat;
    background-size: 400% 100%;
    image-rendering: pixelated;
}
```

`background-size: 400% 100%` escala la tira a 4 veces el ancho del elemento: 64×4 = 256 px de ancho, 64 px de alto. Cada frame queda de 64×64. Los frames se seleccionan moviendo `background-position`:

```css
@keyframes flappy-sprite-ciclo {
    0%, 24.9%   { background-position: 0 0; }
    25%, 49.9%  { background-position: -64px 0; }
    50%, 74.9%  { background-position: -128px 0; }
    75%, 100%   { background-position: -192px 0; }
}
```

### 7.2 `step-end` vs. interpolación

La animación usa `step-end` (o `steps(1, end)` en las aves):

```css
.flappy-pajaro__sprite--aleteo {
    animation: flappy-sprite-ciclo 0.28s step-end infinite;
}
```

Sin `step-end`, el navegador interpolaría `background-position` y la imagen se deslizaría entre frames. Con `step-end`, el valor salta de un frame al siguiente y se obtiene el efecto pixel art.

### 7.3 Estados del sprite del pájaro

| Estado | Clase | Keyframes | Duración | Efecto |
|---|---|---|---:|---|
| Inicio | `--inicio` | `flappy-sprite-ciclo` + `flappy-inicio-flotar` | 1,2 s + 1,8 s | aleteo lento y flotación |
| Aleteo | `--aleteo` | `flappy-sprite-ciclo` | 0,28 s | 4 frames al impulso |
| Planeo | `--planeo` | `flappy-planeo-flotar` | 1,4 s | frame fijo con ala extendida |
| Impacto | `--impacto` | `flappy-sprite-ciclo` + `flappy-impacto-sacudida` | 0,55 s | choque, sacudida y destello |

El cambio de estado lo hace `setSprite`:

```js
setSprite(nombre, reiniciar) {
    const clases = ['inicio', 'aleteo', 'planeo', 'impacto'].map(
        (estado) => `flappy-pajaro__sprite--${estado}`
    );
    clases.forEach((clase) => this.sprite.classList.remove(clase));

    if (reiniciar) {
        // Fuerza reflow para que el keyframe vuelva a empezar.
        void this.sprite.offsetWidth;
    }

    this.sprite.classList.add(`flappy-pajaro__sprite--${nombre}`);
}
```

### 7.4 Por qué el reflow forzado

Si el jugador aletea dos veces seguidas, la clase `--aleteo` ya está puesta. Sacarla y volver a ponerla en el mismo frame no reinicia necesariamente la animación: el navegador puede agrupar los cambios y no ver un cambio real de estilo.

`void this.sprite.offsetWidth` fuerza un cálculo de layout sincrónico antes de volver a agregar la clase. Eso hace que el navegador registre el estado “sin clase” y reinicie la animación al agregarla. Es una lectura de layout, pero ocurre solo en un cambio de estado (input o colisión), no en cada frame.

### 7.5 Separación padre / hijo: el truco clave

El contenedor y el sprite tienen responsabilidades distintas:

```text
.flappy-pajaro                ← JS: translate3d + rotate + scale
└── .flappy-pajaro__sprite    ← CSS: aleteo, flote, sacudida
    └── ::after               ← CSS: destello de impacto
```

- El **padre** recibe el `transform` que calcula `render()`: posición, rotación y escala.
- El **hijo** recibe las animaciones CSS que también usan `transform` (flote, sacudida).

Si ambas cosas estuvieran en el mismo elemento, el keyframe pisaría el `translate3d` de JS o el JS pisaría el keyframe. Al separarlos, los transforms se **componen**: el hijo se mueve dentro del padre.

Lo mismo pasa con las aves, pero con tres niveles:

```text
.flappy-ave-bonus                 ← JS: translate3d(x, y)
└── .flappy-ave-bonus__orientacion ← CSS: scaleX(-1) o rotate(-90deg)
    └── .flappy-ave-bonus__sprite  ← CSS: aleteo + flote
```

Así la orientación no pelea con el flote ni con la posición.

### 7.6 Impacto, penalización y modal

- **Impacto:** `flappy-impacto-sacudida` mueve el sprite con `translate` y `rotate`; `flappy-impacto-destello` anima un `::after` con un gradiente radial que se expande y se apaga. La animación dura 0,55 s y el loop ya está detenido: el choque se ve completo.
- **Penalización:** `.flappy-pajaro--penalizado::after` dibuja un aro rojo que se expande y se desvanece en 0,28 s. Para reiniciarlo se quita la clase, se fuerza reflow y se vuelve a agregar (`mostrarPenalizacion`).
- **Modal:** `.flappy-modal` entra con `flappy-pop` (0,35 s, escala y opacidad). `mostrarOverlay` reinicia la animación con `animation = 'none'`, reflow y `animation = ''`, para que el modal vuelva a aparecer cada vez.

### 7.7 Las animaciones de las aves

| Ave | Orientación | Animaciones | Movimiento |
|---|---|---|---|
| `bird-2` | `scaleX(-1)` (mira a la izquierda) | `flappy-ave-aletear` 0,48 s + `flappy-ave-flotar` 0,8 s (±5 px) | Cruza el escenario con 90 px/s extra |
| `bird-3` | `rotate(-90deg)` (mira hacia arriba) | `flappy-ave-aletear` 0,48 s | Asciende a 50 px/s entre las bocas del tubo |

El `bird-3` se crea dentro del contenedor `#flappy-aves-tuberia`, que está detrás de las tuberías. Por eso parece salir de la boca inferior y esconderse en la superior: su posición horizontal avanza junto con el tubo y su contenedor queda tapado por los tubos.

### 7.8 Qué anima CSS y qué anima JS

| Responsabilidad | Quién | Por qué |
|---|---|---|
| Posición, rotación y escala del pájaro | JS (`render`) | Depende de la física y del estado. |
| Aleteo, flote, sacudida, destello | CSS | Son ciclos visuales; no necesitan lógica por frame. |
| Posición de tuberías y aves | JS | Depende de `dt` y `velocidad`. |
| Aleteo de las aves | CSS | Es un sprite sheet independiente. |
| Aparición del modal | CSS | Es una transición de UI, no de simulación. |

Ventaja: el loop no calcula frames de sprite ni escribe clases cada frame. Solo mueve contenedores y cambia de estado cuando corresponde.

### 7.9 Costo y compositor

No todas las animaciones CSS son iguales:

- Las que animan `transform` (flote, sacudida) pueden resolverse en el **compositor**, sin repintar.
- Las que animan `background-position` (sprite sheets) obligan a **repintar el área del sprite** cuando cambia el frame (4 veces por ciclo, no en cada frame). Son áreas chicas (64×64 o 32×32), así que el costo es bajo.
- El parallax anima `background-position` en siete capas grandes: es la parte más costosa del render. Se eligió por simplicidad; una optimización futura sería duplicar cada capa y mover las copias con `transform`.

`will-change: transform` en los contenedores que se mueven y `image-rendering: pixelated` completan el enfoque.

> **Para la defensa:** “El loop no anima el ala: solo mueve el contenedor. El sprite lo anima CSS con keyframes, y por eso el costo en JS es mínimo.”

---

## 8. Colisiones

### 8.1 La hitbox del pájaro

La hitbox es un **AABB** (*axis-aligned bounding box*): un rectángulo alineado con los ejes, sin rotación.

```js
getHitbox() {
    const mitadAncho = CONFIG.HITBOX_ANCHO * this.escala / 2;
    const mitadAlto = CONFIG.HITBOX_ALTO * this.escala / 2;
    return {
        izq: CONFIG.X_PANTALLA - mitadAncho,
        der: CONFIG.X_PANTALLA + mitadAncho,
        arriba: this.estado.y - mitadAlto,
        abajo: this.estado.y + mitadAlto
    };
}
```

- En escala 1 mide **26×26 px**, contra un sprite de 64×64. Es deliberadamente más chica: el jugador no muere por un píxel de ala.
- Está centrada en `(X_PANTALLA, estado.y)`.
- **Escala** cuando el pájaro crece: a 1,5× mide 39×39.
- **No rota** con el sprite. La rotación es visual; la colisión es más simple y más justa.

### 8.2 Colisión con tuberías

Cada `ParTuberias` guarda los bordes verticales del hueco:

```js
this.huecoArriba = Math.max(ALTO_BOCA, centroY - gap / 2);
this.huecoAbajo = Math.min(sueloY - ALTO_BOCA, centroY + gap / 2);
```

`ALTO_BOCA` vale 48 px. El `Math.max`/`Math.min` son defensivos: con las reglas actuales de la fábrica el hueco siempre respeta esos márgenes, pero el constructor queda protegido si se lo usa directo.

La colisión:

```js
colisionaCon(hitbox) {
    const seSuperponeX = hitbox.der > this.x && hitbox.izq < this.x + this.ancho;
    if (!seSuperponeX) return false;

    return hitbox.arriba < this.huecoArriba || hitbox.abajo > this.huecoAbajo;
}
```

Primero descarta por X. Si el pájaro no está horizontalmente sobre el par, no hay colisión y se evita el resto del cálculo. Si hay solapamiento en X, pregunta si el pájaro se salió del hueco:

- `hitbox.arriba < huecoArriba`: el borde superior del pájaro está por encima del inicio del hueco, o sea dentro del tubo superior.
- `hitbox.abajo > huecoAbajo`: el borde inferior está por debajo del final del hueco, o sea dentro del tubo inferior.

```text
y = 0
┌──────────────┐
│  tubo superior│
├──────────────┤  huecoArriba
│              │
│    hueco     │  ← por acá pasa el pájaro
│              │
├──────────────┤  huecoAbajo
│  tubo inferior│
└──────────────┘  y = 576
```

¿Por qué no hace falta chequear dos AABB completas? Porque el hueco ocupa todo el ancho del par. Si hay solapamiento en X y el pájaro está fuera del rango vertical del hueco, necesariamente está dentro de uno de los dos tubos. La condición es equivalente y más barata.

El tubo inferior se dibuja hasta el borde inferior del lienzo (576 px), no hasta `SUELO_Y` (535 px). La colisión con el suelo se maneja aparte, con la línea de 535.

### 8.3 Suelo y techo

- **Suelo:** `pajaro.estaEnSuelo()` usa `y + OFFSET_PIES * escala >= SUELO_Y`. Si se cumple, se limita la posición, se dibuja la escena y se llama a `terminarPartida('suelo')`.
- **Techo:** `pajaro.limitarAlTecho()` clampa `y` a `OFFSET_CABEZA * escala` y pone `vy = 0`. No termina la partida; es solo un límite.

La diferencia es intencional: el suelo es un obstáculo letal; el techo es el borde del mundo.

### 8.4 Colisión con `bird-2` (“agarrar al enemigo”)

El `bird-2` usa una AABB completa contra la hitbox del pájaro:

```js
colisionaCon(hitbox) {
    const arriba = this.centroY - this.alto / 2;
    const abajo = this.centroY + this.alto / 2;
    return hitbox.der > this.x &&
        hitbox.izq < this.x + this.ancho &&
        hitbox.abajo > arriba &&
        hitbox.arriba < abajo;
}
```

Cuando colisiona:

```js
if (ave.tipo === 'bird-2' && ave.colisionaCon(hitbox)) {
    pajaro.aumentarTamano();
    pajaro.mostrarPenalizacion();
    ave.destruir();
    avesBonus.splice(i, 1);
}
```

- `aumentarTamano()` suma 0,1 a la escala, con máximo 1,5. La hitbox crece con el pájaro.
- `mostrarPenalizacion()` dispara el aro rojo de 0,28 s.
- El ave se destruye y se saca del array.
- **No termina la partida**: es una penalización, no una derrota.
- El `bird-2` solo se elige si `pajaro.puedeAumentarTamano()` es verdadero. Si el pájaro ya está en 1,5×, la fábrica opta por `bird-3`.

Un detalle fino: el crecimiento ocurre dentro de `actualizarAvesBonus`, antes de los chequeos de suelo y tuberías del mismo frame. Si el pájaro estaba justo al borde de un tubo o del suelo, la hitbox más grande puede hacer que colisione en ese mismo frame. Es coherente: agrandarse es más peligroso.

### 8.5 `bird-3`: visual, sin colisión

`bird-3` no tiene chequeo de colisión. Su función es decorativa:

- Sale de la boca inferior del tubo, asciende 50 px/s y se esconde en la boca superior.
- Se mueve horizontalmente a la misma velocidad que el tubo, por eso queda “pegado” al hueco.
- Se destruye cuando `centroY <= centroYFinal`, o sea cuando termina de entrar en el tubo superior.
- Su contenedor (`#flappy-aves-tuberia`) está detrás de las tuberías, así que el ocultamiento es visual, no un truco de opacidad.

### 8.6 Orden de los chequeos en el frame

El loop hace, en este orden:

```text
1. pájaro.actualizar(dt)
2. parallax
3. tuberías: spawn, movimiento, puntaje, limpieza
4. aves: movimiento y colisión con bird-2
5. timer
6. suelo
7. techo
8. colisión con tuberías
9. tiempo agotado
10. render
```

Si un chequeo cambia el estado (`victoria`, `impacto`, `gameover`), el loop corta y no sigue con los pasos siguientes. Por eso hay verificaciones de `estadoJuego !== 'jugando'` después de las tuberías y de las aves.

### 8.7 Puntaje y flag `superado`

Cada par tiene un flag `superado`:

```js
if (!tubo.superado && tubo.x + tubo.ancho < config.X_PANTALLA) {
    tubo.superado = true;
    tuberiasSuperadas += 1;
    actualizarVelocidad();
    sumarPuntos(1);
}
```

- Se suma cuando el borde derecho del tubo ya pasó el X del pájaro: el par fue completamente superado.
- El flag evita sumar dos veces el mismo tubo.
- `tuberiasSuperadas` alimenta la suba de velocidad.
- `sumarPuntos(1)` puede disparar la victoria si se llega a 50.

> **Para la defensa:** “La hitbox es más chica que el sprite a propósito: el jugador no muere por un píxel de ala. Y la colisión con tuberías no compara dos rectángulos completos: primero descarta por X y después pregunta si el pájaro se salió del hueco.”

---

## 9. Fábrica y ciclo de vida

### 9.1 El patrón Factory Method

`FabricaTuberias` encapsula **cómo nace** un par de tuberías. El controlador no calcula gap, altura ni distancia: solo pide.

```js
const nuevoPar = fabricaTuberias.crear(config.ANCHO_LIENZO + 20);
tuberias.push(nuevoPar);
```

La fábrica decide:

- Qué gap tiene el nuevo par.
- Dónde está el centro del hueco.
- Cuánto va a tardar el próximo par en aparecer.

Ventajas:

- Las reglas de dificultad están en un solo lugar.
- El controlador queda corto y legible.
- Cambiar una regla no obliga a tocar el loop.
- Se puede testear la fábrica sin levantar toda la partida.

### 9.2 `ParTuberias`: el producto

Cada par sabe:

- Crear su DOM (`crearDOM`), con tubo superior, tubo inferior, cuerpos y bocas.
- Moverse (`actualizar`).
- Dibujarse (`render`, con `translate3d`).
- Chequear colisión (`colisionaCon`).
- Saber si salió de pantalla (`estaFueraDePantalla`).
- Destruirse (`destruir`, con `.remove()`).

El constructor calcula los bordes del hueco, arma el DOM y lo agrega al contenedor. Cuando la fábrica devuelve el objeto, ya está montado y renderizado.

### 9.3 Las tres reglas de la fábrica

| Regla | Método | Implementación |
|---|---|---|
| Distancia horizontal variable | `siguienteDistancia()` | `Math.random()` entre 290 y 420 px |
| Hueco que se achica | `calcularGap()` | 185 px − 4 px por tubo creado, mínimo 125 px |
| Altura no alineada | `calcularCentroY(gap)` | Margen de 75 px arriba/abajo y al menos 55 px de diferencia respecto del centro anterior |

```js
calcularGap() {
    return Math.max(
        TUBERIAS_CONFIG.GAP_MINIMO,
        TUBERIAS_CONFIG.GAP_INICIAL - this.creadas * TUBERIAS_CONFIG.REDUCCION_GAP
    );
}

siguienteDistancia() {
    return aleatorioEntre(TUBERIAS_CONFIG.DIST_MIN, TUBERIAS_CONFIG.DIST_MAX);
}

crear(x) {
    const gap = this.calcularGap();
    const centroY = this.calcularCentroY(gap);

    this.creadas += 1;
    this.ultimoCentroY = centroY;

    return new ParTuberias(this.contenedor, x, centroY, gap, this.sueloY, this.altoLienzo);
}
```

`calcularGap` usa `this.creadas`, que cuenta **todos los pares creados en la partida**. No depende de los que el jugador superó. El gap llega al mínimo en el tubo 16:

| Par creado | Gap |
|---:|---:|
| 1 | 185 px |
| 15 | 129 px |
| 16 o más | 125 px |

### 9.4 Cómo se elige la altura

`calcularCentroY(gap)` sortea un centro dentro de:

```text
minY = 75 + gap / 2
maxY = 535 - 75 - gap / 2
```

Si el centro sorteado queda a menos de 55 px del centro anterior, restringe el sorteo a la banda superior o inferior que siga siendo válida. Con los márgenes actuales siempre hay al menos una banda posible, así que no salen dos huecos a la misma altura.

El resultado se redondea con `Math.round` para evitar subpíxeles innecesarios en el DOM.

### 9.5 `FabricaAvesBonus`: variantes

La fábrica de aves elige el tipo y crea el producto en el contenedor correcto:

```js
elegirTipo(permitirBird2) {
    if (Math.random() >= PROBABILIDAD_APARICION) return null;
    if (!permitirBird2) return 'bird-3';
    return Math.random() < PROBABILIDAD_BIRD2 ? 'bird-2' : 'bird-3';
}
```

- `PROBABILIDAD_APARICION = 1/3`: cada nuevo par tiene 1/3 de probabilidad de activar un ave, **solo si no hay otra activa**.
- Si el pájaro ya no puede crecer, siempre sale `bird-3`.
- Si puede crecer, `bird-2` y `bird-3` salen 50/50.

Métodos de creación:

- `crearBird2EnEscenario(ancho, alto)`: entra por la derecha, en la mitad superior, con 90 px/s extra.
- `crearBird3DesdeTuberia(tuberia)`: se centra en el hueco del tubo, arranca en la boca inferior y termina en la superior.

### 9.6 Ciclo de vida completo

```text
loop
 └─ distanciaProximoTubo <= 0
      └─ fabricaTuberias.crear(1044)
           ├─ calcularGap()
           ├─ calcularCentroY(gap)
           ├─ new ParTuberias(...)
           │    ├─ crearDOM()
           │    ├─ contenedor.appendChild(el)
           │    └─ render()
           └─ tuberias.push(par)
 └─ por cada tubo: actualizar(dt, velocidad) → render()
 └─ si x + 96 < 0
      ├─ tubo.destruir()      → el.remove()
      └─ tuberias.splice(i, 1)
```

El borrado se hace recorriendo el array **al revés**:

```js
for (let i = tuberias.length - 1; i >= 0; i--) {
    const tubo = tuberias[i];
    tubo.actualizar(dt, velocidad);

    if (tubo.estaFueraDePantalla()) {
        tubo.destruir();
        tuberias.splice(i, 1);
    }
}
```

Si se recorriera de adelante hacia atrás, un `splice(i, 1)` desplazaría el siguiente elemento a la posición `i` y el bucle lo saltearía. Al revés, los índices que faltan recorrer no cambian.

### 9.7 Reset y limpieza total

Al reiniciar:

```js
function limpiarTuberias() {
    for (const tubo of tuberias) tubo.destruir();
    tuberias = [];
    fabricaTuberias.reset();
    distanciaProximoTubo = 120;
}

function limpiarAvesBonus() {
    for (const ave of avesBonus) ave.destruir();
    avesBonus = [];
}
```

- `destruir()` saca el nodo del DOM.
- El array se vacía.
- `fabricaTuberias.reset()` vuelve `creadas = 0` y `ultimoCentroY = null`.
- `distanciaProximoTubo = 120` da un pequeño respiro antes del primer tubo de la nueva partida.

No hay listeners sobre los nodos de tuberías/aves, así que `.remove()` alcanza para liberarlos. Si en el futuro se agregaran listeners, habría que removerlos también.

### 9.8 Por qué no hay object pooling

Un pool reutilizaría nodos en vez de crearlos y destruirlos. En este juego:

- Hay aproximadamente 3–4 pares de tuberías activos (la separación es de 290–420 px y el ancho del escenario es 1024 px).
- Hay como máximo 1 ave activa.
- Crear y destruir unos pocos nodos cada pocos segundos es barato.

El pooling agregaría complejidad (resetear estado, reutilizar DOM, manejar arrays de libres) para un beneficio imperceptible. Si el juego fuera infinito con decenas de entidades, sería una optimización razonable.

> **Para la defensa:** “La fábrica no es un adorno: evita que el controlador tenga un `if` gigante con las reglas de dificultad. El controlador pide un tubo; la fábrica decide cómo nace. Y el borrado es explícito: `.remove()` del DOM y `splice` del array, para que no queden nodos huérfanos.”

---

## 10. Dificultad, puntaje y estados

### 10.1 Niveles de velocidad

Cada 15 tuberías superadas sube un nivel de velocidad, hasta tres niveles:

| Tuberías superadas | Nivel | Velocidad | Factor |
|---|---:|---:|---:|
| 0–14 | 0 | 150 px/s | 1,00 |
| 15–29 | 1 | 165 px/s | 1,10 |
| 30–44 | 2 | 180 px/s | 1,20 |
| 45 o más | 3 | 195 px/s | 1,30 |

```js
function actualizarVelocidad() {
    const niveles = Math.min(
        NIVELES_VELOCIDAD,
        Math.floor(tuberiasSuperadas / TUBERIAS_POR_NIVEL)
    );
    velocidadActual = FlappyFisica.VEL_MUNDO * (1 + niveles * AUMENTO_VELOCIDAD);
}
```

La velocidad no cambia de golpe en medio de un tubo: se actualiza cuando el jugador suma un punto, o sea cuando el par ya quedó atrás. El próximo par nace con la velocidad nueva.

### 10.2 El hueco también se achica

El gap arranca en 185 px y baja 4 px por tubo creado, con piso en 125 px. La dificultad sube en dos ejes al mismo tiempo:

- El mundo va más rápido.
- El hueco es más chico.

El gap mínimo se alcanza en el tubo 16, justo después del primer aumento de velocidad (15 tubos). A partir de ahí la dificultad sigue subiendo solo por velocidad.

### 10.3 Objetivo y límites

- **Meta:** 50 puntos.
- **Tiempo:** 120 segundos.
- **Punto por tubo:** 1, cuando el par fue superado completo.
- **Derrota:** chocar contra una tubería, tocar el suelo o quedarse sin tiempo.
- **El `bird-2` no derrota:** solo agranda y penaliza.
- **El `bird-3` no afecta el puntaje.**

### 10.4 Máquina de estados

```text
                    click / Jugar / Espacio
        ┌────────────────────────────────────┐
        ▼                                    │
     listo ─────────────────────────────► jugando
                                              │
              ┌───────────────┬───────────────┼────────────────┐
              │               │               │                │
        50 puntos        tubo/suelo      0 segundos      pestaña oculta
              │               │               │                │
              ▼               ▼               ▼                ▼
          victoria        impacto          gameover          pausado
              │               │               │                │
              │          600 ms               │           vuelve la pestaña
              │               ▼               │                │
              │           gameover            │                ▼
              │               │               │             jugando
              └───────────────┴───────────────┘
                              │
                    Reintentar / Jugar de nuevo
                              ▼
                            listo
```

Estados en el código: `listo`, `jugando`, `pausado`, `impacto`, `gameover`, `victoria`.

### 10.5 Qué hace cada estado

| Estado | Loop | Input | Overlay | Qué se ve |
|---|---|---|---|---|
| `listo` | Detenido | Inicia partida | Visible | Pájaro en inicio, escena quieta |
| `jugando` | Activo | Aletea | Oculto | Juego normal |
| `pausado` | Detenido | Ignorado | Oculto | Última escena congelada |
| `impacto` | Detenido | Ignorado | Oculto (600 ms) | Animación de choque |
| `gameover` | Detenido | Solo botón | Visible | Modal de derrota |
| `victoria` | Detenido | Solo botón | Visible | Modal de victoria |

### 10.6 Ciclo de vida del loop

```js
function iniciarLoop() {
    if (rafId !== null) return;
    ultimo = null;
    rafId = requestAnimationFrame(loop);
}

function detenerLoop() {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}
```

- `rafId` evita loops duplicados.
- `iniciarLoop` resetea `ultimo` para que el primer `dt` sea 0.
- `detenerLoop` cancela el frame pendiente.
- `reiniciarPartida` detiene el loop, limpia el `timeoutOverlay`, resetea el estado y vuelve a `listo`.

### 10.7 HUD eficiente

- **Puntos:** se actualizan solo cuando cambia el puntaje (`sumarPuntos`).
- **Tiempo:** se actualiza solo cuando cambia el segundo entero (`ultimoSegundoMostrado`), no en cada frame.
- **Estado:** se actualiza en los cambios de estado.
- **Peligro:** el chip de tiempo cambia de color cuando quedan 10 segundos o menos.

Escribir en el DOM una vez por segundo en lugar de 60 veces por segundo es una diferencia real en un equipo modesto.

### 10.8 Balance: una decisión, no un bug

La meta de 50 puntos en 120 segundos es exigente. La separación promedio entre tubos es de 355 px; a 150 px/s son unos 2,37 s por tubo, y el primer punto tarda además el recorrido inicial desde que el tubo aparece hasta que pasa al pájaro.

Un cálculo rápido con las 50 tuberías:

| Escenario | Tiempo estimado | ¿Entra en 120 s? |
|---|---:|---|
| Separación promedio (355 px) | ≈ 110 s | Sí, con margen |
| Separación máxima (420 px) en todos los tramos | ≈ 129 s | No |

O sea: con la separación sorteada uniformemente entre 290 y 420 px la meta es alcanzable, pero si el azar eligiera siempre el máximo no lo sería. Si se quisiera garantizar que la meta sea siempre alcanzable, habría que reducir la meta, aumentar el tiempo o acotar la distancia máxima. Es una decisión de diseño para que la partida no sea trivial; no un error de implementación.

> **Para la defensa:** “La dificultad sube en dos ejes: el mundo acelera cada 15 tubos y el hueco se achica 4 px por tubo hasta un piso de 125. La velocidad máxima es 195 px/s, un 30% más que el inicio.”

---

## 11. Input y accesibilidad

### 11.1 Cómo se controla

| Acción | Entrada | Dónde se escucha |
|---|---|---|
| Aletear / iniciar | Click o toque | `pointerdown` sobre `#flappy-marco` |
| Aletear / iniciar | `Espacio` o `↑` | `keydown` a nivel documento |
| Iniciar / reintentar | Botón del overlay | `click` en `#flappy-btn-accion` |
| Pantalla completa | Botón de la barra | `click` en `#flappy-btn-full` |

`pointerdown` responde antes que `click` y funciona igual con mouse, dedo o lápiz. `touch-action: manipulation` evita el zoom por doble toque y el retraso de 300 ms.

### 11.2 Los guards del input

```js
function esElementoInteractivo(target) {
    return Boolean(
        target && target.closest &&
        target.closest('button, a, input, textarea, select')
    );
}

function alPresionar(e) {
    if (esElementoInteractivo(e.target)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (ejecutarAccionVuelo()) e.preventDefault();
}

function alTeclear(e) {
    if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
    if (esElementoInteractivo(e.target)) return;

    e.preventDefault();
    if (e.repeat) return;

    ejecutarAccionVuelo();
}
```

- **Elementos interactivos:** si el click cae en un botón, link o input, no se aletea. Eso permite usar el botón del overlay sin disparar un salto.
- **Botón incorrecto:** solo el botón izquierdo del mouse aletea.
- **Repetición:** `e.repeat` evita que mantener Espacio haga flapping automático. Cada pulsación es un impulso.
- **Código físico:** `e.code` usa la tecla física, no el carácter; funciona igual en distintos layouts.
- **Prevención:** `preventDefault` evita seleccionar texto o scrollear cuando la acción se ejecutó.

### 11.3 Accesibilidad

- `#flappy-marco` tiene `tabindex="0"` y `aria-label="Área de juego de Flappy Bird"`.
- El pájaro tiene `role="img"` y `aria-label="Pájaro volando por el bosque"`.
- El overlay tiene `role="dialog"`, `aria-modal="true"`, `aria-labelledby` y `aria-describedby`.
- Al mostrarse el overlay se pone `inert = false` y `aria-hidden = "false"`; al ocultarse, al revés. Eso evita que el foco caiga en elementos invisibles.
- En derrota/victoria, el foco va al botón de acción (`enfocar = true`); en el inicio no se roba el foco.
- `:focus-visible` dibuja un outline claro sobre el botón.
- Las capas decorativas y el HUD son `aria-hidden="true"`: no aportan información accionable.
- El HUD es visual; si se quisiera que un lector de pantalla anuncie puntos/tiempo, habría que agregar `aria-live`.

### 11.4 Fullscreen

```js
if (!document.fullscreenElement) {
    const promesa = marco.requestFullscreen ? marco.requestFullscreen() : null;
    if (promesa && promesa.catch) promesa.catch(function () {});
} else if (document.exitFullscreen) {
    document.exitFullscreen();
}
```

- Se pide fullscreen sobre el marco, no sobre toda la página: el juego ocupa la pantalla y el resto del sitio queda afuera.
- `fullscreenchange` vuelve a calcular la escala.
- El `catch` evita errores si el navegador rechaza la solicitud.

> **Para la defensa:** “El click en el botón no dispara un aleteo porque el handler ignora elementos interactivos; y mantener Espacio no hace flapping automático por el guard de `e.repeat`.”

---

## 12. Performance y decisiones

### 12.1 Técnicas usadas

| Técnica | Dónde | Por qué |
|---|---|---|
| `translate3d` | Pájaro, tubos, aves | Mueve en el compositor y evita layout. |
| `will-change: transform` | Pájaro, tubos, aves | Avisa al navegador que el elemento se va a mover. |
| `will-change: background-position-x` | Capas de parallax | Anticipa el cambio de la propiedad que se anima. |
| Un solo render por frame | `dibujarEscena()` | Evita repintados intermedios. |
| Sin lecturas de layout en el loop | `render()` solo escribe estilos | No hay *layout thrashing*. |
| Nodos creados al spawnear | Fábricas | No se crea DOM por frame. |
| HUD throttleado | Puntos/tiempo | Menos escrituras DOM. |
| Animaciones CSS | Sprite sheets, flote, impacto | El loop no calcula frames de sprite. |
| `image-rendering: pixelated` | Sprites y capas | Mantiene el pixel art nítido. |
| `overflow: hidden` | Marco y lienzo | Recorta lo que sale del escenario. |

### 12.2 DOM/CSS vs. canvas

| | DOM/CSS (implementación actual) | Canvas |
|---|---|---|
| Animaciones | Keyframes, sprites, transform | Hay que dibujar cada frame |
| Accesibilidad | Elementos reales, ARIA | Difícil sin capa extra |
| Responsive | CSS scale | Recalcular y redibujar |
| Costo por frame | Bajo con pocos nodos | Depende del área y de las draw calls |
| Escalabilidad | Media: muchos nodos cuestan | Alta: un solo canvas |
| Debug | Inspector del navegador | Herramientas de canvas |

El juego tiene pocos elementos dinámicos (3–4 pares de tubos, 1 ave, 1 pájaro) y muchas animaciones de sprite. DOM/CSS es la opción natural: se aprovechan keyframes, accesibilidad y responsive sin escribir un motor de render.

### 12.3 El costo del parallax

El parallax mueve `background-position-x` en siete capas grandes. Es una propiedad de **paint**, no de compositor: el navegador tiene que repintar esas capas. Con siete imágenes de 1024×576 puede ser la parte más costosa del frame en equipos modestos.

Alternativas:

- Duplicar cada capa y mover dos copias con `translate3d`, reciclando cuando una sale. Es más código, pero el movimiento queda en el compositor.
- Reducir la cantidad de capas o su resolución.
- Precargar las imágenes para evitar el primer frame vacío.

Para el alcance del TPE, la implementación actual es suficientemente fluida y mucho más simple.

### 12.4 Decisiones y limitaciones conocidas

| Tema | Decisión | Consecuencia |
|---|---|---|
| Timestep variable | `dt` real acotado a 33 ms | Misma velocidad relativa; no determinismo bit a bit. |
| Techo | Clamp, no muerte | El jugador no pierde por subir de más. |
| Hitbox | 26×26, no rota | Colisión más justa y barata; la rotación es visual. |
| `bird-2` | Agranda y penaliza | La hitbox crece y el juego se hace más difícil. |
| `bird-3` | Sin colisión | Es decorativo; no afecta el puntaje. |
| `xMundo` | Se acumula pero no se usa | Queda para una futura mecánica; no afecta el juego. |
| Sin pooling | Crear/destruir nodos | Simple; la cantidad de nodos está acotada. |
| Sin `devicePixelRatio` | Escalado CSS | Pixel art aceptable; podría verse más nítido en HiDPI. |
| Sin `prefers-reduced-motion` | Animaciones siempre activas | Mejora pendiente de accesibilidad. |
| Flote del `bird-2` | Visual, no afecta la hitbox | Diferencia de ±5 px; la colisión es generosa. |
| Animaciones CSS en pausa | Siguen su timeline | El overlay tapa la escena; no afecta la simulación. |

### 12.5 Posibles mejoras

- **Timestep fijo con acumulador** si se necesita reproducibilidad o tests deterministas.
- **RNG con semilla** para repetir una partida.
- **Swept AABB o sub-stepping** si se quiere garantía formal contra tunneling a bajos FPS.
- **Object pooling** si el número de entidades crece.
- **Parallax con transform** para llevar el movimiento al compositor.
- **`devicePixelRatio`** para mayor nitidez en HiDPI.
- **`prefers-reduced-motion`** para reducir flote/sacudida.
- **`aria-live`** para anunciar puntos y tiempo.
- **Sonido** y feedback háptico opcionales.

> **Para la defensa:** “El juego es chico: 3–4 pares de tubos y un ave. Por eso priorizamos claridad y animaciones CSS antes que un motor de canvas o pooling.”

---

## 13. Guion corto de defensa

Una versión de 5–8 minutos, pensada para mostrar el juego mientras se habla.

### 0:00–0:45 — Qué es y cómo está armado

> “Flappy Bird es un juego de un solo botón: el pájaro avanza solo y el jugador controla la altura. Está hecho con HTML, CSS y JavaScript clásico, sin canvas. El escenario lógico mide 1024×576 y se escala con CSS. La lógica está separada en cuatro archivos: el pájaro y su física, las tuberías y su fábrica, las aves y su fábrica, y el controlador de partida.”

### 0:45–1:30 — Escenario y responsive

> “El lienzo lógico es fijo. Lo que cambia es la escala: `Math.min(ancho/1024, alto/576)`. Así la misma tubería de 96 px ocupa el mismo porcentaje del escenario en un celular y en un monitor. El HUD y el overlay quedan fuera del lienzo para conservar tamaño de lectura.”

### 1:30–2:30 — Movimiento

> “El pájaro no avanza en X: queda en 220. El mundo se mueve: las tuberías, las aves y las siete capas de parallax. Cada capa usa la misma velocidad del mundo multiplicada por un factor de 0,05 a 1. Por eso el cartel pasa rápido y el fondo casi queda quieto. La física del pájaro es gravedad, impulso y tope de caída; la gravedad escala con el cuadrado del factor de velocidad para que el salto conserve la misma altura cuando el mundo acelera.”

### 2:30–3:30 — Timestamp y loop

> “El loop usa el timestamp de `requestAnimationFrame`. Calcula `dt` en segundos y lo acota a 33 ms. Toda la física está en px/s, así que 60 Hz y 144 Hz se sienten igual. El cap evita que un tirón teletransporte al pájaro. Si el equipo va lento, el juego entra en cámara lenta en vez de romper las colisiones. Al cambiar de pestaña se pausa y al volver se resetea `ultimo` para que no haya un salto.”

### 3:30–4:30 — Animaciones

> “Las animaciones están en CSS. Los sprites son tiras de 4 frames de 16×16; se muestran a 64×64 con `background-size: 400%` y se recorren con `background-position` y `step-end`. El contenedor lo mueve JS y el sprite lo anima CSS: así el `translate3d` de la física no pelea con el flote o la sacudida. Para reiniciar un aleteo se fuerza un reflow solo en el cambio de estado, no en cada frame.”

### 4:30–5:30 — Colisiones

> “La hitbox es un AABB de 26×26, más chico que el sprite de 64×64 para que sea justo. Con las tuberías primero descartamos por X y después preguntamos si el pájaro se salió del hueco. Es equivalente a chequear los dos tubos, pero más barato. El `bird-2` es el enemigo: al tocarlo el pájaro crece 10%, la hitbox crece y el juego se hace más difícil. El `bird-3` es visual y no colisiona.”

### 5:30–6:30 — Fábrica y ciclo de vida

> “Las tuberías y las aves las crean fábricas. La fábrica de tuberías decide el gap, la altura y la distancia; el controlador solo pide `crear(x)`. El par se agrega al DOM y al array. Cuando sale de pantalla, se destruye con `.remove()` y se saca del array con `splice` recorriendo al revés. Al reiniciar se limpian todos los nodos y se resetea la fábrica. No hay pooling porque la cantidad de nodos está acotada.”

### 6:30–7:30 — Dificultad, estados y cierre

> “La velocidad sube cada 15 tubos, hasta 195 px/s, y el gap se achica de 185 a 125. La meta es 50 puntos en 120 segundos. El estado de partida es una máquina simple: listo, jugando, pausado, impacto, gameover y victoria. El HUD se actualiza solo cuando cambia el segundo o el puntaje. En resumen: el juego es chico, pero las decisiones de tiempo, colisión y ciclo de vida están pensadas para que se comporte igual en cualquier dispositivo.”

---

## 14. Preguntas probables

### 1. ¿Por qué no usaron `<canvas>`?

Porque el juego tiene pocos elementos dinámicos y muchas animaciones de sprite. DOM/CSS permite keyframes, accesibilidad, responsive y debug con el inspector sin escribir un motor de render. Canvas sería mejor si hubiera cientos de entidades o efectos por píxel.

### 2. ¿Cómo hacen que 60 Hz y 144 Hz se sientan igual?

Toda la física está en px/s. El loop calcula `dt = (ahora - ultimo) / 1000` y mueve `velocidad * dt`. Un frame más corto mueve menos; la velocidad por segundo no cambia.

### 3. ¿Qué pasa en un equipo lento?

`dt` se capa a 33 ms. El juego entra en cámara lenta: el mundo avanza menos por segundo real, pero las colisiones y la dificultad por tubo se mantienen. Es preferible a que el pájaro se teletransporte.

### 4. ¿Por qué el pájaro no avanza en X?

Porque el mundo se mueve. El pájaro queda en `X_PANTALLA = 220` y las tuberías, aves y capas restan velocidad. Eso simplifica la hitbox y hace que todo el escenario comparta la misma velocidad.

### 5. ¿Por qué la hitbox es más chica que el sprite?

Porque el sprite mide 64×64 y la hitbox 26×26. El jugador no muere por un píxel de ala; la colisión se siente justa. La hitbox escala cuando el pájaro crece, pero no rota.

### 6. ¿Cómo detectan la colisión con una tubería?

Primero solapamiento en X: `hitbox.der > tubo.x && hitbox.izq < tubo.x + 96`. Si no hay, no colisiona. Si hay, comparan el borde superior contra `huecoArriba` y el inferior contra `huecoAbajo`. Es equivalente a chequear los dos tubos, pero más barato.

### 7. ¿Qué pasa al tocar el `bird-2`?

El pájaro crece 10% hasta 1,5×, se muestra un aro rojo y el ave se destruye. No termina la partida, pero la hitbox más grande hace que sea más difícil pasar. Si el pájaro ya está en 1,5×, el `bird-2` no aparece; sale `bird-3`.

### 8. ¿Cómo evitan que se acumulen tubos y aves?

Cada tubo que sale de pantalla se destruye con `.remove()` y se saca del array con `splice`. Las aves se destruyen al colisionar o terminar su recorrido. Al reiniciar se limpian todos los nodos y se resetean las fábricas.

### 9. ¿Por qué usaron una fábrica?

Para separar “cómo nace un tubo” de “cuándo nace”. El controlador no calcula gap, altura ni distancia; solo pide. Así las reglas de dificultad están en un solo lugar y el loop queda legible.

### 10. ¿El juego es determinista?

No. El `dt` varía con el frame pacing y las tuberías/aves usan `Math.random()`. Lo que se garantiza es la misma velocidad relativa y la misma dificultad por distancia. Para reproducibilidad exacta haría falta timestep fijo y RNG con semilla.

### 11. ¿Por qué la gravedad escala con `factor²`?

Porque el tiempo entre tubos cae `1/f`. Para conservar la altura del salto (`y ≈ ½ g t²`), `g` debe escalar `f²`. El impulso escala `f`, así la altura máxima `v²/(2g)` queda constante y el salto se vuelve más rápido.

### 12. ¿Cómo reinician sin bugs?

`reiniciarPartida()` detiene el loop, limpia `timeoutOverlay`, vuelve el estado a `listo`, resetea puntos/tiempo/velocidad, resetea el pájaro, el parallax, las tuberías y las aves. `rafId` evita loops duplicados y `ultimo = null` evita un `dt` gigante al reanudar.

### 13. ¿Cómo reinician una animación CSS?

Se quita la clase, se fuerza un reflow con `void element.offsetWidth` y se vuelve a agregar. Eso lo usan `setSprite`, `mostrarPenalizacion` y `mostrarOverlay`.

### 14. ¿Por qué el temporizador se ralentiza en equipos lentos?

Porque es tiempo de simulación: se descuenta con `dt`, no con `Date.now()`. Si el equipo no puede sostener el frame, el reloj también se ralentiza. Así el jugador no pierde tiempo mientras el juego va a tirones.

### 15. ¿Qué pasa al cambiar de pestaña?

`visibilitychange` detecta que la pestaña se ocultó, pasa el estado a `pausado` y detiene el loop. Al volver, vuelve a `jugando`, llama a `iniciarLoop()` y resetea `ultimo` para que el primer `dt` sea 0.

### 16. ¿Por qué el HUD no se actualiza en cada frame?

Porque no hace falta. El tiempo se actualiza cuando cambia el segundo entero y los puntos cuando cambian. Escribir en el DOM 60 veces por segundo sin necesidad es trabajo descartable.

### 17. ¿Qué pasa si el usuario mantiene Espacio?

El handler ignora `e.repeat`. Cada pulsación produce un solo impulso; mantener la tecla no hace flapping automático.

### 18. ¿Por qué el click en el botón no hace aletear?

Porque `esElementoInteractivo` detecta que el target está dentro de un botón, link o input y no ejecuta la acción de vuelo. El botón además hace `stopPropagation`.

### 19. ¿Cómo se oculta el `bird-3` en las tuberías?

Su contenedor `#flappy-aves-tuberia` tiene z-index 7 y las tuberías z-index 8. El ave se mueve a la misma velocidad horizontal que el tubo, así que queda centrada en el hueco y visualmente entra en las bocas.

### 20. ¿Qué mejorarían si tuvieran más tiempo?

Timestep fijo con acumulador para determinismo, RNG con semilla, parallax con `transform`, `devicePixelRatio`, `prefers-reduced-motion`, `aria-live` para el HUD y, si creciera la cantidad de entidades, object pooling.

---

## 15. Cheat sheet

| Dato | Valor |
|---|---:|
| Lienzo lógico | 1024×576 px |
| Velocidad base del mundo | 150 px/s |
| Velocidad máxima | 195 px/s |
| Niveles de velocidad | 3, cada 15 tubos, +10% |
| Gravedad base | 1400 px/s² |
| Impulso base | −450 px/s |
| Caída máxima base | 650 px/s |
| X del pájaro | 220 px |
| Suelo | 535 px |
| Hitbox base | 26×26 px |
| Sprite del pájaro | 64×64 px (4 frames de 16×16) |
| Ancho del tubo | 96 px |
| Boca del tubo | 48 px |
| Gap inicial | 185 px |
| Gap mínimo | 125 px |
| Reducción por tubo | 4 px |
| Distancia entre tubos | 290–420 px |
| Separación mínima de altura | 55 px |
| Margen vertical | 75 px |
| Partida | 50 puntos / 120 s |
| Probabilidad de ave | 1/3 por tubo, solo si no hay otra |
| Probabilidad `bird-2` | 50% si el pájaro puede crecer |
| Crecimiento por `bird-2` | +10%, máximo 1,5× |
| `dt` máximo | 1/30 s ≈ 33,3 ms |
| Capas de parallax | 7, factores 0,05–1,00 |
| z-index | capas 1–7, aves de tubo 7, tubos 8, aves/pájaro 9, HUD 10, overlay 20 |

**Tres frases para cerrar:**

1. “La física está en unidades por segundo, no en píxeles por frame.”
2. “El mundo se mueve; el jugador solo controla la altura.”
3. “La fábrica decide cómo nace cada obstáculo; el controlador solo pide, actualiza, dibuja y destruye.”

---

## 16. Cómo probarlo

### 16.1 Servir el juego

Desde la carpeta `2 entrega`:

```bash
python -m http.server 8123
```

Abrir `http://127.0.0.1:8123/flappybird.html`. También se puede abrir el archivo directamente, pero servirlo por HTTP se parece más al despliegue real y evita diferencias de rutas.

### 16.2 Checklist manual

- [ ] La página carga sin errores en consola.
- [ ] El lienzo se ve escalado y centrado; al redimensionar, se reacomoda.
- [ ] El botón de pantalla completa entra y sale; la escala se recalcula.
- [ ] Click, toque, `Espacio` y `↑` inician la partida y hacen aletear.
- [ ] Mantener `Espacio` no produce flapping automático.
- [ ] El pájaro sube al aletear y cae por gravedad; no sale por el techo.
- [ ] Pasar un par de tubos suma 1 punto y actualiza el HUD.
- [ ] Chocar contra un tubo o el suelo muestra la animación de impacto y, después de 600 ms, el overlay.
- [ ] El overlay permite reintentar y la partida vuelve a `listo`.
- [ ] Al cambiar de pestaña, el juego se pausa; al volver, se reanuda sin salto.
- [ ] El temporizador llega a 0 y muestra “¡Tiempo cumplido!”.
- [ ] El `bird-2` agranda al pájaro y muestra el aro rojo; el `bird-3` no colisiona.
- [ ] Al llegar a 50 puntos aparece la victoria.
- [ ] El juego sigue funcionando en una ventana angosta y en fullscreen.

### 16.3 Probar la victoria rápido

En la consola del navegador:

```js
FlappyDebug.debugCasiGanar();
```

Ese hook deja la partida en 49 puntos, con la velocidad máxima y un tubo justo antes de la línea de puntaje. Al pasar ese tubo se dispara la victoria. Es solo para demo/testing; no participa del flujo normal.

### 16.4 Probar el rendimiento

- Abrir DevTools → Performance y grabar unos segundos de juego.
- Verificar que no hay tareas largas ni lecturas de layout repetidas.
- Probar con CPU throttling (6× o 10×) para ver el comportamiento del cap: el juego debe ir en cámara lenta, no teletransportar.
- Probar en una ventana chica y en fullscreen.
- Revisar que el parallax y las tuberías se muevan sincronizados.

### 16.5 Probar accesibilidad

- Tabular hasta el botón del overlay y verificar el foco visible.
- Verificar que el overlay oculto no recibe foco (`inert`).
- Revisar los `aria-label` del marco, el pájaro y el diálogo.
- Confirmar que el juego se puede iniciar y jugar solo con teclado.

---

## 17. Glosario y referencias

### 17.1 Glosario

| Término | Significado |
|---|---|
| **AABB** | Rectángulo alineado con los ejes; se usa para las colisiones. |
| **Hitbox** | Caja de colisión del pájaro o del ave. |
| **`dt`** | Delta time: tiempo transcurrido desde el frame anterior, en segundos. |
| **Timestep variable** | La simulación avanza con el `dt` real de cada frame, no con un paso fijo. |
| **`requestAnimationFrame`** | API del navegador que ejecuta una función antes del próximo repintado y entrega un timestamp. |
| **Sprite sheet** | Imagen con varios frames en una tira; se recorre con `background-position`. |
| **Keyframe** | Estado de una animación CSS en un porcentaje del tiempo. |
| **Factory Method** | Patrón donde una fábrica encapsula la creación de objetos. |
| **Parallax** | Capas que se mueven a distintas velocidades para dar profundidad. |
| **Lienzo lógico** | Sistema de coordenadas fijo (1024×576) independiente del tamaño en pantalla. |
| **Tunneling** | Atravesar un obstáculo sin detectar la colisión por un salto grande entre frames. |

### 17.2 Archivos para leer con este documento

- [`2 entrega/flappybird.html`](../2%20entrega/flappybird.html)
- [`2 entrega/css/flappy.css`](../2%20entrega/css/flappy.css)
- [`2 entrega/js/FlappyPajaro.js`](../2%20entrega/js/FlappyPajaro.js)
- [`2 entrega/js/FlappyTuberias.js`](../2%20entrega/js/FlappyTuberias.js)
- [`2 entrega/js/FlappyAvesBonus.js`](../2%20entrega/js/FlappyAvesBonus.js)
- [`2 entrega/js/flappy.js`](../2%20entrega/js/flappy.js)
- [`specs/flappy_tuberias.md`](flappy_tuberias.md) — detalle del sprite y la construcción de las tuberías.

### 17.3 Referencias externas

- MDN — [`requestAnimationFrame`](https://developer.mozilla.org/es/docs/Web/API/Window/requestAnimationFrame)
- MDN — [CSS animations](https://developer.mozilla.org/es/docs/Web/CSS/CSS_animations/Using_CSS_animations)
- MDN — [`step-end` / `steps()`](https://developer.mozilla.org/es/docs/Web/CSS/easing-function)
- Refactoring Guru — [Factory Method](https://refactoring.guru/es/design-patterns/factory-method)

---

## Cierre

Flappy Bird parece un juego simple, pero concentra decisiones de tiempo, movimiento, colisión, animación y ciclo de vida. La defensa no pasa por decir que es complejo, sino por mostrar que cada pieza tiene un porqué:

- El **timestamp** y el **`dt`** hacen que el ritmo no dependa del dispositivo.
- El **mundo que se mueve** y el **jugador fijo en X** simplifican la física y las colisiones.
- Las **fábricas** mantienen las reglas de dificultad fuera del controlador.
- Las **colisiones AABB** con una hitbox generosa hacen que el juego se sienta justo.
- Las **animaciones CSS** separan lo visual de la simulación.
- El **ciclo de vida explícito** evita nodos huérfanos y partidas sucias.

Si hay que resumirlo en una idea: **el juego es chico, pero está diseñado para comportarse igual en cualquier equipo y para que cada responsabilidad viva en el lugar correcto**.

