<?php
// backend/save_daily_routine.php
require_once 'config.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['type']) || empty($input['topic']) || empty($input['staffId'])) {
    sendResponse(['error' => 'Missing required fields'], 400);
}

try {
    $stmt = $pdo->prepare("INSERT INTO daily_routine (type, topic, patient_mrn, staff_id) VALUES (?, ?, ?, ?)");
    $stmt->execute([
        $input['type'],
        $input['topic'],
        $input['patientMrn'] ?? null,
        $input['staffId']
    ]);

    sendResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
} catch (PDOException $e) {
    sendResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>
