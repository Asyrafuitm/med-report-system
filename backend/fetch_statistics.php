<?php
// backend/fetch_statistics.php
require_once 'config.php';
require_once 'working_days_helper.php';

header('Content-Type: application/json');

$year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
$month = isset($_GET['month']) ? $_GET['month'] : 'all';

try {
    $holidays = getMalaysiaHolidays($year);

    $sql = "SELECT r.*, m.send_doctor_date, m.completion_date, m.pmr, m.iclic
            FROM requests r 
            LEFT JOIN monitoring m ON r.id = m.request_id 
            WHERE strftime('%Y', r.created_at) = :yr OR YEAR(r.created_at) = :yr";
            // The OR handles both SQLite and MySQL compatibility just in case 
            
    $params = [':yr' => (string)$year];
    
    if ($month !== 'all') {
        $sql .= " AND (strftime('%m', r.created_at) = :mon OR MONTH(r.created_at) = :mon_num)";
        $params[':mon'] = sprintf('%02d', $month);
        $params[':mon_num'] = (int)$month;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Initial structure
    $stats = [
        'volume' => [
            'total_applications' => count($records)
        ],
        'status_distribution' => [],
        'popular_request_types' => [],
        'department_breakdown' => [
            'CDO' => 0,
            'CPO' => 0,
            'CTD' => 0,
            'Others' => 0
        ],
        'kpi' => [
            'kpi1_met' => 0, 'kpi1_total' => 0, // 2 Days to doctor
            'kpi2_met' => 0, 'kpi2_total' => 0, // 18 Days doctor complete
            'kpi3_met' => 0, 'kpi3_total' => 0  // 21 Days total turnaround
        ],
        'methodology' => [
            'physical_pmr' => 0,
            'emr_iclic' => 0
        ]
    ];

    $statusCounts = [];
    $typeCounts = [];

    // Yearly total fetch
    $stmtYear = $pdo->prepare("SELECT COUNT(*) as yr_count FROM requests WHERE strftime('%Y', created_at) = :yr1 OR YEAR(created_at) = :yr2");
    $stmtYear->execute([':yr1' => (string)$year, ':yr2' => $year]);
    $yrResult = $stmtYear->fetch();
    $stats['volume']['yearly_overall'] = $yrResult ? (int)$yrResult['yr_count'] : 0;


    foreach ($records as $row) {
        // Status Distribution
        $status = $row['status'] ?: 'APPLY';
        if (!isset($statusCounts[$status])) $statusCounts[$status] = 0;
        $statusCounts[$status]++;

        // Request Types (remarks category proxy or we join request_items? Wait, user asked for Type of Application, mostly remarks_category is what they track)
        $cat = trim($row['remarks_category']);
        if (!empty($cat)) {
            if (!isset($typeCounts[$cat])) $typeCounts[$cat] = 0;
            $typeCounts[$cat]++;
        }

        // Department Breakdown
        $dep = trim($row['department']);
        $depUpper = strtoupper($dep);
        if (in_array($depUpper, ['CDO', 'CPO', 'CTD'])) {
            $stats['department_breakdown'][$depUpper]++;
        } else {
            $stats['department_breakdown']['Others']++;
        }

        // Methodology
        $isPmr = (bool)($row['pmr'] ?? false);
        $isIclic = (bool)($row['iclic'] ?? false);
        if ($isPmr) $stats['methodology']['physical_pmr']++;
        if ($isIclic) $stats['methodology']['emr_iclic']++;

        // KPI Calculations
        $appliedDate = $row['created_at'];
        $sendDate = $row['send_doctor_date'];
        $completeDate = $row['completion_date'];

        // KPI 1: Delivery to doctor within 2 working days
        if (!empty($appliedDate) && !empty($sendDate)) {
            $stats['kpi']['kpi1_total']++;
            $days = getWorkingDays($appliedDate, $sendDate, $holidays);
            if ($days !== null && $days <= 2) {
                $stats['kpi']['kpi1_met']++;
            }
        }

        // KPI 2: Completed by doctor within 18 working days
        if (!empty($sendDate) && !empty($completeDate)) {
            $stats['kpi']['kpi2_total']++;
            $days = getWorkingDays($sendDate, $completeDate, $holidays);
            if ($days !== null && $days <= 18) {
                $stats['kpi']['kpi2_met']++;
            }
        }

        // KPI 3: Total Turnaround Time within 21 working days
        if (!empty($appliedDate) && !empty($completeDate)) {
            $stats['kpi']['kpi3_total']++;
            $days = getWorkingDays($appliedDate, $completeDate, $holidays);
            if ($days !== null && $days <= 21) {
                $stats['kpi']['kpi3_met']++;
            }
        }
    }

    // Format status distribution for charting
    foreach ($statusCounts as $s => $c) {
        $stats['status_distribution'][] = ['status' => $s, 'count' => $c];
    }
    // Format popular types for charting, sort descending
    arsort($typeCounts);
    foreach (array_slice($typeCounts, 0, 10, true) as $t => $c) {
        $stats['popular_request_types'][] = ['type' => $t, 'count' => $c];
    }

    sendResponse($stats);

} catch (Exception $e) {
    sendResponse(['error' => 'Server error: ' . $e->getMessage()], 500);
}
?>
