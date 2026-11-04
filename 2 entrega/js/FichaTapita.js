/**
 * Representa una ficha con formato circular de "tapita", temática Boca Juniors.
 * Hereda de ElementoJuego y recorta su imagen dentro de un path circular.
 */
class FichaTapita extends ElementoJuego {
    /**
     * @param {number} posX - Centro en eje X.
     * @param {number} posY - Centro en eje Y.
     * @param {HTMLImageElement} fill - Imagen de la tapita cargada.
     * @param {boolean} resaltado - Estado inicial de resaltado.
     * @param {CanvasRenderingContext2D} context - Contexto del Canvas.
     * @param {number} radius - Radio en píxeles del círculo de la ficha.
     */
    constructor(posX, posY, fill, resaltado, context, radius) {
        super(posX, posY, fill, resaltado, context);
        this.radius = radius;
    }

    /**
     * Define el path circular para el recorte (clip) centrado en (posX, posY).
     */
    definirPath() {
        this.context.arc(this.posX, this.posY, this.radius, 0, 2 * Math.PI);
    }

    /**
     * Dibuja la ficha en el Canvas:
     * 1. Aplica un clip circular para que la imagen quede recortada a la forma de la tapita.
     * 2. Si la ficha está seleccionada, dibuja un anillo exterior resaltado en amarillo.
     */
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

    /**
     * Determina si una coordenada (x, y) del mouse cae dentro del área circular de la ficha
     * utilizando el cálculo de distancia euclidiana pitagórica.
     * @param {number} x - Coordenada X del click.
     * @param {number} y - Coordenada Y del click.
     * @returns {boolean} True si la distancia al centro es menor o igual al radio.
     */
    isPointInside(x, y) {
        let dx = this.posX - x;
        let dy = this.posY - y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }
}
