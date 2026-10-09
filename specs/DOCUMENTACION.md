# Blocka — Documentación del proyecto

**Blocka** es un juego de rompecabezas basado en imágenes. El jugador debe armar una imagen descompuesta en **cuatro partes (sub-imágenes)**, cada una rotada respecto a su posición original, rotándolas con los botones del mouse hasta conformar la imagen final.

---

## 1. Descripción general de la mecánica

- Al iniciar el nivel, la **blocka** aparece en pantalla con una interfaz limpia.
- Una **blocka** es una imagen descompuesta en cuatro partes rotadas respecto a su posición original.
- El usuario debe rotar cada sub-imagen hasta que las cuatro partes conformen la imagen final.
- **Rotación:**
  - Click con **botón izquierdo** → gira hacia la **izquierda** (−90°).
  - Click con **botón derecho** → gira hacia la **derecha** (+90°).
- El nivel muestra un **temporizador** que se inicia con la opción **“Comenzar”** y se detiene al lograr la imagen final, marcando el **récord** de ese nivel.
- Al terminar, el usuario puede volver al **Menú Ppal** o continuar al **siguiente nivel** (misma mecánica, otra imagen).
- Para incrementar la dificultad, la imagen aparece desordenada y **con un filtro aplicado**. A medida que pasan los niveles, el filtro cambia e incluso cada sub-imagen puede tener un filtro distinto.
- Cuando el usuario termina de armar la imagen, **los filtros se quitan** y se observa la imagen original en **RGB**.

### Funcionalidad general

- Los filtros se aplican en **tiempo de carga**, en el momento de **setup del nivel**.
- Existe un **banco de imágenes (6 o más)** y al iniciar el nivel el sistema elige **aleatoriamente** una imagen.
- Incluir **instrucciones de juego** (posición, forma de acceso, etc., acorde a la mejor UX).
- El videojuego debe contener al menos **tres niveles**.
- Filtros obligatorios:
  1. Escala de grises
  2. Brillo (30%)
  3. Negativo

---

## 2. Estructura del proyecto

```
practica filtros/
├── index.html          ← página principal (canvas + botones)
├── script.js           ← lógica de filtros y rotación
├── image.jpg           ← imagen del banco
└── DOCUMENTACION.md    ← este archivo
```

**Ejecución:** abrir `index.html` directamente en un navegador (no requiere servidor ni dependencias).

---

## 3. Código HTML (`index.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>

<style>
    body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
    }

    button {
        margin: 10px;
    }

    #myCanvas {
        margin-bottom: 20px;
    }
</style>

<body>
    <canvas id="myCanvas" width="400" height="400" style="border:1px solid #000000;" oncontextmenu="return false;"></canvas>

    <button id="gray-filter">Apply Gray Filter</button>
    <button id="brightness-filter">Apply Brightness Filter</button>
    <button id="invert-filter">Apply Invert Filter</button>

    <button id="reset">Reset</button>

    <script src="script.js"></script>
</body>
</html>
```

### Explicación de los elementos

| Elemento | Rol |
|---|---|
| `<canvas id="myCanvas" width="400" height="400">` | Lienzo donde se dibuja la imagen y se aplican los filtros y la rotación. |
| `oncontextmenu="return false;"` | **Imprescindible:** desactiva el menú contextual del navegador para que el **click derecho** pueda usarse como rotación a la derecha. |
| `#gray-filter` | Aplica escala de grises. |
| `#brightness-filter` | Aplica brillo +30%. |
| `#invert-filter` | Aplica negativo. |
| `#reset` | Restaura la imagen original (sin filtros, ángulo 0°). |
| `<script src="script.js">` | Carga la lógica del juego al final del `body`. |
| CSS `body { display:flex; ... }` | Centra el canvas y los botones verticalmente en la pantalla. |

---

## 4. Código JavaScript (`script.js`)

