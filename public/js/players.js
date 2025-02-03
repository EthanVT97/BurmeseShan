$(document).ready(function() {
    // Destroy existing DataTable if it exists
    if ($.fn.DataTable.isDataTable('#playersTable')) {
        $('#playersTable').DataTable().destroy();
    }

    // Currency formatter
    const formatCurrency = (amount, currency = 'MMK') => {
        const formatter = new Intl.NumberFormat('my-MM', {
            style: 'currency',
            currency: 'MMK',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        return formatter.format(amount).replace('MMK', 'MMK ');
    };

    // Alternative currency formatter for THB
    const formatThaiCurrency = (amount) => {
        const formatter = new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        return formatter.format(amount);
    };

    // Initialize DataTable
    const playersTable = $('#playersTable').DataTable({
        ajax: {
            url: '/api/players',
            dataSrc: 'data'
        },
        columns: [
            { 
                data: 'username',
                render: function(data, type, row) {
                    return `<a href="#" class="view-player-details" data-id="${row._id}">${data}</a>`;
                }
            },
            { 
                data: 'balance',
                render: function(data) {
                    return formatCurrency(data || 0);
                }
            },
            {
                data: 'status',
                render: function(data) {
                    const statusClasses = {
                        'active': 'success',
                        'inactive': 'danger',
                        'suspended': 'warning'
                    };
                    return `<span class="badge bg-${statusClasses[data] || 'secondary'}">${data}</span>`;
                }
            },
            { 
                data: 'lastLogin',
                render: function(data) {
                    return data ? new Date(data).toLocaleString() : 'Never';
                }
            },
            { 
                data: 'createdAt',
                render: function(data) {
                    return new Date(data).toLocaleString();
                }
            },
            {
                data: null,
                render: function(data) {
                    const statusButton = data.status === 'active' 
                        ? `<button class="btn btn-sm btn-warning change-status" data-id="${data._id}" data-status="inactive">Deactivate</button>`
                        : `<button class="btn btn-sm btn-success change-status" data-id="${data._id}" data-status="active">Activate</button>`;
                    
                    const addPointsButton = `
                        <button class="btn btn-sm btn-info add-points" 
                            data-id="${data._id}" 
                            data-username="${data.username}"
                            data-balance="${data.balance}">
                            <i class="bi bi-plus-circle"></i> Points
                        </button>`;
                    
                    return `
                        <div class="btn-group" role="group">
                            ${statusButton}
                            ${addPointsButton}
                        </div>
                    `;
                }
            }
        ],
        order: [[4, 'desc']], // Sort by created date by default
        responsive: true,
        language: {
            emptyTable: "No players found"
        }
    });

    // Refresh button handler
    $('.refresh-players').click(function() {
        playersTable.ajax.reload();
        showToast('Players list refreshed', 'success');
    });

    // Add player form handler
    $('#addPlayerForm').submit(function(e) {
        e.preventDefault();
        
        const formData = {
            username: $('#username').val(),
            balance: parseFloat($('#initialBalance').val()) || 0
        };

        $.ajax({
            url: '/api/players',
            method: 'POST',
            data: formData,
            success: function(response) {
                if (response.success) {
                    $('#addPlayerModal').modal('hide');
                    playersTable.ajax.reload();
                    showToast('Player added successfully', 'success');
                    $('#addPlayerForm')[0].reset();
                } else {
                    showToast(response.error || 'Error adding player', 'error');
                }
            },
            error: function(xhr) {
                const errorMessage = xhr.responseJSON?.error || 'Error adding player';
                showToast(errorMessage, 'error');
            }
        });
    });

    // Add points button handler
    $('#playersTable').on('click', '.add-points', function() {
        const playerId = $(this).data('id');
        const username = $(this).data('username');
        const balance = $(this).data('balance');
        
        $('#playerIdForPoints').val(playerId);
        $('#playerUsername').val(username);
        $('#pointsAmount').val('');
        $('#pointsType').val('add');

        // Get current user's name from the navbar dropdown
        const currentUser = $('#userDropdown').text().trim();
        const currentTime = new Date().toLocaleString('my-MM', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        
        // Set default remark with user name and timestamp
        const defaultRemark = `Points ${$('#pointsType').val() === 'add' ? 'added' : 'subtracted'} by ${currentUser} on ${currentTime}`;
        $('#pointsRemark').val(defaultRemark);
        
        $('#addPointsModal').modal('show');
    });

    // Points type change handler
    $('#pointsType').change(function() {
        // Get current user's name from the navbar dropdown
        const currentUser = $('#userDropdown').text().trim();
        const currentTime = new Date().toLocaleString('my-MM', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        
        // Update remark based on selected type
        const defaultRemark = `Points ${$(this).val() === 'add' ? 'added' : 'subtracted'} by ${currentUser} on ${currentTime}`;
        $('#pointsRemark').val(defaultRemark);
    });

    // Add points form handler
    $('#addPointsForm').submit(function(e) {
        e.preventDefault();
        
        const playerId = $('#playerIdForPoints').val();
        const amount = parseFloat($('#pointsAmount').val());
        const type = $('#pointsType').val();
        const remark = $('#pointsRemark').val();

        if (!playerId || !amount) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        $.ajax({
            url: `/api/players/${playerId}/balance`,
            method: 'PUT',
            data: { amount, type, remark },
            success: function(response) {
                if (response.success) {
                    $('#addPointsModal').modal('hide');
                    playersTable.ajax.reload();
                    
                    // Show detailed success message
                    const message = `Successfully ${type === 'add' ? 'added' : 'subtracted'} $${amount} ${type === 'add' ? 'to' : 'from'} ${response.player.username}`;
                    showToast(message, 'success');
                    
                    // Reset form
                    $('#addPointsForm')[0].reset();
                } else {
                    showToast(response.error || 'Error updating points', 'error');
                }
            },
            error: function(xhr) {
                const errorMessage = xhr.responseJSON?.error || 'Error updating points';
                showToast(errorMessage, 'error');
            }
        });
    });

    // Change player status handler
    $('#playersTable').on('click', '.change-status', function() {
        const playerId = $(this).data('id');
        const newStatus = $(this).data('status');

        $.ajax({
            url: `/api/players/${playerId}/status`,
            method: 'PUT',
            data: { status: newStatus },
            success: function(response) {
                if (response.success) {
                    playersTable.ajax.reload();
                    showToast('Player status updated successfully', 'success');
                } else {
                    showToast(response.error || 'Error updating player status', 'error');
                }
            },
            error: function(xhr) {
                const errorMessage = xhr.responseJSON?.error || 'Error updating player status';
                showToast(errorMessage, 'error');
            }
        });
    });

    // View player details handler
    $('#playersTable').on('click', '.view-player-details', function(e) {
        e.preventDefault();
        const playerId = $(this).data('id');

        $.ajax({
            url: `/api/players/${playerId}`,
            method: 'GET',
            success: function(response) {
                console.log('Player details response:', response); // Debug log
                if (response && response.success && response.player) {
                    const player = response.player;
                    
                    // Populate basic information if the properties exist
                    if (player.username) {
                        $('#detailUsername').text(player.username);
                    }
                    if (player.balance !== undefined) {
                        $('#detailBalance').text(formatCurrency(player.balance));
                    }
                    if (player.balanceUpdatedBy) {
                        const updateInfo = `Updated by ${player.balanceUpdatedBy}`;
                        const updateTime = player.balanceUpdatedAt ? ` on ${formatDate(player.balanceUpdatedAt)}` : '';
                        $('#detailBalanceUpdatedBy').text(updateInfo + updateTime);
                    } else {
                        $('#detailBalanceUpdatedBy').text('No balance updates yet');
                    }
                    if (player.status) {
                        $('#detailStatus').html(
                            player.status === 'active' 
                                ? '<span class="badge bg-success">Active</span>'
                                : '<span class="badge bg-danger">Inactive</span>'
                        );
                    }
                    
                    // Populate activity information if the properties exist
                    if (player.lastLogin) {
                        $('#detailLastLogin').text(formatDate(player.lastLogin));
                    }
                    if (player.createdAt) {
                        $('#detailRegisteredDate').text(formatDate(player.createdAt));
                    }
                    if (player.updatedAt) {
                        $('#detailLastUpdated').text(formatDate(player.updatedAt));
                    }

                    // Load recent transactions
                    loadPlayerTransactions(playerId);
                    
                    // Show the modal
                    $('#playerDetailsModal').modal('show');
                } else {
                    console.error('Invalid response format:', response); // Debug log
                    showToast(response.error || 'Failed to load player details', 'error');
                }
            },
            error: function(xhr) {
                showToast(xhr.responseJSON?.message || 'Failed to load player details', 'error');
            }
        });
    });

    // Function to load player transactions
    function loadPlayerTransactions(playerId) {
        $.ajax({
            url: `/api/transactions/player/${playerId}?limit=10`,
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    const transactions = response.data;
                    let html = '';
                    
                    if (transactions.length === 0) {
                        html = '<tr><td colspan="5" class="text-center">No transactions found</td></tr>';
                    } else {
                        transactions.forEach(transaction => {
                            html += `
                                <tr>
                                    <td>${formatDate(transaction.createdAt)}</td>
                                    <td>
                                        <span class="badge ${transaction.type === 'add' ? 'bg-success' : 'bg-danger'}">
                                            ${transaction.type === 'add' ? 'Credit' : 'Debit'}
                                        </span>
                                    </td>
                                    <td>${formatCurrency(transaction.amount)}</td>
                                    <td>${formatCurrency(transaction.balance)}</td>
                                    <td>${transaction.remark}</td>
                                </tr>
                            `;
                        });
                    }
                    
                    $('#playerTransactionsList').html(html);
                } else {
                    $('#playerTransactionsList').html('<tr><td colspan="5" class="text-center text-danger">Failed to load transactions</td></tr>');
                }
            },
            error: function() {
                $('#playerTransactionsList').html('<tr><td colspan="5" class="text-center text-danger">Failed to load transactions</td></tr>');
            }
        });
    }

    // Helper function to format date
    function formatDate(dateString) {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Toast notification function
    function showToast(message, type = 'info') {
        const toastId = 'toast-' + Date.now();
        const bgClass = type === 'error' ? 'bg-danger' : 
                       type === 'success' ? 'bg-success' : 
                       type === 'warning' ? 'bg-warning' : 'bg-info';
        
        const toast = `
            <div id="${toastId}" class="toast ${bgClass} text-white" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header ${bgClass} text-white">
                    <strong class="me-auto">Notification</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        $('#toastContainer').append(toast);
        const toastElement = new bootstrap.Toast(document.getElementById(toastId));
        toastElement.show();
        
        // Remove toast after it's hidden
        $(`#${toastId}`).on('hidden.bs.toast', function() {
            $(this).remove();
        });
    }
});
