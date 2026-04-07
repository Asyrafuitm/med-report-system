<?php
// backend/working_days_helper.php

function getMalaysiaHolidays($year) {
    $cacheFile = __DIR__ . '/holidays_' . $year . '.json';
    if (file_exists($cacheFile)) {
        return json_decode(file_get_contents($cacheFile), true);
    }
    
    // Fetch from Nager.Date API
    // Nager supports MY public holidays
    $url = "https://date.nager.at/api/v3/PublicHolidays/{$year}/MY";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($response && $httpCode == 200) {
        $holidays = json_decode($response, true);
        if (is_array($holidays)) {
            $dates = array_map(function($h) { return $h['date']; }, $holidays);
            file_put_contents($cacheFile, json_encode($dates));
            return $dates;
        }
    }
    
    // Fallback if API fails
    return [];
}

// Ensure both dates are strings in YYYY-MM-DD format
function getWorkingDays($startDate, $endDate, $holidays) {
    if (empty($startDate) || empty($endDate)) return null;
    
    $start = new DateTime(substr($startDate, 0, 10));
    $end = new DateTime(substr($endDate, 0, 10));
    
    if ($start > $end) {
        return 0; // or negative depending on context, we'll cap at 0
    }
    
    $workingDays = 0;
    while ($start <= $end) {
        $dayOfWeek = (int)$start->format('N'); // 1 (Mon) to 7 (Sun)
        $dateStr = $start->format('Y-m-d');
        
        if ($dayOfWeek < 6 && !in_array($dateStr, $holidays)) {
            $workingDays++;
        }
        $start->modify('+1 day');
    }
    return $workingDays;
}
?>
