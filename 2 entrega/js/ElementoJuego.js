/**
 * Clase base abstracta que representa cualquier elemento visual e interactivo del juego
 * dibujado sobre un contexto 2D de Canvas.
 * Implementa el patrón Template Method en dibujarImagenEnClip(ancho, alto), delegando
 * la geometría específica a definirPath() en cada subclase.
 */
class ElementoJuego {
    /**
     * @param {number} posX - Coordenada X inicial del centro del elemento.
     * @param {number} posY - Coordenada Y inicial del centro del elemento.
     * @param {HTMLImageElement|string} fill - Imagen o color de relleno del elemento.
     * @param {boolean} resaltado - Indica si la figura tiene un borde de selección activo.
     * @param {CanvasRenderingContext2D} context - Contexto 2D del Canvas donde se renderiza.
     */
    constructor(posX, posY, fill, resaltado, context) {
        this.posX = posX;
        this.posY = posY;
        this.fill = fill;
        this.resaltado = resaltado;
        this.resaltadoStyle = "yellow";
        this.context = context;
    }

    /**
     * Obtiene la posición horizontal (eje X) del elemento.
     * @returns {number} Coordenada X.
     */
    getPosx() {
        return this.posX;
    }

    /**
     * Obtiene la posición vertical (eje Y) del elemento.
     * @returns {number} Coordenada Y.
     */
    getPosY() {
        return this.posY;
    }

    /**
     * Obtiene las coordenadas actuales (X, Y) del elemento como objeto.
     * @returns {{x: number, y: number}} Objeto con coordenadas x e y.
     */
    getPos() {
        return {
            x: this.posX,
            y: this.posY
        };
    }

    /**
     * Obtiene la imagen o estilo de relleno asociado a la figura.
     * @returns {HTMLImageElement|string}
     */
    getFill() {
        return this.fill;
    }

    /**
     * Consulta si el elemento está actualmente resaltado (seleccionado).
     * @returns {boolean}
     */
    getResaltado() {
        return this.resaltado;
    }

    /**
     * Activa o desactiva el resaltado visual de selección en el elemento.
     * @param {boolean} resaltado
     */
    setResaltado(resaltado) {
        this.resaltado = resaltado;
    }

    /**
     * Actualiza las coordenadas espaciales del elemento en el canvas.
     * @param {number} x - Nueva coordenada X.
     * @param {number} y - Nueva coordenada Y.
     */
    setPos(x, y) {
        this.posX = x;
        this.posY = y;
    }

    /**
     * Modifica la imagen o estilo de relleno del elemento.
     * @param {HTMLImageElement|string} fill
     */
    setFill(fill) {
        this.fill = fill;
    }

    /**
     * Define la forma geométrica del recorte (clip) y del contorno.
     * Cada subclase DEBE sobreescribir este método.
     * Se invoca automáticamente desde dibujarImagenEnClip().
     */
    definirPath() {
        // Método abstracto: implementado por las subclases (FichaTapita)
    }

    /**
     * Dibuja this.fill (HTMLImageElement) centrada en (posX, posY) y recortada a la forma
     * definida por definirPath(), aplicando además el contorno si está resaltada.
     *
     * @param {number} ancho - Ancho en píxeles con el que se escala la imagen.
     * @param {number} alto - Alto en píxeles con el que se escala la imagen.
     */
    dibujarImagenEnClip(ancho, alto) {
        const ctx = this.context;

        // 1. Imagen recortada a la silueta definida por la subclase
        if (this.fill && this.fill instanceof HTMLImageElement) {
            ctx.save();
            ctx.beginPath();
            this.definirPath();
            ctx.clip();

            ctx.drawImage(
                this.fill,
                this.posX - ancho / 2,
                this.posY - alto / 2,
                ancho,
                alto
            );

            ctx.restore();
        }

        // 2. Contorno de selección (fuera del clip para verse completo)
        if (this.resaltado) {
            ctx.beginPath();
            this.definirPath();
            ctx.strokeStyle = this.resaltadoStyle;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }
}
