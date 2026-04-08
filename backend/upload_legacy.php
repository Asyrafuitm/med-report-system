<?php
// backend/upload_legacy.php
require_once 'config.php';

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['data']) || !is_array($input['data'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid data format.']);
    exit;
}

$data = $input['data'];
$importedCount = 0;

function parseDateStr($val, $dateOnly = false) {
    if (empty($val) || $val === '-' || $val === 'N/A') return null;
    
    $format = $dateOnly ? 'Y-m-d' : 'Y-m-d H:i:s';
    
    if (is_numeric($val)) {
        $unix = ($val - 25569) * 86400;
        return gmdate($format, (int)$unix);
    }
    
    $val = trim($val);
    // Match DD/MM/YYYY or DD/MM/YYYY HH:MM
    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})/', $val, $m)) {
        return sprintf("%04d-%02d-%02d%s", $m[3], $m[2], $m[1], $dateOnly ? '' : ' 00:00:00');
    }
    // Match DD-MM-YYYY
    if (preg_match('/^(\d{1,2})-(\d{1,2})-(\d{4})/', $val, $m)) {
        return sprintf("%04d-%02d-%02d%s", $m[3], $m[2], $m[1], $dateOnly ? '' : ' 00:00:00');
    }
    
    $time = strtotime($val);
    if ($time !== false) {
        return date($format, $time);
    }
    
    return null;
}
// Ensure department column exists in DB before using it (must be outside transaction)
try {
    $pdo->exec("ALTER TABLE requests ADD COLUMN department TEXT;");
} catch (Exception $e) { /* ignore if column already exists */ }

$pdo->beginTransaction();

try {
    foreach ($data as $row) {
        // Convert all keys to uppercase to safely tolerate mismatched capitalizations from the Excel export
        $row = array_change_key_case($row, CASE_UPPER);
        
        $mrn = trim($row['MRN'] ?? '');
        if (empty($mrn)) continue;
        
        $name = trim($row['NAME'] ?? 'UNKNOWN');
        $dateRaw = trim($row['DATE'] ?? '');
        $dateStr = parseDateStr($dateRaw) ?: date('Y-m-d H:i:s');
        
        $status = trim($row['STATUS'] ?? 'APPLY');
        $type = trim($row['TYPE'] ?? 'Others');
        $sendDoctor = trim($row['SEND DOCTOR'] ?? '');
        $completeDoctor = trim($row['COMPLETE DOCTOR'] ?? '');
        
        $dateSent = parseDateStr($row['DATE SENT'] ?? '', true) ?: '';
        $dateCompleted = parseDateStr($row['DATE COMPLETED'] ?? '', true) ?: '';
        $notificationDate = parseDateStr($row['1ST NOTIFICATION DATE'] ?? '', true) ?: '';
        $dateCollected = parseDateStr($row['DATE COLLECTED'] ?? '', true) ?: '';
        $department = trim($row['DEPARTMENT'] ?? '');
        $appNote = trim($row['APP NOTE'] ?? '');
        
        // 1. Upsert Patient (Universal compatibility)
        $stmt = $pdo->prepare("SELECT mrn FROM patients WHERE mrn = ?");
        $stmt->execute([$mrn]);
        if ($stmt->fetch()) {
            $stmt = $pdo->prepare("UPDATE patients SET name = ? WHERE mrn = ?");
            $stmt->execute([$name, $mrn]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO patients (mrn, name, ic_no, phone) VALUES (?, ?, 'N/A', 'N/A')");
            $stmt->execute([$mrn, $name]);
        }
        
        // 2. Identify if Request already imported to avoid duplicate rows on re-upload
        // Uses patient_mrn, exact Date string, and Type as a fingerprint
        $stmt = $pdo->prepare("SELECT id FROM requests WHERE patient_mrn = ? AND created_at = ? AND remarks_category = ? LIMIT 1");
        $stmt->execute([$mrn, $dateStr, $type]);
        $existingReq = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existingReq) {
            $reqId = $existingReq['id'];
            $stmt = $pdo->prepare("UPDATE requests SET status = ?, notes = ? WHERE id = ?");
            $stmt->execute([$status, $appNote, $reqId]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO requests 
                (source, patient_mrn, requester_type, delivery_method, remarks_category, department, status, notes, username, created_at) 
                VALUES ('Legacy Excel', ?, 'Patient', 'Self-Collect', ?, ?, ?, ?, 'System Upload', ?)");
            $stmt->execute([$mrn, $type, $department, $status, $appNote, $dateStr]);
            $reqId = $pdo->lastInsertId();
        }
        
        // 3. Upsert Monitoring
        $stmt = $pdo->prepare("SELECT request_id FROM monitoring WHERE request_id = ?");
        $stmt->execute([$reqId]);
        if ($stmt->fetch()) {
            $stmt = $pdo->prepare("UPDATE monitoring SET 
                doctor = ?, 
                send_doctor_date = ?, 
                completion_by = ?, 
                completion_date = ?, 
                notification_date = ?, 
                handover_date = ? 
                WHERE request_id = ?");
            $stmt->execute([$sendDoctor, $dateSent, $completeDoctor, $dateCompleted, $notificationDate, $dateCollected, $reqId]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO monitoring 
                (request_id, doctor, send_doctor_date, completion_by, completion_date, notification_date, handover_date) 
                VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$reqId, $sendDoctor, $dateSent, $completeDoctor, $dateCompleted, $notificationDate, $dateCollected]);
        }
        
        $importedCount++;
    }
    
    $pdo->commit();
    echo json_encode(['success' => true, 'imported_count' => $importedCount]);
} catch (Exception $e) {
    if($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
