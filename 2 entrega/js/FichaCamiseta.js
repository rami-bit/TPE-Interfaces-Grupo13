/**
 * Representa una ficha con formato rectangular de camiseta de fútbol, temática Boca Juniors.
 * Hereda de ElementoJuego y define su geometría rectangular centrada para el clip y detección de impacto.
 */
class FichaCamiseta extends ElementoJuego {
    /**
     * @param {number} posX - Centro en eje X.
     * @param {number} posY - Centro en eje Y.
     * @param {HTMLImageElement} fill - Imagen de la camiseta cargada.
     * @param {boolean} resaltado - Estado inicial de resaltado.
     * @param {CanvasRenderingContext2D} context - Contexto del Canvas.
     * @param {number} ancho - Ancho en píxeles de la ficha.
     * @param {number} alto - Alto en píxeles de la ficha.
     */
    constructor(posX, posY, fill, resaltado, context, ancho, alto) {
        super(posX, posY, fill, resaltado, context);
        this.ancho = ancho;
        this.alto = alto;
    }

    /**
     * Define la forma del clip y borde: rectángulo centrado en (posX, posY).
     */
    definirPath() {
        this.context.rect(
            this.posX - this.ancho / 2,
            this.posY - this.alto / 2,
            this.ancho,
            this.alto
        );
    }

    /**
     * Dibuja la ficha en el Canvas delegando el clip y resaltado a la clase padre.
     */
    draw() {
        this.dibujarImagenEnClip(this.ancho, this.alto);
    }

    /**
     * Determina si una coordenada (x, y) del mouse cae dentro del área rectangular de la camiseta
     * mediante comprobación de caja delimitadora (AABB).
     * @param {number} x - Coordenada X del click.
     * @param {number} y - Coordenada Y del click.
     * @returns {boolean} True si (x, y) está dentro de los límites del rectángulo.
     */
    isPointInside(x, y) {
        const a = this.ancho / 2;
        const b = this.alto / 2;
        return x >= this.posX - a && x <= this.posX + a &&
               y >= this.posY - b && y <= this.posY + b;
    }
}
