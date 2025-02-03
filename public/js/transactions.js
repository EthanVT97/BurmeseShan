$(document).ready(function() {
    // Load players for select dropdowns
    function loadPlayers() {
        $.get('/api/players', function(response) {
            if (response.success) {
                const players = response.data;
                const options = players.map(player => 
                    `<option value="${player._id}">${player.username} (Balance: ${formatCurrency(player.balance)})</option>`
                ).join('');
                
                $('#depositPlayer, #withdrawalPlayer').html('<option value="">Select Player</option>' + options);
            }
        });
    }
    
    loadPlayers();

    // Destroy existing DataTable if it exists
    if ($.fn.DataTable.isDataTable('#transactionsTable')) {
        $('#transactionsTable').DataTable().destroy();
    }

    // Initialize DataTable
    const transactionsTable = $('#transactionsTable').DataTable({
        processing: true,
        serverSide: false,
        ajax: {
            url: '/api/transactions',
            dataSrc: function(response) {
                if (response.success && Array.isArray(response.data)) {
                    return response.data;
                }
                console.error('Invalid response format:', response);
                return [];
            }
        },
        columns: [
            { 
                data: 'transactionId',
                render: function(data) {
                    return data ? `<span class="badge bg-dark">${data}</span>` : '-';
                }
            },
            { 
                data: 'playerName',
                render: function(data) {
                    return data || 'Unknown';
                }
            },
            { 
                data: 'transactionType',
                render: function(data, type, row) {
                    if (!data) return '-';
                    const typeLabels = {
                        'deposit': 'Deposit',
                        'withdrawal': 'Withdrawal',
                        'commission': 'Commission',
                        'point_adjustment': row.adjustmentType === 'add' ? 'Points Added' : 'Points Deducted'
                    };
                    const typeClasses = {
                        'deposit': 'success',
                        'withdrawal': 'danger',
                        'commission': 'info',
                        'point_adjustment': row.adjustmentType === 'add' ? 'success' : 'danger'
                    };
                    return `<span class="badge bg-${typeClasses[data] || 'secondary'}">${typeLabels[data] || data}</span>`;
                }
            },
            { 
                data: 'transactionAmount',
                render: function(data, type, row) {
                    if (data == null) return '-';
                    const isNegative = row.transactionType === 'withdrawal' || 
                                     (row.transactionType === 'point_adjustment' && row.adjustmentType === 'subtract');
                    const amount = formatCurrency(Math.abs(parseFloat(data) || 0));
                    return `<span class="text-${isNegative ? 'danger' : 'success'}">${isNegative ? '-' : '+'}${amount}</span>`;
                }
            },
            {
                data: 'transactionStatus',
                render: function(data) {
                    if (!data) return '-';
                    const statusClasses = {
                        'pending': 'warning',
                        'completed': 'success',
                        'rejected': 'danger'
                    };
                    const status = data.charAt(0).toUpperCase() + data.slice(1);
                    return `<span class="badge bg-${statusClasses[data] || 'secondary'}">${status}</span>`;
                }
            },
            {
                data: 'processedBy',
                render: function(data) {
                    return data || 'System';
                }
            },
            { 
                data: 'remark',
                render: function(data) {
                    return data || '-';
                }
            },
            { 
                data: 'transactionDate',
                render: function(data) {
                    return data || 'N/A';
                }
            },
            {
                data: null,
                orderable: false,
                render: function(data, type, row) {
                    if (!row._id) return '';
                    return `
                        <button type="button" class="btn btn-sm btn-info view-transaction" data-id="${row._id}">
                            <i class="bi bi-eye"></i>
                        </button>
                    `;
                }
            }
        ],
        order: [[7, 'desc']], // Sort by date by default
        responsive: true,
        language: {
            emptyTable: 'No transactions found',
            zeroRecords: 'No matching transactions found',
            info: 'Showing _START_ to _END_ of _TOTAL_ transactions',
            infoEmpty: 'Showing 0 to 0 of 0 transactions',
            infoFiltered: '(filtered from _MAX_ total transactions)'
        },
        drawCallback: function() {
            // Re-initialize tooltips after table draw
            $('[data-bs-toggle="tooltip"]').tooltip();
        }
    });

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

    // Transaction type filter handler
    $('#transactionTypeFilter').change(function() {
        const type = $(this).val();
        transactionsTable.column(2).search(type).draw();
    });

    // Refresh button handler
    $('.refresh-transactions').click(function() {
        transactionsTable.ajax.reload();
        showToast('Transactions list refreshed', 'success');
    });

    // Add deposit form handler
    $('#addDepositForm').submit(function(e) {
        e.preventDefault();
        
        const formData = {
            playerId: $('#depositPlayer').val(),
            type: 'deposit',
            amount: parseFloat($('#depositAmount').val())
        };

        $.ajax({
            url: '/api/transactions',
            method: 'POST',
            data: formData,
            success: function(response) {
                if (response.success) {
                    $('#addDepositModal').modal('hide');
                    transactionsTable.ajax.reload();
                    loadPlayers(); // Reload players to update balances
                    showToast('Deposit added successfully', 'success');
                    $('#addDepositForm')[0].reset();
                } else {
                    showToast(response.error || 'Error adding deposit', 'error');
                }
            },
            error: function(xhr) {
                showToast(xhr.responseJSON?.error || 'Error adding deposit', 'error');
            }
        });
    });

    // Add withdrawal form handler
    $('#addWithdrawalForm').submit(function(e) {
        e.preventDefault();
        
        const formData = {
            playerId: $('#withdrawalPlayer').val(),
            amount: parseFloat($('#withdrawalAmount').val()),
            paymentMethod: $('#withdrawalMethod').val(),
            paymentDetails: $('#withdrawalDetails').val()
        };

        if (!formData.playerId) {
            showToast('Please select a player', 'error');
            return;
        }

        if (!formData.amount || formData.amount <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        
        $.ajax({
            url: '/api/transactions/withdraw',
            method: 'POST',
            data: formData,
            success: function(response) {
                $('#addWithdrawalModal').modal('hide');
                $('#addWithdrawalForm')[0].reset();
                transactionsTable.ajax.reload();
                showToast('Withdrawal request submitted successfully', 'success');
            },
            error: function(xhr) {
                showToast(xhr.responseJSON?.error || 'Error submitting withdrawal', 'error');
            }
        });
    });

    // Approve transaction handler
    $('#transactionsTable').on('click', '.approve-transaction', function() {
        const transactionId = $(this).data('id');
        
        if (!transactionId) {
            showToast('Invalid transaction ID', 'error');
            return;
        }

        // Show confirmation dialog
        if (!confirm('Are you sure you want to approve this transaction?')) {
            return;
        }

        $.ajax({
            url: `/api/transactions/${transactionId}/status`,
            method: 'PUT',
            data: { status: 'completed' },
            success: function(response) {
                transactionsTable.ajax.reload();
                loadPlayers(); // Reload players to update balances
                showToast(response.message || 'Transaction approved successfully', 'success');
            },
            error: function(xhr) {
                console.error('Error response:', xhr.responseJSON);
                showToast(xhr.responseJSON?.error || 'Error approving transaction', 'error');
            }
        });
    });

    // Reject transaction handler
    $('#transactionsTable').on('click', '.reject-transaction', function() {
        const transactionId = $(this).data('id');
        
        if (!transactionId) {
            showToast('Invalid transaction ID', 'error');
            return;
        }

        // Show confirmation dialog
        if (!confirm('Are you sure you want to reject this transaction?')) {
            return;
        }

        $.ajax({
            url: `/api/transactions/${transactionId}/status`,
            method: 'PUT',
            data: { status: 'rejected' },
            success: function(response) {
                transactionsTable.ajax.reload();
                showToast(response.message || 'Transaction rejected successfully', 'success');
            },
            error: function(xhr) {
                console.error('Error response:', xhr.responseJSON);
                showToast(xhr.responseJSON?.error || 'Error rejecting transaction', 'error');
            }
        });
    });

    // View transaction handler
    $('#transactionsTable').on('click', '.view-transaction', function() {
        const transactionId = $(this).data('id');
        
        if (!transactionId) {
            showToast('Invalid transaction ID', 'error');
            return;
        }

        $.ajax({
            url: `/api/transactions/${transactionId}`,
            method: 'GET',
            success: function(response) {
                if (response.success && response.data) {
                    const t = response.data;
                    
                    // Populate modal fields
                    $('#view-transaction-id').text(t.transactionId);
                    $('#view-player').text(t.playerName);
                    $('#view-type').html(`<span class="badge bg-${getTypeClass(t)}">${getTypeLabel(t)}</span>`);
                    $('#view-amount').html(formatCurrency(t.transactionAmount));
                    $('#view-status').html(`<span class="badge bg-${getStatusClass(t.transactionStatus)}">${t.transactionStatus.charAt(0).toUpperCase() + t.transactionStatus.slice(1)}</span>`);
                    $('#view-processed-by').text(t.processedBy);
                    $('#view-remark').text(t.remark);
                    $('#view-date').text(t.transactionDate);
                    
                    // Show payment details if available
                    if (t.paymentMethod || t.paymentDetails) {
                        $('#payment-details-section').show();
                        $('#view-payment-method').text(t.paymentMethod || '-');
                        $('#view-payment-details').text(t.paymentDetails || '-');
                    } else {
                        $('#payment-details-section').hide();
                    }

                    // Show the modal
                    $('#viewTransactionModal').modal('show');
                } else {
                    showToast(response.error || 'Failed to load transaction details', 'error');
                }
            },
            error: function(xhr) {
                console.error('Error response:', xhr.responseJSON);
                showToast(xhr.responseJSON?.error || 'Error loading transaction details', 'error');
            }
        });
    });

    // Helper functions for transaction display
    function getTypeClass(transaction) {
        const typeClasses = {
            'deposit': 'success',
            'withdrawal': 'danger',
            'commission': 'info',
            'point_adjustment': transaction.adjustmentType === 'add' ? 'success' : 'danger'
        };
        return typeClasses[transaction.transactionType] || 'secondary';
    }

    function getTypeLabel(transaction) {
        const typeLabels = {
            'deposit': 'Deposit',
            'withdrawal': 'Withdrawal',
            'commission': 'Commission',
            'point_adjustment': transaction.adjustmentType === 'add' ? 'Points Added' : 'Points Deducted'
        };
        return typeLabels[transaction.transactionType] || transaction.transactionType;
    }

    function getStatusClass(status) {
        const statusClasses = {
            'pending': 'warning',
            'completed': 'success',
            'rejected': 'danger'
        };
        return statusClasses[status] || 'secondary';
    }

    function formatAmount(transaction) {
        const isNegative = transaction.transactionType === 'withdrawal' || 
                          (transaction.transactionType === 'point_adjustment' && transaction.adjustmentType === 'subtract');
        const amount = formatCurrency(Math.abs(parseFloat(transaction.transactionAmount) || 0));
        return `<span class="text-${isNegative ? 'danger' : 'success'}">${isNegative ? '-' : '+'}${amount}</span>`;
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
