<?php
require 'config.php';
$stmt = $pdo->query("SELECT COUNT(*) as cnt FROM requests WHERE source = 'Legacy Excel'");
$res = $stmt->fetch(PDO::FETCH_ASSOC);
echo "Legacy Excel Records: " . $res['cnt'] . "\n";
?>
