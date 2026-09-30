document.addEventListener("DOMContentLoaded", () => {
    let fill = document.getElementById("loading-bar-fill");
    let texto = document.getElementById("loading-text");
    if (!fill || !texto) {
        window.location.href = "home.html";
        return;
    }

    let anim = fill.getAnimations()[0];
    if (!anim) {
        window.location.href = "home.html";
        return;
    }

    let yaNavego = false;
    function irAHome() {
        if (yaNavego) return;
        yaNavego = true;
        window.location.href = "home.html";
    }

    function actualizar() {
        let progreso = anim.effect.getComputedTiming().progress;
        texto.textContent = Math.round((progreso || 0) * 100) + "%";
        if (anim.playState === "finished") {
            irAHome();
            return;
        }
        requestAnimationFrame(actualizar);
    }

    requestAnimationFrame(actualizar);
    setTimeout(irAHome, 5000);
});
