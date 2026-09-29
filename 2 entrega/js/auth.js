document.addEventListener("DOMContentLoaded", () => {
    let formulario = document.querySelector(".formulario-registro, .formulario-login");
    let tarjeta = document.querySelector(".tarjeta-registro, .tarjeta-login");
    if (!formulario || !tarjeta) return;

    let yaRedirigio = false;
    function irALoading() {
        if (yaRedirigio) return;
        yaRedirigio = true;
        window.location.href = "loading.html";
    }

    function alTerminar(ev) {
        if (ev.target !== tarjeta) return;
        if (ev.propertyName !== "transform") return;
        tarjeta.removeEventListener("transitionend", alTerminar);
        irALoading();
    }

    formulario.addEventListener("submit", (e) => {
        e.preventDefault();
        tarjeta.classList.add("animacion");
        tarjeta.addEventListener("transitionend", alTerminar);
        setTimeout(irALoading, 600);
    });

    document.querySelectorAll(".campo-con-ojo").forEach((campo) => {
        let ojo = campo.querySelector(".icono-ojo");
        let input = campo.querySelector("input");
        if (!ojo || !input) return;
        ojo.addEventListener("click", () => {
            let visible = input.type === "text";
            input.type = visible ? "password" : "text";
            ojo.src = visible ? "assets/icons/ojo.svg" : "assets/icons/mostrado.svg";
        });
    });
});
