/**
 * Módulo de Procesamiento de Imágenes y Filtros para Canvas (2D ImageData)
 * Cada función recibe un elemento canvas y modifica sus píxeles en memoria.
 */
const Filtros = {
    /**
     * Nivel 1: Escala de grises con fórmula de luminosidad estándar (ITU-R BT.601)
     */
    grises(cv) {
        const c = cv.getContext('2d');
        const imageData = c.getImageData(0, 0, cv.width, cv.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gris = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = gris;
            data[i + 1] = gris;
            data[i + 2] = gris;
            data[i + 3] = 255;
        }
        c.putImageData(imageData, 0, 0);
    },

    /**
     * Nivel 2: Brillo aumentado en un porcentaje (por defecto 30% = +76.5 sobre 255)
     */
    brillo(cv, porcentaje = 0.3) {
        const c = cv.getContext('2d');
        const imageData = c.getImageData(0, 0, cv.width, cv.height);
        const data = imageData.data;
        const incremento = 255 * porcentaje;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.max(0, Math.min(255, data[i] + incremento));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + incremento));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + incremento));
        }
        c.putImageData(imageData, 0, 0);
    },

    /**
     * Nivel 3: Filtro negativo (inversión de colores: 255 - canal)
     */
    negativo(cv) {
        const c = cv.getContext('2d');
        const imageData = c.getImageData(0, 0, cv.width, cv.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
            data[i + 3] = 255;
        }
        c.putImageData(imageData, 0, 0);
    },

    /**
     * Nivel 5: Blur por filtro de vecinos (ventana 5x5, radio K=2).
     * Cada píxele pasa a ser el promedio de su ventana. Se lee de "origen"
     * y se escribe en "destino" (dos buffers: si se escribiera sobre el mismo
     * array, los promedios se contaminarían con valores ya modificados).
     * En el borde faltan vecinos: se cuenta n y se divide por los que existen.
     */
    blur(cv, K = 2, iteraciones = 1) {
        const c = cv.getContext('2d');
        const origen = c.getImageData(0, 0, cv.width, cv.height);
        const destino = c.createImageData(cv.width, cv.height);
        let src = origen.data;
        const dst = destino.data;
        const width = cv.width, height = cv.height;

        for (let iter = 0; iter < iteraciones; iter++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let r = 0, g = 0, b = 0, n = 0;
                    for (let dy = -K; dy <= K; dy++) {
                        for (let dx = -K; dx <= K; dx++) {
                            const nx = x + dx, ny = y + dy;
                            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                            const j = (nx + ny * width) * 4;
                            r += src[j]; g += src[j + 1]; b += src[j + 2];
                            n++;
                        }
                    }
                    const i = (x + y * width) * 4;
                    dst[i] = r / n;
                    dst[i + 1] = g / n;
                    dst[i + 2] = b / n;
                    dst[i + 3] = src[i + 3];
                }
            }
            if (iter < iteraciones - 1) {
                src.set(dst);
            }
        }
        c.putImageData(destino, 0, 0);
    }
};

window.Filtros = Filtros;
