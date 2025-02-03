$(document).ready(function() {
    // Destroy existing DataTable if it exists
    if ($.fn.DataTable.isDataTable('#gamesTable')) {
        $('#gamesTable').DataTable().destroy();
    }

    // Initialize DataTable
    const gamesTable = $('#gamesTable').DataTable({
        processing: true,
        serverSide: false,
        ajax: {
            url: '/api/games',
            dataSrc: 'data'
        },
        columns: [
            { 
                data: '_id',
                render: function(data) {
                    return data ? `<span class="badge bg-dark">${data.toString().slice(-8).toUpperCase()}</span>` : '-';
                }
            },
            {
                data: 'imageUrlWithDefault',
                render: function(data, type, row) {
                    const imageUrl = data || '/images/games/default-game.svg';
                    return `<img src="${imageUrl}" alt="${row.title || ''}" class="img-thumbnail" style="max-width: 50px;">`;
                }
            },
            { data: 'title' },
            { 
                data: 'description',
                render: function(data) {
                    if (!data) return '-';
                    return data.length > 50 ? data.substr(0, 47) + '...' : data;
                }
            },
            {
                data: 'active',
                render: function(data) {
                    const status = data ? 'active' : 'inactive';
                    const statusClass = data ? 'success' : 'secondary';
                    return `<span class="badge bg-${statusClass}">${status}</span>`;
                }
            },
            { 
                data: 'playerCount',
                defaultContent: '0'
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
                            <button class="btn btn-sm btn-outline-primary edit-game" data-id="${row._id}">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-${row.active ? 'warning' : 'success'} toggle-status" data-id="${row._id}" data-active="${row.active}">
                                <i class="bi bi-${row.active ? 'pause' : 'play'}"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-game" data-id="${row._id}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    `;
                }
            }
        ],
        order: [[6, 'desc']], // Sort by created date by default
        pageLength: 10,
        responsive: true,
        language: {
            emptyTable: 'No games found',
            zeroRecords: 'No matching games found',
            info: 'Showing _START_ to _END_ of _TOTAL_ games',
            infoEmpty: 'Showing 0 to 0 of 0 games',
            infoFiltered: '(filtered from _MAX_ total games)'
        }
    });

    // Add game form handler
    $('#addGameForm').submit(function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        
        $.ajax({
            url: '/api/games',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    $('#addGameModal').modal('hide');
                    gamesTable.ajax.reload();
                    showToast('Game created successfully', 'success');
                    $('#addGameForm')[0].reset();
                } else {
                    showToast(response.error || 'Error creating game', 'error');
                }
            },
            error: function(xhr) {
                showToast(xhr.responseJSON?.error || 'Error creating game', 'error');
            }
        });
    });

    // Edit game form handler
    $('#editGameForm').submit(function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const gameId = $('#editGameId').val();
        
        $.ajax({
            url: `/api/games/${gameId}`,
            method: 'PUT',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    $('#editGameModal').modal('hide');
                    gamesTable.ajax.reload();
                    showToast('Game updated successfully', 'success');
                } else {
                    showToast(response.error || 'Error updating game', 'error');
                }
            },
            error: function(xhr) {
                showToast(xhr.responseJSON?.error || 'Error updating game', 'error');
            }
        });
    });

    // Edit game button handler
    $('#gamesTable').on('click', '.edit-game', function() {
        const gameId = $(this).data('id');
        
        $.ajax({
            url: `/api/games/${gameId}`,
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    const game = response.data;
                    $('#editGameId').val(game._id);
                    $('#editGameTitle').val(game.title);
                    $('#editGameDescription').val(game.description);
                    $('#editGameActive').prop('checked', game.active);
                    $('#editGameModal').modal('show');
                } else {
                    showToast(response.error || 'Error loading game details', 'error');
                }
            },
            error: function(xhr) {
                showToast(xhr.responseJSON?.error || 'Error loading game details', 'error');
            }
        });
    });

    // Toggle status button handler
    $('#gamesTable').on('click', '.toggle-status', function() {
        const gameId = $(this).data('id');
        const currentActive = $(this).data('active');
        
        if (!confirm(`Are you sure you want to ${currentActive ? 'deactivate' : 'activate'} this game?`)) {
            return;
        }
        
        $.ajax({
            url: `/api/games/${gameId}/status`,
            method: 'PUT',
            data: { active: !currentActive },
            success: function(response) {
                if (response.success) {
                    gamesTable.ajax.reload();
                    showToast(`Game ${currentActive ? 'deactivated' : 'activated'} successfully`, 'success');
                } else {
                    showToast(response.error || 'Error updating game status', 'error');
                }
            },
            error: function(xhr) {
                showToast(xhr.responseJSON?.error || 'Error updating game status', 'error');
            }
        });
    });

    // Delete game button handler
    $('#gamesTable').on('click', '.delete-game', function() {
        const gameId = $(this).data('id');
        
        if (!confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
            return;
        }
        
        $.ajax({
            url: `/api/games/${gameId}`,
            method: 'DELETE',
            success: function(response) {
                if (response.success) {
                    gamesTable.ajax.reload();
                    showToast('Game deleted successfully', 'success');
                } else {
                    showToast(response.error || 'Error deleting game', 'error');
                }
            },
            error: function(xhr) {
                showToast(xhr.responseJSON?.error || 'Error deleting game', 'error');
            }
        });
    });

    // Status filter handler
    $('#gameStatusFilter').change(function() {
        const status = $(this).val();
        gamesTable.column(4).search(status).draw();
    });

    // Refresh button handler
    $('.refresh-games').click(function() {
        gamesTable.ajax.reload();
        showToast('Games list refreshed', 'info');
    });

    // Toast notification function
    function showToast(message, type = 'info') {
        const types = {
            success: 'bg-success',
            error: 'bg-danger',
            warning: 'bg-warning',
            info: 'bg-info'
        };

        const toast = $(`
            <div class="toast align-items-center text-white ${types[type]} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `);
        
        $('#toastContainer').append(toast);
        const bsToast = new bootstrap.Toast(toast[0], { delay: 3000 });
        bsToast.show();
        
        toast.on('hidden.bs.toast', function() {
            $(this).remove();
        });
    }
});
