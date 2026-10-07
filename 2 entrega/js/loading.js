document.addEventListener("DOMContentLoaded", () => {
    let fill = document.getElementById("loading-bar-fill");
    let texto = document.getElementById("loading-text");
    let loadingContainer = document.querySelector(".loading-container");


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
            loadingContainer.style.animation = "movingUp 1s forwards";
            setTimeout(irAHome, 800);
            return;
        }
        requestAnimationFrame(actualizar);
    }

    requestAnimationFrame(actualizar);
    setTimeout(irAHome, 6000); // 6 segundos (5s + 0.8s)
});
