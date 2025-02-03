$(document).ready(function() {
    // Initialize toastr options
    toastr.options = {
        closeButton: true,
        progressBar: true,
        positionClass: "toast-top-right",
        timeOut: 3000
    };

    // Load current settings
    loadCurrentSettings();

    // Profile form submission
    $('#profileForm').on('submit', function(e) {
        e.preventDefault();
        const formData = {
            email: $('#email').val(),
            firstName: $('#firstName').val(),
            lastName: $('#lastName').val()
        };

        $.ajax({
            url: '/api/settings/profile',
            type: 'PUT',
            data: formData,
            success: function(response) {
                if (response.success) {
                    toastr.success('Profile updated successfully');
                    // Update displayed name if available
                    if (response.data.firstName || response.data.lastName) {
                        const fullName = [response.data.firstName, response.data.lastName].filter(Boolean).join(' ');
                        $('.user-name').text(fullName);
                    }
                }
            },
            error: function(xhr) {
                const error = xhr.responseJSON?.error || 'Error updating profile';
                toastr.error(error);
            }
        });
    });

    // Profile image upload
    $('#profileImage').on('change', function() {
        const file = this.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toastr.error('File size must be less than 5MB');
                return;
            }

            const formData = new FormData();
            formData.append('profileImage', file);

            $.ajax({
                url: '/api/settings/profile-image',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function(response) {
                    if (response.success) {
                        toastr.success('Profile image updated successfully');
                        // Update profile image preview
                        $('#profileImagePreview').attr('src', response.data.profileImage);
                        // Update header profile image if it exists
                        $('.profile-image').attr('src', response.data.profileImage);
                    }
                },
                error: function(xhr) {
                    const error = xhr.responseJSON?.error || 'Error uploading profile image';
                    toastr.error(error);
                }
            });
        }
    });

    // Notification settings
    $('.notification-toggle').on('change', function() {
        const notifications = {
            emailLoginAlert: $('#emailLoginAlert').prop('checked'),
            emailTransactionAlert: $('#emailTransactionAlert').prop('checked'),
            emailSystemUpdates: $('#emailSystemUpdates').prop('checked'),
            browserLoginAlert: $('#browserLoginAlert').prop('checked'),
            browserTransactionAlert: $('#browserTransactionAlert').prop('checked')
        };

        $.ajax({
            url: '/api/settings/notifications',
            type: 'PUT',
            data: notifications,
            success: function(response) {
                if (response.success) {
                    toastr.success('Notification settings updated');
                }
            },
            error: function(xhr) {
                const error = xhr.responseJSON?.error || 'Error updating notification settings';
                toastr.error(error);
                // Revert toggle if update failed
                $(this).prop('checked', !$(this).prop('checked'));
            }
        });
    });

    // Theme settings
    $('#themeSelect, #fontSizeSelect').on('change', function() {
        const settings = {
            theme: $('#themeSelect').val(),
            fontSize: $('#fontSizeSelect').val()
        };

        $.ajax({
            url: '/api/settings/appearance',
            type: 'PUT',
            data: settings,
            success: function(response) {
                if (response.success) {
                    toastr.success('Appearance settings updated');
                    applyTheme(settings.theme);
                    applyFontSize(settings.fontSize);
                }
            },
            error: function(xhr) {
                const error = xhr.responseJSON?.error || 'Error updating appearance settings';
                toastr.error(error);
            }
        });
    });

    // Apply theme from URL parameter if present
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');
    if (themeParam && ['light', 'dark', 'system'].includes(themeParam)) {
        $('#themeSelect').val(themeParam);
        applyTheme(themeParam);
    }

    // Update URL when theme changes
    $('#themeSelect').on('change', function() {
        const newTheme = $(this).val();
        const url = new URL(window.location.href);
        url.searchParams.set('theme', newTheme);
        window.history.replaceState({}, '', url);
        applyTheme(newTheme);
    });

    // Export data
    $('#exportData').on('click', function() {
        window.location.href = '/api/settings/export-data';
    });

    // Helper functions
    function loadCurrentSettings() {
        $.ajax({
            url: '/api/settings',
            type: 'GET',
            success: function(response) {
                if (response.success) {
                    const settings = response.data;
                    
                    // Profile information
                    $('#email').val(settings.email);
                    $('#firstName').val(settings.firstName);
                    $('#lastName').val(settings.lastName);
                    if (settings.profileImage) {
                        $('#profileImagePreview').attr('src', settings.profileImage);
                    }

                    // Notification settings
                    Object.keys(settings.notifications).forEach(key => {
                        $(`#${key}`).prop('checked', settings.notifications[key]);
                    });

                    // Appearance settings
                    $('#themeSelect').val(settings.theme);
                    $('#fontSizeSelect').val(settings.fontSize);
                    
                    // Apply current theme and font size
                    applyTheme(settings.theme);
                    applyFontSize(settings.fontSize);
                }
            },
            error: function(xhr) {
                const error = xhr.responseJSON?.error || 'Error loading settings';
                toastr.error(error);
            }
        });
    }

    function applyTheme(theme) {
        // Remove existing theme
        document.documentElement.removeAttribute('data-theme');
        
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }

        // Save theme preference
        localStorage.setItem('theme', theme);
    }

    function applyFontSize(size) {
        const html = $('html');
        html.removeClass('font-small font-medium font-large');
        html.addClass(`font-${size}`);

        // Save font size preference to localStorage
        localStorage.setItem('fontSize', size);
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addListener(function(e) {
        if ($('#themeSelect').val() === 'system') {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
    });
});
