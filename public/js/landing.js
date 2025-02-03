$(document).ready(function() {
    // Navbar scroll effect
    $(window).scroll(function() {
        if ($(window).scrollTop() > 50) {
            $('.navbar').addClass('scrolled');
        } else {
            $('.navbar').removeClass('scrolled');
        }
    });

    // Smooth scrolling for anchor links
    $('a[href*="#"]').not('[href="#"]').click(function(event) {
        if (
            location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') &&
            location.hostname == this.hostname
        ) {
            var target = $(this.hash);
            target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
            if (target.length) {
                event.preventDefault();
                $('html, body').animate({
                    scrollTop: target.offset().top - 70
                }, 1000);
            }
        }
    });

    // Add animation classes on scroll
    function animateOnScroll() {
        $('.animate-fade-in').each(function() {
            var elementTop = $(this).offset().top;
            var elementBottom = elementTop + $(this).outerHeight();
            var viewportTop = $(window).scrollTop();
            var viewportBottom = viewportTop + $(window).height();
            
            if (elementBottom > viewportTop && elementTop < viewportBottom) {
                $(this).addClass('animated');
            }
        });
    }

    // Run animation check on load and scroll
    $(window).on('load scroll', animateOnScroll);

    // Mobile menu collapse on click
    $('.navbar-nav>li>a').on('click', function(){
        $('.navbar-collapse').collapse('hide');
    });

    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Live Chat Elements
    const liveChatBtn = $('#liveChatBtn');
    const liveChatWidget = $('#liveChatWidget');
    const closeChatBtn = $('#closeChatBtn');
    const messageInput = $('#messageInput');
    const sendMessageBtn = $('#sendMessageBtn');
    const chatMessages = $('#chatMessages');

    // Toggle chat widget
    liveChatBtn.on('click', function() {
        liveChatWidget.toggleClass('active');
        if (liveChatWidget.hasClass('active')) {
            messageInput.focus();
        }
    });

    // Close chat widget
    closeChatBtn.on('click', function() {
        liveChatWidget.removeClass('active');
    });

    // Send message
    function sendMessage() {
        const message = messageInput.val().trim();
        if (message) {
            // Add user message
            addMessage(message, 'user');
            
            // Clear input
            messageInput.val('');
            
            // Simulate admin response after a delay
            setTimeout(() => {
                addMessage('Thank you for your message. An agent will respond shortly.', 'system');
            }, 500);
        }
    }

    // Add message to chat
    function addMessage(text, type) {
        const messageDiv = $('<div></div>')
            .addClass('message')
            .addClass(type)
            .text(text);
        
        chatMessages.append(messageDiv);
        chatMessages.scrollTop(chatMessages[0].scrollHeight);
    }

    // Send message on button click
    sendMessageBtn.on('click', sendMessage);

    // Send message on Enter key
    messageInput.on('keypress', function(e) {
        if (e.which === 13) {
            sendMessage();
        }
    });

    // Smooth scroll for navigation links
    $('a[href^="#"]').on('click', function(e) {
        e.preventDefault();
        const target = $(this.hash);
        if (target.length) {
            $('html, body').animate({
                scrollTop: target.offset().top - 70
            }, 1000);
        }
    });
});
