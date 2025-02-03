$(document).ready(function() {
    // Initialize DataTables
    $('#transactionsTable').DataTable({
        order: [[5, 'desc']], // Sort by date column by default
        pageLength: 10,
        responsive: true
    });

    // Sidebar Toggle
    $('.sidebar-toggle').on('click', function() {
        $('.sidebar').toggleClass('active');
        $('.main-content').toggleClass('active');
    });

    // Close sidebar on mobile when clicking outside
    $(document).on('click', function(e) {
        if ($(window).width() <= 768) {
            if (!$(e.target).closest('.sidebar, .sidebar-toggle').length) {
                $('.sidebar').removeClass('active');
                $('.main-content').removeClass('active');
            }
        }
    });

    // Tooltips
    $('[data-bs-toggle="tooltip"]').tooltip();

    // Active link highlighting
    const currentPath = window.location.pathname;
    $('.nav-link').each(function() {
        if ($(this).attr('href') === currentPath) {
            $(this).addClass('active');
        }
    });

    // Stats Cards Animation
    $('.stat-card').each(function(index) {
        $(this).css({
            'animation-delay': (index * 0.1) + 's'
        });
    });
});