```javascript
document.addEventListener('DOMContentLoaded', () => {
    let btnGray = document.getElementById('gray-filter');
    let btnBrightness = document.getElementById('brightness-filter');
    let btnInvert = document.getElementById('invert-filter');
    let btnReset = document.getElementById('reset');

    let canvas = document.getElementById('myCanvas');

    let width = 400;
    let height = 400;

    let ctx = canvas.getContext('2d');

    let image = new Image();
    image.src = 'image.jpg';
    image.onload = () => {
        myDrawMethod(image);
    }


    const myDrawMethod = (image) => {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }


    function applyGrayFilter() {
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let index = (x + y * imageData.width) * 4;
                let gray = imageData.data[index] * 0.299 + imageData.data[index + 1] * 0.587 + imageData.data[index + 2] * 0.114;
                imageData.data[index] = gray;
                imageData.data[index + 1] = gray;
                imageData.data[index + 2] = gray;
                imageData.data[index + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }


    btnGray.addEventListener('click', () => {
        applyGrayFilter();
    });


    function applyBrightnessFilter() {
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;
        const amount = 255 * 0.3; // 30% de brillo = +76.5

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] + amount);     // Red
            data[i + 1] = Math.min(255, data[i + 1] + amount); // Green
            data[i + 2] = Math.min(255, data[i + 2] + amount); // Blue
            // Alpha (data[i + 3]) se mantiene igual
        }

        ctx.putImageData(imageData, 0, 0);
    }


    btnBrightness.addEventListener('click', () => {
        applyBrightnessFilter();
    })


    let currentAngle = 0;

    btnReset.addEventListener('click', () => {
        currentAngle = 0;
        myDrawMethod(image);
    })


    function invertColors() {
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let index = (x + y * imageData.width) * 4;
                imageData.data[index] = 255 - imageData.data[index];
                imageData.data[index + 1] = 255 - imageData.data[index + 1];
                imageData.data[index + 2] = 255 - imageData.data[index + 2];
                imageData.data[index + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }


    btnInvert.addEventListener('click', () => {
        invertColors();
    })


    const rotateCanvas = (direction) => {
        let dataURL = canvas.toDataURL();
        currentAngle = (currentAngle + direction + 360) % 360;

        let tempImg = new Image();
        tempImg.src = dataURL;
        tempImg.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(currentAngle * Math.PI / 180);
            ctx.drawImage(tempImg, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
            ctx.restore();
        };
    }


    canvas.addEventListener('mousedown', (event) => {
        if (event.button === 0) {
            rotateCanvas(-90);
        } else if (event.button === 2) {
            event.preventDefault();
            rotateCanvas(90);
        }
    });

})
```

### 4.1 Inicialización y carga de la imagen

```javascript
let image = new Image();
image.src = 'image.jpg';
image.onload = () => {
    myDrawMethod(image);
}

const myDrawMethod = (image) => {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}
```

- Se crea un objeto `Image` y se le asigna la fuente (`image.jpg`, parte del banco de imágenes).
- Recién en `onload` (cuando la imagen terminó de cargar) se la dibuja en el canvas con `drawImage`, escalada a 400×400.
- Todo el código vive dentro de `DOMContentLoaded`, garantizando que los elementos del DOM existan antes de referenciarlos.

### 4.2 Filtro: Escala de grises

```javascript
function applyGrayFilter() {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let index = (x + y * imageData.width) * 4;
            let gray = imageData.data[index] * 0.299
                     + imageData.data[index + 1] * 0.587
                     + imageData.data[index + 2] * 0.114;
            imageData.data[index]     = gray;
            imageData.data[index + 1] = gray;
            imageData.data[index + 2] = gray;
            imageData.data[index + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
}
```

- `getImageData` extrae los píxeles del canvas como un array `Uint8ClampedArray` (RGBA, 4 valores por píxel).
- La fórmula usa los **pesos de luminancia ITU-R BT.601**: `0.299·R + 0.587·G + 0.114·B`, que respeta la percepción humana del brillo (el verde pesa más que el azul).
- El mismo valor `gray` se escribe en R, G y B → el píxel queda neutro (sin matiz).
- `index = (x + y · width) · 4` convierte la coordenada (x, y) a la posición en el array RGBA.
- `putImageData` vuelve a escribir los píxeles modificados en el canvas.

### 4.3 Filtro: Brillo (+30%)

```javascript
function applyBrightnessFilter() {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;
    const amount = 255 * 0.3; // 30% de brillo = +76.5

    for (let i = 0; i < data.length; i += 4) {
        data[i]     = Math.min(255, data[i] + amount);     // Red
        data[i + 1] = Math.min(255, data[i + 1] + amount); // Green
        data[i + 2] = Math.min(255, data[i + 2] + amount); // Blue
        // Alpha (data[i + 3]) se mantiene igual
    }

    ctx.putImageData(imageData, 0, 0);
}
```

- `amount = 255 * 0.3 = 76.5` → se suma el **30% del rango total** a cada canal.
- `Math.min(255, ...)` evita el *saturación/blanqueo*: ningún canal supera 255.
- Se recorre el array de a 4 en 4 (`i += 4`) y se tocan solo R, G y B; el canal alfa (transparencia) no cambia.

### 4.4 Filtro: Negativo

```javascript
function invertColors() {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let index = (x + y * imageData.width) * 4;
            imageData.data[index]     = 255 - imageData.data[index];
            imageData.data[index + 1] = 255 - imageData.data[index + 1];
            imageData.data[index + 2] = 255 - imageData.data[index + 2];
            imageData.data[index + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
}
```

- Invierte cada canal con `255 − valor` (blanco ↔ negro, azul ↔ amarillo, etc.).
- Es una operación **punto a punto**: cada píxel se transforma sin mirar a sus vecinos.

### 4.5 Rotación con los dos botones del mouse

