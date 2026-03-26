<?php
// backend/config.php

// Enable error reporting for development
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Database path
$dbPath = __DIR__ . '/../database/medical_report.db';

try {
    // Create (or open) the SQLite database
    $pdo = new PDO("sqlite:" . $dbPath);
    
    // Set error mode to exception
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    
    // Enable foreign keys
    $pdo->exec('PRAGMA foreign_keys = ON;');
    
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
