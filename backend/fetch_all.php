<?php
// backend/fetch_all.php
require_once 'config.php';

try {
    // 1. Fetch all requests with patient details
    $stmt = $pdo->query("SELECT r.*, p.name as patientName, p.ic_no as patientIC, p.phone as patientPhone 
                         FROM requests r
                         JOIN patients p ON r.patient_mrn = p.mrn
                         ORDER BY r.created_at DESC");
    $requests = $stmt->fetchAll();

    // 2. For each request, fetch items and monitoring data
    foreach ($requests as &$r) {
        $requestId = $r['id'];

        // Fetch Items
        $stmt = $pdo->prepare("SELECT type, completed, completed_by as completedBy, completed_at as completedAt FROM request_items WHERE request_id = ?");
        $stmt->execute([$requestId]);
        $r['requestTypes'] = $stmt->fetchAll();
        // Convert completed from 0/1 to boolean
        foreach ($r['requestTypes'] as &$rt) {
            $rt['completed'] = (bool)$rt['completed'];
        }

        // Fetch Monitoring
        $stmt = $pdo->prepare("SELECT * FROM monitoring WHERE request_id = ?");
        $stmt->execute([$requestId]);
        $mon = $stmt->fetch();

        $r['monitoring'] = [
            'doctor' => $mon['doctor'] ?? '',
            'secretary' => $mon['secretary'] ?? '',
            'cancellationDate' => ['date' => $mon['cancellation_date'] ?? '', 'by' => $mon['cancellation_by'] ?? ''],
            'sendDoctorDate' => ['date' => $mon['send_doctor_date'] ?? '', 'by' => $mon['send_doctor_by'] ?? ''],
            'completionDate' => ['date' => $mon['completion_date'] ?? '', 'by' => $mon['completion_by'] ?? ''],
            'notificationDate' => ['date' => $mon['notification_date'] ?? '', 'by' => $mon['notification_by'] ?? ''],
            'handoverDate' => ['date' => $mon['handover_date'] ?? '', 'by' => $mon['handover_by'] ?? ''],
            'pmrTraceDate' => ['date' => $mon['pmr_trace_date'] ?? '', 'by' => $mon['pmr_trace_by'] ?? '', 'isNA' => (bool)($mon['pmr_trace_na'] ?? false)]
        ];

        // Fetch Audit Log for this individual record
        $stmt = $pdo->prepare("SELECT action, details, username as user, timestamp FROM audit_logs WHERE request_id = ? ORDER BY timestamp ASC");
        $stmt->execute([$requestId]);
        $r['auditLog'] = $stmt->fetchAll();

        // Rename fields for frontend compatibility
        $r['patientMRN'] = $r['patient_mrn'];
        $r['requesterType'] = $r['requester_type'];
        $r['requesterName'] = $r['requester_name'];
        $r['requesterPhone'] = $r['requester_phone'];
        $r['deliveryMethod'] = $r['delivery_method'];
        $r['deliveryDetail'] = $r['delivery_detail'];
        $r['deliveryEmail'] = $r['delivery_email'];
        $r['remarksCategory'] = $r['remarks_category'];
        $r['createdAt'] = $r['created_at'];
    }

    sendResponse($requests);

}
catch (PDOException $e) {
    sendResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>
