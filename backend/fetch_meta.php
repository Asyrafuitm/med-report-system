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

    // Try to fetch daily routine JSON state
    try {
        $stmt = $pdo->query("SELECT key_value FROM system_state WHERE key_name = 'daily_routine'");
        if ($row = $stmt->fetch()) {
            $meta['dailyRoutine'] = json_decode($row['key_value'], true);
        }
    } catch (Exception $e) {
        // Table might not exist yet, fallback gracefully
    }

    sendResponse($meta);

}
catch (PDOException $e) {
    sendResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>
