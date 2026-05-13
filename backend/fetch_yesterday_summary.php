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

    // 2. Daily Routine (Emails/Calls/Counter Queries) by staff from system_state JSON blob
    $stmtRoutine = $pdo->prepare("SELECT key_value FROM system_state WHERE key_name = 'daily_routine'");
    $stmtRoutine->execute();
    $rowRoutine = $stmtRoutine->fetch(PDO::FETCH_ASSOC);

    $routineByStaff = [];
    $totalRoutine = 0;
    $counterByStaff = [];
    $totalCounter = 0;

    if ($rowRoutine && !empty($rowRoutine['key_value'])) {
        $routineData = json_decode($rowRoutine['key_value'], true);
        if ($routineData) {
            // Process Emails and Calls
            $routineCats = ['emails', 'calls'];
            foreach ($routineCats as $cat) {
                if (isset($routineData[$cat]) && is_array($routineData[$cat])) {
                    foreach ($routineData[$cat] as $item) {
                        $itemDate = $item['date'] ?? '';
                        if ($itemDate === $targetDate) {
                            $staff = $item['staff'] ?? 'Unknown';
                            if (!isset($routineByStaff[$staff])) {
                                $routineByStaff[$staff] = 0;
                            }
                            $routineByStaff[$staff]++;
                            $totalRoutine++;
                        }
                    }
                }
            }

            // Process Counter Queries
            if (isset($routineData['counterQueries']) && is_array($routineData['counterQueries'])) {
                foreach ($routineData['counterQueries'] as $item) {
                    $itemDate = $item['date'] ?? '';
                    if ($itemDate === $targetDate) {
                        $staff = $item['staff'] ?? 'Unknown';
                        if (!isset($counterByStaff[$staff])) {
                            $counterByStaff[$staff] = 0;
                        }
                        $counterByStaff[$staff]++;
                        $totalCounter++;
                    }
                }
            }
        }
    }

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

    // 4. Excel Uploads count
    $stmtUploads = $pdo->prepare("
        SELECT username, details
        FROM audit_logs
        WHERE DATE(timestamp) = :dt AND action = 'UPLOAD_EXCEL'
    ");
    $stmtUploads->execute([':dt' => $targetDate]);
    $uploadsLogs = $stmtUploads->fetchAll(PDO::FETCH_ASSOC);

    $uploadByStaff = [];
    $totalUploads = 0;
    foreach ($uploadsLogs as $log) {
        $u = $log['username'] ?: 'Unknown';
        if (preg_match('/Imported (\d+) records/', $log['details'], $matches)) {
            $count = (int)$matches[1];
            if (!isset($uploadByStaff[$u])) $uploadByStaff[$u] = 0;
            $uploadByStaff[$u] += $count;
            $totalUploads += $count;
        }
    }

    // Combine stats per staff
    $staffStats = [];
    $totalReg = 0;
    $totalRoutineSum = 0;
    $totalCounterSum = 0;
    $totalUpdates = 0;

    foreach ($regByStaff as $row) {
        $u = $row['username'] ?: 'Unknown';
        if (!isset($staffStats[$u])) {
            $staffStats[$u] = ['registrations' => 0, 'routines' => 0, 'counters' => 0, 'updates' => 0, 'uploads' => 0];
        }
        $staffStats[$u]['registrations'] += $row['count'];
        $totalReg += $row['count'];
    }

    foreach ($routineByStaff as $u => $count) {
        if (!isset($staffStats[$u])) {
            $staffStats[$u] = ['registrations' => 0, 'routines' => 0, 'counters' => 0, 'updates' => 0, 'uploads' => 0];
        }
        $staffStats[$u]['routines'] += $count;
        $totalRoutineSum += $count;
    }

    foreach ($counterByStaff as $u => $count) {
        if (!isset($staffStats[$u])) {
            $staffStats[$u] = ['registrations' => 0, 'routines' => 0, 'counters' => 0, 'updates' => 0, 'uploads' => 0];
        }
        $staffStats[$u]['counters'] += $count;
        $totalCounterSum += $count;
    }

    foreach ($auditByStaff as $row) {
        $u = $row['username'] ?: 'Unknown';
        if (!isset($staffStats[$u])) {
            $staffStats[$u] = ['registrations' => 0, 'routines' => 0, 'counters' => 0, 'updates' => 0, 'uploads' => 0];
        }
        $staffStats[$u]['updates'] += $row['count'];
        $totalUpdates += $row['count'];
    }

    foreach ($uploadByStaff as $u => $count) {
        if (!isset($staffStats[$u])) {
            $staffStats[$u] = ['registrations' => 0, 'routines' => 0, 'counters' => 0, 'updates' => 0, 'uploads' => 0];
        }
        $staffStats[$u]['uploads'] += $count;
    }

    // Format final response
    $response = [
        'target_date' => $targetDate,
        'summary' => [
            'total_registrations' => $totalReg,
            'total_routines' => $totalRoutineSum,
            'total_counters' => $totalCounterSum,
            'total_updates' => $totalUpdates,
            'total_uploads' => $totalUploads
        ],
        'staff_breakdown' => $staffStats
    ];

    sendResponse($response);

} catch (Exception $e) {
    sendResponse(['error' => 'Server error: ' . $e->getMessage()], 500);
}
?>