```javascript
let currentAngle = 0;

const rotateCanvas = (direction) => {
    let dataURL = canvas.toDataURL();
    currentAngle = (currentAngle + direction + 360) % 360;

    let tempImg = new Image();
    tempImg.src = dataURL;
    tempImg.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(currentAngle * Math.PI / 180);
        ctx.drawImage(tempImg, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        ctx.restore();
    };
}

canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {          // botón IZQUIERDO
        rotateCanvas(-90);             // gira a la izquierda
    } else if (event.button === 2) {   // botón DERECHO
        event.preventDefault();
        rotateCanvas(90);              // gira a la derecha
    }
});
```

**Cómo funciona paso a paso:**

1. **Captura del click:** el evento `mousedown` identifica qué botón se presionó con `event.button`:
   - `0` = botón izquierdo → `direction = -90` (antihorario / izquierda).
   - `2` = botón derecho → `direction = +90` (horario / derecha).
   - `event.preventDefault()` en el botón derecho evita comportamientos por defecto (complementado por `oncontextmenu="return false"` en el HTML).
2. **Snapshot:** `canvas.toDataURL()` guarda el contenido actual del canvas como una imagen (data URL).
3. **Ángulo acumulado:** `currentAngle = (currentAngle + direction + 360) % 360` mantiene el ángulo siempre normalizado entre 0° y 359° (el `+ 360` evita negativos antes del módulo).
4. **Redibujo rotado** (en el `onload` de la imagen temporal):
   - `clearRect` limpia el canvas.
   - `save()` / `restore()` aíslan las transformaciones.
   - `translate` al centro del canvas → el pivote de rotación es el centro.
   - `rotate(currentAngle * Math.PI / 180)` convierte grados a radianes y aplica la rotación.
   - `drawImage` redibuja la imagen centrada (por eso se resta `width/2`, `height/2`).
5. Como el ángulo es **acumulativo**, la imagen recuerda su orientación respecto a la original: cuando `currentAngle` vuelve a 0, la blocka queda resuelta.

### 4.6 Reset

```javascript
btnReset.addEventListener('click', () => {
    currentAngle = 0;
    myDrawMethod(image);
})
```

Restaura el ángulo a 0° y redibuja la imagen original (también sirve para limpiar los filtros aplicados).

---

## 5. Tabla resumen de filtros

| Filtro | Fórmula | Función en `script.js` | Botón |
|---|---|---|---|
| Escala de grises | `0.299·R + 0.587·G + 0.114·B` | `applyGrayFilter()` | `#gray-filter` |
| Brillo 30% | `min(255, canal + 255·0.3)` | `applyBrightnessFilter()` | `#brightness-filter` |
| Negativo | `255 − canal` | `invertColors()` | `#invert-filter` |

---

## 6. Diseño de niveles (spec)

| Nivel | Dificultad | Filtro aplicado en el setup | Banco de imágenes |
|---|---|---|---|
| 1 | Baja | Escala de grises (imagen completa) | Selección aleatoria de 6+ imágenes |
| 2 | Media | Brillo 30% (imagen completa) | Selección aleatoria de 6+ imágenes |
| 3 | Alta | Negativo, **distinto por cada sub-imagen** | Selección aleatoria de 6+ imágenes |

**Reglas de progresión:**

- Los filtros se aplican **al cargar el nivel** (en el setup), no durante el juego.
- Al completar la imagen (las 4 sub-imágenes en su posición y ángulo correctos), **se remueven todos los filtros** y se muestra la imagen original en RGB.
- El temporizador arranca con **“Comenzar”** y se detiene al resolver; el tiempo queda guardado como **récord** del nivel.
- Pantalla posterior a resolver: **Menú Ppal** o **Siguiente nivel**.

---

## 7. Estados y pantallas planificados

```
┌─────────────┐   "Comenzar"   ┌──────────────────┐   4 sub-imágenes   ┌────────────────┐
│  Menú Ppal  │ ─────────────▶ │  Nivel (timer ON) │ ────────────────▶ │  Nivel resuelto│
│ + Instrucc. │                │  filtros activos  │   timer OFF       │  sin filtros   │
└─────────────┘                └──────────────────┘   récord guardado  └───────┬────────┘
       ▲                                                              │        │
       └─────────────────── "Menú Ppal" ◀─────────────────────────────┤        │
                                                                      ▼        ▼
                                                              Siguiente nivel  Fin
```

---

## 8. Pendientes / próximos pasos

- [ ] Descomponer la imagen en **4 cuadrantes** (sub-imágenes) con su propio estado de rotación.
- [ ] Barajar el ángulo inicial de cada sub-imagen al cargar el nivel.
- [ ] Aplicar el filtro **por sub-imagen** en el setup (no sobre el canvas completo).
- [ ] Detectar la condición de victoria (4/4 sub-imágenes en ángulo 0 y posición correcta) y remover los filtros.
- [ ] Temporizador con botón **“Comenzar”**, detección de fin y guardado de récord por nivel.
- [ ] Banco de **6+ imágenes** con selección aleatoria.
- [ ] Menú principal, pantalla de instrucciones y navegación entre niveles (mínimo 3).
- [ ] Actualizar los rótulos de los botones al español.
