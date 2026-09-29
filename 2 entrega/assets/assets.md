# Assets — guía de referencia

Inventario de `assets/` para saber qué existe y qué usar **sin explorar la carpeta a ciegas**.
Rutas desde la raíz del proyecto; desde CSS van como `../assets/...`.

**Páginas:** `game.html`, `signup.html` · **CSS:** `css/style.css` (variables), `css/header.css`, `css/game.css`, `css/carrusel.css` (carrusel vertical, requiere `game.css` antes), `css/signup.css`, `css/footer.css` (fat footer, requiere `style.css` antes) · **JS:** `js/header.js`, `js/juego.js`

---

## Raíz de `assets/`

| Archivo | Qué es | Estado |
|---|---|---|
| `logo.svg` | Logo "CODEPLAY" (píxeles rosa) | usado en header y barra del juego |
| `marca.svg` | Marca/gráfico junto al logo en el header | usado en `game.html` |
| `caratula-peg.png` | Carátula del juego Peg Solitaire (627×353) | vista del juego |
| `miniaturaVideo.png` | Miniatura del video tutorial (362×223) — se muestra a tamaño natural | card "¿Que es Peg?" |
| `mouse.svg` | Ratón sólido, cuerpo blanco + botón superior izquierdo **rosa #FFB8F5** (38×59). **Usar este** en los controles | controles "Como Se Juega" (derecho) |
| `mouse-blanco.svg` | Copia de `mouse.svg` repintada **todo blanca** (la creé yo para el control izquierdo) | controles "Como Se Juega" (izquierdo) |
| `FagFooter.svg` | Arte grande (parece de footer) | sin usar |

---

## `assets/carrusel/` — carátulas del carrusel vertical

Descargadas de la CDN de Steam (las mismas imágenes que muestra SteamDB), todas **616×353**:

`rdr2.jpg` (Red Dead Redemption 2, app 1174180) · `fc26.jpg` (EA Sports FC 26, app 3405690) · `sekiro.jpg` (app 814380) · `gta-sa.jpg` (GTA San Andreas, app 12120) · `p3p.jpg` (Persona 3 Portable, app 1809700)

> Para FC26 el path clásico devolvía 404; se usó el `og:image` de la página de la tienda (`store_item_assets/.../capsule_616x353.jpg`).

---

## `assets/avatares/` — avatares de comentarios (150×150, JPG)

Recortes centrados en la cara (originales de Pinterest, redimensionados a 150×150):

| Archivo | Usuario en `game.html` | Origen (pin) |
|---|---|---|
| `seiya.jpg` | nar | pin `705165254188604816` — caballero de Andrómeda con pelo verde |
| `riquelme.jpg` | riquelme__@real100% | `i.pinimg.com/5d924edf...` — Riquelme con camiseta de Boca |
| `janson.jpg` | elPibe_janson | pin `lucas-janson-boca-juniors--1061090362191678196` — retrato oficial de Janson |
| `tito-estando-virgo.jpeg` | juanceto_01 | meme "Tito" |

> Falta 1: avatar del formulario de comentario (mock: meme "el tío gilipollas de Boca"). Mientras usa `icons/avatar-comentario.svg`.

---

## `assets/icons/` — íconos

Se usan como `<img>` o como **CSS mask** (mask permite recolorearlos con `background-color`).

**En uso — header/nav (`game.html`):**
`home.svg`, `recientes.svg`, `juegos-gratis/predeterminado.svg`, `juegos-gratis/juegos-pro.svg`, `accion.svg`, `deporte.svg`, `puzzle.svg`, `rpg.svg` (menú hamburguesa) · `search-1.svg` (lupa) · `avatar-claro.svg`

**En uso — `game.css` (masks, recoloreables):**
`play-triangulo.svg` (triángulo del play) · `Compartir.svg`, `favoritos.svg`, `fullscreen.svg` (botones de la barra) · `puzzle.svg` (icono de la pill de categoría, pintado oscuro)

**En uso — `header.css` (masks del panel de cuenta):**
`avatar.svg` · `avatar-noob/pro-card-recomendados/coronaPro-1.svg` (corona rosa) · `Config.svg` · `escudo.svg` · `salir.svg` · `favoritos.svg`

