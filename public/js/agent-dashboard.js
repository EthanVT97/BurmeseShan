$(document).ready(function() {
    // Initialize DataTables
    const playersTable = $('#playersTable').DataTable({
        processing: true,
        serverSide: false,
        ajax: {
            url: '/agent/api/players',
            dataSrc: function(response) {
                return response.success ? response.data : [];
            }
        },
        columns: [
            { 
                data: '_id',
                render: function(data) {
                    return data ? `<span class="badge bg-dark">${data.toString().slice(-8).toUpperCase()}</span>` : '-';
                }
            },
            { data: 'username' },
            {
                data: 'balance',
                render: function(data) {
                    return `MMK ${parseFloat(data || 0).toLocaleString()}`;
                }
            },
            {
                data: 'status',
                render: function(data) {
                    const statusClasses = {
                        'online': 'success',
                        'offline': 'secondary',
                        'blocked': 'danger'
                    };
                    return `<span class="badge bg-${statusClasses[data] || 'secondary'}">${data?.toUpperCase() || 'OFFLINE'}</span>`;
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
                    return data ? new Date(data).toLocaleString() : 'N/A';
                }
            },
            {
                data: null,
                orderable: false,
                render: function(data) {
                    return `
                        <div class="btn-group btn-group-sm">
                            <button type="button" class="btn btn-outline-primary add-balance" 
                                    data-id="${data._id}"
                                    data-username="${data.username}"
                                    data-balance="${data.balance}">
                                <i class="bi bi-cash"></i>
                            </button>
                            <button type="button" class="btn btn-outline-${data.status === 'blocked' ? 'success' : 'danger'} toggle-status"
                                    data-id="${data._id}"
                                    data-status="${data.status}">
                                <i class="bi bi-${data.status === 'blocked' ? 'unlock' : 'lock'}"></i>
                            </button>
                        </div>
                    `;
                }
            }
        ],
        order: [[5, 'desc']],
        pageLength: 10,
        responsive: true
    });

    // Initialize transaction table
    const transactionsTable = $('#transactionsTable').DataTable({
        order: [[4, 'desc']],
        pageLength: 10,
        responsive: true
    });

    // Add Player Form Handler
    $('#addPlayerForm').submit(function(e) {
        e.preventDefault();
        
        const formData = {
            username: $('#playerUsername').val().trim(),
            password: $('#playerPassword').val(),
            balance: parseFloat($('#playerBalance').val()) || 0
        };

        if (!formData.username || !formData.password) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        $.ajax({
            url: '/agent/api/players',
            method: 'POST',
            data: formData,
            success: function(response) {
                if (response.success) {
                    $('#addPlayerModal').modal('hide');
                    playersTable.ajax.reload();
                    showToast('Player created successfully', 'success');
                    $('#addPlayerForm')[0].reset();
                } else {
                    showToast(response.error || 'Failed to create player', 'error');
                }
            },
            error: function(xhr) {
                showToast(xhr.responseJSON?.error || 'Error creating player', 'error');
            }
        });
    });

    // Add Balance Form Handler
    $('#addBalanceForm').submit(function(e) {
        e.preventDefault();
        
        const playerId = $('#playerId').val();
        const formData = {
            amount: parseFloat($('#balanceAmount').val()),
            type: $('#balanceType').val(),
            description: $('#balanceDescription').val().trim()
        };

        if (!formData.amount || formData.amount <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }

        $.ajax({
            url: `/agent/api/players/${playerId}/balance`,
            method: 'POST',
            data: formData,
            success: function(response) {
                if (response.success) {
                    $('#addBalanceModal').modal('hide');
                    playersTable.ajax.reload();
                    showToast('Balance updated successfully', 'success');
                    $('#addBalanceForm')[0].reset();
                    // Reload page to update agent's balance
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showToast(response.error || 'Failed to update balance', 'error');
                }
            },
            error: function(xhr) {
                showToast(xhr.responseJSON?.error || 'Error updating balance', 'error');
            }
        });
    });

    // Add Balance Button Handler
    $('#playersTable').on('click', '.add-balance', function() {
        const id = $(this).data('id');
        const username = $(this).data('username');
        const balance = parseFloat($(this).data('balance'));
        
        $('#playerId').val(id);
        $('#playerUsernameDisplay').val(username);
        $('#currentBalanceDisplay').val(`MMK ${balance.toLocaleString()}`);
        $('#addBalanceModal').modal('show');
    });

    // Toggle Status Button Handler
    $('#playersTable').on('click', '.toggle-status', function() {
        const id = $(this).data('id');
        const currentStatus = $(this).data('status');
        const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
        
        if (confirm(`Are you sure you want to ${newStatus === 'blocked' ? 'block' : 'unblock'} this player?`)) {
            $.ajax({
                url: `/agent/api/players/${id}/status`,
                method: 'PUT',
                data: { status: newStatus },
                success: function(response) {
                    if (response.success) {
                        playersTable.ajax.reload();
                        showToast(`Player ${newStatus === 'blocked' ? 'blocked' : 'unblocked'} successfully`, 'success');
                    } else {
                        showToast(response.error || 'Failed to update status', 'error');
                    }
                },
                error: function(xhr) {
                    showToast(xhr.responseJSON?.error || 'Error updating status', 'error');
                }
            });
        }
    });

    // Refresh buttons handlers
    $('.refresh-players').click(() => playersTable.ajax.reload());
    $('.refresh-transactions').click(() => location.reload());

    // Toast notification function
    function showToast(message, type = 'info') {
        const toast = $(`
            <div class="toast align-items-center text-white bg-${type}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `);
        
        $('.toast-container').append(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        toast.on('hidden.bs.toast', function() {
            $(this).remove();
        });
    }
});
