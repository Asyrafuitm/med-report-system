<?php
// backend/fetch_statistics.php
require_once 'config.php';

try {
    // Basic stats for dashboard
    $stats = [];

    // Total requests by status
    $stmt = $pdo->query("SELECT status, COUNT(*) as count FROM requests GROUP BY status");
    $stats['status_distribution'] = $stmt->fetchAll();

    // Daily registrations for last 30 days
    $stmt = $pdo->query("SELECT date(created_at) as date, COUNT(*) as count 
                         FROM requests 
                         WHERE created_at >= date('now', '-30 days')
                         GROUP BY date(created_at) 
                         ORDER BY date ASC");
    $stats['daily_trends'] = $stmt->fetchAll();

    // Staff workload
    $stmt = $pdo->query("SELECT username, COUNT(*) as count FROM requests GROUP BY username");
    $stats['staff_workload'] = $stmt->fetchAll();

    // Request type distribution
    $stmt = $pdo->query("SELECT type, COUNT(*) as count FROM request_items GROUP BY type ORDER BY count DESC LIMIT 10");
    $stats['popular_request_types'] = $stmt->fetchAll();

    sendResponse($stats);

}
catch (PDOException $e) {
    sendResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>
