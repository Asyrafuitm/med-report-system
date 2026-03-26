<?php
// backend/save_registration.php
require_once 'config.php';

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    sendResponse(['error' => 'No data provided'], 400);
}

try {
    $pdo->beginTransaction();

    // 1. Upsert Patient
    $stmt = $pdo->prepare("INSERT INTO patients (mrn, name, ic_no, phone) 
                           VALUES (?, ?, ?, ?) 
                           ON CONFLICT(mrn) DO UPDATE SET 
                           name=excluded.name, ic_no=excluded.ic_no, phone=excluded.phone");
    $stmt->execute([
        $input['patientMRN'],
        $input['patientName'],
        $input['patientIC'],
        $input['patientPhone']
    ]);

    // 2. Insert Request
    $stmt = $pdo->prepare("INSERT INTO requests (source, patient_mrn, requester_type, requester_name, requester_phone, 
                                               relationship, delivery_method, delivery_detail, delivery_email, 
                                               remarks_category, notes, username) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $input['source'],
        $input['patientMRN'],
        $input['requesterType'],
        $input['requesterName'] ?? null,
        $input['requesterPhone'] ?? null,
        $input['relationship'] ?? null,
        $input['deliveryMethod'],
        $input['deliveryDetail'] ?? null,
        $input['deliveryEmail'] ?? null,
        $input['remarksCategory'],
        $input['notes'] ?? null,
        $input['username'] ?? 'Anonymous'
    ]);
    $requestId = $pdo->lastInsertId();

    // 3. Insert Request Items
    if (isset($input['formRequests']) && is_array($input['formRequests'])) {
        $stmt = $pdo->prepare("INSERT INTO request_items (request_id, type) VALUES (?, ?)");
        foreach ($input['formRequests'] as $type) {
            if (!empty($type)) {
                $stmt->execute([$requestId, $type]);
            }
        }
    }

    // 4. Initialize Monitoring record
    $stmt = $pdo->prepare("INSERT INTO monitoring (request_id) VALUES (?)");
    $stmt->execute([$requestId]);

    // 5. Audit Log
    $stmt = $pdo->prepare("INSERT INTO audit_logs (request_id, action, details, username) 
                           VALUES (?, ?, ?, ?)");
    $stmt->execute([
        $requestId,
        'CREATE',
        'New registration created for MRN: ' . $input['patientMRN'],
        $input['username'] ?? 'Anonymous'
    ]);

    $pdo->commit();
    sendResponse(['success' => true, 'request_id' => $requestId]);

}
catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>
