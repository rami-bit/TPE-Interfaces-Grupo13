/**
 * Clase base abstracta que representa cualquier elemento visual e interactivo del juego
 * dibujado sobre un contexto 2D de Canvas.
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
        this.resaltado = false;
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
     * Define la forma del recorte (clip).
     * Cada subclase DEBE sobreescribir este método.
     * Se llama desde dibujarImagenEnClip().
     */
    definirPath() {
        // vacío a propósito
    }

    /**
     * Dibuja this.fill (una HTMLImageElement) recortada a la forma
     * definida por definirPath().
     *
     * Flujo:
     *   save()       → guarda el estado actual del canvas
     *   beginPath()  → inicia un nuevo path
     *   definirPath()→ cada hijo describe su forma (círculo, camiseta…)
     *   clip()       → recorta todo lo que se dibuje después a esa forma
     *   drawImage()  → dibuja la imagen completa dentro del recorte
     *   restore()    → quita el clip y restaura el estado anterior
     */
    dibujarImagenEnClip() {
        if (!this.fill || !(this.fill instanceof HTMLImageElement)) return;

        const ctx = this.context;
        ctx.save();
        ctx.beginPath();
        this.definirPath();
        ctx.clip();
        ctx.drawImage(this.fill, this.posX, this.posY);
        ctx.restore();
    }
}
