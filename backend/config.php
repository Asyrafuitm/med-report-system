<?php
// backend/config.php

// Enable error reporting for development
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Database routing
try {
    $driver = 'sqlite';
    if (getenv('MYSQL_URL') || getenv('MYSQLHOST')) {
        $driver = 'mysql';
        $host = getenv('MYSQLHOST');
        $port = getenv('MYSQLPORT') ?: 3306;
        $db   = getenv('MYSQLDATABASE');
        $user = getenv('MYSQLUSER');
        $pass = getenv('MYSQLPASSWORD');
        
        $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass);
    } else {
        $dbPath = __DIR__ . '/../database/medical_report.db';
        $pdo = new PDO("sqlite:" . $dbPath);
        $pdo->exec('PRAGMA foreign_keys = ON;');
    }
    
    // Set error mode to exception
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    
    // Auto-init DB if missing
    try {
        $pdo->query("SELECT 1 FROM requests LIMIT 1");
    } catch (Exception $e) {
        $schemaFile = __DIR__ . '/../database/schema.sql';
        if (file_exists($schemaFile)) {
            $sql = file_get_contents($schemaFile);
            if ($driver === 'mysql') {
                $sql = str_replace('AUTOINCREMENT', 'AUTO_INCREMENT', $sql);
            }
            $pdo->exec($sql);
        }
    }
    
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

// Helper function to send JSON response
function sendResponse($data, $statusCode = 200) {
    header('Content-Type: application/json');
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}
?>
