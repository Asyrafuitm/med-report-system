<?php
// backend/fetch_yesterday_summary.php
require_once 'config.php';

header('Content-Type: application/json');

$targetDate = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d', strtotime('-1 day'));

try {
    // 1. Registrations count and list by staff
    $stmtReq = $pdo->prepare("
        SELECT username, COUNT(*) as count 
        FROM requests 
        WHERE DATE(created_at) = :dt 
        GROUP BY username
    ");
    $stmtReq->execute([':dt' => $targetDate]);
    $regByStaff = $stmtReq->fetchAll(PDO::FETCH_ASSOC);

    // 2. Daily Routine (Emails/Calls) by staff
    $stmtRoutine = $pdo->prepare("
        SELECT staff_id as username, COUNT(*) as count 
        FROM daily_routine 
        WHERE DATE(timestamp) = :dt 
        GROUP BY staff_id
    ");
    $stmtRoutine->execute([':dt' => $targetDate]);
    $routineByStaff = $stmtRoutine->fetchAll(PDO::FETCH_ASSOC);

    // 3. Updates (Tasks completed/sent to doctor) by staff
    // Using audit_logs for a more accurate representation of staff activity
    // We count actions like UPDATE, CREATE, or anything logged yesterday.
    // Or we just count total audit logs per staff for yesterday.
    $stmtAudit = $pdo->prepare("
        SELECT username, COUNT(*) as count 
        FROM audit_logs 
        WHERE DATE(timestamp) = :dt AND action != 'CREATE'
        GROUP BY username
    ");
    $stmtAudit->execute([':dt' => $targetDate]);
    $auditByStaff = $stmtAudit->fetchAll(PDO::FETCH_ASSOC);

    // Combine stats per staff
    $staffStats = [];
    $totalReg = 0;
    $totalRoutine = 0;
    $totalUpdates = 0;

    foreach ($regByStaff as $row) {
        $u = $row['username'] ?: 'Unknown';
        if (!isset($staffStats[$u])) $staffStats[$u] = ['registrations' => 0, 'routines' => 0, 'updates' => 0];
        $staffStats[$u]['registrations'] += $row['count'];
        $totalReg += $row['count'];
    }

    foreach ($routineByStaff as $row) {
        $u = $row['username'] ?: 'Unknown';
        if (!isset($staffStats[$u])) $staffStats[$u] = ['registrations' => 0, 'routines' => 0, 'updates' => 0];
        $staffStats[$u]['routines'] += $row['count'];
        $totalRoutine += $row['count'];
    }

    foreach ($auditByStaff as $row) {
        $u = $row['username'] ?: 'Unknown';
        if (!isset($staffStats[$u])) $staffStats[$u] = ['registrations' => 0, 'routines' => 0, 'updates' => 0];
        $staffStats[$u]['updates'] += $row['count'];
        $totalUpdates += $row['count'];
    }

    // Format final response
    $response = [
        'target_date' => $targetDate,
        'summary' => [
            'total_registrations' => $totalReg,
            'total_routines' => $totalRoutine,
            'total_updates' => $totalUpdates
        ],
        'staff_breakdown' => $staffStats
    ];

    sendResponse($response);

} catch (Exception $e) {
    sendResponse(['error' => 'Server error: ' . $e->getMessage()], 500);
}
?>
