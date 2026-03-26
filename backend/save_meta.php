<?php
// backend/save_meta.php
require_once 'config.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    sendResponse(['error' => 'Invalid data'], 400);
}

try {
    $pdo->beginTransaction();

    if (isset($input['doctors'])) {
        $pdo->exec("DELETE FROM doctors");
        $stmt = $pdo->prepare("INSERT INTO doctors (name, secretary, leave_start, leave_end) VALUES (?, ?, ?, ?)");
        foreach ($input['doctors'] as $d) {
            $stmt->execute([
                $d['name'] ?? '',
                $d['secretary'] ?? '',
                $d['leaveStart'] ?? '',
                $d['leaveEnd'] ?? ''
            ]);
        }
    }

    if (isset($input['secretaries'])) {
        $pdo->exec("DELETE FROM secretaries");
        $stmt = $pdo->prepare("INSERT INTO secretaries (name, leave_start, leave_end) VALUES (?, ?, ?)");
        foreach ($input['secretaries'] as $s) {
            $stmt->execute([
                $s['name'] ?? '',
                $s['leaveStart'] ?? '',
                $s['leaveEnd'] ?? ''
            ]);
        }
    }

    $pdo->commit();
    sendResponse(['success' => true]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>
