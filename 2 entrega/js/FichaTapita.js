class FichaTapita extends ElementoJuego {

    constructor(posX, posY, fill, resaltado, context, radius) {
        super(posX, posY, fill, resaltado, context);
        this.radius = radius;
    }

    /**
     * Forma del clip: círculo centrado en (posX, posY) con radio `radius`.
     */
    definirPath() {
        this.context.arc(this.posX, this.posY, this.radius, 0, 2 * Math.PI);
    }

    draw() {
        const ctx = this.context;

        // --- Imagen recortada al círculo ---
        if (this.fill && this.fill instanceof HTMLImageElement) {
            const lado = this.radius * 2;

            ctx.save();
            ctx.beginPath();
            this.definirPath();
            ctx.clip();

            // La imagen se dibuja centrada en (posX, posY) escalada al diámetro
            ctx.drawImage(this.fill,
                this.posX - this.radius,
                this.posY - this.radius,
                lado, lado);

            ctx.restore();
        }

        // --- Borde resaltado (fuera del clip, se ve completo) ---
        if (this.resaltado) {
            ctx.beginPath();
            ctx.arc(this.posX, this.posY, this.radius, 0, 2 * Math.PI);
            ctx.strokeStyle = this.resaltadoStyle;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    isPointInside(x, y) {
        let dx = this.posX - x;
        let dy = this.posY - y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }
}
