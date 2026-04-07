<?php
// backend/update_monitoring.php
require_once 'config.php';

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['requestId']) || !isset($input['monitoring'])) {
    sendResponse(['error' => 'Invalid data'], 400);
    exit;
}

$reqId = $input['requestId'];
$mon = $input['monitoring'];
$status = $input['status'] ?? null;
$logs = $input['auditLogs'] ?? [];

try {
    // Add pmr and iclic columns if they don't exist yet
    $pdo->exec("ALTER TABLE monitoring ADD COLUMN pmr BOOLEAN DEFAULT 0;");
} catch (Exception $e) { /* ignore if already exists */ }

try {
    $pdo->exec("ALTER TABLE monitoring ADD COLUMN iclic BOOLEAN DEFAULT 0;");
} catch (Exception $e) { /* ignore if already exists */ }

try {
    $pdo->beginTransaction();

    // 1. Upsert Monitoring
    $stmt = $pdo->prepare("SELECT request_id FROM monitoring WHERE request_id = ?");
    $stmt->execute([$reqId]);
    if ($stmt->fetch()) {
        $stmt = $pdo->prepare("UPDATE monitoring SET 
            doctor = ?, 
            secretary = ?, 
            cancellation_date = ?, 
            send_doctor_date = ?, 
            completion_date = ?, 
            notification_date = ?, 
            handover_date = ?,
            pmr = ?,
            iclic = ?
            WHERE request_id = ?");
        $stmt->execute([
            $mon['doctor'] ?? '',
            $mon['secretary'] ?? '',
            isset($mon['cancellationDate']['date']) ? $mon['cancellationDate']['date'] : '',
            isset($mon['sendDoctorDate']['date']) ? $mon['sendDoctorDate']['date'] : '',
            isset($mon['completionDate']['date']) ? $mon['completionDate']['date'] : '',
            isset($mon['notificationDate']['date']) ? $mon['notificationDate']['date'] : '',
            isset($mon['handoverDate']['date']) ? $mon['handoverDate']['date'] : '',
            isset($mon['pmr']) ? (int)$mon['pmr'] : 0,
            isset($mon['iclic']) ? (int)$mon['iclic'] : 0,
            $reqId
        ]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO monitoring 
            (request_id, doctor, secretary, cancellation_date, send_doctor_date, completion_date, notification_date, handover_date, pmr, iclic) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $reqId,
            $mon['doctor'] ?? '',
            $mon['secretary'] ?? '',
            isset($mon['cancellationDate']['date']) ? $mon['cancellationDate']['date'] : '',
            isset($mon['sendDoctorDate']['date']) ? $mon['sendDoctorDate']['date'] : '',
            isset($mon['completionDate']['date']) ? $mon['completionDate']['date'] : '',
            isset($mon['notificationDate']['date']) ? $mon['notificationDate']['date'] : '',
            isset($mon['handoverDate']['date']) ? $mon['handoverDate']['date'] : '',
            isset($mon['pmr']) ? (int)$mon['pmr'] : 0,
            isset($mon['iclic']) ? (int)$mon['iclic'] : 0
        ]);
    }

    // 2. Update Request Status
    if ($status) {
        $stmt = $pdo->prepare("UPDATE requests SET status = ? WHERE id = ?");
        $stmt->execute([$status, $reqId]);
    }

    // 3. Insert Logs
    if (!empty($logs)) {
        $stmt = $pdo->prepare("INSERT INTO audit_logs (request_id, action, details, username, timestamp) VALUES (?, ?, ?, ?, ?)");
        foreach ($logs as $log) {
            $stmt->execute([
                $reqId,
                $log['action'] ?? 'Update',
                $log['detail'] ?? ($log['text'] ?? ''),
                $log['user'] ?? 'System',
                $log['timestamp'] ?? date('Y-m-d H:i:s')
            ]);
        }
    }

    $pdo->commit();
    sendResponse(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>
