document.addEventListener('DOMContentLoaded', function() {
    // Initialize all dropdowns
    var dropdowns = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
    dropdowns.map(function (dropdownToggle) {
        return new bootstrap.Dropdown(dropdownToggle);
    });

    // Add hover functionality for desktop
    const dropdownElementList = document.querySelectorAll('.dropdown');
    if (window.innerWidth >= 992) { // desktop only
        dropdownElementList.forEach(function(dropdown) {
            dropdown.addEventListener('mouseenter', function() {
                const toggle = this.querySelector('.dropdown-toggle');
                const dropdownMenu = this.querySelector('.dropdown-menu');
                if (toggle && dropdownMenu) {
                    const dropdown = new bootstrap.Dropdown(toggle);
                    dropdown.show();
                }
            });

            dropdown.addEventListener('mouseleave', function() {
                const toggle = this.querySelector('.dropdown-toggle');
                const dropdownMenu = this.querySelector('.dropdown-menu');
                if (toggle && dropdownMenu) {
                    const dropdown = new bootstrap.Dropdown(toggle);
                    dropdown.hide();
                }
            });
        });
    }
});
