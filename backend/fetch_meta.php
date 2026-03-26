<?php
// backend/fetch_meta.php
require_once 'config.php';

try {
    $meta = [];

    // Doctors
    $stmt = $pdo->query("SELECT * FROM doctors ORDER BY name ASC");
    $meta['doctors'] = $stmt->fetchAll();

    // Secretaries
    $stmt = $pdo->query("SELECT * FROM secretaries ORDER BY name ASC");
    $meta['secretaries'] = $stmt->fetchAll();

    // System Audit (Global)
    $stmt = $pdo->query("SELECT action, details, username as user, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 200");
    $meta['systemAuditLog'] = $stmt->fetchAll();

    // Daily Routine (Current Day)
    $stmt = $pdo->query("SELECT * FROM daily_routine WHERE date(timestamp) = date('now')");
    $meta['dailyRoutine'] = $stmt->fetchAll();

    sendResponse($meta);

}
catch (PDOException $e) {
    sendResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>
