/**
 * Representa una ficha con formato circular de "tapita", temática Boca Juniors.
 * Hereda de ElementoJuego y define su geometría circular para el clip y detección de impacto.
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
     * Define el path circular para el recorte (clip) y borde centrado en (posX, posY).
     */
    definirPath() {
        this.context.arc(this.posX, this.posY, this.radius, 0, 2 * Math.PI);
    }

    /**
     * Dibuja la ficha en el Canvas delegando el clip y resaltado a la clase padre.
     */
    draw() {
        const diametro = this.radius * 2;
        this.dibujarImagenEnClip(diametro, diametro);
    }

    /**
     * Determina si una coordenada (x, y) del mouse cae dentro del área circular de la ficha
     * utilizando el cálculo de distancia euclidiana pitagórica.
     * @param {number} x - Coordenada X del click.
     * @param {number} y - Coordenada Y del click.
     * @returns {boolean} True si la distancia al centro es menor o igual al radio.
     */
    isPointInside(x, y) {
        const dx = this.posX - x;
        const dy = this.posY - y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }
}
