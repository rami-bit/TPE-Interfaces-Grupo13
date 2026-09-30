document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // MENÚ HAMBURGUESA Y PERFIL (HEADER)
    // ==========================================
    const btnHamburguesa = document.querySelector('.btn-hamburguesa');
    const menuOverlay = document.querySelector('.menu-overlay');
    const cuenta = document.querySelector(".header-cuenta");
    const btnCuenta = document.querySelector(".btn-perfil");

    function cerrarMenuHamburguesa() {
        if (btnHamburguesa) btnHamburguesa.classList.remove("activo");
        if (btnHamburguesa) btnHamburguesa.setAttribute("aria-expanded", "false");
    }

    function cerrarCuenta() {
        if (cuenta) cuenta.classList.remove("activo");
        if (btnCuenta) btnCuenta.setAttribute("aria-expanded", "false");
    }

    if (btnHamburguesa) {
        btnHamburguesa.addEventListener('click', (e) => {
            e.stopPropagation();
            cerrarCuenta();
            const abrir = !btnHamburguesa.classList.contains("activo");
            btnHamburguesa.classList.toggle('activo', abrir);
            btnHamburguesa.setAttribute("aria-expanded", String(abrir));
        });
    }

    if (btnCuenta) {
        btnCuenta.addEventListener("click", (e) => {
            e.stopPropagation();
            cerrarMenuHamburguesa();
            const abrir = !cuenta.classList.contains("activo");
            cuenta.classList.toggle("activo", abrir);
            btnCuenta.setAttribute("aria-expanded", String(abrir));
        });
    }

    // Cerrar al clickear fuera
    document.addEventListener("click", (e) => {
        if (cuenta && cuenta.classList.contains("activo") && !cuenta.contains(e.target)) {
            cerrarCuenta();
        }
        if (btnHamburguesa && btnHamburguesa.classList.contains("activo")) {
            const menuNav = document.querySelector('.menu-nav');
            if (!btnHamburguesa.contains(e.target) && (!menuNav || !menuNav.contains(e.target))) {
                cerrarMenuHamburguesa();
            }
        }
    });
});