**En uso — `signup.html`:**
`ojo.svg`, `alert.svg`, `recaptcha.png`, `google.svg`, `facebook.svg`

**Sin uso actual:** `Vector.svg`, `angle-right-1.svg`, `mostrado.svg`, `ojo`… , `play-icon.svg`, `PRO.svg`, `propiedad-1-predeterminado*.svg`, `rpg-card.svg`, `deporte-card.svg`, `estrategia-card.svg` (variantes de categoría para cards), `avatar.svg`, `checkbox.svg`, `checkbox/*`, `Icon/Vector.svg`, `avatar-noob/pro-card-recomendados/*`, `pro-card-recomendados/*`, `facebook.svg`, `Config` (solo mask)…

**En uso — fat footer (`game.html`):** `mastercard.svg` (54×32) y `visa.svg` (50×32) — son **badges blancos con el logo recortado** (todo `fill="white"`), van como `<img>` sobre el fondo oscuro ✓ · `iconoPro.svg` (botón PRO) · **Instagram y TikTok NO tienen asset**: van como SVG inline dibujados en el HTML (círculo blanco 34px + glifo #050E1F)

**En uso — comentarios y carrusel (`game.html`):** `avatar-comentario.svg` (solo 2 avatares ahora: el del formulario y el de `juanceto_01`; los otros 3 van con `assets/avatares/*.jpg`) · `like.svg` (pulgar "me gusta", **`<img>` directo**: el svg es stroke blanco, no necesita mask) · `iconoPro.svg` (badge PRO completo del carrusel: pill #0F172A + borde/corona/letras rosa, 72×32)

> ⚠️ `icons/raton.svg` — **obsoleto**: lo creé yo antes de que subieras `mouse.svg`. Ya no se usa.
> ⚠️ `avatar-noob/pro-card-recomendados/coronaPro.svg` — **0 KB, no sirve**; usar `coronaPro-1.svg`.

---

## `assets/buttons/` — botones exportados de Figma

Todo este directorio está **sin usar actualmente** (los botones del juego se hacen con HTML+CSS+mask). Sirven como referencia de diseño/estados:

- **Estados de botones:** `btn-accion`, `btn-deporte`, `btn-rpg`, `btn-reciente`, `btn-megusta`, `btn-juego-gratis`, `btn-juegos-pro`, `btn-fav`, `btn-fav-head`, `btn-favoritos-anadir`, `btn-cancelar`, `btn-comentar`, `compartir`, `fullscrean`, `play-juego` — cada uno con sus variantes `hover-*`, `Default*`, `default-*`, `Inactivo`, `presionado`, `Hover`
- **Perfil en header:** `avatar*.svg`, `barra-de-navegacion-perfil*.svg`, `botones-barra-de-navegacion-perfil.svg`
- **Video:** `play-video.svg` — play rojo (elipse #F70004 + triángulo blanco) de la card de video ✅ en uso
- **Flechas/varios:** `Vector.svg` y `Vector-1.svg` — flecha con forma de **casa** (ojo: no es chevron; antes la usaba para las flechas del teclado y se veía rara) · `derecha.svg`/`izquierda.svg` (+ `derecha-inactivo`/`izquierda-inactivo`), `deslizar-carrusel.svg`, `Union.svg`, `base.svg`, `rectangle-7.svg`, `nav-cerrado.svg`, `puzzle-btn.svg`, `facebook.svg`
- `recaptcha/Predeterminado.svg` — widget reCAPTCHA

---

## Notas técnicas

- **Recolorear SVG monocromo:** usar CSS `mask` + `background-color` (así se pintan blancos/rosa los íconos de la barra, la pill, etc.).
- **Edge headless NO renderiza masks** → en mis capturas no aparecen (triángulo del play, corazón, puzzle, chevrons si fueran mask); en el navegador normal sí se ven. Por eso los chevrons de los controles y los ratones se hacen con bordes CSS / `<img>`, no mask.
- **PNG no se recolorean** (`caratula-peg.png`, `miniaturaVideo.png`, `recaptcha.png`).
