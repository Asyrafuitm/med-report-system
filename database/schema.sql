-- Medical Report Walk-In System Schema

-- Patients Table
CREATE TABLE IF NOT EXISTS patients (
    mrn VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    ic_no TEXT NOT NULL,
    phone TEXT NOT NULL
);

-- Requests Table
CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    patient_mrn VARCHAR(50) NOT NULL,
    requester_type TEXT NOT NULL,
    requester_name TEXT,
    requester_phone TEXT,
    relationship TEXT,
    delivery_method TEXT NOT NULL,
    delivery_detail TEXT,
    delivery_email TEXT,
    remarks_category TEXT NOT NULL,
    department TEXT,
    status VARCHAR(50) DEFAULT 'APPLY',
    notes TEXT,
    username TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_mrn) REFERENCES patients(mrn)
);

-- Request Types (Link Table for multiple types per request)
CREATE TABLE IF NOT EXISTS request_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    completed_by TEXT,
    completed_at DATETIME,
    FOREIGN KEY (request_id) REFERENCES requests(id)
);

-- Monitoring Table
CREATE TABLE IF NOT EXISTS monitoring (
    request_id INTEGER PRIMARY KEY,
    doctor TEXT,
    secretary TEXT,
    cancellation_date TEXT,
    cancellation_by TEXT,
    pmr_trace_date TEXT,
    pmr_trace_by TEXT,
    pmr_trace_na BOOLEAN DEFAULT 0,
    send_doctor_date TEXT,
    send_doctor_by TEXT,
    completion_date TEXT,
    completion_by TEXT,
    notification_date TEXT,
    notification_by TEXT,
    handover_date TEXT,
    handover_by TEXT,
    FOREIGN KEY (request_id) REFERENCES requests(id)
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    username TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily Routine (Emails/Calls)
CREATE TABLE IF NOT EXISTS daily_routine (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'Email' or 'Call'
    topic TEXT NOT NULL,
    patient_mrn VARCHAR(50),
    staff_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Master Lists
CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    secretary TEXT,
    leave_start TEXT,
    leave_end TEXT
);

CREATE TABLE IF NOT EXISTS secretaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    leave_start TEXT,
    leave_end TEXT
);
