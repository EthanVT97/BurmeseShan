document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navBar = document.querySelector('#nav-bar');
    const body = document.body;

    function toggleMobileMenu() {
        navBar.classList.toggle('show');
        body.classList.toggle('sidebar-open');
    }

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 991.98 && 
            !navBar.contains(e.target) && 
            mobileMenuToggle && !mobileMenuToggle.contains(e.target) && 
            navBar.classList.contains('show')) {
            toggleMobileMenu();
        }
    });

    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (window.innerWidth > 991.98) {
                navBar.classList.remove('show');
                body.classList.remove('sidebar-open');
            }
        }, 250);
    });

    // Add active class to current nav item
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-button').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
});
