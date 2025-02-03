$(document).ready(function() {
    // Destroy existing DataTable if it exists
    if ($.fn.DataTable.isDataTable('#agentsTable')) {
        $('#agentsTable').DataTable().destroy();
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
    const agentsTable = $('#agentsTable').DataTable({
        processing: true,
        serverSide: false,
        ajax: {
            url: '/api/agents',
            dataSrc: function(response) {
                if (response.success && Array.isArray(response.data)) {
                    return response.data;
                }
                console.error('Invalid response format:', response);
                return [];
            },
            error: function(xhr, error, thrown) {
                console.error('Ajax error:', error);
                showToast('Error loading agents data', 'error');
                return [];
            }
        },
        columns: [
            { 
                data: '_id',
                render: function(data) {
                    return data ? `<span class="badge bg-dark">${data.toString().slice(-8).toUpperCase()}</span>` : '-';
                }
            },
            { 
                data: 'username',
                render: function(data) {
                    return data || '-';
                }
            },
            {
                data: 'balance',
                render: function(data) {
                    return data != null ? formatCurrency(data) : 'MMK 0';
                }
            },
            {
                data: 'status',
                render: function(data) {
                    if (!data) return '-';
                    const statusClasses = {
                        'active': 'success',
                        'inactive': 'secondary',
                        'blocked': 'danger'
                    };
                    const status = data.charAt(0).toUpperCase() + data.slice(1);
                    return `<span class="badge bg-${statusClasses[data] || 'secondary'}">${status}</span>`;
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
                render: function(data, type, row) {
                    if (!row._id) return '';
                    return `
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-outline-primary add-balance" data-id="${row._id}" data-username="${row.username || ''}" data-balance="${row.balance || 0}">
                                <i class="bi bi-cash"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-${row.status === 'active' ? 'warning' : 'success'} toggle-status" data-id="${row._id}" data-status="${row.status || 'inactive'}">
                                <i class="bi bi-${row.status === 'active' ? 'pause' : 'play'}"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger block-agent" data-id="${row._id}">
                                <i class="bi bi-slash-circle"></i>
                            </button>
                        </div>
                    `;
                }
            }
        ],
        order: [[5, 'desc']], // Sort by created date by default
        pageLength: 10,
        responsive: true,
        language: {
            emptyTable: 'No agents found',
            zeroRecords: 'No matching agents found',
            info: 'Showing _START_ to _END_ of _TOTAL_ agents',
            infoEmpty: 'Showing 0 to 0 of 0 agents',
            infoFiltered: '(filtered from _MAX_ total agents)'
        }
    });

    // Initialize Bootstrap modals with custom animation
    const addAgentModal = new bootstrap.Modal(document.getElementById('addAgentModal'), {
        keyboard: true,
        backdrop: true,
        focus: true
    });

    const addBalanceModal = new bootstrap.Modal(document.getElementById('addBalanceModal'), {
        keyboard: true,
        backdrop: true,
        focus: true
    });

    // Add custom animation handling
    const modals = document.querySelectorAll('.modal.slide-up');
    modals.forEach(modal => {
        modal.addEventListener('hide.bs.modal', function() {
            this.classList.add('closing');
            setTimeout(() => {
                this.classList.remove('closing');
            }, 300); // Match the CSS animation duration
        });
    });

    // Form submission handlers
    document.getElementById('addAgentForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());
        
        try {
            const response = await fetch('/api/agents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    showToast('Agent created successfully', 'success');
                    addAgentModal.hide();
                    this.reset();
                    agentsTable.ajax.reload();
                } else {
                    showToast(result.message || 'Failed to create agent', 'error');
                }
            } else {
                throw new Error('Network response was not ok');
            }
        } catch (error) {
            console.error('Error creating agent:', error);
            showToast('Failed to create agent', 'error');
        }
    });

    document.getElementById('addBalanceForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());
        const agentId = this.dataset.agentId;
        
        try {
            const response = await fetch(`/api/agents/${agentId}/balance`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    showToast('Balance updated successfully', 'success');
                    addBalanceModal.hide();
                    this.reset();
                    agentsTable.ajax.reload();
                } else {
                    showToast(result.message || 'Failed to update balance', 'error');
                }
            } else {
                throw new Error('Network response was not ok');
            }
        } catch (error) {
            console.error('Error updating balance:', error);
            showToast('Failed to update balance', 'error');
        }
    });

    // Clean up modal content when hidden
    document.getElementById('addAgentModal')?.addEventListener('hidden.bs.modal', function() {
        document.getElementById('addAgentForm').reset();
    });

    document.getElementById('addBalanceModal')?.addEventListener('hidden.bs.modal', function() {
        document.getElementById('addBalanceForm').reset();
    });

    // Focus management for modals
    document.getElementById('addAgentModal')?.addEventListener('shown.bs.modal', function() {
        document.getElementById('agentUsername').focus();
    });

    document.getElementById('addBalanceModal')?.addEventListener('shown.bs.modal', function() {
        document.getElementById('balanceAmount')?.focus();
    });

    // Add balance button handler
    $('#agentsTable').on('click', '.add-balance', function() {
        const id = $(this).data('id');
        const username = $(this).data('username');
        const balance = $(this).data('balance');
        
        $('#balanceAgentId').val(id);
        $('#balanceAgentName').text(username);
        $('#balanceAgentCurrentBalance').text(
            formatCurrency(balance)
        );
        
        $('#addBalanceModal').modal('show');
    });

    // Toggle status button handler
    $('#agentsTable').on('click', '.toggle-status', function() {
        const id = $(this).data('id');
        const currentStatus = $(this).data('status');
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        
        $.ajax({
            url: `/api/agents/${id}/status`,
            method: 'PUT',
            data: { status: newStatus },
            success: function(response) {
                if (response.success) {
                    agentsTable.ajax.reload();
                    showToast(`Agent ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
                } else {
                    showToast(response.error || 'Error updating status', 'error');
                }
            },
            error: function(xhr) {
                showToast(xhr.responseJSON?.error || 'Error updating status', 'error');
            }
        });
    });

    // Block agent button handler
    $('#agentsTable').on('click', '.block-agent', function() {
        const id = $(this).data('id');
        
        if (confirm('Are you sure you want to block this agent?')) {
            $.ajax({
                url: `/api/agents/${id}/status`,
                method: 'PUT',
                data: { status: 'blocked' },
                success: function(response) {
                    if (response.success) {
                        agentsTable.ajax.reload();
                        showToast('Agent blocked', 'success');
                    } else {
                        showToast(response.error || 'Error blocking agent', 'error');
                    }
                },
                error: function(xhr) {
                    showToast(xhr.responseJSON?.error || 'Error blocking agent', 'error');
                }
            });
        }
    });

    // Status filter handler
    $('#agentStatusFilter').change(function() {
        const status = $(this).val();
        agentsTable.column(3).search(status).draw();
    });

    // Refresh button handler
    $('.refresh-agents').click(function() {
        agentsTable.ajax.reload();
        showToast('Agent list refreshed', 'success');
    });
});

// Toast notification function
function showToast(message, type = 'info') {
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${type}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    $('#toastContainer').append(toastHtml);
    const toast = new bootstrap.Toast(document.getElementById(toastId));
    toast.show();
    
    // Remove toast after it's hidden
    $(`#${toastId}`).on('hidden.bs.toast', function() {
        $(this).remove();
    });
}
