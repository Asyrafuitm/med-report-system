<?php
// backend/doctor_workload.php
require_once 'config.php';

try {
    // Current active workload (statuses: APPLY, SENT, NOTIFY)
    $stmt = $pdo->query("SELECT d.name, d.secretary, 
                         (SELECT COUNT(*) FROM monitoring m 
                          JOIN requests r ON m.request_id = r.id 
                          WHERE m.doctor = d.name AND r.status IN ('APPLY', 'SENT', 'NOTIFY')) as workload_count
                         FROM doctors d");
    $workload = $stmt->fetchAll();

    sendResponse($workload);

}
catch (PDOException $e) {
    sendResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>
