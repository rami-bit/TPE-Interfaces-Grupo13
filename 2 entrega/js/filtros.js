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
    }
};

window.Filtros = Filtros;
