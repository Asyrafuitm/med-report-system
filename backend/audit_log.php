<?php
// backend/audit_log.php
require_once 'config.php';

try {
    // Fetch recent audit logs
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;

    $stmt = $pdo->prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?");
    $stmt->execute([$limit]);
    $logs = $stmt->fetchAll();

    sendResponse($logs);

}
catch (PDOException $e) {
    sendResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>
