<?php
// backend/save_routine.php
require_once 'config.php';

// Ensure table exists
$pdo->exec("CREATE TABLE IF NOT EXISTS system_state (
    key_name VARCHAR(50) PRIMARY KEY,
    key_value LONGTEXT
)");

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    sendResponse(['error' => 'Invalid data'], 400);
}

try {
    $encoded = json_encode($input);
    $stmt = $pdo->prepare("INSERT INTO system_state (key_name, key_value) VALUES ('daily_routine', ?) ON DUPLICATE KEY UPDATE key_value = VALUES(key_value)");
    $stmt->execute([$encoded]);

    sendResponse(['success' => true]);
} catch (PDOException $e) {
    sendResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>
