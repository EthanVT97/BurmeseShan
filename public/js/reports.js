$(document).ready(function() {
    // Initialize DataTable for activity
    const activityTable = $('#activityTable').DataTable({
        processing: true,
        serverSide: false,
        ajax: {
            url: '/api/reports/activity',
            dataSrc: 'data'
        },
        columns: [
            {
                data: 'timestamp',
                render: function(data) {
                    return data ? new Date(data).toLocaleString() : 'N/A';
                }
            },
            {
                data: 'type',
                render: function(data) {
                    const types = {
                        login: 'Login',
                        transaction: 'Transaction',
                        game: 'Game',
                        system: 'System'
                    };
                    return types[data] || data;
                }
            },
            { data: 'user' },
            { 
                data: 'details',
                render: function(data) {
                    if (!data) return '-';
                    return data.length > 30 ? data.substr(0, 27) + '...' : data;
                }
            },
            {
                data: 'status',
                render: function(data) {
                    const statusClasses = {
                        success: 'success',
                        pending: 'warning',
                        failed: 'danger'
                    };
                    return `<span class="badge bg-${statusClasses[data] || 'secondary'}">${data}</span>`;
                }
            }
        ],
        order: [[0, 'desc']],
        pageLength: 10,
        responsive: true,
        language: {
            emptyTable: 'No activity found',
            zeroRecords: 'No matching activity found'
        },
        dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" +
             "<'row'<'col-sm-12'tr>>" +
             "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
    });

    // Load statistics
    function loadStats() {
        $.ajax({
            url: '/api/reports/stats',
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    const stats = response.data;
                    $('#totalPlayers').text(stats.totalPlayers.toLocaleString());
                    $('#totalAgents').text(stats.totalAgents.toLocaleString());
                    $('#totalGames').text(stats.totalGames.toLocaleString());
                    $('#totalTransactions').text(stats.totalTransactions.toLocaleString());
                    updateCharts(stats.charts);
                } else {
                    showToast('Error loading statistics', 'error');
                }
            },
            error: function() {
                showToast('Error loading statistics', 'error');
            }
        });
    }

    // Initialize charts
    let dailyPlayersChart, transactionVolumeChart;

    function initializeCharts() {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        };

        // Daily Players Chart
        const dailyPlayersCtx = document.getElementById('dailyPlayersChart').getContext('2d');
        dailyPlayersChart = new Chart(dailyPlayersCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Active Players',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                ...chartOptions,
                plugins: {
                    ...chartOptions.plugins,
                    tooltip: {
                        ...chartOptions.plugins.tooltip,
                        callbacks: {
                            label: function(context) {
                                return `Players: ${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                }
            }
        });

        // Transaction Volume Chart
        const transactionVolumeCtx = document.getElementById('transactionVolumeChart').getContext('2d');
        transactionVolumeChart = new Chart(transactionVolumeCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Transaction Volume',
                    data: [],
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    borderColor: 'rgb(255, 159, 64)',
                    borderWidth: 1
                }]
            },
            options: {
                ...chartOptions,
                plugins: {
                    ...chartOptions.plugins,
                    tooltip: {
                        ...chartOptions.plugins.tooltip,
                        callbacks: {
                            label: function(context) {
                                return `Volume: ${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                }
            }
        });

        // Handle window resize
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                dailyPlayersChart.resize();
                transactionVolumeChart.resize();
            }, 250);
        });
    }

    function updateCharts(chartData) {
        // Update Daily Players Chart
        dailyPlayersChart.data.labels = chartData.dailyPlayers.labels;
        dailyPlayersChart.data.datasets[0].data = chartData.dailyPlayers.data;
        dailyPlayersChart.update();

        // Update Transaction Volume Chart
        transactionVolumeChart.data.labels = chartData.transactionVolume.labels;
        transactionVolumeChart.data.datasets[0].data = chartData.transactionVolume.data;
        transactionVolumeChart.update();
    }

    // Export report
    $('#exportReport').click(function() {
        window.location.href = '/api/reports/export';
    });

    // Refresh stats
    $('#refreshStats').click(function() {
        const $btn = $(this);
        const $icon = $btn.find('i');
        
        $btn.prop('disabled', true);
        $icon.addClass('rotate-animation');
        
        loadStats();
        
        setTimeout(function() {
            $btn.prop('disabled', false);
            $icon.removeClass('rotate-animation');
            showToast('Statistics refreshed', 'info');
        }, 1000);
    });

    // Refresh activity
    $('#refreshActivity').click(function() {
        const $btn = $(this);
        const $icon = $btn.find('i');
        
        $btn.prop('disabled', true);
        $icon.addClass('rotate-animation');
        
        activityTable.ajax.reload(function() {
            $btn.prop('disabled', false);
            $icon.removeClass('rotate-animation');
            showToast('Activity log refreshed', 'info');
        });
    });

    // Chart range buttons
    $('.btn-group [data-range]').click(function() {
        const $btn = $(this);
        const range = $btn.data('range');
        const chartType = $btn.closest('.card').find('canvas').attr('id');

        $btn.closest('.btn-group').find('.btn').removeClass('active');
        $btn.addClass('active');

        $.ajax({
            url: `/api/reports/chart-data/${chartType}/${range}`,
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    if (chartType === 'dailyPlayersChart') {
                        dailyPlayersChart.data.labels = response.data.labels;
                        dailyPlayersChart.data.datasets[0].data = response.data.data;
                        dailyPlayersChart.update();
                    } else if (chartType === 'transactionVolumeChart') {
                        transactionVolumeChart.data.labels = response.data.labels;
                        transactionVolumeChart.data.datasets[0].data = response.data.data;
                        transactionVolumeChart.update();
                    }
                } else {
                    showToast('Error loading chart data', 'error');
                }
            },
            error: function() {
                showToast('Error loading chart data', 'error');
            }
        });
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

    // Initialize
    initializeCharts();
    loadStats();
});
