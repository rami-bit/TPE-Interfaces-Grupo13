document.addEventListener("DOMContentLoaded", () => {
    let btnMenu = document.querySelector(".menu-hamburguesa");
    let menuNav = document.querySelector(".menu-nav");
    let cuenta = document.querySelector(".header-cuenta");
    let btnCuenta = document.querySelector(".boton-avatar");

    function cerrarMenu() {
        btnMenu.classList.remove("activo");
        btnMenu.setAttribute("aria-expanded", "false");
    }

    function cerrarCuenta() {
        cuenta.classList.remove("activo");
        btnCuenta.setAttribute("aria-expanded", "false");
    }

    btnMenu.addEventListener("click", function() {
        let abrir = !btnMenu.classList.contains("activo");
        cerrarCuenta();
        btnMenu.classList.toggle("activo", abrir);
        btnMenu.setAttribute("aria-expanded", String(abrir));
    });

    btnCuenta.addEventListener("click", function() {
        let abrir = !cuenta.classList.contains("activo");
        cerrarMenu();
        cuenta.classList.toggle("activo", abrir);
        btnCuenta.setAttribute("aria-expanded", String(abrir));
    });

    document.addEventListener("click", (e) => {
        if (cuenta.classList.contains("activo") && !cuenta.contains(e.target)) {
            cerrarCuenta();
        }
        if (btnMenu.classList.contains("activo") && !btnMenu.contains(e.target) && !menuNav.contains(e.target)) {
            cerrarMenu();
        }
    });
});
