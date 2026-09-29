document.querySelectorAll('.btn-juego--fav').forEach(function (btn) {
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () {
        let activo = btn.classList.toggle('activo');
        btn.setAttribute('aria-pressed', activo ? 'true' : 'false');
    });
});
