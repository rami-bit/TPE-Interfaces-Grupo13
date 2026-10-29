class FichaCamiseta extends ElementoJuego {

    constructor(posX, posY, fill, resaltado, context, ancho, alto) {
        super(posX, posY, fill, resaltado, context);
        this.ancho = ancho;
        this.alto = alto;
    }

    /**
     * Forma del clip: rectángulo centrado en (posX, posY).
     */
    definirPath() {
        this.context.rect(
            this.posX - this.ancho / 2,
            this.posY - this.alto / 2,
            this.ancho,
            this.alto
        );
    }

    draw() {
        const ctx = this.context;

        // --- Imagen recortada al rectángulo ---
        if (this.fill && this.fill instanceof HTMLImageElement) {
            ctx.save();
            ctx.beginPath();
            this.definirPath();
            ctx.clip();

            ctx.drawImage(this.fill,
                this.posX - this.ancho / 2,
                this.posY - this.alto / 2,
                this.ancho, this.alto);

            ctx.restore();
        }

        // --- Borde resaltado (fuera del clip) ---
        if (this.resaltado) {
            ctx.beginPath();
            this.definirPath();
            ctx.strokeStyle = this.resaltadoStyle;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    isPointInside(x, y) {
        const a = this.ancho / 2;
        const b = this.alto / 2;
        return x >= this.posX - a && x <= this.posX + a &&
               y >= this.posY - b && y <= this.posY + b;
    }
}
