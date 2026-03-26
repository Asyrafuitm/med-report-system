<?php
// backend/init_db.php
require_once 'config.php';

$schemaFile = __DIR__ . '/../database/schema.sql';
$sql = file_get_contents($schemaFile);

try {
    $pdo->exec($sql);
    echo "Database initialized successfully.\n";
}
catch (PDOException $e) {
    echo "Error initializing database: " . $e->getMessage() . "\n";
}
?>
