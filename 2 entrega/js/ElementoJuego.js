class ElementoJuego {
    constructor(posX, posY, fill, resaltado, context) {
        this.posX = posX;
        this.posY = posY;
        this.fill = fill;
        this.resaltado = false;
        this.resaltadoStyle = "yellow";
        this.context = context;
    }

    getPosx() {
        return this.posX;
    }

    getPosY() {
        return this.posY;
    }

    getPos() {
        return {
            x: this.posX,
            y: this.posY
        };
    }

    getFill() {
        return this.fill;
    }

    getResaltado() {
        return this.resaltado;
    }

    setResaltado(resaltado) {
        this.resaltado = resaltado;
    }

    setPos(x, y) {
        this.posX = x;
        this.posY = y;
    }

    setFill(fill) {
        this.fill = fill;
    }

    /**
     * Define la forma del recorte (clip).
     * Cada subclabe DEBE sobreescribir este método.
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
