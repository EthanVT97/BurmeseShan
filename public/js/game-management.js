document.addEventListener('DOMContentLoaded', function() {
    // Initialize DataTable
    const gamesTable = $('#gamesTable').DataTable({
        order: [[1, 'asc']],
        columnDefs: [
            { orderable: false, targets: [0, 4] }
        ]
    });

    // Load games on page load
    loadGames();

    // Image preview functionality
    function setupImagePreview(inputId, previewId) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);

        if (input && preview) {
            input.addEventListener('change', function() {
                const file = this.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        preview.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    // Setup image previews for both add and edit forms
    setupImagePreview('gameImage', 'previewImage');
    setupImagePreview('editGameImage', 'editPreviewImage');

    // Handle form submission for adding new game
    document.getElementById('submitGameBtn').addEventListener('click', async function() {
        const form = document.getElementById('addGameForm');
        const formData = new FormData(form);

        try {
            const response = await fetch('/admin/games', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                toastr.success('Game added successfully');
                $('#addGameModal').modal('hide');
                form.reset();
                document.getElementById('previewImage').src = '/images/placeholder.png';
                loadGames();
            } else {
                toastr.error(result.error || 'Failed to add game');
            }
        } catch (error) {
            console.error('Error:', error);
            toastr.error('Failed to add game');
        }
    });

    // Handle form submission for editing game
    document.getElementById('updateGameBtn').addEventListener('click', async function() {
        const form = document.getElementById('editGameForm');
        const formData = new FormData(form);

        try {
            const response = await fetch(`/admin/games/${formData.get('gameId')}`, {
                method: 'PUT',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                toastr.success('Game updated successfully');
                $('#editGameModal').modal('hide');
                loadGames();
            } else {
                toastr.error(result.error || 'Failed to update game');
            }
        } catch (error) {
            console.error('Error:', error);
            toastr.error('Failed to update game');
        }
    });

    // Load games from server
    async function loadGames() {
        try {
            const response = await fetch('/admin/games');
            const result = await response.json();

            if (result.success) {
                const tbody = document.getElementById('gamesTableBody');
                tbody.innerHTML = '';

                result.games.forEach(game => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>
                            <img src="/images/games/${game.image}" alt="${game.name}" class="game-thumbnail">
                        </td>
                        <td>${game.name}</td>
                        <td>${game.description}</td>
                        <td>
                            <span class="badge bg-${game.active ? 'success' : 'danger'} game-status">
                                ${game.active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td class="actions">
                            <button class="btn btn-primary btn-icon" onclick="editGame('${game._id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-danger btn-icon" onclick="deleteGame('${game._id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                // Reinitialize DataTable
                gamesTable.clear().rows.add($(tbody).children()).draw();
            }
        } catch (error) {
            console.error('Error:', error);
            toastr.error('Failed to load games');
        }
    }

    // Edit game
    window.editGame = async function(gameId) {
        try {
            const response = await fetch(`/admin/games/${gameId}`);
            const result = await response.json();

            if (result.success) {
                const game = result.game;
                document.getElementById('editGameId').value = game._id;
                document.getElementById('editGameName').value = game.name;
                document.getElementById('editGameDescription').value = game.description;
                document.getElementById('editGameActive').checked = game.active;
                document.getElementById('editPreviewImage').src = `/images/games/${game.image}`;

                $('#editGameModal').modal('show');
            }
        } catch (error) {
            console.error('Error:', error);
            toastr.error('Failed to load game details');
        }
    };

    // Delete game
    window.deleteGame = async function(gameId) {
        if (confirm('Are you sure you want to delete this game?')) {
            try {
                const response = await fetch(`/admin/games/${gameId}`, {
                    method: 'DELETE'
                });

                const result = await response.json();
                if (result.success) {
                    toastr.success('Game deleted successfully');
                    loadGames();
                } else {
                    toastr.error(result.error || 'Failed to delete game');
                }
            } catch (error) {
                console.error('Error:', error);
                toastr.error('Failed to delete game');
            }
        }
    };

    // Drag and drop functionality
    const dropZones = document.querySelectorAll('.image-preview');
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragging');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragging');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragging');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const input = zone.closest('form').querySelector('input[type="file"]');
                input.files = files;
                input.dispatchEvent(new Event('change'));
            }
        });
    });
});
