// --- CONFIGURATION & MOCK DATA ---
const MOCK_PATIENTS = [
    { mrn: '65135', name: 'TAN HOOI LI', ic: '850520145522', phone: '012-3456789' },
    { mrn: '123456', name: 'AHMAD BIN ABDULLAH', ic: '900101015566', phone: '013-9876543' },
    { mrn: '223344', name: 'SITI NURHALIZA', ic: '921212140088', phone: '011-22334455' },
    { mrn: '112233', name: 'RAJU KRISHNAN', ic: '880303105577', phone: '016-5544332' }
];

const ROUTINE_TOPICS = [
    { label: 'Medication', color: 'purple', class: 'topic-medication' },
    { label: 'New Request – New Submission', color: 'blue', class: 'topic-new-submission' },
    { label: 'New Request – Pending MRC Application / Payment / Insurance Form', color: 'orange', class: 'topic-pending-payment' },
    { label: 'New Request – Pending Completeness', color: 'yellow', class: 'topic-pending-completeness' },
    { label: 'Check Status – Application Status', color: 'green', class: 'topic-app-status' },
    { label: 'Check Status – Amendment', color: 'teal', class: 'topic-amendment' },
    { label: 'Copy Investigation Report', color: 'brown', class: 'topic-investigation' },
    { label: 'Check Patient – Not IJN Patient', color: 'red', class: 'topic-not-ijn' },
    { label: 'New Request – Create OP', color: 'pink', class: 'topic-create-op' },
    { label: 'Done Email – Ready to Collect', color: 'indigo', class: 'topic-ready-collect' },
    { label: 'Done Email – Ready to Post', color: 'cyan', class: 'topic-ready-post' }
];

const CALL_IN_TOPICS = [
    { label: 'Check Status', color: '#10b981', class: 'topic-call-status' },
    { label: 'Tanya Process', color: '#6366f1', class: 'topic-call-process' },
    { label: 'Others', color: '#64748b', class: 'topic-call-others' }
];

const CALL_OUT_TOPICS = [
    { label: 'Call success - akan datang collect', color: '#10b981', class: 'topic-call-success-collect' },
    { label: 'Call success - minta email/pos', color: '#06b6d4', class: 'topic-call-success-email' },
    { label: 'Call failed - ready to collect', color: '#f43f5e', class: 'topic-call-failed-ready' },
    { label: 'Call failed - done email', color: '#ec4899', class: 'topic-call-failed-done' },
    { label: 'Ready to collect', color: '#f59e0b', class: 'topic-call-ready' }
];

// --- APP STATE ---
let state = {
    view: 'dailyRoutine', // 'dailyRoutine' as default landing page
    user: JSON.parse(sessionStorage.getItem('MedReport_User')) || null,
    requests: [], // Will be loaded from server
    filters: {
        date: '',
        search: '',
        status: 'All',
        staff: 'All',
        meOnly: false,
        deliveryStart: '',
        deliveryEnd: '',
        deliveryMethod: 'All'
    },
    editingId: null, // ID of record being edited
    expandedId: null, // Added for monitoring row expansion
    formRequests: [''], // Temporary array for dynamic rows in form
    registrationForm: {
        source: 'Counter',
        patientMRN: '',
        patientIC: '',
        patientName: '',
        patientPhone: '',
        requesterType: 'Patient',
        requesterName: '',
        requesterPhone: '',
        relationship: '',
        deliveryMethod: 'Self Collect',
        deliveryDetail: '',
        deliveryEmail: '',
        remarksCategory: 'New Submission',
        notes: ''
    },
    // Master lists - Will be loaded from server
    doctors: [],
    secretaries: [],
    activeProcessStep: 'enquiry', // Default step for Process Flow view
    deletedRequests: [],
    historyFilters: {
        search: '',
        date: '',
        type: 'All'
    },
    statusTimeframe: 'Weekly', // 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'
    statusChartView: 'bar', // 'bar' | 'trend'
    dailyRoutine: { emails: [], calls: [], counterQueries: [], timeframe: 'Day' },
    workloadTab: 'emails', // 'emails' | 'counter'
    routineSearch: '',
    systemAuditLog: []
};

// --- API UTILITIES ---
async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`../backend/${endpoint}`, options);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    } catch (e) {
        console.error(`API Call failed (${endpoint}):`, e);
        // Fallback for missing endpoints to avoid breaking the UI completely during transition
        if (endpoint.includes('save_')) {
            console.warn(`Fallback: Mocking success for ${endpoint} because it might be missing.`);
            return { success: true };
        }
        showToast("Error communicating with server.", "error");
        return null; // Ensure callers handle null
    }
}

function handleRegInput(field, value) {
    state.registrationForm[field] = value;
    // Don't re-render here to avoid focus loss on typing
}

const PROCESS_INSTRUCTIONS = {
    enquiry: {
        title: "Enquiry Intake",
        meta: "Langkah pertama untuk merekod setiap permintaan laporan perubatan.",
        content: `
            <h4>1. Pendaftaran Baru</h4>
            <ul>
                <li>Klik butang <strong>"Registration"</strong> di sidebar.</li>
                <li>Pilih <strong>Registration Source</strong> (Counter, Email, atau Online).</li>
                <li>Masukkan <strong>Patient MRN</strong>. Sistem akan cuba mencari data pesakit secara automatik.</li>
                <li>Pastikan <strong>IC Number</strong> dan <strong>Phone Number</strong> adalah tepat.</li>
            </ul>
            <h4>2. Maklumat Permohonan</h4>
            <ul>
                <li>Pilih <strong>Type of Report</strong> (boleh pilih lebih daripada satu).</li>
                <li>Semak semua maklumat sebelum klik <strong>"SAVE REGISTRATION"</strong>.</li>
            </ul>
            <h4>3. Compliance</h4>
            <ul>
                <li>Setiap permohonan mestilah mempunyai MRN yang sah.</li>
                <li>Remarks tambahan boleh dimasukkan jika pemohon adalah pihak ketiga (e.g., Insurance/Lawyer).</li>
            </ul>
        `
    },
    check: {
        title: "Check Request",
        meta: "Mencari dan menyemak status permohonan sedia ada.",
        content: `
            <h4>1. Carian Rekod</h4>
            <ul>
                <li>Gunakan <strong>"Check Request"</strong> dashboard.</li>
                <li>Cari menggunakan <strong>MRN, Nama Pesakit, atau IC</strong>.</li>
                <li>Gunakan filter <strong>Status</strong> (e.g., Pending, Sent, Complete) untuk mengecilkan carian.</li>
            </ul>
            <h4>2. Semakan Status IJN</h4>
            <ul>
                <li>Pastikan status permohonan adalah terkini (sama ada masih di peringkat Enquiry atau telah dihantar ke Doktor).</li>
                <li>Gunakan filter <strong>Date Range</strong> untuk melihat permohonan bagi bulan tertentu.</li>
            </ul>
        `
    },
    tracker: {
        title: "Application Tracker",
        meta: "Pemantauan (Monitoring) progress penyediaan laporan oleh doktor.",
        content: `
            <h4>1. Kemaskini Monitoring</h4>
            <ul>
                <li>Klik pada rekod untuk kembangkan panel <strong>Monitoring</strong>.</li>
                <li>Masukkan <strong>Send to Doctor Date</strong> apabila fail dihantar kepada Secretary/Doktor.</li>
                <li>Sistem akan mengira <strong>Day Lapse</strong> secara automatik (Sasaran: 21 hari bekerja).</li>
            </ul>
            <h4>2. Status Workflow</h4>
            <ul>
                <li><strong>SENT</strong>: Fail telah dihantar kepada Doktor.</li>
                <li><strong>COMPLETE</strong>: Laporan telah siap ditandatangani oleh Doktor.</li>
                <li><strong>NOTIFY</strong>: Pesakit telah dimaklumkan untuk pungutan.</li>
                <li><strong>COLLECT</strong>: Laporan telah diserahkan kepada pemohon.</li>
            </ul>
        `
    },
    delivery: {
        title: "Delivery Listing",
        meta: "Menyediakan senarai penghantaran harian kepada Secretary.",
        content: `
            <h4>1. Penapisan (Filtering)</h4>
            <ul>
                <li>Pilih tarikh <strong>Date Sent</strong> di menu Delivery Listing.</li>
                <li>Sistem akan menyusun rekod mengikut <strong>Secretary Name</strong> secara automatik.</li>
            </ul>
            <h4>2. Pengesahan (Acknowledgment)</h4>
            <ul>
                <li>Gunakan butang <strong>"SAVE GROUP"</strong> selepas Secretary menerima dan menandatangani senarai penghantaran.</li>
                <li>Cetak listing menggunakan butang <strong>Print</strong> untuk salinan fizikal (Signature Audit).</li>
            </ul>
        `
    },
    audit: {
        title: "Audit Log",
        meta: "Menyemak jejak audit sistem untuk integriti data.",
        content: `
            <h4>1. Semakan Aktiviti</h4>
            <ul>
                <li>Setiap perubahan (Create, Edit, Delete, Save, Print) direkodkan dalam <strong>Audit Log</strong>.</li>
                <li>Rekod audit mengandungi: <strong>Username, Timestamp, Tindakan, dan Butiran Perubahan</strong>.</li>
            </ul>
            <h4>2. Integriti Data</h4>
            <ul>
                <li>Sebarang pemadaman rekod (Delete) akan meninggalkan kesan kekal dalam log audit pengurusan.</li>
                <li>Audit Log membantu dalam siasatan jika terdapat pertikaian status permohonan.</li>
            </ul>
        `
    }
};

function migrateMasterList(data, type) {
    const defaults = {
        doctors: [
            { name: 'Dr. Leong Ming Chern', secretary: '', leaveStart: '', leaveEnd: '' },
            { name: 'Dr. Omar Izmir Bin Ahmad', secretary: '', leaveStart: '', leaveEnd: '' },
            { name: 'Dr. Sharimila Shanmugam', secretary: '', leaveStart: '', leaveEnd: '' },
            { name: 'Dr. Nurul Nabila Mohd Raffie', secretary: '', leaveStart: '', leaveEnd: '' },
            { name: 'Dr. Fa\'iz Mashood', secretary: '', leaveStart: '', leaveEnd: '' },
            { name: 'Dato Dr. Mohd Nazeri Nordin', secretary: '', leaveStart: '', leaveEnd: '' }
        ],
        secretaries: [
            { name: 'Pn. Siti', leaveStart: '', leaveEnd: '' },
            { name: 'En. Ali', leaveStart: '', leaveEnd: '' },
            { name: 'Cik Maria', leaveStart: '', leaveEnd: '' },
            { name: 'Pn. Rohani', leaveStart: '', leaveEnd: '' }
        ]
    };

    if (!data || !Array.isArray(data)) return defaults[type];

    return data.map(item => {
        if (typeof item === 'string') {
            if (type === 'doctors') {
                return { name: item, secretary: '', leaveStart: '', leaveEnd: '' };
            } else {
                return { name: item, leaveStart: '', leaveEnd: '' };
            }
        }
        // Ensure all properties exist
        if (type === 'doctors') {
            return {
                name: item.name || '',
                secretary: item.secretary || '',
                leaveStart: item.leaveStart || '',
                leaveEnd: item.leaveEnd || ''
            };
        } else {
            return {
                name: item.name || '',
                leaveStart: item.leaveStart || '',
                leaveEnd: item.leaveEnd || ''
            };
        }
    });
}

function migrateData(data) {
    if (!data || !Array.isArray(data)) return [];

    const monitoringKeys = [
        'cancellationDate', 'pmrTraceDate', 'sendDoctorDate',
        'completionDate', 'notificationDate', 'handoverDate'
    ];

    return data.map(r => {
        // Modernize request types
        if (r.requestTypes && r.requestTypes.length > 0 && typeof r.requestTypes[0] === 'string') {
            r.requestTypes = r.requestTypes.map(type => ({
                type: type,
                completed: false,
                completedBy: null,
                completedAt: null
            }));
        }
        if (!r.requestTypes) r.requestTypes = [];

        // Backwards compatibility for single r.requestType string
        if (typeof r.requestType === 'string') {
            r.requestTypes = [{
                type: r.requestType,
                completed: false,
                completedBy: null,
                completedAt: null
            }];
            delete r.requestType;
        }

        // Basic fields
        if (!r.auditLog) r.auditLog = [];
        if (!r.history) r.history = [];
        if (!r.patientMRN) r.patientMRN = '';
        if (!r.patientName) r.patientName = 'Unknown Patient';
        if (!r.createdAt) r.createdAt = new Date().toISOString();

        // Monitoring Object
        if (!r.monitoring) r.monitoring = {};

        monitoringKeys.forEach(key => {
            if (!r.monitoring[key]) {
                r.monitoring[key] = { date: '', by: '' };
            }
            // Ensure sub-properties exist
            if (typeof r.monitoring[key] !== 'object') {
                r.monitoring[key] = { date: '', by: '' };
            }
            if (r.monitoring[key].date === undefined) r.monitoring[key].date = '';
            if (r.monitoring[key].by === undefined) r.monitoring[key].by = '';

            // Special case for PMR Trace Date NA
            if (key === 'pmrTraceDate' && r.monitoring[key].isNA === undefined) {
                r.monitoring[key].isNA = false;
            }
        });

        if (r.monitoring.doctor === undefined) r.monitoring.doctor = '';
        if (r.monitoring.secretary === undefined) r.monitoring.secretary = '';

        // Delivery Listing Fields
        if (r.location === undefined) r.location = '';
        if (r.contactPerson === undefined) r.contactPerson = '';

        // Standardize old statuses to new rules
        if (r.status === 'Pending') r.status = 'APPLY';
        if (r.status === 'In Progress') r.status = 'SENT';
        if (r.status === 'Completed') r.status = 'COMPLETE';
        if (r.status === 'Cancelled') r.status = 'CANCELLED';

        return r;
    });
}

// --- INITIALIZATION ---
async function init() {
    updateClock();
    setInterval(() => {
        updateClock();
        const dashboardClock = document.getElementById('dashboard-clock');
        if (dashboardClock) {
            dashboardClock.innerText = new Date().toLocaleString();
        }
    }, 1000);

    await loadInitialData();
    checkAuth();
    setupEventListeners();
}

async function loadInitialData() {
    showToast("Loading local data...", "info");

    // 1. Load Requests
    const requests = await apiCall('fetch_all.php');
    if (requests) {
        state.requests = migrateData(requests);
    } else {
        console.warn("Server unavailable. Loading requests from local storage fallback...");
        const localReqs = JSON.parse(localStorage.getItem('MedReport_Requests') || localStorage.getItem('MedReport_Applications') || '[]');
        localReqs.forEach((r, idx) => {
            if (typeof r.id === 'string' && r.id.length > 14) {
                r.id = Date.now() - 100000 + idx; // Safe precision auto-heal
            }
        });
        state.requests = migrateData(localReqs);
        localStorage.setItem('MedReport_Requests', JSON.stringify(state.requests));
    }

    // 2. Load Metadata (Doctors, Secretaries, Audit)
    const meta = await apiCall('fetch_meta.php');
    if (meta) {
        state.doctors = meta.doctors || migrateMasterList(null, 'doctors');
        state.secretaries = meta.secretaries || migrateMasterList(null, 'secretaries');
        state.systemAuditLog = meta.systemAuditLog || [];
        
        if (meta.dailyRoutine) {
            state.dailyRoutine = meta.dailyRoutine;
        } else {
            // fallback structure
            state.dailyRoutine = { emails: [], calls: [], counterQueries: [], timeframe: 'Day' };
        }
    }

    renderView();
}

function checkAuth() {
    const overlay = document.getElementById('login-overlay');
    const layout = document.getElementById('app-layout');

    if (state.user) {
        overlay.style.display = 'none';
        layout.style.display = 'flex';
        updateUserPill();
        renderView();
    } else {
        overlay.style.display = 'flex';
        layout.style.display = 'none';
    }
}

function handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById('login-id').value.trim();
    const pass = document.getElementById('login-password').value;

    if (!id || !pass) return showToast("Sila masukkan ID dan Password", "error");

    // Nice interface security logic
    if (pass !== "p@ssword123") {
        return showToast('Password salah. Sila gunakan "p@ssword123"', "error");
    }

    state.user = {
        id: id,
        name: id,
        dept: 'Med Management',
        initials: (id.substring(0, 2)).toUpperCase()
    };

    sessionStorage.setItem('MedReport_User', JSON.stringify(state.user));
    checkAuth();
    showToast(`Welcome back, ${id}!`, "success");
}

function logout() {
    sessionStorage.removeItem('MedReport_User');
    state.user = null;
    location.reload();
}

function updateUserPill() {
    if (!state.user) return;
    const initials = state.user.initials || 'AD';
    const name = state.user.name;
    const role = state.user.id; // Using ID as subtext for clarity

    const pill = document.querySelector('.user-pill');
    if (pill) {
        pill.innerHTML = `
            <div class="user-avatar">${initials}</div>
            <div class="user-status">
                <span class="name">${name}</span>
                <span class="role">${role}</span>
            </div>
            <button onclick="logout()" style="background:none; border:none; cursor:pointer; font-size: 1rem; margin-left: auto;" title="Logout">🚪</button>
        `;
    }
}

function isCurrentlyOnLeave(doctorName) {
    if (!doctorName) return false;
    const doctor = state.doctors.find(d => d.name === doctorName);
    if (!doctor || !doctor.leaveStart || !doctor.leaveEnd) return false;

    const today = new Date().toISOString().split('T')[0];
    return today >= doctor.leaveStart && today <= doctor.leaveEnd;
}

function updateClock() {
    const clock = document.querySelector('.live-clock');
    if (clock) {
        const now = new Date();
        clock.innerText = now.toLocaleTimeString();
    }
}

// --- DOCTOR WORKLOAD HELPERS ---
function getDoctorWorkload(doctorName) {
    if (!doctorName) return 0;
    const activeStatuses = ['APPLY', 'SENT', 'NOTIFY', 'Processing', 'In Progress', 'Pending'];
    return state.requests.filter(r =>
        r.monitoring.doctor === doctorName &&
        activeStatuses.includes(r.status)
    ).length;
}

function getWorkloadStatus(count) {
    if (count > 15) return { label: 'High', color: 'var(--danger)', class: 'workload-high' };
    if (count > 10) return { label: 'Moderate', color: 'var(--warning)', class: 'workload-mod' };
    return { label: 'Normal', color: 'var(--success)', class: 'workload-normal' };
}

// --- VIEW RENDERING ---
function renderView() {
    const contentArea = document.getElementById('content-area');
    const viewTitle = document.getElementById('view-title');
    const viewDesc = document.getElementById('view-desc');

    if (state.view === 'registration') {
        viewTitle.innerText = "REGISTRATION";
        viewDesc.innerText = "Register and manage medical report requests.";
        contentArea.innerHTML = renderRegistrationView();
    } else if (state.view === 'history') {
        viewTitle.innerText = "CHECK REQUEST";
        viewDesc.innerText = "Advanced search and status management dashboard.";
        contentArea.innerHTML = renderHistoryView();
    } else if (state.view === 'settings') {
        viewTitle.innerText = "SETTINGS";
        viewDesc.innerText = "Manage master lists and system configuration.";
        contentArea.innerHTML = renderSettingsView();
    } else if (state.view === 'analytics') {
        viewTitle.innerText = "ANALYTICS DASHBOARD";
        viewDesc.innerText = "Real-time statistics and staff workload breakdown.";
        contentArea.innerHTML = renderAnalyticsPage();
    } else if (state.view === 'delivery') {
        viewTitle.innerText = "DELIVERY LISTING";
        viewDesc.innerText = "Generate and print delivery reports grouped by doctor.";
        contentArea.innerHTML = renderDeliveryListingView();
    } else if (state.view === 'mailingList') {
        viewTitle.innerText = "MAILING LIST";
        viewDesc.innerText = "View applications requesting Post or Email + Post delivery.";
        contentArea.innerHTML = renderMailingListView();
    } else if (state.view === 'uploadLegacy') {
        viewTitle.innerText = "IMPORT LEGACY EXCEL";
        viewDesc.innerText = "Bulk upload requests from the main system (.xls format).";
        contentArea.innerHTML = renderUploadLegacyView();
    } else if (state.view === 'processFlow') {
        viewTitle.innerText = "PROCESS FLOW";
        viewDesc.innerText = "Visual workflow for the medical report lifecycle.";
        contentArea.innerHTML = renderProcessFlowView();
    } else if (state.view === 'instructions') {
        viewTitle.innerText = "WORKING INSTRUCTIONS";
        viewDesc.innerText = "Step-by-step guidance for registry tasks.";
        contentArea.innerHTML = renderInstructionsView();
    } else if (state.view === 'globalHistory') {
        viewTitle.innerText = "GLOBAL HISTORY LOG";
        viewDesc.innerText = "Audit-friendly timeline of all system actions (including deleted records).";
        contentArea.innerHTML = renderGlobalHistoryLogView();
    } else if (state.view === 'doctorWorkload') {
        viewTitle.innerText = "DOCTOR WORKLOAD MONITOR";
        viewDesc.innerText = "Real-time distribution of active applications per doctor.";
        contentArea.innerHTML = renderDoctorWorkloadView();
    } else if (state.view === 'statusDistribution') {
        viewTitle.innerText = "STATUS DISTRIBUTION HUB";
        viewDesc.innerText = "Dynamic status aggregation and trend analysis.";
        contentArea.innerHTML = renderStatusDistributionHub();
    } else if (state.view === 'dailyRoutine') {
        viewTitle.innerText = "DAILY ROUTINE DASHBOARD";
        viewDesc.innerText = "Consolidated workload for Emails and Caller Queries.";
        contentArea.innerHTML = renderDailyRoutineView();
    } else if (state.view === 'workloadEntry') {
        viewTitle.innerText = "WORKLOAD DATA ENTRY";
        viewDesc.innerText = "Record new email and call queries for tracking.";
        contentArea.innerHTML = renderWorkloadEntryView();
    }
}

function renderMailingListView() {
    // Filter requests matching Post or Email + Post, and exclude CANCELLED and COLLECT
    const mailingRequests = state.requests.filter(r => 
        r.deliveryMethod && r.deliveryMethod.includes('Post') && r.status !== 'CANCELLED' && r.status !== 'COLLECT'
    );
    
    return `
        <div class="panel-card fade-in" style="padding: 24px;">
            <div class="panel-title" style="display: flex; justify-content: space-between; align-items: center;">
                <div><span>📮</span> Mailing List Applications</div>
                <button class="btn btn-primary" onclick="printSelectedStickers()">🖨️ Print Selected</button>
            </div>
            <p style="color: #64748b; margin-bottom: 24px;">This list shows all active applications where the patient requested to receive their medical report via Post.</p>
            <div class="data-table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">
                                <input type="checkbox" id="selectAllMailing" onclick="toggleAllMailingCheckboxes(this)">
                            </th>
                            <th>MRN</th>
                            <th>Patient Name</th>
                            <th>Phone</th>
                            <th>Mailing Address</th>
                            <th>Status</th>
                            <th>Delivery Method</th>
                            <th>Submission Date</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${mailingRequests.length > 0 ? mailingRequests.map(r => `
                            <tr>
                                <td style="text-align: center;">
                                    <input type="checkbox" class="mailing-checkbox" value="${r.id}">
                                </td>
                                <td><strong>${r.patientMRN || '-'}</strong></td>
                                <td>${r.patientName || '-'}</td>
                                <td>${r.patientPhone || '-'}</td>
                                <td>
                                    <div style="max-width: 250px; white-space: normal; line-height: 1.4;">
                                        ${r.deliveryDetail ? r.deliveryDetail : '<span style="color:#ef4444; font-size: 0.8rem;">No address specified!</span>'}
                                    </div>
                                </td>
                                <td><span class="status-badge status-${(r.status || 'APPLY').toLowerCase()}">${r.status || 'APPLY'}</span></td>
                                <td>${r.deliveryMethod}</td>
                                <td>${new Date(r.createdAt).toLocaleDateString()}</td>
                                <td>
                                    <div style="display: flex; gap: 8px;">
                                        <button class="btn-ghost" onclick="state.editingId='${r.id}'; switchView('registration')" style="padding: 6px 12px; font-size: 0.8rem;">View</button>
                                        <button class="btn-primary" onclick="printSticker('${r.patientName.replace(/'/g, "\\'")}', '${r.patientMRN}', '${r.patientPhone || ''}', \`${(r.deliveryDetail || '').replace(/`/g, '\\`')}\`)" style="padding: 6px 12px; font-size: 0.8rem;">🖨️ Print</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('') : `
                            <tr><td colspan="9" style="text-align: center; color: #64748b; padding: 32px;">No mailing applications found.</td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function printSticker(name, mrn, phone, address) {
    if (!address || address.trim() === '') {
        showToast("No mailing address provided!", "error");
        return;
    }
    
    // Format address by replacing newlines with <br> if needed
    const formattedAddress = address.replace(/\n/g, '<br>');
    
    const stickerHtml = `
        <style>
            @media print {
                @page { size: 8cm 3cm; margin: 0; }
                html, body { 
                    margin: 0 !important; 
                    padding: 0 !important; 
                    width: 8cm !important;
                    height: 3cm !important; 
                    overflow: hidden !important; 
                }
                #print-report-container {
                    padding: 0.1cm !important; /* Overrides the global 40px padding */
                    margin: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    box-sizing: border-box;
                }
            }
        </style>
        <div class="sticker-print-template">
            <div class="sticker-recipient">${name}</div>
            <div class="sticker-mrn">MRN: ${mrn}</div>
            <div class="sticker-address">${formattedAddress}</div>
        </div>
    `;
    
    const container = document.getElementById('print-report-container');
    container.innerHTML = stickerHtml;
    
    // Slight delay to ensure DOM updates before triggering print dialog
    setTimeout(() => {
        window.print();
        // Clear after printing to prevent artifact bleeding into regular report prints
        setTimeout(() => { container.innerHTML = ''; }, 1000);
    }, 150);
}

function toggleAllMailingCheckboxes(source) {
    document.querySelectorAll('.mailing-checkbox').forEach(cb => {
        cb.checked = source.checked;
    });
}

function printSelectedStickers() {
    const checkedBoxes = Array.from(document.querySelectorAll('.mailing-checkbox:checked'));
    if (checkedBoxes.length === 0) {
        return showToast("Please select at least one record to print.", "warning");
    }

    let allStickersHtml = `
        <style>
            @media print {
                @page { size: 8cm 3cm; margin: 0; }
                html, body { 
                    margin: 0 !important; 
                    padding: 0 !important; 
                    width: 8cm !important;
                    height: 3cm !important; 
                    overflow: hidden !important; 
                }
                #print-report-container {
                    padding: 0.1cm !important;
                    margin: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    box-sizing: border-box;
                }
                .sticker-print-template {
                    page-break-after: always;
                }
                .sticker-print-template:last-child {
                    page-break-after: auto;
                }
            }
        </style>
    `;

    let printedCount = 0;

    checkedBoxes.forEach(cb => {
        const id = parseInt(cb.value);
        const r = state.requests.find(req => req.id === id);
        if (!r) return;
        
        const address = r.deliveryDetail;
        if (!address || address.trim() === '') {
            showToast(`Skipping ${r.patientName} (No Address)`, "warning");
            return;
        }

        const formattedAddress = address.replace(/\n/g, '<br>');
        allStickersHtml += `
            <div class="sticker-print-template">
                <div class="sticker-recipient">${r.patientName}</div>
                <div class="sticker-mrn">MRN: ${r.patientMRN}</div>
                <div class="sticker-address">${formattedAddress}</div>
            </div>
        `;
        printedCount++;
    });

    if (printedCount === 0) return;

    const container = document.getElementById('print-report-container');
    container.innerHTML = allStickersHtml;

    setTimeout(() => {
        window.print();
        setTimeout(() => { container.innerHTML = ''; }, 1000);
    }, 150);
}

let uploadedLegacyData = [];

function renderUploadLegacyView() {
    return `
        <div class="card" style="padding: 24px;">
            <h3 style="margin-bottom: 16px; color: #1e293b;">Import Legacy Data (.xls)</h3>
            <p style="color: #64748b; margin-bottom: 24px; font-size: 0.9rem;">
                Upload the Excel 97-2003 (.xls) export from your main system. The file should strictly contain the headers:<br>
                <strong>Date, MRN, Name, Status, Type, Send Doctor, Complete Doctor, Date Sent, Date Completed, 1st Notification Date, Date Collected, App Note</strong>
            </p>
            
            <div style="border: 2px dashed #cbd5e1; border-radius: 12px; padding: 40px; text-align: center; background: #f8fafc; margin-bottom: 24px; cursor: pointer;" onclick="document.getElementById('legacy-file-input').click()">
                <div style="font-size: 2.5rem; margin-bottom: 16px;">📁</div>
                <h4 style="margin-bottom: 8px; color: #0f172a;">Click to browse or Drag your .xls file here</h4>
                <p style="color: #64748b; font-size: 0.85rem;">Must be an Excel or CSV file</p>
                <input type="file" id="legacy-file-input" accept=".xls,.xlsx,.csv" style="display: none;" onchange="handleLegacyFileUpload(event)">
            </div>

            <div id="upload-preview-container" style="display: none;">
                <h4 style="margin-bottom: 12px; color: #0f172a;">Data Preview (First 5 Rows)</h4>
                <div class="table-responsive" style="margin-bottom: 24px; max-height: 250px; overflow-y: auto;">
                    <table class="data-table" style="font-size: 0.8rem;">
                        <thead id="preview-thead"></thead>
                        <tbody id="preview-tbody"></tbody>
                    </table>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn btn-ghost" onclick="resetLegacyUpload()">Cancel</button>
                    <button class="btn btn-primary" onclick="confirmLegacyUpload()" id="btn-confirm-upload">🚀 Confirm & Import</button>
                </div>
            </div>
        </div>
    `;
}

function handleLegacyFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert rows to JSON
        // Using defval: "" guarantees we map every column row even if it's empty
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        if (rawJson.length === 0) {
            showToast("The uploaded file is empty or invalid.", "error");
            return;
        }

        uploadedLegacyData = rawJson;
        
        const container = document.getElementById('upload-preview-container');
        const thead = document.getElementById('preview-thead');
        const tbody = document.getElementById('preview-tbody');
        
        container.style.display = 'block';
        
        const headers = Object.keys(rawJson[0]);
        thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
        
        tbody.innerHTML = rawJson.slice(0, 5).map(row => {
            return '<tr>' + headers.map(h => `<td>${row[h] || '-'}</td>`).join('') + '</tr>';
        }).join('');
        
        showToast(`Parsed ${rawJson.length} rows successfully. Please review before confirming.`, "success");
    };
    reader.readAsArrayBuffer(file);
}

function resetLegacyUpload() {
    document.getElementById('legacy-file-input').value = "";
    document.getElementById('upload-preview-container').style.display = 'none';
    uploadedLegacyData = [];
}

async function confirmLegacyUpload() {
    if (uploadedLegacyData.length === 0) return;
    
    const btn = document.getElementById('btn-confirm-upload');
    btn.innerText = "Importing, please wait...";
    btn.disabled = true;

    try {
        let res = await apiCall('upload_legacy.php', 'POST', { data: uploadedLegacyData });
        
        // --- LOCAL STORAGE MOCK FALLBACK FOR file:/// OR 404 ---
        if (!res) {
            console.warn("Server unavailable. Firing local storage importer fallback...");
            
            const parseDateString = (dStr) => {
                if (!dStr) return '';
                let s = dStr.toString().trim();
                if (s.includes('/')) {
                    const parts = s.split(/[/\s]/); // handle DD/MM/YYYY
                    if (parts.length >= 3) {
                        let y = parts[2];
                        if (y.length === 2) y = '20' + y;
                        return `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T12:00:00.000Z`;
                    }
                }
                return s;
            };

            uploadedLegacyData.forEach((row, index) => {
                const rowUpper = Object.keys(row).reduce((acc, key) => {
                    acc[key.toUpperCase()] = row[key];
                    return acc;
                }, {});
                
                const mrn = (rowUpper['MRN'] || '').toString().trim();
                if (!mrn) return; // skip missing MRN
                
                const newReq = {
                    id: Date.now() + index,
                    status: rowUpper['STATUS'] || 'APPLY',
                    username: 'System Upload',
                    source: 'Legacy Excel',
                    createdAt: parseDateString(rowUpper['DATE']) || new Date().toISOString(),
                    patientMRN: mrn,
                    patientIC: 'N/A',
                    patientName: rowUpper['NAME'] || 'UNKNOWN',
                    patientPhone: 'N/A',
                    requesterType: 'Patient',
                    deliveryMethod: 'Self Collect',
                    remarksCategory: rowUpper['TYPE'] || 'Others',
                    notes: rowUpper['APP NOTE'] || '',
                    requestTypes: [{ type: rowUpper['TYPE'] || 'Others', completed: false }],
                    monitoring: {
                        cancellationDate: { date: '', by: '' },
                        sendDoctorDate: { date: parseDateString(rowUpper['DATE SENT']), by: '' },
                        completionDate: { date: parseDateString(rowUpper['DATE COMPLETED']), by: rowUpper['COMPLETE DOCTOR'] || '' },
                        notificationDate: { date: parseDateString(rowUpper['1ST NOTIFICATION DATE']), by: '' },
                        handoverDate: { date: parseDateString(rowUpper['DATE COLLECTED']), by: '' },
                        pmr: false,
                        iclic: false,
                        doctor: rowUpper['SEND DOCTOR'] || '',
                        secretary: ''
                    },
                    auditLog: [{
                        timestamp: new Date().toISOString(),
                        user: 'System',
                        action: 'Legacy Data Upload',
                        detail: 'System auto-imported record from Excel mapping'
                    }]
                };
                
                state.requests.unshift(newReq);
            });
            
            // Persist locally mimicking the database
            localStorage.setItem('MedReport_Requests', JSON.stringify(state.requests));
            res = { success: true, imported_count: uploadedLegacyData.length };
        }

        if (res.success) {
            showToast(`Successfully imported ${res.imported_count || uploadedLegacyData.length} records!`, "success");
            resetLegacyUpload();
            // Refresh UI
            if (typeof renderView === 'function') renderView();
            switchView('history');
        } else {
            showToast(res.message || "Failed to import records.", "error");
        }
    } catch (e) {
        showToast("System error during upload.", "error");
        console.error(e);
    } finally {
        btn.innerText = "🚀 Confirm & Import";
        btn.disabled = false;
    }
}

function switchView(viewName) {
    state.view = viewName;
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    renderView();
}

function renderRegistrationView() {
    const isEditing = !!state.editingId;
    const currentRecord = isEditing ? state.requests.find(r => r.id === state.editingId) : null;
    const isCompleted = currentRecord && currentRecord.status === 'COMPLETE';

    return `
        <div class="panel-card fade-in">
            ${isEditing ? `
                <div class="edit-mode-indicator">
                    <div class="edit-mode-label"><span>✏️</span> Editing Submission #${state.editingId}</div>
                    <button class="btn-ghost" style="padding: 6px 12px; font-size: 0.8rem;" onclick="cancelEdit()">Cancel Edit</button>
                </div>
            ` : ''}
            <div class="panel-title"><span>📝</span> ${isEditing ? 'Update Registration' : 'Registration Form'}</div>
            <form id="reg-form" onsubmit="handleFormSubmit(event)">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Registration Source *</label>
                        <select id="reg-source" class="f-input ${isCompleted ? 'disabled-field' : ''}" required ${isCompleted ? 'disabled' : ''}
                                onchange="handleRegInput('source', this.value)">
                            <option value="Counter" ${state.registrationForm.source === 'Counter' ? 'selected' : ''}>🏢 Counter</option>
                            <option value="Email" ${state.registrationForm.source === 'Email' ? 'selected' : ''}>📧 Email</option>
                            <option value="Online" ${state.registrationForm.source === 'Online' ? 'selected' : ''}>🌐 Online</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Patient MRN *</label>
                        <input type="text" id="p-mrn" class="f-input ${isCompleted ? 'disabled-field' : ''}" 
                               placeholder="6-digit MRN" maxlength="6" required ${isCompleted ? 'readonly' : ''}
                               value="${state.registrationForm.patientMRN}"
                               oninput="this.value = this.value.replace(/[^0-9]/g, ''); handleRegInput('patientMRN', this.value); handleMRNLookup(this.value)">
                    </div>
                    <div class="form-group">
                        <label>Patient IC No. *</label>
                        <input type="text" id="p-ic" class="f-input ${isCompleted ? 'disabled-field' : ''}" 
                               placeholder="IC Number" required ${isCompleted ? 'readonly' : ''}
                               value="${state.registrationForm.patientIC}"
                               oninput="handleRegInput('patientIC', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Patient Name *</label>
                        <input type="text" id="p-name" class="f-input ${isCompleted ? 'disabled-field' : ''}" 
                               placeholder="Patient Name" required ${isCompleted ? 'readonly' : ''}
                               value="${state.registrationForm.patientName}"
                               oninput="handleRegInput('patientName', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Patient Phone Number *</label>
                        <input type="text" id="p-phone" class="f-input ${isCompleted ? 'disabled-field' : ''}" 
                               placeholder="e.g. 0123456789" required ${isCompleted ? 'readonly' : ''}
                               value="${state.registrationForm.patientPhone}"
                               oninput="handleRegInput('patientPhone', this.value)">
                    </div>

                    <div class="form-group">
                        <label>Requester Type *</label>
                        <select id="r-type" class="f-input ${isCompleted ? 'disabled-field' : ''}" required ${isCompleted ? 'disabled' : ''} 
                                onchange="handleRegInput('requesterType', this.value); toggleRequesterField()">
                            <option value="Patient" ${state.registrationForm.requesterType === 'Patient' ? 'selected' : ''}>Patient (Self)</option>
                            <option value="Next of Kin" ${state.registrationForm.requesterType === 'Next of Kin' ? 'selected' : ''}>Next of Kin</option>
                            <option value="Agent" ${state.registrationForm.requesterType === 'Agent' ? 'selected' : ''}>Agent</option>
                            <option value="External Doctor" ${state.registrationForm.requesterType === 'External Doctor' ? 'selected' : ''}>External Doctor</option>
                            <option value="Legal Representative" ${state.registrationForm.requesterType === 'Legal Representative' ? 'selected' : ''}>Legal Representative</option>
                            <option value="Insurance" ${state.registrationForm.requesterType === 'Insurance' ? 'selected' : ''}>Insurance</option>
                            <option value="Other" ${state.registrationForm.requesterType === 'Other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                    
                    <div id="requester-info" class="span-2" style="display: ${state.registrationForm.requesterType !== 'Patient' ? 'block' : 'none'};">
                        <div class="form-grid" style="margin-top: 0;">
                            <div class="form-group">
                                <label>Requester Name *</label>
                                <input type="text" id="r-name" class="f-input ${isCompleted ? 'disabled-field' : ''}" placeholder="Full Name" ${isCompleted ? 'readonly' : ''} 
                                       value="${state.registrationForm.requesterName}"
                                       oninput="handleRegInput('requesterName', this.value)">
                            </div>
                            <div class="form-group">
                                <label>Requester Phone *</label>
                                <input type="text" id="r-phone" class="f-input ${isCompleted ? 'disabled-field' : ''}" placeholder="Phone Number" ${isCompleted ? 'readonly' : ''} 
                                       value="${state.registrationForm.requesterPhone}"
                                       oninput="handleRegInput('requesterPhone', this.value)">
                            </div>
                            <div class="form-group" id="nok-rel-group" style="display: ${state.registrationForm.requesterType === 'Next of Kin' ? 'block' : 'none'};">
                                <label>Relationship to Patient *</label>
                                <select id="r-rel" class="f-input ${isCompleted ? 'disabled-field' : ''}" ${isCompleted ? 'disabled' : ''}
                                        onchange="handleRegInput('relationship', this.value)">
                                    <option value="" disabled ${!state.registrationForm.relationship ? 'selected' : ''}>Select Relationship</option>
                                    <option value="Father" ${state.registrationForm.relationship === 'Father' ? 'selected' : ''}>Father</option>
                                    <option value="Mother" ${state.registrationForm.relationship === 'Mother' ? 'selected' : ''}>Mother</option>
                                    <option value="Spouse" ${state.registrationForm.relationship === 'Spouse' ? 'selected' : ''}>Spouse</option>
                                    <option value="Son in Law" ${state.registrationForm.relationship === 'Son in Law' ? 'selected' : ''}>Son in Law</option>
                                    <option value="Daughter in Law" ${state.registrationForm.relationship === 'Daughter in Law' ? 'selected' : ''}>Daughter in Law</option>
                                    <option value="Guardian" ${state.registrationForm.relationship === 'Guardian' ? 'selected' : ''}>Guardian</option>
                                    <option value="Grandparent" ${state.registrationForm.relationship === 'Grandparent' ? 'selected' : ''}>Grandparent</option>
                                    <option value="Aunty" ${state.registrationForm.relationship === 'Aunty' ? 'selected' : ''}>Aunty</option>
                                    <option value="Uncle" ${state.registrationForm.relationship === 'Uncle' ? 'selected' : ''}>Uncle</option>
                                    <option value="Brother" ${state.registrationForm.relationship === 'Brother' ? 'selected' : ''}>Brother</option>
                                    <option value="Sister" ${state.registrationForm.relationship === 'Sister' ? 'selected' : ''}>Sister</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="section-divider">Request Details</div>

                    <div class="form-group full-width">
                        <label>Request Type(s) *</label>
                        <div id="requests-rows" class="requests-container">
                            ${state.formRequests.map((req, idx) => `
                                <div class="request-row">
                                    <select class="f-input request-item-select ${isCompleted ? 'disabled-field' : ''}" required ${isCompleted ? 'disabled' : ''} onchange="updateFormRequest(${idx}, this.value)">
                                        <option value="" disabled ${!req ? 'selected' : ''}>Select Category</option>
                                        <optgroup label="🏥 Medical Report">
                                            <option value="Medical Report – Consultant" ${req === 'Medical Report – Consultant' ? 'selected' : ''}>Medical Report – Consultant</option>
                                            <option value="Medical Report – Clinical Specialist" ${req === 'Medical Report – Clinical Specialist' ? 'selected' : ''}>Medical Report – Clinical Specialist</option>
                                            <option value="Medical Report – Medical Officer" ${req === 'Medical Report – Medical Officer' ? 'selected' : ''}>Medical Report – Medical Officer</option>
                                            <option value="Medical Report – Legal" ${req === 'Medical Report – Legal' ? 'selected' : ''}>Medical Report – Legal</option>
                                            <option value="Medical Records" ${req === 'Medical Records' ? 'selected' : ''}>Medical Records</option>
                                        </optgroup>
                                        <optgroup label="📋 Claim Form">
                                            <option value="Attending Physician Statement - Consultant" ${req === 'Attending Physician Statement - Consultant' ? 'selected' : ''}>Attending Physician Statement - Consultant</option>
                                            <option value="Attending Physician Statement - Clinical Specialist" ${req === 'Attending Physician Statement - Clinical Specialist' ? 'selected' : ''}>Attending Physician Statement - Clinical Specialist</option>
                                            <option value="Claim form - Consultant" ${req === 'Claim form - Consultant' ? 'selected' : ''}>Claim form - Consultant</option>
                                            <option value="Claim form - Clinical Specialist" ${req === 'Claim form - Clinical Specialist' ? 'selected' : ''}>Claim form - Clinical Specialist</option>
                                            <option value="Perkeso Pencen Ilat" ${req === 'Perkeso Pencen Ilat' ? 'selected' : ''}>Perkeso Pencen Ilat</option>
                                            <option value="KWSP Health Withdrawal" ${req === 'KWSP Health Withdrawal' ? 'selected' : ''}>KWSP Health Withdrawal</option>
                                            <option value="KWSP Incapacitation" ${req === 'KWSP Incapacitation' ? 'selected' : ''}>KWSP Incapacitation</option>
                                        </optgroup>
                                        <optgroup label="✉️ Letter / Communication">
                                            <option value="Patient Confirmation Letter" ${req === 'Patient Confirmation Letter' ? 'selected' : ''}>Patient Confirmation Letter</option>
                                            <option value="Referral Letter" ${req === 'Referral Letter' ? 'selected' : ''}>Referral Letter</option>
                                            <option value="Reply Letter" ${req === 'Reply Letter' ? 'selected' : ''}>Reply Letter</option>
                                            <option value="Reply call - External Hospital/Doctor" ${req === 'Reply call - External Hospital/Doctor' ? 'selected' : ''}>Reply call - External Hospital/Doctor</option>
                                        </optgroup>
                                        <optgroup label="🕋 Religious/Welfare">
                                            <option value="Zakat/Baitulmal/Kebajikan" ${req === 'Zakat/Baitulmal/Kebajikan' ? 'selected' : ''}>Zakat/Baitulmal/Kebajikan</option>
                                            <option value="Haji" ${req === 'Haji' ? 'selected' : ''}>Haji</option>
                                        </optgroup>
                                        <optgroup label="🏛️ Government Forms">
                                            <option value="Borang JPA 1/09" ${req === 'Borang JPA 1/09' ? 'selected' : ''}>Borang JPA 1/09</option>
                                        </optgroup>
                                    </select>
                                    ${state.formRequests.length > 1 && !isCompleted ? `
                                        <button type="button" class="btn-remove-row" onclick="removeRequestRow(${idx})">&times;</button>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                        ${!isCompleted ? `
                            <button type="button" class="btn-add-row" onclick="addRequestRow()">
                                <span>➕</span> Add Another Request
                            </button>
                        ` : ''}
                    </div>

                    <div class="form-group">
                        <label>Delivery Method *</label>
                        <select id="d-method" class="f-input ${isCompleted ? 'disabled-field' : ''}" required ${isCompleted ? 'disabled' : ''} 
                                onchange="handleRegInput('deliveryMethod', this.value); toggleDeliveryField()">
                            <option value="">Select Delivery Method</option>
                            <option value="Self Collect" ${(isEditing ? currentRecord?.deliveryMethod : state.registrationForm.deliveryMethod) === 'Self Collect' ? 'selected' : ''}>Self Collect</option>
                            <option value="Post" ${(isEditing ? currentRecord?.deliveryMethod : state.registrationForm.deliveryMethod) === 'Post' ? 'selected' : ''}>Post (Courier)</option>
                            <option value="Email" ${(isEditing ? currentRecord?.deliveryMethod : state.registrationForm.deliveryMethod) === 'Email' ? 'selected' : ''}>Email</option>
                            <option value="Email + Collect" ${(isEditing ? currentRecord?.deliveryMethod : state.registrationForm.deliveryMethod) === 'Email + Collect' ? 'selected' : ''}>Email + Collect</option>
                            <option value="Email + Post" ${(isEditing ? currentRecord?.deliveryMethod : state.registrationForm.deliveryMethod) === 'Email + Post' ? 'selected' : ''}>Email + Post</option>
                        </select>
                    </div>

                    <div class="form-group" id="post-detail-group" style="display: ${(isEditing ? currentRecord?.deliveryMethod : state.registrationForm.deliveryMethod)?.includes('Post') ? 'block' : 'none'};">
                        <label>Mailing Address *</label>
                        <input type="text" id="d-detail" class="f-input ${isCompleted ? 'disabled-field' : ''}" placeholder="Full postal address" ${isCompleted ? 'readonly' : ''} 
                               value="${isEditing ? (currentRecord?.deliveryDetail || '') : state.registrationForm.deliveryDetail}"
                               oninput="handleRegInput('deliveryDetail', this.value)">
                    </div>

                    <div class="form-group" id="email-detail-group" style="display: ${(isEditing ? currentRecord?.deliveryMethod : state.registrationForm.deliveryMethod)?.includes('Email') ? 'block' : 'none'};">
                        <label>Email Address *</label>
                        <input type="text" id="d-email" class="f-input ${isCompleted ? 'disabled-field' : ''}" placeholder="patient@example.com" ${isCompleted ? 'readonly' : ''} 
                               value="${isEditing ? (currentRecord?.deliveryEmail || '') : state.registrationForm.deliveryEmail}"
                               oninput="handleRegInput('deliveryEmail', this.value)">
                    </div>

                    <div class="form-group span-2">
                        <label>Remarks Category *</label>
                        <select id="remarks-cat" class="f-input ${isCompleted ? 'disabled-field' : ''}" required ${isCompleted ? 'disabled' : ''}
                                onchange="handleRegInput('remarksCategory', this.value)">
                            <option value="New Submission" ${(isEditing ? currentRecord?.remarksCategory : state.registrationForm.remarksCategory) === 'New Submission' ? 'selected' : ''}>New Submission</option>
                            <option value="Amendment" ${(isEditing ? currentRecord?.remarksCategory : state.registrationForm.remarksCategory) === 'Amendment' ? 'selected' : ''}>Amendment</option>
                        </select>
                    </div>


                    ${isEditing ? `
                        <div class="form-group">
                            <label>Status *</label>
                            <select id="r-status" class="f-input ${isCompleted ? 'disabled-field' : ''}" required ${isCompleted ? 'disabled' : ''}>
                                <option value="APPLY" ${currentRecord.status === 'APPLY' ? 'selected' : ''}>⏳ APPLY</option>
                                <option value="SENT" ${currentRecord.status === 'SENT' ? 'selected' : ''}>📤 SENT</option>
                                <option value="NOTIFY" ${currentRecord.status === 'NOTIFY' ? 'selected' : ''}>🔔 NOTIFY</option>
                                <option value="COLLECT" ${currentRecord.status === 'COLLECT' ? 'selected' : ''}>📦 COLLECT</option>
                                <option value="COMPLETE" ${currentRecord.status === 'COMPLETE' ? 'selected' : ''}>✅ COMPLETE</option>
                                <option value="CANCELLED" ${currentRecord.status === 'CANCELLED' ? 'selected' : ''}>❌ CANCELLED</option>
                            </select>
                        </div>
                    ` : ''}
                    
                    <div class="form-group full-width">
                        <label>Additional Notes</label>
                        <textarea id="notes" class="f-input" style="min-height: 80px;" placeholder="Optional additional context..."
                                  oninput="handleRegInput('notes', this.value)">${isEditing ? (currentRecord?.notes || '') : state.registrationForm.notes}</textarea>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <span>💾</span> ${isEditing ? 'UPDATE RECORD' : 'SAVE REGISTRATION'}
                    </button>
                    <button type="button" class="btn btn-ghost" onclick="${isEditing ? 'cancelEdit()' : 'resetForm()'}">
                        ${isEditing ? 'CANCEL' : 'RESET FORM'}
                    </button>
                </div>
            </form>
        </div>

        <!-- Integrated Table below form for quick view -->
        <div class="panel-card" style="margin-top: 32px; padding: 24px;">
            <div class="table-header-row">
                <div class="panel-title" style="margin-bottom: 0;"><span>🏢</span> Recent Registrations</div>
                <button class="btn btn-ghost" style="padding: 8px 16px; font-size: 0.8rem;" onclick="switchView('history')">View All Records</button>
            </div>
            <div class="data-table-wrapper">
                ${renderTable(state.requests.slice(0, 5))}
            </div>
        </div>
    `;
}

function renderHistoryView() {
    const filtered = filterData();
    const staffList = [...new Set(state.requests.map(r => r.username))].sort();

    return `
        <div class="panel-card fade-in" style="padding: 24px;">
            <div class="panel-title"><span>🔍</span> SEARCH REQUEST</div>
            <div class="search-panel-grid">
                <div class="form-group">
                    <label>Search by MRN</label>
                    <input type="text" class="f-input" id="search-mrn" placeholder="6-digit MRN" value="${state.filters.search}" oninput="state.filters.search = this.value">
                </div>
                <div class="form-group">
                    <label>Search by Date</label>
                    <input type="date" class="f-input" id="search-date" value="${state.filters.date}" onchange="state.filters.date = this.value">
                </div>
                <div class="form-group">
                    <label>Search by User</label>
                    <select class="f-input" id="search-staff" onchange="state.filters.staff = this.value">
                        <option value="All">All Staff</option>
                        ${staffList.map(name => `<option value="${name}" ${state.filters.staff === name ? 'selected' : ''}>${name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Search by Status</label>
                    <select class="f-input" id="search-status" onchange="state.filters.status = this.value">
                        <option value="All" ${state.filters.status === 'All' ? 'selected' : ''}>All Status</option>
                        <option value="APPLY" ${state.filters.status === 'APPLY' ? 'selected' : ''}>⏳ APPLY</option>
                        <option value="SENT" ${state.filters.status === 'SENT' ? 'selected' : ''}>📤 SENT</option>
                        <option value="COMPLETE" ${state.filters.status === 'COMPLETE' ? 'selected' : ''}>✅ COMPLETE</option>
                        <option value="NOTIFY" ${state.filters.status === 'NOTIFY' ? 'selected' : ''}>🔔 NOTIFY</option>
                        <option value="COLLECT" ${state.filters.status === 'COLLECT' ? 'selected' : ''}>📦 COLLECT</option>
                        <option value="CANCELLED" ${state.filters.status === 'CANCELLED' ? 'selected' : ''}>❌ CANCELLED</option>
                    </select>
                </div>
                <div class="search-actions" style="grid-column: span 1; justify-content: flex-start; gap: 8px;">
                    <button class="btn btn-primary btn-sm" style="padding: 8px 16px; min-width: 80px;" onclick="updateFilters()">SEARCH</button>
                    <button class="btn btn-ghost btn-sm" style="padding: 8px 16px;" onclick="resetSearch()">RESET</button>
                    <button class="btn btn-ghost btn-sm" style="padding: 8px 16px; color: var(--primary); border-color: var(--primary); font-size: 0.75rem;" 
                        onclick="printDoctorReport()" title="Grouped by Doctor & Secretary">🖨️ PRINT</button>
                </div>
            </div>
        </div>

        <div class="panel-card fade-in" style="padding: 24px;">
            <div class="table-header-row">
                <div class="panel-title" style="margin-bottom: 0;"><span>📜</span> REQUEST RECORDS</div>
                <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">
                    Showing ${filtered.length} records
                </div>
            </div>
            
            <div class="data-table-wrapper" style="margin-top: 16px;">
                ${filtered.length > 0 ? renderTable(filtered) : `
                    <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                        <div style="font-size: 2rem; margin-bottom: 12px;">🔍</div>
                        <div style="font-weight: 600;">No request record found.</div>
                        <div style="font-size: 0.8rem;">Try adjusting your filters or search criteria.</div>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderTable(data) {
    return `
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 40px;"></th>
                    <th>MRN</th>
                    <th>Patient Name</th>
                    <th>Request Type(s)</th>
                    <th>Status</th>
                    <th>Timeline</th>
                    <th>Request Date</th>
                    <th>Entered By</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(r => `
                    <tr class="${state.expandedId === r.id ? 'expanded-row' : ''}">
                        <td>
                            <button class="expand-btn" onclick="toggleRow(${r.id})">
                                ${state.expandedId === r.id ? '▼' : '▶'}
                            </button>
                        </td>
                        <td style="font-weight: 700;">${r.patientMRN}</td>
                        <td style="font-weight: 600;">${r.patientName}</td>
                        <td style="font-size: 0.8rem;">
                            ${r.requestTypes.map(rt => `
                                <div style="margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
                                    <span>${rt.completed ? '✅' : '•'}</span>
                                    <span style="${rt.completed ? 'text-decoration: line-through; color: #166534;' : ''}">${rt.type}</span>
                                </div>
                            `).join('')}
                        </td>
                        <td>
                            ${(() => {
            const done = r.requestTypes.filter(rt => rt.completed).length;
            const total = r.requestTypes.length;
            const allDone = done === total;

            // If not all done, status is effectively "IN PROGRESS" in the label
            const statusText = allDone ? r.status : `IN PROGRESS (${done}/${total})`;
            return renderStatusBadge(allDone ? r.status : 'SENT', statusText);
        })()}
                        </td>
                        <td>${renderDayLapseBar(r)}</td>
                        <td style="font-size: 0.85rem;">${new Date(r.createdAt).toLocaleDateString()}</td>
                        <td style="font-size: 0.85rem; font-weight: 600; color: var(--primary);">${r.username}</td>
                        <td>
                            <button class="row-action-btn" onclick="openStatusModal(${r.id})" title="Edit status">✏️ Edit</button>
                        </td>
                    </tr>
                    ${state.expandedId === r.id ? renderExpandedSection(r) : ''}
                `).join('')}
            </tbody>
        </table>
    `;
}

// --- DYNAMIC ROWS HANDLERS ---
function addRequestRow() {
    state.formRequests.push('');
    renderView();
}

function removeRequestRow(idx) {
    state.formRequests.splice(idx, 1);
    renderView();
}

function updateFormRequest(idx, val) {
    state.formRequests[idx] = val;
}

// --- EDIT FLOW HANDLERS ---
function startEdit(id) {
    const record = state.requests.find(r => r.id === id);
    if (!record) return;

    state.editingId = id;
    state.formRequests = [...record.requestTypes.map(rt => rt.type)];
    state.registrationForm = {
        source: record.source,
        patientMRN: record.patientMRN,
        patientIC: record.patientIC,
        patientName: record.patientName,
        patientPhone: record.patientPhone,
        requesterType: record.requesterType,
        requesterName: record.requesterName,
        requesterPhone: record.requesterPhone,
        relationship: record.relationship,
        deliveryMethod: record.deliveryMethod,
        deliveryDetail: record.deliveryDetail,
        remarksCategory: record.remarksCategory,
        notes: record.notes
    };
    state.view = 'registration';

    // Update menu UI
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === 'registration');
    });

    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    state.editingId = null;
    state.formRequests = [''];
    state.registrationForm = {
        source: 'Counter',
        patientMRN: '',
        patientIC: '',
        patientName: '',
        patientPhone: '',
        requesterType: 'Patient',
        requesterName: '',
        requesterPhone: '',
        relationship: '',
        deliveryMethod: 'Self Collect',
        deliveryDetail: '',
        remarksCategory: 'New Submission',
        notes: ''
    };
    renderView();
}

// --- LOGIC HANDLERS ---
function handleMRNLookup(val) {
    if (val.length === 6) {
        const match = MOCK_PATIENTS.find(p => p.mrn === val);
        if (match) {
            state.registrationForm.patientName = match.name;
            state.registrationForm.patientIC = match.ic;
            state.registrationForm.patientPhone = match.phone;

            // Re-render only if needed, or just update DOM directly to avoid focus jump
            document.getElementById('p-name').value = match.name;
            document.getElementById('p-ic').value = match.ic;
            document.getElementById('p-phone').value = match.phone;

            showToast("✓ Patient details auto-populated", "success");
        }
    }
}

function toggleRequesterField() {
    const val = document.getElementById('r-type').value;
    const info = document.getElementById('requester-info');
    const relGroup = document.getElementById('nok-rel-group');

    info.style.display = val === 'Patient' ? 'none' : 'block';
    relGroup.style.display = val === 'Next of Kin' ? 'block' : 'none';
}

function toggleDeliveryField() {
    const val = document.getElementById('d-method').value;
    const postGroup = document.getElementById('post-detail-group');
    const emailGroup = document.getElementById('email-detail-group');

    if (!val || val === 'Self Collect') {
        if (postGroup) postGroup.style.display = 'none';
        if (emailGroup) emailGroup.style.display = 'none';
        return;
    }

    if (postGroup) postGroup.style.display = val.includes('Post') ? 'block' : 'none';
    if (emailGroup) emailGroup.style.display = val.includes('Email') ? 'block' : 'none';
}

function handleFormSubmit(e) {
    e.preventDefault();

    if (state.formRequests.some(r => !r)) {
        return showToast("Please select Request Type before saving.", "error");
    }

    if (!state.registrationForm.deliveryMethod && !state.editingId) {
        return showToast("Please select a Delivery Method.", "error");
    }

    const isEditing = !!state.editingId;
    const f = state.registrationForm;

    // Get values from DOM if editing (as they might have changed and we don't track edit-state in registrationForm)
    // Get values from state if new registration (as they are bound in real-time)
    const source = isEditing ? document.getElementById('reg-source').value : f.source;
    const mrn = isEditing ? document.getElementById('p-mrn').value : f.patientMRN;
    const ic = isEditing ? document.getElementById('p-ic').value : f.patientIC;
    const name = isEditing ? document.getElementById('p-name').value : f.patientName;
    const pPhone = isEditing ? document.getElementById('p-phone').value : f.patientPhone;
    const rType = isEditing ? document.getElementById('r-type').value : f.requesterType;
    const rRel = isEditing ? document.getElementById('r-rel').value : f.relationship;
    const dMethod = isEditing ? document.getElementById('d-method').value : f.deliveryMethod;
    const dDetail = isEditing ? document.getElementById('d-detail').value : f.deliveryDetail;
    const dEmail = isEditing ? document.getElementById('d-email').value : f.deliveryEmail;
    const rCat = isEditing ? document.getElementById('remarks-cat').value : f.remarksCategory;
    const notes = isEditing ? document.getElementById('notes').value : f.notes;

    let record = isEditing ? state.requests.find(r => r.id === state.editingId) : null;

    if (isEditing && record.status === 'Completed') {
        // Only allow updating notes for completed records
        const before = record.notes;
        record.notes = notes;
        record.auditLog.push({
            timestamp: new Date().toISOString(),
            user: state.user.name,
            action: 'Update Notes',
            changes: { notes: { before, after: notes } }
        });
    } else {
        let newValues = {};
        if (isEditing) {
            newValues.status = document.getElementById('r-status').value;
        }

        newValues = {
            ...newValues,
            patientMRN: mrn,
            patientIC: ic,
            patientName: name,
            patientPhone: pPhone,
            source: source,
            requesterType: rType,
            relationship: rType === 'Next of Kin' ? rRel : '',
            requestTypes: isEditing ? record.requestTypes : state.formRequests.map(type => ({
                type: type,
                completed: false,
                completedBy: null,
                completedAt: null
            })),
            createdAt: isEditing ? record.createdAt : new Date().toISOString(),
            deliveryMethod: dMethod,
            deliveryDetail: dDetail,
            deliveryEmail: dEmail,
            remarksCategory: rCat,
            notes: notes,
            requesterName: rType === 'Patient' ? name : (isEditing ? document.getElementById('r-name').value : f.requesterName),
            requesterPhone: rType === 'Patient' ? '' : (isEditing ? document.getElementById('r-phone').value : f.requesterPhone)
        };

        if (isEditing) {
            const changes = {};
            for (let key in newValues) {
                if (JSON.stringify(record[key]) !== JSON.stringify(newValues[key])) {
                    changes[key] = { before: record[key], after: newValues[key] };
                }
            }

            Object.assign(record, newValues);
            record.auditLog.push({
                timestamp: new Date().toISOString(),
                user: state.user.name,
                action: 'Update Submission',
                changes: changes
            });
        } else {
            record = {
                id: Date.now(),
                status: 'APPLY',
                username: state.user.name,
                department: state.user.dept,
                createdAt: new Date().toISOString(),
                auditLog: [{
                    timestamp: new Date().toISOString(),
                    user: state.user.name,
                    action: 'Create Submission'
                }],
                monitoring: {
                    cancellationDate: { date: '', by: '' },
                    sendDoctorDate: { date: '', by: '' },
                    completionDate: { date: '', by: '' },
                    notificationDate: { date: '', by: '' },
                    handoverDate: { date: '', by: '' },
                    pmr: false,
                    iclic: false,
                    doctor: '',
                    secretary: ''
                },
                ...newValues
            };
            state.requests.unshift(record);
        }

        const payload = {
            ...newValues,
            username: state.user.name,
            formRequests: isEditing ? record.requestTypes.map(rt => rt.type) : state.formRequests
        };

        apiCall('save_registration.php', 'POST', payload).then(result => {
            if (result && result.success) {
                showToast(isEditing ? "Record updated successfully!" : "Registration saved successfully!", "success");
                loadInitialData().then(() => renderView());
            }
        });
    }

    state.editingId = null;
    state.formRequests = [''];
    state.registrationForm = {
        source: 'Counter',
        patientMRN: '',
        patientIC: '',
        patientName: '',
        patientPhone: '',
        requesterType: 'Patient',
        requesterName: '',
        requesterPhone: '',
        relationship: '',
        deliveryMethod: 'Self Collect',
        deliveryDetail: '',
        remarksCategory: 'New Submission',
        notes: ''
    };
}

function resetForm() {
    state.formRequests = [''];
    state.registrationForm = {
        source: 'Counter',
        patientMRN: '',
        patientIC: '',
        patientName: '',
        patientPhone: '',
        requesterType: 'Patient',
        requesterName: '',
        requesterPhone: '',
        relationship: '',
        deliveryMethod: 'Self Collect',
        deliveryDetail: '',
        remarksCategory: 'New Submission',
        notes: ''
    };
    const form = document.getElementById('reg-form');
    if (form) form.reset();
    toggleRequesterField();
    toggleDeliveryField();
    renderView();
}

function saveData() {
    localStorage.setItem('MedReport_Requests', JSON.stringify(state.requests));
    localStorage.setItem('MedReport_Doctors', JSON.stringify(state.doctors));
    localStorage.setItem('MedReport_Secretaries', JSON.stringify(state.secretaries));
    localStorage.setItem('MedReport_AuditLog', JSON.stringify(state.systemAuditLog));
}

// --- FILTERING & VIEW CONTROLS ---
function switchView(view) {
    state.view = view;
    // Update menu items
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderView();
}

function updateFilters() {
    // Collect from UI elements if necessary (though they are bound via oninput/onchange)
    state.filters.search = document.getElementById('search-mrn').value;
    state.filters.date = document.getElementById('search-date').value;
    state.filters.staff = document.getElementById('search-staff').value;

    console.log(`[Audit] ${state.user.name} ran search: MRN=${state.filters.search}, Date=${state.filters.date}, Staff=${state.filters.staff}`);

    renderView();
}

function resetSearch() {
    state.filters = {
        date: '',
        search: '',
        status: 'All',
        staff: 'All',
        meOnly: false
    };
    renderView();
}

function toggleMeFilter() {
    state.filters.meOnly = !state.filters.meOnly;
    renderView();
}

function filterData() {
    if (!state.requests || !Array.isArray(state.requests)) return [];
    return state.requests.filter(r => {
        if (!r) return false;
        const matchDate = !state.filters.date || (r.createdAt && r.createdAt.startsWith(state.filters.date));
        const matchSearch = !state.filters.search || (r.patientMRN && r.patientMRN.includes(state.filters.search));
        const matchStaff = state.filters.staff === 'All' || r.username === state.filters.staff;
        const matchStatus = state.filters.status === 'All' || r.status === state.filters.status;

        return matchDate && matchSearch && matchStaff && matchStatus;
    });
}

// --- DEDICATED ANALYTICS PAGE ---
function renderAnalyticsPage() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const thisMonthStr = todayStr.substring(0, 7); // YYYY-MM
    const thisYearStr = todayStr.substring(0, 4); // YYYY

    // Core Metrics
    let totalItems = 0;
    let todayItems = 0;
    const statusCounts = { APPLY: 0, SENT: 0, NOTIFY: 0, COLLECT: 0, COMPLETE: 0, CANCELLED: 0 };
    const lapseCounts = { green: 0, yellow: 0, orange: 0, red: 0 };
    const requestTally = {};
    const staffTally = {}; // { submissions: 0, actions: 0 }

    // Source Statistics
    const sourceStats = {
        daily: { Counter: 0, Email: 0, Online: 0, total: 0 },
        monthly: { Counter: 0, Email: 0, Online: 0, total: 0 },
        yearly: { Counter: 0, Email: 0, Online: 0, total: 0 }
    };


    // Analytics calculations for Counter Queries
    const cqTally = {};
    const filteredCQ = state.dailyRoutine.counterQueries || [];

    filteredCQ.forEach(cq => {
        const type = cq.type || 'Other';
        cqTally[type] = (cqTally[type] || 0) + 1;

        // Add to staff tally
        const staff = cq.staff || 'System';
        if (!staffTally[staff]) staffTally[staff] = { submissions: 0, actions: 0 };
        staffTally[staff].actions++;
    });

    state.requests.forEach(r => {
        // Tally Total Line Items
        totalItems += (r.requestTypes || []).length;

        // Today Items
        if (r.createdAt.startsWith(todayStr)) {
            todayItems += (r.requestTypes || []).length;
        }

        // Tally status
        const status = (r.status || 'APPLY').toUpperCase();
        statusCounts[status] = (statusCounts[status] || 0) + 1;


        // Tally request types
        (r.requestTypes || []).forEach(rt => {
            const type = typeof rt === 'object' ? rt.type : rt;
            requestTally[type] = (requestTally[type] || 0) + 1;
        });

        // Lapse Distribution
        const start = new Date(r.createdAt);
        const handoverDate = r.monitoring?.handoverDate?.date;
        const end = handoverDate ? new Date(handoverDate) : new Date();
        const elapsed = calculateWorkingDays(start, end);

        if (elapsed > 21) lapseCounts.red++;
        else if (elapsed >= 17) lapseCounts.orange++;
        else if (elapsed >= 11) lapseCounts.yellow++;
        else lapseCounts.green++;

        // Tally Staff Submissions (Creator)
        const creator = r.username || 'System';
        if (!staffTally[creator]) staffTally[creator] = { submissions: 0, actions: 0 };
        staffTally[creator].submissions++;

        // Tally Staff Actions (Detailed Audit Based)
        (r.auditLog || []).forEach(log => {
            if (['Status Auto-Update', 'Timeline Locked', 'Application Completed'].includes(log.action)) {
                const staff = log.user;
                if (!staffTally[staff]) staffTally[staff] = { submissions: 0, actions: 0 };
                staffTally[staff].actions++;
            }
        });

        // Source Distribution Tally
        const source = r.source || 'Counter';
        const date = r.createdAt || '';

        if (date.startsWith(todayStr)) {
            if (sourceStats.daily[source] !== undefined) sourceStats.daily[source]++;
            sourceStats.daily.total++;
        }
        if (date.startsWith(thisMonthStr)) {
            if (sourceStats.monthly[source] !== undefined) sourceStats.monthly[source]++;
            sourceStats.monthly.total++;
        }
        if (date.startsWith(thisYearStr)) {
            if (sourceStats.yearly[source] !== undefined) sourceStats.yearly[source]++;
            sourceStats.yearly.total++;
        }
    });

    const activeCount = statusCounts.APPLY + statusCounts.SENT + statusCounts.NOTIFY;
    const completedCount = statusCounts.COMPLETE + statusCounts.COLLECT;
    const grandTotal = state.requests.length;
    const totalCQAll = filteredCQ.length;

    const topCategories = Object.entries(requestTally)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const statusColors = {
        APPLY: '#f59e0b',
        SENT: '#3b82f6',
        NOTIFY: '#8b5cf6',
        COLLECT: '#f97316',
        COMPLETE: '#10b981',
        CANCELLED: '#ef4444'
    };

    return `
        <div class="dashboard-container fade-in">
            <!-- Header Summary Cards -->
            <div class="summary-cards">
                <div class="summary-card">
                    <span class="summary-icon">📥</span>
                    <span class="summary-label">Today Items</span>
                    <span class="summary-value">${todayItems}</span>
                </div>
                <div class="summary-card">
                    <span class="summary-icon">🏢</span>
                    <span class="summary-label">Counter Queries</span>
                    <span class="summary-value">${totalCQAll}</span>
                </div>
                <div class="summary-card">
                    <span class="summary-icon">✅</span>
                    <span class="summary-label">Completed Total</span>
                    <span class="summary-value">${completedCount}</span>
                </div>
                <div class="summary-card">
                    <span class="summary-icon">🌍</span>
                    <span class="summary-label">Grand Total</span>
                    <span class="summary-value">${grandTotal}</span>
                </div>
            </div>

            <div class="chart-grid">
                <!-- NEW: Workload Type Breakdown -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3>📊 Workload Type Breakdown</h3>
                    </div>
                    <div style="margin-top: 16px;">
                        ${(() => {
            const emailCount = state.dailyRoutine.emails.length;
            const callCount = state.dailyRoutine.calls.length;
            const counterCount = (state.dailyRoutine.counterQueries || []).length;
            const total = emailCount + callCount + counterCount;

            const types = [
                { label: 'Emails', count: emailCount, color: 'var(--primary)', icon: '📧' },
                { label: 'Calls', count: callCount, color: 'var(--secondary)', icon: '📞' },
                { label: 'Counter', count: counterCount, color: '#8b5cf6', icon: '🏢' }
            ];

            return types.map(t => {
                const perc = total > 0 ? (t.count / total * 100) : 0;
                return `
                                <div class="dist-item">
                                    <div class="dist-label-row">
                                        <span>${t.icon} ${t.label}</span>
                                        <span>${t.count} (${perc.toFixed(0)}%)</span>
                                    </div>
                                    <div class="progress-container">
                                        <div class="progress-bar" style="width: ${perc}%; background: ${t.color};"></div>
                                    </div>
                                </div>
                            `;
            }).join('');
        })()}
                    </div>
                </div>

                <!-- Registration Source Breakdown -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3>📈 Registration Source (Total)</h3>
                    </div>
                    <div class="source-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 16px;">
                        ${['daily', 'monthly', 'yearly'].map(period => `
                            <div class="period-col">
                                <div style="font-weight: 800; font-size: 0.85rem; color: var(--primary); margin-bottom: 12px; text-transform: uppercase; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px;">
                                    ${period === 'daily' ? 'Hari Ini' : period === 'monthly' ? 'Bulan Ini' : 'Tahun Ini'}
                                </div>
                                ${Object.entries(sourceStats[period]).filter(([k]) => k !== 'total').map(([src, count]) => {
            const perc = sourceStats[period].total > 0 ? (count / sourceStats[period].total * 100) : 0;
            const colors = { Counter: '#6366f1', Email: '#ec4899', Online: '#06b6d4' };
            return `
                                        <div style="margin-bottom: 12px;">
                                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px; font-weight: 600;">
                                                <span>${src === 'Counter' ? '🏢 Counter' : src === 'Email' ? '📧 Email' : '🌐 Online'}</span>
                                                <span>${count} (${perc.toFixed(0)}%)</span>
                                            </div>
                                            <div style="height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                                                <div style="height: 100%; width: ${perc}%; background: ${colors[src] || '#cbd5e1'};"></div>
                                            </div>
                                        </div>
                                    `;
        }).join('')}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Counter Workload Distribution -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3>🏢 Counter Workload Distribution</h3>
                    </div>
                    <div style="margin-top: 16px; max-height: 250px; overflow-y: auto;">
                        ${Object.entries(cqTally).length > 0 ? Object.entries(cqTally).map(([type, count]) => {
            const perc = totalCQAll > 0 ? (count / totalCQAll * 100) : 0;
            return `
                                <div class="dist-item">
                                    <div class="dist-label-row">
                                        <span>${type}</span>
                                        <span>${count} (${perc.toFixed(0)}%)</span>
                                    </div>
                                    <div class="progress-container">
                                        <div class="progress-bar" style="width: ${perc}%; background: #8b5cf6;"></div>
                                    </div>
                                </div>
                            `;
        }).join('') : '<div style="color:var(--text-muted); padding:20px; text-align:center;">No counter queries recorded</div>'}
                    </div>
                </div>
            </div>

            <div class="chart-grid">
                <!-- NEW: Workload Trend (Day) - Hourly Distribution -->
                <div class="chart-card span-2">
                    <div class="chart-header">
                        <h3>⏰ Workload Trend (Day) - Counter Peak Hours</h3>
                    </div>
                    <div style="height: 200px; display: flex; align-items: flex-end; gap: 4px; padding-top: 20px; margin-top: 16px;">
                        ${(() => {
            const hours = Array.from({ length: 24 }, (_, i) => i);
            const hourlyData = hours.map(h => {
                const count = filteredCQ.filter(cq => {
                    const hour = parseInt(cq.time.split(':')[0]);
                    return hour === h;
                }).length;
                return count;
            });
            const max = Math.max(...hourlyData, 1);

            return hours.map(h => {
                const count = hourlyData[h];
                const height = (count / max) * 100;
                // Only show labels for every 3 hours or where there is data
                const showLabel = h % 2 === 0;
                return `
                                <div class="trend-bar-wrapper" style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                    <div class="tooltip" data-tooltip="${count} queries at ${h}:00" style="width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%;">
                                        <div class="trend-bar" style="width: 80%; height: ${height}%; background: ${count > 0 ? '#8b5cf6' : '#f1f5f9'}; border-radius: 4px 4px 0 0; transition: height 0.3s;"></div>
                                    </div>
                                    <span style="font-size: 0.6rem; color: var(--text-muted); ${!showLabel ? 'visibility:hidden;' : ''}">${h}h</span>
                                </div>
                            `;
            }).join('');
        })()}
                    </div>
                </div>
            </div>

            <div class="chart-grid">
                <!-- Status Distribution -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3>📊 Status Distribution</h3>
                    </div>
                    ${Object.entries(statusCounts).map(([status, count]) => {
            const perc = grandTotal > 0 ? (count / grandTotal * 100) : 0;
            const color = statusColors[status] || '#cbd5e1';
            return `
                            <div class="dist-item">
                                <div class="dist-label-row">
                                    <span>${status}</span>
                                    <span>${count} (${perc.toFixed(0)}%)</span>
                                </div>
                                <div class="progress-container">
                                    <div class="progress-bar" style="width: ${perc}%; background: ${color};"></div>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>

                <!-- Day Lapse Distribution -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3>⏳ Day Lapse Overview</h3>
                    </div>
                    <div class="lapse-dist">
                        ${renderLapseDistItem('Normal (1-10)', lapseCounts.green, 'lapse-green', grandTotal)}
                        ${renderLapseDistItem('Warning (11-16)', lapseCounts.yellow, 'lapse-yellow', grandTotal)}
                        ${renderLapseDistItem('Urgent (17-21)', lapseCounts.orange, 'lapse-orange', grandTotal)}
                        ${renderLapseDistItem('Overdue (>21)', lapseCounts.red, 'lapse-red', grandTotal)}
                    </div>
                </div>
            </div>


            <div class="chart-grid">
                <!-- Top Categories -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3>🏆 Top Request Categories</h3>
                    </div>
                    <div class="rank-list">
                        ${topCategories.map(([name, count], idx) => `
                            <div class="rank-item">
                                <div class="rank-info">
                                    <div class="rank-number">${idx + 1}</div>
                                    <div class="rank-name">${name}</div>
                                </div>
                                <div class="rank-value">${count}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Staff Workload -->
                <div class="workload-section">
                    <div class="chart-header">
                        <h3>👩‍💻 Staff Workload Breakdown</h3>
                        <button class="btn btn-ghost btn-sm" onclick="exportAnalyticsWorkload()">Export CSV</button>
                    </div>
                    <div class="data-table-wrapper" style="max-height: 300px;">
                        <table class="workload-table">
                            <thead>
                                <tr>
                                    <th>Staff Name</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                    <th>Contribution %</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(staffTally).sort((a, b) => b[1].actions - a[1].actions).map(([staff, data]) => {
            const totalActions = Object.values(staffTally).reduce((acc, curr) => acc + curr.actions, 0);
            const contrib = totalActions > 0 ? (data.actions / totalActions * 100) : 0;
            return `
                                        <tr>
                                            <td style="font-weight: 700;">${staff}</td>
                                            <td>${data.submissions}</td>
                                            <td>${data.actions}</td>
                                            <td>
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <div style="flex: 1; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                                                        <div style="height: 100%; background: var(--primary); width: ${contrib}%"></div>
                                                    </div>
                                                    <span style="font-weight: 800; font-size: 0.75rem;">${contrib.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderLapseDistItem(label, count, colorClass, total) {
    const perc = total > 0 ? (count / total * 100) : 0;
    return `
        <div class="dist-item">
            <div class="dist-label-row">
                <span>${label}</span>
                <span>${count} (${perc.toFixed(0)}%)</span>
            </div>
            <div class="progress-container">
                <div class="progress-bar ${colorClass}" style="width: ${perc}%;"></div>
            </div>
        </div>
    `;
}

// --- ANALYTICS EXPORT ---
function exportAnalyticsWorkload() {
    const staffTally = {};
    state.requests.forEach(r => {
        const creator = r.username || 'System';
        if (!staffTally[creator]) staffTally[creator] = { submissions: 0, actions: 0 };
        staffTally[creator].submissions++;

        (r.auditLog || []).forEach(log => {
            if (['Status Auto-Update', 'Timeline Locked', 'Application Completed'].includes(log.action)) {
                const staff = log.user;
                if (!staffTally[staff]) staffTally[staff] = { submissions: 0, actions: 0 };
                staffTally[staff].actions++;
            }
        });
    });

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Staff Name,Requests Created,Actions Performed,Contribution %\n";

    const totalActions = Object.values(staffTally).reduce((acc, curr) => acc + curr.actions, 0);

    Object.entries(staffTally).forEach(([staff, data]) => {
        const contrib = totalActions > 0 ? (data.actions / totalActions * 100) : 0;
        csvContent += `${staff},${data.submissions},${data.actions},${contrib.toFixed(2)}%\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MedReport_Workload_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToCSV() {
    if (state.requests.length === 0) return showToast("No data to export", "error");

    const headers = ["Date", "Source", "MRN", "IC", "Patient Name", "Patient Phone", "Role", "Relationship", "Requests", "Sub-Requests", "Delivery", "Status", "Staff"];
    const rows = [];

    state.requests.forEach(r => {
        const reqTypesStr = (r.requestTypes || []).map(rt => {
            const type = typeof rt === 'object' ? rt.type : rt;
            const statusLabel = (typeof rt === 'object' && rt.completed) ? "[DONE]" : "[PENDING]";
            return `${statusLabel} ${type} `;
        }).join('; ');

        rows.push([
            new Date(r.createdAt).toLocaleString(),
            r.source,
            r.patientMRN,
            r.patientIC,
            `"${(r.patientName || '').replace(/"/g, '""')}"`,
            r.patientPhone || '',
            r.requesterType,
            r.relationship || '',
            (r.requestTypes || []).length,
            `"${reqTypesStr.replace(/"/g, '""')}"`,
            r.deliveryMethod,
            r.status,
            r.username
        ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Registry_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- UTILS ---
const MALAYSIA_HOLIDAYS_2026 = [
    '2026-01-01', // New Year
    '2026-02-02', // Thaipusam
    '2026-02-17', // Chinese New Year
    '2026-02-18', // Chinese New Year
    '2026-03-21', // Hari Raya Aidilfitri
    '2026-03-22', // Hari Raya Aidilfitri
    '2026-03-23', // Hari Raya Aidilfitri (Replacement)
    '2026-05-01', // Labour Day
    '2026-05-27', // Hari Raya Haji
    '2026-05-31', // Wesak Day
    '2026-06-01', // Agong's Birthday
    '2026-06-17', // Awal Muharram
    '2026-08-31', // Merdeka Day
    '2026-09-16', // Malaysia Day
    '2026-11-09', // Deepavali
    '2026-12-25'  // Christmas
];

function isWorkingDay(date) {
    const day = date.getDay();
    if (day === 0 || day === 6) return false; // Weekend
    const str = date.toISOString().split('T')[0];
    return !MALAYSIA_HOLIDAYS_2026.includes(str);
}

function calculateWorkingDays(startDate, endDate) {
    if (!startDate || isNaN(new Date(startDate).getTime())) return 0;
    if (!endDate || isNaN(new Date(endDate).getTime())) return 0;
    
    let count = 0;
    let current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const last = new Date(endDate);
    last.setHours(0, 0, 0, 0);

    while (current <= last) {
        if (isWorkingDay(current)) count++;
        current.setDate(current.getDate() + 1);
    }
    return count;
}

function renderDayLapseBar(record) {
    const start = new Date(record.createdAt);
    const handoverDate = record.monitoring.handoverDate.date;
    const isLocked = !!handoverDate;
    const end = isLocked ? new Date(handoverDate) : new Date();

    // Count days (Working days)
    const elapsed = calculateWorkingDays(start, end);
    const maxDays = 21;
    const displayDays = Math.min(elapsed, maxDays);
    const percentage = Math.min((displayDays / maxDays) * 100, 100);

    // Threshold color based on User Image:
    // 1-10: Green
    // 11-16: Yellow
    // 17-21: Orange
    // > 21: Red
    let colorClass = 'lapse-green';
    if (elapsed > 21) colorClass = 'lapse-red';
    else if (elapsed >= 17) colorClass = 'lapse-orange';
    else if (elapsed >= 11) colorClass = 'lapse-yellow';

    const handoverBy = record.monitoring.handoverDate.by;

    return `
        <div class="lapse-container" title="Request: ${start.toLocaleDateString()}\nHandover: ${handoverDate || 'Pending'}${handoverBy ? ` (By: ${handoverBy})` : ''}\nElapsed: ${elapsed} Working Days ${isLocked ? '(LOCKED)' : ''}">
            <div class="lapse-label">
                <span>DAY LAPSE ${isLocked ? '🔒' : ''}</span>
            </div>
            <div class="lapse-bar-bg">
                <div class="lapse-bar-text">${elapsed} / ${maxDays}</div>
                <div class="lapse-bar-fill ${colorClass}" style="width: ${percentage}%"></div>
            </div>
        </div>
    `;
}

function renderStatusBadge(status, customText) {
    if (!status) return '';
    const cleanStatus = status.trim().toUpperCase();
    const displayText = (customText || status).toUpperCase();
    return `<span class="status-label status-${cleanStatus.toLowerCase().replace(' ', '-')}">${displayText}</span>`;
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = type === 'success' ? 'var(--success)' :
        type === 'error' ? 'var(--danger)' : 'var(--primary)';
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function setupEventListeners() {
    document.querySelectorAll('.menu-item[data-view]').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
}

// --- STATUS MODAL (ADVANCED) ---
function openStatusModal(id) {
    const r = state.requests.find(req => req.id === id);
    if (!r) return;

    const modal = document.getElementById('analytics-modal'); // Reusing modal structure
    const body = document.getElementById('analytics-body');
    const headerTitle = document.querySelector('.modal-header h3');

    headerTitle.innerText = "STATUS UPDATE";
    modal.style.display = 'flex';

    body.innerHTML = `
        <div class="status-modal-content">
            <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border);">
                <div style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">#${r.id.toString().slice(-6)} - ${r.patientName}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Current Status: <strong>${r.status}</strong></div>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label>Status *</label>
                <select id="modal-status" class="f-input" required onchange="toggleRemarksValidation(this.value)">
                    <option value="" disabled>Select Status</option>
                    <option value="APPLY" ${['APPLY', 'Pending'].includes(r.status) ? 'selected' : ''}>⏳ APPLY</option>
                    <option value="SENT" ${['SENT', 'In Progress'].includes(r.status) ? 'selected' : ''}>📤 SENT</option>
                    <option value="COMPLETE" ${r.status === 'COMPLETE' ? 'selected' : ''}>✅ COMPLETE</option>
                    <option value="NOTIFY" ${r.status === 'NOTIFY' ? 'selected' : ''}>🔔 NOTIFY</option>
                    <option value="COLLECT" ${r.status === 'COLLECT' ? 'selected' : ''}>📦 COLLECT</option>
                    <option value="CANCELLED" ${r.status === 'CANCELLED' ? 'selected' : ''}>❌ CANCELLED</option>
                </select>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label>Remarks <span id="remarks-req-star" style="display: ${r.status === 'Cancelled' ? 'inline' : 'none'}; color: var(--danger);">*</span></label>
                <textarea id="modal-remarks" class="f-input" style="height: 100px; resize: none;" placeholder="Enter update remarks...">${r.notes || ''}</textarea>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label>Delivery Method</label>
                <select id="modal-delivery" class="f-input" onchange="toggleModalDeliveryFields(this.value)">
                    <option value="Self Collect" ${r.deliveryMethod === 'Self Collect' ? 'selected' : ''}>Self Collect</option>
                    <option value="Post" ${r.deliveryMethod === 'Post' ? 'selected' : ''}>Post (Courier)</option>
                    <option value="Email" ${r.deliveryMethod === 'Email' ? 'selected' : ''}>Email</option>
                    <option value="Email + Collect" ${r.deliveryMethod === 'Email + Collect' ? 'selected' : ''}>Email + Collect</option>
                    <option value="Email + Post" ${r.deliveryMethod === 'Email + Post' ? 'selected' : ''}>Email + Post</option>
                </select>
            </div>

            <div id="modal-post-group" class="form-group" style="margin-bottom: 20px; display: ${r.deliveryMethod?.includes('Post') ? 'block' : 'none'};">
                <label>Mailing Address *</label>
                <input type="text" id="modal-d-detail" class="f-input" value="${r.deliveryDetail || ''}" placeholder="Full postal address">
            </div>

            <div id="modal-email-group" class="form-group" style="margin-bottom: 20px; display: ${r.deliveryMethod?.includes('Email') ? 'block' : 'none'};">
                <label>Email Address *</label>
                <input type="text" id="modal-d-email" class="f-input" value="${r.deliveryEmail || ''}" placeholder="patient@example.com">
            </div>

            <div class="form-actions" style="margin-top: 0;">
                <button class="btn btn-primary" onclick="saveStatusUpdate(${id})">SAVE UPDATE</button>
                <button class="btn btn-ghost" onclick="toggleAnalyticsModal(false)">CANCEL</button>
            </div>
        </div>
    `;
}

function toggleRemarksValidation(status) {
    const star = document.getElementById('remarks-req-star');
    if (star) star.style.display = (status === 'Cancelled') ? 'inline' : 'none';
}

function saveStatusUpdate(id) {
    const newStatus = document.getElementById('modal-status').value;
    const remarks = document.getElementById('modal-remarks').value.trim();
    const delivery = document.getElementById('modal-delivery').value || 'N/A';
    const detail = document.getElementById('modal-d-detail')?.value || '';
    const email = document.getElementById('modal-d-email')?.value || '';

    if (!newStatus) return showToast("Please select a status", "error");
    if (newStatus === 'CANCELLED' && !remarks) {
        return showToast("Remarks are required for Cancelled status", "error");
    }

    const idx = state.requests.findIndex(r => r.id === id);
    if (idx === -1) return;

    state.requests[idx].deliveryMethod = delivery;
    state.requests[idx].auditLog.push({
        timestamp: new Date().toISOString(),
        user: state.user.name,
        action: 'Manual Status Update',
        detail: `Status updated manually: ${oldStatus} → ${newStatus}`,
        before: beforeValues,
        after: afterValues
    });

    console.log(`[Audit Trail] Updated #${id}:`, {
        user: state.user.name,
        dept: state.user.dept,
        before: beforeValues,
        after: afterValues
    });

    saveData();
    toggleAnalyticsModal(false);
    showToast("Status updated successfully!", "success");
    renderView();
}

function toggleAnalyticsModal(show) {
    const modal = document.getElementById('analytics-modal');
    if (modal) modal.style.display = show ? 'flex' : 'none';
}

function toggleModalDeliveryFields(val) {
    const postGroup = document.getElementById('modal-post-group');
    const emailGroup = document.getElementById('modal-email-group');
    if (postGroup) postGroup.style.display = val.includes('Post') ? 'block' : 'none';
    if (emailGroup) emailGroup.style.display = val.includes('Email') ? 'block' : 'none';
}

function toggleRow(id) {
    state.expandedId = state.expandedId === id ? null : id;
    renderView();
}

function renderExpandedSection(r) {
    const m = r.monitoring;
    const docOnLeave = isCurrentlyOnLeave(m.doctor);
    const lockedStatuses = ['COLLECT', 'CANCELLED'];
    const isLocked = lockedStatuses.includes(r.status);

    return `
        <tr class="expanded-panel">
            <td colspan="8">
                <div class="expand-grid">
                    <div class="mon-section ${isLocked ? 'section-locked' : ''}">
                        <div class="panel-subtitle" style="display: flex; justify-content: space-between; align-items: center;">
                            <div><span>📊</span> MONITORING</div>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                ${renderDayLapseBar(r)}
                                ${renderStatusBadge(r.status)}
                                ${isLocked ? '<span class="lock-pill">🔒 RECORD LOCKED</span>' : ''}
                            </div>
                        </div>
                        <div class="mon-fields-grid">
                            ${renderDateByField('Send to Doctor Date', 'sendDoctorDate', m.sendDoctorDate, r.id, false, true, true)}
                            
                            <div class="mon-field-group">
                                <label>System Export / Processing <span class="mandatory-star">*</span></label>
                                <div class="mon-checkbox-grid" id="mon-checkbox-group-${r.id}" style="padding: 10px 14px;">
                                    <label class="mon-checkbox-item">
                                        <input type="checkbox" id="mon-pmr-${r.id}" ${m.pmr ? 'checked' : ''} ${isLocked ? 'disabled' : ''} onchange="validateMonitoringFields(${r.id})">
                                        <span>PMR</span>
                                    </label>
                                    <label class="mon-checkbox-item" style="margin-left: 20px;">
                                        <input type="checkbox" id="mon-iclic-${r.id}" ${m.iclic ? 'checked' : ''} ${isLocked ? 'disabled' : ''} onchange="validateMonitoringFields(${r.id})">
                                        <span>ICLIC</span>
                                    </label>
                                </div>
                                <div id="error-mon-checkbox-${r.id}" class="error-label">Select at least one (PMR or ICLIC)</div>
                            </div>

                            <!-- Row 2: Doctor & Secretary -->
                            <div class="mon-field-group">
                                <label style="display: flex; justify-content: space-between; align-items: center;">
                                    Doctor Name <span class="mandatory-star">*</span>
                                    ${docOnLeave ? '<span class="on-leave-badge">🚫 ON LEAVE</span>' : ''}
                                </label>
                                <div class="typeahead-wrapper">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <input type="text" class="f-mon-input ${docOnLeave ? 'warning-border' : ''}" id="mon-doctor-${r.id}" 
                                            placeholder="Type to search..." value="${m.doctor || ''}"
                                            ${isLocked ? 'readonly' : ''}
                                            oninput="handleTypeAhead(this, 'doctors', ${r.id}); validateMonitoringFields(${r.id})">
                                        <span id="mon-doc-workload-${r.id}" class="workload-pill-mini" 
                                              style="display: ${m.doctor ? 'inline-block' : 'none'}; background: ${getWorkloadStatus(getDoctorWorkload(m.doctor)).color};">
                                            Workload: ${getDoctorWorkload(m.doctor)}
                                        </span>
                                    </div>
                                    <div id="typeahead-doctors-${r.id}" class="typeahead-results"></div>
                                </div>
                                <div id="error-mon-doctor-${r.id}" class="error-label">Please enter doctor name</div>
                            </div>
                            <div class="mon-field-group">
                                <label>Secretary Name</label>
                                <div class="typeahead-wrapper">
                                    <input type="text" class="f-mon-input" id="mon-secretary-${r.id}" 
                                        placeholder="Type to search..." value="${m.secretary || ''}"
                                        ${isLocked || (state.doctors.find(d => d.name === m.doctor && d.secretary === m.secretary)) ? 'readonly' : ''}
                                        oninput="handleTypeAhead(this, 'secretaries', ${r.id})">
                                    <div id="typeahead-secretaries-${r.id}" class="typeahead-results"></div>
                                </div>
                            </div>

                            <!-- Row 3: Completion & Notification -->
                            ${renderDateByField('Completion Date', 'completionDate', m.completionDate, r.id, false, true)}
                            ${renderDateByField('Notification Date', 'notificationDate', m.notificationDate, r.id, false, true)}

                            <!-- Row 4: Handover & Cancellation -->
                            ${renderDateByField('Handover Date', 'handoverDate', m.handoverDate, r.id, false, true)}
                            ${renderDateByField('Cancellation Date', 'cancellationDate', m.cancellationDate, r.id, false, true)}
                        </div>

                        <div class="app-checklist-section">
                            <div class="app-checklist-title">
                                <span>📋 Application Checklist</span>
                                <span>${r.requestTypes.filter(rt => rt.completed).length} / ${r.requestTypes.length} Done</span>
                            </div>
                            <div class="app-grid">
                                ${r.requestTypes.map((rt, idx) => `
                                    <label class="app-item ${rt.completed ? 'completed' : ''}">
                                        <input type="checkbox" ${rt.completed ? 'checked' : ''} 
                                               onchange="toggleApplicationStatus(${r.id}, ${idx})">
                                        <div class="app-name">${rt.type}</div>
                                        ${rt.completed ? `
                                            <div class="app-meta">
                                                Done by ${rt.completedBy} on ${new Date(rt.completedAt).toLocaleDateString()}
                                            </div>
                                        ` : ''}
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <div class="mon-actions" style="display: flex; gap: 12px; justify-content: flex-start; align-items: center;">
                            <button class="btn btn-primary btn-save-mon" id="save-mon-${r.id}" onclick="saveMonitoring(${r.id})" ${isLocked ? 'disabled' : ''}>
                                <span>💾</span> SAVE MONITORING
                            </button>
                            <button class="btn btn-ghost" onclick="toggleRow(${r.id})">Close Panel</button>
                            <div style="flex: 1;"></div>
                            <button class="btn btn-ghost" style="color: #ef4444; border-color: #fca5a5; background: #fef2f2; font-size: 0.8rem; padding: 8px 12px;" 
                                onclick="deleteRequest(${r.id})">
                                🗑️ Delete Record
                            </button>
                        </div>
                        <script>
                            // Auto-validate once panel opens
                            setTimeout(() => {
                                if (typeof validateMonitoringFields === 'function') {
                                    validateMonitoringFields(${r.id});
                                }
                            }, 50);
                        </script>
                    </div>
                    
                    <div class="his-section">
                        <div class="panel-subtitle"><span>📜</span> HISTORY & REMARKS</div>
                        
                        <!-- Delivery Quick Info Banner -->
                        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 14px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 6px; border-left: 4px solid #0ea5e9;">
                            <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #0369a1; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                                <span>🚚</span> Registered Delivery Method
                            </div>
                            <div style="font-weight: 800; color: #0c4a6e; font-size: 1rem;">${r.deliveryMethod}</div>
                            ${r.deliveryDetail ? `<div style="font-size: 0.85rem; color: #0c4a6e; display: flex; align-items: flex-start; gap: 8px;"><span>🏠</span> <span style="font-weight: 500;">${r.deliveryDetail}</span></div>` : ''}
                            ${r.deliveryEmail ? `<div style="font-size: 0.85rem; color: #0c4a6e; display: flex; align-items: flex-start; gap: 8px;"><span>📧</span> <span style="font-weight: 500;">${r.deliveryEmail}</span></div>` : ''}
                        </div>
                        <div class="remarks-input-group" style="flex-direction: column; gap: 12px; align-items: stretch;">
                            <textarea id="new-remark-${r.id}" class="f-input remark-area remark-input-tablet" placeholder="Enter new remarks or signature notes..."></textarea>
                            <button class="btn btn-primary btn-tablet-lg" onclick="saveAndRemark(${r.id})" ${isLocked ? 'disabled' : ''}>
                                💾 ADD REMARK + SAVE MONITORING
                            </button>
                        </div>
                        <div class="remarks-list">
                            ${(() => {
            const allEvents = [
                ...(r.history || []).map(h => ({ ...h, type: 'remark' })),
                ...(r.auditLog || []).map(a => ({ ...a, type: 'audit', text: a.detail || a.text || a.action }))
            ];
            if (allEvents.length === 0) return '<div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 20px;">No records yet.</div>';

            return allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(ev => `
                                    <div class="remark-item ${ev.type === 'audit' ? 'audit-item' : ''}">
                                        <div class="remark-meta">
                                            <span class="remark-user">${ev.user}</span>
                                            <span class="remark-time">${new Date(ev.timestamp).toLocaleString()}</span>
                                        </div>
                                        <div class="remark-text ${ev.type === 'audit' ? 'audit-text' : ''}">
                                            ${ev.type === 'audit' ? `<strong>${ev.action}:</strong> ` : ''}${ev.text}
                                        </div>
                                    </div>
                                `).join('');
        })()}
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function handleTypeAhead(input, type, requestId) {
    const val = input.value.toLowerCase();
    const containerId = requestId !== undefined ? `typeahead-${type}-${requestId}` : `typeahead-${type}`;
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (val.length < 1) return;

    const list = type === 'doctors' ? state.doctors : state.secretaries;
    const filtered = list.filter(item => (item.name || item).toLowerCase().includes(val));

    filtered.forEach(item => {
        const name = item.name || item;
        const div = document.createElement('div');
        div.className = 'typeahead-item';

        if (type === 'doctors') {
            const workload = getDoctorWorkload(name);
            const status = getWorkloadStatus(workload);
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${name}</span>
                    <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: ${status.color}; color: white; font-weight: 600;">
                        Workload: ${workload}
                    </span>
                </div>
            `;
        } else {
            div.innerText = name;
        }

        div.onclick = () => selectTypeAhead(name, type, requestId);
        container.appendChild(div);
    });
}

function selectTypeAhead(value, listKey, requestId) {
    if (requestId === undefined) return; // Only used in monitoring now

    const fieldName = listKey === 'doctors' ? 'doctor' : 'secretary';
    const inputId = `mon-${fieldName}-${requestId}`;
    const input = document.getElementById(inputId);
    if (input) input.value = value;

    const resultsDivId = `typeahead-${listKey}-${requestId}`;
    const resultsDiv = document.getElementById(resultsDivId);
    if (resultsDiv) resultsDiv.innerHTML = '';

    if (listKey === 'doctors') {
        const workload = getDoctorWorkload(value);
        const status = getWorkloadStatus(workload);
        const indicatorId = `mon-doc-workload-${requestId}`;
        const indicator = document.getElementById(indicatorId);

        if (indicator) {
            indicator.style.display = 'inline-block';
            indicator.style.background = status.color;
            indicator.innerText = `Workload: ${workload}`;
            if (workload > 15) {
                indicator.title = "Doctor currently has high workload.";
                if (input) input.style.borderColor = 'var(--danger)';
            } else {
                indicator.title = "";
                if (input) input.style.borderColor = '#ddd';
            }
        }

        // Auto-populate Secretary
        const docObj = state.doctors.find(d => d.name === value);
        if (docObj && docObj.secretary) {
            const secValue = docObj.secretary;
            const secInputId = `mon-secretary-${requestId}`;
            const secInput = document.getElementById(secInputId);
            if (secInput) secInput.value = secValue;

            const req = state.requests.find(r => r.id === requestId);
            if (req) req.monitoring.secretary = secValue;
        }

        validateMonitoringFields(requestId);
    } else {
        validateMonitoringFields(requestId);
    }

    // Auto-save
    const req = state.requests.find(r => r.id === requestId);
    if (req) {
        req.monitoring[fieldName] = value;
        saveData();
    }
}

// --- PARTIAL COMPLETION HANDLER ---
function toggleApplicationStatus(id, appIdx) {
    const r = state.requests.find(record => record.id === id);
    if (!r) return;

    const app = r.requestTypes[appIdx];
    app.completed = !app.completed;

    if (app.completed) {
        app.completedBy = state.user.name;
        app.completedAt = new Date().toISOString();

        r.auditLog.push({
            timestamp: new Date().toISOString(),
            user: state.user.name,
            action: 'Application Completed',
            detail: `Application [${app.type}] completed by ${state.user.name} on ${new Date().toLocaleDateString()}`
        });
    } else {
        app.completedBy = null;
        app.completedAt = null;

        r.auditLog.push({
            timestamp: new Date().toISOString(),
            user: state.user.name,
            action: 'Application Uncompleted',
            detail: `Application [${app.type}] status reset by ${state.user.name}`
        });
    }

    saveData();
    renderView();
    showToast(`Application [${app.type}] ${app.completed ? 'marked as complete' : 'reset'}`, "success");
}

function renderDateByField(label, key, val, requestId, hasNA = false, autoStaff = false, required = false) {
    if (!val) val = { date: '', by: '' };
    const r = state.requests.find(req => req.id === requestId);
    const lockedStatuses = ['COLLECT', 'CANCELLED'];
    const isLocked = (hasNA && val.isNA) || (r && lockedStatuses.includes(r.status));
    const staffValue = autoStaff ? (val.by || state.user.name) : (val.by || '');
    const staffReadOnly = autoStaff || isLocked ? 'readonly' : '';
    const staffClass = (autoStaff || isLocked) ? 'readonly-by' : '';

    return `
        <div class="mon-field-group date-by-group ${isLocked ? 'field-locked' : ''}">
            <label>${label}${required ? ' <span class="mandatory-star">*</span>' : ''}</label>
            <div class="date-by-inputs">
                <input type="date" class="f-mon-input mon-date" id="mon-${key}-date-${requestId}" 
                    value="${val.date || ''}" ${isLocked ? 'disabled' : ''} 
                    onchange="validateMonitoringFields(${requestId})">
                <input type="text" class="f-mon-input mon-by ${staffClass}" id="mon-${key}-by-${requestId}" 
                    placeholder="By" value="${staffValue}" ${staffReadOnly}>
                ${hasNA ? `
                    <button class="btn-na ${val.isNA ? 'active' : ''}" id="mon-${key}-na-${requestId}" 
                        onclick="togglePmrNA(${requestId})" ${isLocked ? 'disabled' : ''}>N/A</button>
                ` : ''}
            </div>
            ${required ? `<div id="error-mon-${key}-${requestId}" class="error-label">Required</div>` : ''}
        </div>
    `;
}

// togglePmrNA removed

function saveMonitoring(id) {
    const idx = state.requests.findIndex(r => r.id === id);
    if (idx === -1) return;
    const r = state.requests[idx];

    // Final Validation Check
    if (!validateMonitoringFields(id, true)) {
        // Log Validation Failure
        r.auditLog.push({
            timestamp: new Date().toISOString(),
            user: state.user.name,
            action: 'Monitoring Save Blocked',
            detail: 'Validation failed: Missing Date Sent, Doctor, or PMR/ICLIC.'
        });
        return showToast("Please complete Date Sent, Doctor Name, and select PMR or ICLIC before saving.", "error");
    }

    // Extract values
    const keys = ['cancellationDate', 'sendDoctorDate', 'completionDate', 'notificationDate', 'handoverDate'];
    const newMonitoring = { ...r.monitoring };

    keys.forEach(k => {
        const dateInput = document.getElementById(`mon-${k}-date-${id}`);
        const byInput = document.getElementById(`mon-${k}-by-${id}`);

        let finalBy = byInput ? byInput.value : '';

        // Auto-detect staff login: If date is changed/added, set 'By' to current user
        if (dateInput && dateInput.value && dateInput.value !== r.monitoring[k].date) {
            finalBy = state.user.name;
        }

        newMonitoring[k] = {
            date: dateInput ? dateInput.value : '',
            by: finalBy
        };
    });

    newMonitoring.pmr = document.getElementById(`mon-pmr-${id}`).checked;
    newMonitoring.iclic = document.getElementById(`mon-iclic-${id}`).checked;
    newMonitoring.doctor = document.getElementById(`mon-doctor-${id}`).value;
    newMonitoring.secretary = document.getElementById(`mon-secretary-${id}`).value;

    // Status Auto-Reflect Logic
    let newStatus = r.status;
    let triggerField = "";

    // Priority order for auto-status (Descending: most specific to least)
    if (newMonitoring.handoverDate.date && r.monitoring.handoverDate.date !== newMonitoring.handoverDate.date) {
        newStatus = 'COLLECT';
        triggerField = "Handover Date";

        // Timeline Lock Audit
        const start = new Date(r.createdAt);
        const end = new Date(newMonitoring.handoverDate.date);
        const elapsed = calculateWorkingDays(start, end);
        r.auditLog.push({
            timestamp: new Date().toISOString(),
            user: state.user.name,
            action: 'Timeline Locked',
            detail: `Timeline locked at Handover (Day ${elapsed} of 21)`
        });
        showToast(`Timeline locked at Day ${elapsed}`, "warning");
    } else if (newMonitoring.completionDate.date && r.monitoring.completionDate.date !== newMonitoring.completionDate.date) {
        newStatus = 'COMPLETE';
        triggerField = "Completion Date";
    } else if (newMonitoring.notificationDate.date && r.monitoring.notificationDate.date !== newMonitoring.notificationDate.date) {
        newStatus = 'NOTIFY';
        triggerField = "Notification Date";
    } else if (newMonitoring.sendDoctorDate.date && r.monitoring.sendDoctorDate.date !== newMonitoring.sendDoctorDate.date) {
        newStatus = 'SENT';
        triggerField = "Send to Doctor Date";
    } else if (newMonitoring.cancellationDate.date && r.monitoring.cancellationDate.date !== newMonitoring.cancellationDate.date) {
        newStatus = 'CANCELLED';
        triggerField = "Cancellation Date";
    }

    if (newStatus !== r.status) {
        const oldStatus = r.status;
        r.status = newStatus;
        r.auditLog.push({
            timestamp: new Date().toISOString(),
            user: state.user.name,
            action: 'Status Auto-Update',
            detail: `${triggerField} updated: ${oldStatus} → ${newStatus}`
        });
        showToast(`Status auto-updated to ${newStatus}`, "info");
    }

    // Overlap Warning Logic (Checks against global state.doctors)
    const sendDate = newMonitoring.sendDoctorDate.date;
    if (sendDate) {
        let warningMsg = "";
        const doctor = state.doctors.find(d => d.name === newMonitoring.doctor);
        const secretary = state.secretaries.find(s => s.name === newMonitoring.secretary);

        if (doctor && doctor.leaveStart && doctor.leaveEnd) {
            if (sendDate >= doctor.leaveStart && sendDate <= doctor.leaveEnd) {
                warningMsg += `Doctor ${doctor.name} is on leave from ${doctor.leaveStart} to ${doctor.leaveEnd}.\n`;
            }
        }
        if (secretary && secretary.leaveStart && secretary.leaveEnd) {
            if (sendDate >= secretary.leaveStart && sendDate <= secretary.leaveEnd) {
                warningMsg += `Secretary ${secretary.name} is on leave from ${secretary.leaveStart} to ${secretary.leaveEnd}.\n`;
            }
        }

        if (warningMsg) {
            if (!confirm(warningMsg + "\nDo you want to proceed and save anyway?")) {
                return; // Cancel save
            }
            // Log warning acknowledgment
            r.auditLog.push({
                timestamp: new Date().toISOString(),
                user: state.user.name,
                action: 'Leave Warning Acknowledged',
                detail: warningMsg.replace(/\n/g, " ")
            });
        }
    }

    const oldMonitoring = JSON.parse(JSON.stringify(r.monitoring));
    r.monitoring = newMonitoring;

    // Detect all changed fields for audit
    const changedFields = [];
    const dateKeys = ['cancellationDate', 'sendDoctorDate', 'completionDate', 'notificationDate', 'handoverDate'];

    dateKeys.forEach(k => {
        if (oldMonitoring[k].date !== newMonitoring[k].date) {
            changedFields.push(`${k.replace('Date', '')} Date: ${oldMonitoring[k].date || 'N/A'} → ${newMonitoring[k].date || 'N/A'}`);
        }
    });

    if (oldMonitoring.doctor !== newMonitoring.doctor) {
        changedFields.push(`Doctor: ${oldMonitoring.doctor || 'N/A'} → ${newMonitoring.doctor || 'N/A'}`);
    }
    if (oldMonitoring.secretary !== newMonitoring.secretary) {
        changedFields.push(`Secretary: ${oldMonitoring.secretary || 'N/A'} → ${newMonitoring.secretary || 'N/A'}`);
    }
    if (oldMonitoring.memo !== newMonitoring.memo) {
        changedFields.push(`Memo updated`);
    }

    // Explicit log for the Save action
    r.auditLog.push({
        timestamp: new Date().toISOString(),
        user: state.user.name,
        action: 'Save Monitoring',
        detail: changedFields.length > 0 ? changedFields.join('; ') : 'Re-saved without major changes'
    });

    saveData();
    showToast("Monitoring updated successfully!", "success");
    renderView();
}

function addRemark(id) {
    const textarea = document.getElementById(`new-remark-${id}`);
    const text = textarea.value.trim();
    if (!text) return;

    const idx = state.requests.findIndex(r => r.id === id);
    if (idx === -1) return;
    const r = state.requests[idx];

    const newRemark = {
        timestamp: new Date().toISOString(),
        user: state.user.name,
        text: text
    };

    if (!r.history) r.history = [];
    r.history.push(newRemark);

    // Audit
    r.auditLog.push({
        timestamp: new Date().toISOString(),
        user: state.user.name,
        action: 'Add Remark',
        text: text
    });

    saveData();
    textarea.value = '';
    saveData();
    textarea.value = '';
    showToast("Remark added.", "success");
    renderView();
}

function saveAndRemark(id) {
    const textarea = document.getElementById(`new-remark-${id}`);
    const text = textarea.value.trim();

    // 1. Add Remark if text exists
    if (text) {
        addRemark(id);
    }

    // 2. Perform Save Monitoring
    saveMonitoring(id);

    // 3. Auto-log signature if it looks like a signature
    const r = state.requests.find(req => req.id === id);
    if (r && text && (text.toLowerCase().includes('sign') || text.toLowerCase().includes('done'))) {
        r.auditLog.push({
            timestamp: new Date().toISOString(),
            user: state.user.name,
            action: 'Tablet Acknowledgment',
            detail: `Secretary acknowledged/signed: "${text}"`
        });
        saveData();
    }
}

// --- SETTINGS VIEW ---
function renderSettingsView() {
    return `
        <div class="panel-card fade-in">
            <div class="panel-title"><span>⚙️</span> Master List Management</div>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 24px;">
                Manage global availability and linking. Updating the Doctor Leave dates here will reflect across all monitoring panels.
            </p>
            
            <div class="settings-full-width">
                <div class="panel-subtitle" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>👨‍⚕️ Doctor Master List & Availability</span>
                    <label class="btn-upload btn-sm">
                        <span>📤</span> Bulk Upload CSV/Excel
                        <input type="file" accept=".csv,.txt" onchange="handleFileUpload(event, 'doctors')" style="display: none;">
                    </label>
                </div>
                <div class="settings-table-wrapper">
                    <table class="settings-table" id="doctors-table">
                        <thead>
                            <tr>
                                <th>Doctor Name</th>
                                <th>Secretary</th>
                                <th>Leave Start</th>
                                <th>Leave End</th>
                                <th style="width: 50px;"></th>
                            </tr>
                        </thead>
                        <tbody id="doctors-table-body">
                            ${state.doctors.map((d, i) => renderDoctorRow(d, i)).join('')}
                        </tbody>
                    </table>
                </div>
                <button class="btn btn-ghost btn-sm" style="margin-top: 12px;" onclick="addDoctorRow()">➕ Add New Doctor</button>
            </div>

            <div class="settings-grid" style="margin-top: 32px; border-top: 1px solid var(--border); padding-top: 32px;">
                <div class="settings-section">
                    <div class="panel-subtitle"><span>👩‍💼</span> Secretary Master List</div>
                    <div class="form-group">
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                            <label style="margin-bottom: 0;">Unique Secretary Names</label>
                            <label class="btn-upload">
                                <span>📤</span> Upload File
                                <input type="file" accept=".csv,.txt" onchange="handleFileUpload(event, 'secretaries')" style="display: none;">
                            </label>
                        </div>
                        <textarea id="settings-secretaries" class="f-mon-input" style="height: 200px; font-family: monospace;">${state.secretaries.map(s => s.name).join('\n')}</textarea>
                    </div>
                </div>
            </div>
            
            <div class="form-actions" style="margin-top: 32px;">
                <button class="btn btn-primary" onclick="saveMasterLists()">SAVE ALL CHANGES</button>
                <button class="btn btn-ghost" onclick="resetMasterLists()">RESET TO DEFAULT</button>
            </div>

            <div class="sticky-save-container">
                <button class="sticky-save-btn" onclick="saveMasterLists()">
                    <span>💾</span> SAVE ALL CHANGES
                </button>
            </div>
        </div>
    `;
}

function renderDoctorRow(d, i) {
    return `
        <tr class="doctor-row">
            <td><input type="text" class="f-table-input doc-name" placeholder="Doctor Name" value="${d.name || ''}"></td>
            <td><input type="text" class="f-table-input doc-sec" placeholder="Secretary" value="${d.secretary || ''}"></td>
            <td><input type="date" class="f-table-input doc-start" value="${d.leaveStart || ''}"></td>
            <td><input type="date" class="f-table-input doc-end" value="${d.leaveEnd || ''}"></td>
            <td><button class="btn-remove-row" onclick="this.closest('tr').remove()">&times;</button></td>
        </tr>
    `;
}

function addDoctorRow() {
    const tbody = document.getElementById('doctors-table-body');
    const row = document.createElement('tr');
    row.className = 'doctor-row';
    row.innerHTML = renderDoctorRow({ name: '', secretary: '', leaveStart: '', leaveEnd: '' }, -1);
    tbody.appendChild(row);
}

function handleFileUpload(event, listKey) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;
        const rawLines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');

        if (rawLines.length === 0) {
            showToast("File is empty", "error");
            return;
        }

        let processedData = [];

        // Detect delimiter (Comma, Tab, or Pipe)
        const firstLine = rawLines[0];
        let delimiter = ',';
        if (firstLine.includes('\t')) delimiter = '\t';
        else if (firstLine.includes('|')) delimiter = '|';

        const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());
        const docIdx = headers.indexOf('doctor');
        const secIdx = headers.indexOf('secretary');

        // Check if this looks like a multi-column file with headers
        const isMultiColumn = docIdx !== -1 || secIdx !== -1;

        if (isMultiColumn) {
            for (let i = 1; i < rawLines.length; i++) {
                const parts = rawLines[i].split(delimiter).map(p => p.trim());
                if (listKey === 'doctors') {
                    const docName = docIdx !== -1 ? parts[docIdx] : '';
                    const secName = secIdx !== -1 ? parts[secIdx] : '';
                    if (docName) {
                        processedData.push(secName ? `${docName} | ${secName}` : docName);
                    }
                } else if (listKey === 'secretaries') {
                    const secName = secIdx !== -1 ? parts[secIdx] : '';
                    if (secName) processedData.push(secName);
                }
            }
        } else {
            // Fallback for simple list or mismatched columns
            processedData = rawLines.filter(line => {
                const l = line.toLowerCase();
                return !l.startsWith('no') && !l.startsWith('name') && !l.startsWith('doctor') && !l.startsWith('secretary');
            });
        }

        // De-duplicate for secretaries
        if (listKey === 'secretaries') {
            processedData = [...new Set(processedData)];
        }

        if (processedData.length === 0) {
            showToast("No valid data found in file for " + listKey, "error");
            return;
        }

        if (listKey === 'doctors') {
            const tbody = document.getElementById('doctors-table-body');
            // If replace confirmed, clear first
            if (confirm(`Found ${processedData.length} doctors. Replace current list?`)) {
                tbody.innerHTML = '';
            }

            processedData.forEach(line => {
                const delimiter = line.includes('|') ? '|' : (line.includes(',') ? ',' : null);
                let name = line;
                let secretary = '';
                if (delimiter) {
                    const parts = line.split(delimiter).map(p => p.trim());
                    name = parts[0];
                    secretary = parts[1] || '';
                }
                const row = document.createElement('tr');
                row.className = 'doctor-row';
                row.innerHTML = renderDoctorRow({ name, secretary, leaveStart: '', leaveEnd: '' }, -1);
                tbody.appendChild(row);
            });
        } else {
            const textarea = document.getElementById('settings-secretaries');
            if (confirm(`Found ${processedData.length} records. Replace current list?`)) {
                textarea.value = processedData.join('\n');
            } else {
                const currentVal = textarea.value.trim();
                textarea.value = currentVal ? currentVal + '\n' + processedData.join('\n') : processedData.join('\n');
            }
        }

        showToast(`Imported ${processedData.length} ${listKey}.`, "success");
        event.target.value = '';
    };

    reader.onerror = () => showToast("Error reading file", "error");
    reader.readAsText(file);
}

function saveMasterLists() {
    // Scrape Doctors Table
    const docRows = document.querySelectorAll('.doctor-row');
    const newDoctors = [];
    docRows.forEach(row => {
        const name = row.querySelector('.doc-name').value.trim();
        const secretary = row.querySelector('.doc-sec').value.trim();
        const leaveStart = row.querySelector('.doc-start').value;
        const leaveEnd = row.querySelector('.doc-end').value;
        if (name) {
            newDoctors.push({ name, secretary, leaveStart, leaveEnd });
        }
    });

    // Scrape Secretary Textarea
    const secInput = document.getElementById('settings-secretaries').value;
    const rawSecretaries = secInput.split('\n').map(s => s.trim()).filter(s => s !== '');

    if (newDoctors.length === 0) {
        return showToast("Doctor list cannot be empty", "error");
    }

    state.doctors = newDoctors;
    state.secretaries = rawSecretaries.map(name => {
        const existing = state.secretaries.find(s => s.name === name);
        return {
            name: name,
            leaveStart: existing ? existing.leaveStart : '',
            leaveEnd: existing ? existing.leaveEnd : ''
        };
    });

    apiCall('save_meta.php', 'POST', { doctors: state.doctors, secretaries: state.secretaries }).then(res => {
        if (res && res.success) {
            // Audit Trail
            const auditEntry = {
                timestamp: new Date().toISOString(),
                user: state.user.name,
                action: 'Save Secretary Master List',
                detail: `Updated ${newDoctors.length} doctors and ${rawSecretaries.length} secretaries.`
            };
            state.systemAuditLog.push(auditEntry);
            localStorage.setItem('MedReport_System_Audit', JSON.stringify(state.systemAuditLog));

            console.log(`[Audit Trail] Master List Updated:`, auditEntry);

            showToast("All changes saved successfully.", "success");
            renderView();
        } else {
            showToast("Failed to save to database.", "error");
        }
    });
}

function resetMasterLists() {
    if (!confirm("Are you sure you want to reset to default lists?")) return;

    localStorage.removeItem('MedReport_Master_Doctors');
    localStorage.removeItem('MedReport_Master_Secretaries');

    state.doctors = migrateMasterList(null, 'doctors');
    state.secretaries = migrateMasterList(null, 'secretaries');

    showToast("Lists reset to defaults.", "info");
    renderView();
}


// --- MONITORING VALIDATION ---
function validateMonitoringFields(id, isSubmit = false) {
    const r = state.requests.find(req => req.id === id);
    if (!r) return false;

    // Fields
    const sendDateInput = document.getElementById(`mon-sendDoctorDate-date-${id}`);
    const doctorInput = document.getElementById(`mon-doctor-${id}`);
    const pmrCheck = document.getElementById(`mon-pmr-${id}`);
    const iclicCheck = document.getElementById(`mon-iclic-${id}`);
    const saveBtn = document.getElementById(`save-mon-${id}`);

    // Error Labels
    const sendDateError = document.getElementById(`error-mon-sendDoctorDate-${id}`);
    const doctorError = document.getElementById(`error-mon-doctor-${id}`);
    const checkboxError = document.getElementById(`error-mon-checkbox-${id}`);

    const isDateValid = sendDateInput && sendDateInput.value !== '';
    const isDoctorValid = doctorInput && doctorInput.value.trim() !== '';
    const isChecksValid = (pmrCheck && pmrCheck.checked) || (iclicCheck && iclicCheck.checked);

    const isValid = isDateValid && isDoctorValid && isChecksValid;

    // UI Feedback (Borders)
    if (isSubmit || sendDateInput.value) {
        sendDateInput.classList.toggle('validation-error', !isDateValid);
        if (sendDateError) sendDateError.style.display = isDateValid ? 'none' : 'block';
    }

    if (isSubmit || doctorInput.value) {
        doctorInput.classList.toggle('validation-error', !isDoctorValid);
        if (doctorError) doctorError.style.display = isDoctorValid ? 'none' : 'block';
    }

    const checkboxGroup = document.getElementById(`mon-checkbox-group-${id}`);
    if (isSubmit || (pmrCheck.checked || iclicCheck.checked)) {
        checkboxGroup.classList.toggle('validation-error', !isChecksValid);
        if (checkboxError) checkboxError.style.display = isChecksValid ? 'none' : 'block';
    }

    // Enable/Disable Save Button
    if (saveBtn) {
        saveBtn.disabled = !isValid;
    }

    return isValid;
}


// --- REPORT PRINTING ---
function printDoctorReport() {
    const filtered = filterData().filter(r => r.monitoring.sendDoctorDate.date !== '');

    if (filtered.length === 0) {
        return showToast("No records with 'Date Sent' found for printing.", "warning");
    }

    // Grouping
    const groups = {};
    filtered.forEach(r => {
        const doc = r.monitoring.doctor || 'Unassigned Doctor';
        const sec = r.monitoring.secretary || 'Unassigned Secretary';

        if (!groups[doc]) groups[doc] = {};
        if (!groups[doc][sec]) groups[doc][sec] = [];

        groups[doc][sec].push(r);
    });

    // Sort Doctors and Secretaries
    const sortedDocs = Object.keys(groups).sort();

    const reportHtml = `
        <div class="report-header">
            <div class="report-title">
                <h1>Applications Sent to Doctor</h1>
                <p>Registry Record Report</p>
            </div>
            <div class="report-meta">
                <div>Printed By: ${state.user.name}</div>
                <div>Date: ${new Date().toLocaleString()}</div>
                <div>Total Records: ${filtered.length}</div>
            </div>
        </div>

        ${sortedDocs.map(doc => `
            <div class="doc-group">
                <div class="doc-header">
                    <h2>Doctor: ${doc}</h2>
                </div>
                ${Object.keys(groups[doc]).sort().map(sec => `
                    <div class="sec-group">
                        <div class="sec-header">
                            <h3>Secretary: ${sec}</h3>
                        </div>
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th>Encounter ID</th>
                                    <th>Patient Name</th>
                                    <th>Date Sent</th>
                                    <th>Status</th>
                                    <th>Export</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${groups[doc][sec].map(r => `
                                    <tr>
                                        <td>${r.patientMRN}</td>
                                        <td>${r.patientName}</td>
                                        <td>${r.monitoring.sendDoctorDate.date}</td>
                                        <td>${r.status}</td>
                                        <td>${r.monitoring.pmr ? 'PMR' : ''} ${r.monitoring.iclic ? 'ICLIC' : ''}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </div>
        `).join('')}
    `;

    const container = document.getElementById('print-report-container');
    container.innerHTML = reportHtml;

    // Audit Log
    const docCount = sortedDocs.length;
    const secCount = sortedDocs.reduce((acc, doc) => acc + Object.keys(groups[doc]).length, 0);

    // Add to system-wide audit if available, else log to a dedicated summary record (or just alert)
    console.log(`Report printed: ${filtered.length} records, ${docCount} doctors, ${secCount} secretaries.`);
    showToast(`Generating report for ${filtered.length} records...`, "info");

    window.print();
}

// --- DELIVERY LISTING VIEW ---
function renderDeliveryListingView() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = state.filters.deliveryStart || today;
    const endDate = state.filters.deliveryEnd || today;

    const filtered = state.requests.filter(r => {
        const sendDate = r.monitoring.sendDoctorDate.date;
        if (!sendDate) return false;

        const matchesDate = sendDate >= startDate && sendDate <= endDate;
        const matchesMethod = state.filters.deliveryMethod === 'All' || r.deliveryMethod === state.filters.deliveryMethod;

        return matchesDate && matchesMethod;
    });

    // Grouping for preview (Secretary -> List of records sorted by Doctor)
    const groups = {};
    filtered.forEach(r => {
        const sec = r.monitoring.secretary || 'Unassigned Secretary';
        if (!groups[sec]) groups[sec] = [];
        groups[sec].push(r);
    });

    // Sort records within each secretary group by Doctor Name
    Object.keys(groups).forEach(sec => {
        groups[sec].sort((a, b) => (a.monitoring.doctor || '').localeCompare(b.monitoring.doctor || ''));
    });

    return `
        <div class="panel-card fade-in" style="padding: 24px;">
            <div class="panel-title"><span>🚚</span> DELIVERY FILTERS</div>
            <div class="search-panel-grid">
                <div class="form-group">
                    <label>Date Sent (Start)</label>
                    <input type="date" class="f-input" value="${startDate}" 
                        onchange="state.filters.deliveryStart = this.value; renderView()">
                </div>
                <div class="form-group">
                    <label>Date Sent (End)</label>
                    <input type="date" class="f-input" value="${endDate}" 
                        onchange="state.filters.deliveryEnd = this.value; renderView()">
                </div>
                <div class="search-actions">
                    <button class="btn btn-primary" onclick="printDeliveryListing()">🖨️ PRINT LISTING</button>
                    <button class="btn btn-ghost" onclick="state.filters.deliveryStart = ''; state.filters.deliveryEnd = ''; renderView()">RESET</button>
                </div>
            </div>
        </div>

        <div class="panel-card fade-in" style="padding: 24px;">
            <div class="panel-title"><span>📋</span> PREVIEW LISTING (BY SECRETARY)</div>
            <div class="delivery-preview">
                ${filtered.length === 0 ? `
                    <div style="text-align: center; color: var(--text-muted); padding: 40px;">
                        No records found for the selected date range.
                    </div>
                ` : Object.keys(groups).sort().map(sec => `
                    <div class="preview-group" id="group-${sec.replace(/\s+/g, '-')}">
                        <div class="preview-sec-header">Secretary: <strong>${sec}</strong></div>
                        <table class="data-table compact-table">
                            <thead>
                                <tr>
                                    <th style="width: 40px;">No.</th>
                                    <th style="width: 30px;"></th>
                                    <th>MRN</th>
                                    <th>Patient Name</th>
                                    <th>Doctor Name</th>
                                    <th>Date Sent</th>
                                    <th>Secretary Name</th>
                                    <th style="width: 120px;">Signature</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${groups[sec].map((r, idx) => {
        const isSaved = r.monitoring?.deliveryAcknowledged;
        return `
                                    <tr>
                                        <td style="color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
                                        <td><input type="checkbox" class="delivery-check"></td>
                                        <td style="font-weight: 700;">${r.patientMRN}</td>
                                        <td>${r.patientName}</td>
                                        <td>${r.monitoring.doctor || '-'}</td>
                                        <td>${r.monitoring.sendDoctorDate.date}</td>
                                        <td>${sec}</td>
                                        <td style="border-left: 1px solid var(--border); background: #fafafa;"></td>
                                    </tr>
                                    `;
    }).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function printDeliveryListing() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = state.filters.deliveryStart || today;
    const endDate = state.filters.deliveryEnd || today;

    const filtered = state.requests.filter(r => {
        const sendDate = r.monitoring.sendDoctorDate.date;
        if (!sendDate) return false;
        return sendDate >= startDate && sendDate <= endDate;
    });

    if (filtered.length === 0) {
        return showToast("No records found for printing.", "warning");
    }

    // Grouping by Secretary
    const groups = {};
    filtered.forEach(r => {
        const sec = r.monitoring.secretary || 'Unassigned Secretary';
        if (!groups[sec]) groups[sec] = [];
        groups[sec].push(r);
    });

    // Sort records within group by Doctor
    Object.keys(groups).forEach(sec => {
        groups[sec].sort((a, b) => (a.monitoring.doctor || '').localeCompare(b.monitoring.doctor || ''));
    });

    const reportHtml = `
        <div class="delivery-listing-print">
            <div class="report-header">
                <div class="report-title">
                    <h1 style="font-size: 1.4rem; margin-bottom: 4px;">Delivery Listing by Secretary</h1>
                    <p style="font-size: 0.9rem;">Date Range: ${startDate} to ${endDate}</p>
                </div>
                <div class="report-meta" style="font-size: 0.85rem;">
                    <div>Printed By: ${state.user.name}</div>
                    <div>Date: ${new Date().toLocaleString('en-MY')}</div>
                    <div>Total Records: ${filtered.length}</div>
                </div>
            </div>

            ${Object.keys(groups).sort().map(sec => `
                <div class="sec-group-print">
                    <div class="sec-header-row">
                        Secretary: <strong>${sec}</strong>
                    </div>
                    <table class="report-table compact-report-table">
                        <thead>
                            <tr>
                                <th style="width: 40px;">No.</th>
                                <th style="width: 15%;">MRN</th>
                                <th style="width: 20%;">Patient Name</th>
                                <th style="width: 20%;">Doctor Name</th>
                                <th style="width: 15%;">Date Sent</th>
                                <th style="width: 15%;">Signature</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${groups[sec].map((r, idx) => `
                                <tr>
                                    <td style="text-align: center;">${idx + 1}</td>
                                    <td>${r.patientMRN}</td>
                                    <td>${r.patientName}</td>
                                    <td>${r.monitoring.doctor || '-'}</td>
                                    <td style="text-align: center;">${r.monitoring.sendDoctorDate.date}</td>
                                    <td style="height: 35px;"></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `).join('')}

            <div class="print-footer">
                <span>Generated by System | MedReport Pro</span>
                <span class="page-number"></span>
            </div>
        </div>
    `;

    const container = document.getElementById('print-report-container');
    container.innerHTML = reportHtml;

    // Audit
    console.log(`[Audit] ${state.user.name} printed Delivery Listing by Secretary (${filtered.length} records). Filter: ${startDate} to ${endDate}`);
    showToast(`Generating compact delivery listing...`, "info");

    window.print();
}


function renderProcessFlowView() {
    const activeStep = state.activeProcessStep || 'enquiry';
    const step = PROCESS_INSTRUCTIONS[activeStep];

    return `
        <div class="process-flow-container fade-in">
            <div class="flow-chart">
                <div class="flow-step ${activeStep === 'enquiry' ? 'active' : ''}" onclick="showProcessStep('enquiry')">
                    Enquiry Intake
                </div>
                <div class="flow-step ${activeStep === 'check' ? 'active' : ''}" onclick="showProcessStep('check')">
                    Check Request
                </div>
                <div class="flow-step ${activeStep === 'tracker' ? 'active' : ''}" onclick="showProcessStep('tracker')">
                    Application Tracker
                </div>
                <div class="flow-step ${activeStep === 'delivery' ? 'active' : ''}" onclick="showProcessStep('delivery')">
                    Delivery Listing
                </div>
                <div class="flow-step ${activeStep === 'audit' ? 'active' : ''}" onclick="showProcessStep('audit')">
                    Audit Log
                </div>
            </div>

            <div class="instruction-panel">
                <div class="instruction-header">
                    <h3>${step.title}</h3>
                    <button class="btn btn-ghost" style="color: white; border-color: rgba(255,255,255,0.3);" onclick="exportProcessFlow()">
                        📥 EXPORT PDF
                    </button>
                </div>
                <div class="instruction-body">
                    <div class="step-meta">
                        <strong>Overview:</strong> ${step.meta}
                    </div>
                    ${step.content}
                </div>
            </div>
        </div>
    `;
}

function showProcessStep(stepId) {
    state.activeProcessStep = stepId;
    renderView();

    // Audit Log
    console.log(`[Audit] ${state.user.name} viewed instruction: ${PROCESS_INSTRUCTIONS[stepId].title}`);
}

function renderInstructionsView() {
    const activeStep = state.activeProcessStep || 'enquiry';
    const step = PROCESS_INSTRUCTIONS[activeStep];

    return `
        <div class="panel-card fade-in" style="padding: 24px;">
            <div class="panel-subtitle"><span>📖</span> WORKING INSTRUCTIONS</div>
            <div class="process-flow-container" style="margin-top: 16px;">
                <div class="flow-chart">
                    ${Object.keys(PROCESS_INSTRUCTIONS).map(id => `
                        <div class="flow-step ${activeStep === id ? 'active' : ''}" onclick="showProcessStep('${id}')">
                            ${PROCESS_INSTRUCTIONS[id].title}
                        </div>
                    `).join('')}
                </div>
                <div class="instruction-panel">
                    <div class="instruction-header">
                        <h3>${step.title}</h3>
                        <button class="btn btn-ghost" style="color: white; border-color: rgba(255,255,255,0.3);" onclick="exportProcessFlow()">
                            📥 EXPORT PDF
                        </button>
                    </div>
                    <div class="instruction-body">
                        <div class="step-meta"><strong>Overview:</strong> ${step.meta}</div>
                        ${step.content}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderGlobalHistoryLogView() {
    const allLogs = [];

    // Collect from active requests
    state.requests.forEach(r => {
        if (r.auditLog) {
            r.auditLog.forEach(log => {
                allLogs.push({ ...log, mrn: r.patientMRN, name: r.patientName, isDeleted: false });
            });
        }
    });

    // Collect from deleted requests
    state.deletedRequests.forEach(r => {
        if (r.auditLog) {
            r.auditLog.forEach(log => {
                allLogs.push({ ...log, mrn: r.patientMRN, name: r.patientName, isDeleted: true });
            });
        }
    });

    // Collect from system logs
    state.systemAuditLog.forEach(log => {
        allLogs.push({ ...log, mrn: 'SYSTEM', name: 'Master List', isDeleted: false });
    });

    // Filtering
    const search = state.historyFilters.search.toLowerCase();
    const date = state.historyFilters.date;
    const type = state.historyFilters.type;

    const filteredLogs = allLogs.filter(log => {
        const matchesSearch = !search ||
            (log.mrn || '').toLowerCase().includes(search) ||
            (log.name || '').toLowerCase().includes(search) ||
            (log.detail || '').toLowerCase().includes(search) ||
            (log.action || '').toLowerCase().includes(search);

        const matchesDate = !date || (log.timestamp || '').startsWith(date);

        let matchesType = true;
        if (type === 'Save') matchesType = log.action.includes('Save') || log.action.includes('Monitoring');
        else if (type === 'Status') matchesType = log.action.includes('Status') || log.action.includes('Collect') || log.action.includes('Cancel');
        else if (type === 'Submission') matchesType = log.action.includes('Add') || log.action.includes('Registration');

        return matchesSearch && matchesDate && matchesType;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return `
        <div class="panel-card fade-in" style="padding: 24px;">
            <div class="history-filters">
                <div class="form-group">
                    <label>Search MRN / Patient / Action</label>
                    <input type="text" class="f-input" placeholder="Search..." value="${state.historyFilters.search}" 
                        oninput="state.historyFilters.search = this.value; renderView()">
                </div>
                <div class="form-group">
                    <label>Date Filter</label>
                    <input type="date" class="f-input" value="${state.historyFilters.date}" 
                        onchange="state.historyFilters.date = this.value; renderView()">
                </div>
                <div class="form-group">
                    <label>Action Category</label>
                    <select class="f-input" onchange="state.historyFilters.type = this.value; renderView()">
                        <option value="All" ${type === 'All' ? 'selected' : ''}>All Actions</option>
                        <option value="Save" ${type === 'Save' ? 'selected' : ''}>Save / Edits</option>
                        <option value="Status" ${type === 'Status' ? 'selected' : ''}>Status Updates</option>
                        <option value="Submission" ${type === 'Submission' ? 'selected' : ''}>New Submissions</option>
                    </select>
                </div>
            </div>

            <div class="table-header-row">
                <div class="panel-title" style="margin-bottom: 0;"><span>📜</span> AUDIT TRAIL</div>
                <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">
                    Showing ${filteredLogs.length} events
                </div>
                <button class="btn btn-ghost" style="padding: 6px 12px; font-size: 0.8rem;" onclick="exportGlobalHistory()">
                    📥 EXPORT CSV
                </button>
            </div>

            <div class="global-history-list" style="margin-top: 16px;">
                ${filteredLogs.length === 0 ? `
                    <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                        No history records found.
                    </div>
                ` : filteredLogs.map(log => {
        let typeClass = 'type-status';
        if (log.action.includes('Save') || log.action.includes('Monitoring')) typeClass = 'type-save';
        if (log.action.includes('Add') || log.action.includes('Registration')) typeClass = 'type-submit';
        if (log.action.includes('Delete')) typeClass = 'type-delete';

        return `
                        <div class="history-card ${typeClass}">
                            <div class="history-time">
                                ${new Date(log.timestamp).toLocaleString('en-MY', {
            dateStyle: 'short',
            timeStyle: 'short'
        })}
                            </div>
                            <div>
                                <div class="history-action">${log.action}</div>
                            </div>
                            <div class="history-detail">
                                <span class="history-mrn">${log.mrn || 'N/A'}</span> - ${log.name || 'Unknown'}
                                <div style="font-size: 0.75rem; margin-top: 4px;">${log.detail || log.text || ''}</div>
                                ${log.isDeleted ? '<span class="deleted-tag">DELETED RECORD</span>' : ''}
                            </div>
                            <div class="history-user" style="text-align: right;">
                                👤 ${log.user}
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}

function deleteRequest(id) {
    if (!confirm("Are you sure you want to delete this record? The record will be hidden from the active list but the audit trail will be preserved for compliance.")) return;

    const idx = state.requests.findIndex(r => r.id === id);
    if (idx === -1) return;

    const record = state.requests[idx];

    // Audit trailing
    record.auditLog.push({
        timestamp: new Date().toISOString(),
        user: state.user.name,
        action: 'Delete Record',
        detail: `Record removed by ${state.user.name}`
    });

    // Move to deletedRequests
    state.deletedRequests.push(record);
    state.requests.splice(idx, 1);

    // Persist
    saveData();
    localStorage.setItem('MedReport_Deleted_Data', JSON.stringify(state.deletedRequests));

    renderView();
    showToast("Record archived to history log.", "success");
}

function exportGlobalHistory() {
    const allLogs = [];
    state.requests.forEach(r => {
        if (r.auditLog) {
            r.auditLog.forEach(log => allLogs.push({ ...log, mrn: r.patientMRN, name: r.patientName, status: 'Active' }));
        }
    });
    state.deletedRequests.forEach(r => {
        if (r.auditLog) {
            r.auditLog.forEach(log => allLogs.push({ ...log, mrn: r.patientMRN, name: r.patientName, status: 'Deleted' }));
        }
    });

    if (allLogs.length === 0) return showToast("No logs to export", "warning");

    const headers = ['Timestamp', 'User', 'Action', 'MRN', 'Patient Name', 'Record Status', 'Detail'];
    const rows = allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.user,
        log.action,
        log.mrn || 'N/A',
        log.name || 'N/A',
        log.status,
        (log.detail || log.text || '').replace(/"/g, '""')
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `MedReport_AuditLog_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Audit log exported to CSV", "success");
}

function renderStatusDistributionHub() {
    const timeframe = state.statusTimeframe;
    const isTrend = state.statusChartView === 'trend';
    const now = new Date();

    // Aggregate Data
    const counts = { APPLY: 0, SENT: 0, NOTIFY: 0, COLLECT: 0, COMPLETE: 0, CANCELLED: 0 };
    const filteredRequests = state.requests.filter(r => {
        const date = new Date(r.createdAt);
        if (timeframe === 'Daily') {
            return date.toDateString() === now.toDateString();
        } else if (timeframe === 'Weekly') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            return date >= oneWeekAgo;
        } else if (timeframe === 'Monthly') {
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        } else if (timeframe === 'Yearly') {
            return date.getFullYear() === now.getFullYear();
        }
        return true;
    });

    filteredRequests.forEach(r => {
        const status = (r.status || 'APPLY').toUpperCase();
        if (counts[status] !== undefined) counts[status]++;
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const statusColors = {
        APPLY: '#f97316', // Orange
        SENT: '#3b82f6',  // Blue
        NOTIFY: '#8b5cf6', // Violet
        COLLECT: '#f97316', // Orange
        COMPLETE: '#10b981', // Green
        CANCELLED: '#ef4444' // Red
    };

    const chartHtml = isTrend ? `
        <div class="dist-trend-card fade-in">
            <table class="trend-table">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Record Count</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(counts).map(([status, count]) => `
                        <tr>
                            <td>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${statusColors[status]};"></div>
                                    <span class="trend-item-label">${status}</span>
                                </div>
                            </td>
                            <td>${count}</td>
                            <td>${total > 0 ? ((count / total) * 100).toFixed(1) : 0}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : `
        <div class="dist-chart-card fade-in">
            ${Object.entries(counts).map(([status, count]) => {
        const perc = total > 0 ? (count / total * 100) : 0;
        return `
                    <div class="dist-bar-row">
                        <div class="dist-bar-meta">
                            <span>${status}</span>
                            <span>${count} (${perc.toFixed(1)}%)</span>
                        </div>
                        <div class="dist-bar-bg">
                            <div class="dist-bar-fill" style="width: ${perc}%; background: ${statusColors[status]};"></div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;

    return `
        <div class="distribution-hub-container fade-in">
            <div class="dist-header-actions">
                <div class="timeframe-filter">
                    ${['Daily', 'Weekly', 'Monthly', 'Yearly'].map(tf => `
                        <button class="tf-btn ${timeframe === tf ? 'active' : ''}" onclick="setStatusTimeframe('${tf}')">${tf}</button>
                    `).join('')}
                </div>
                
                <div class="chart-toggle-group">
                    <button class="btn btn-ghost btn-sm" onclick="toggleStatusChart()">
                        ${isTrend ? '📊 SHOW BARS' : '📈 SHOW TREND LIST'}
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="exportStatusDistribution()">
                        📥 EXPORT REPORT
                    </button>
                </div>
            </div>

            ${chartHtml}

            <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center;">
                * Data reflects records created within the selected <strong>${timeframe}</strong> timeframe.
            </div>
        </div>
    `;
}

function setStatusTimeframe(tf) {
    state.statusTimeframe = tf;

    // Audit Logging
    const counts = { APPLY: 0, SENT: 0, NOTIFY: 0, COLLECT: 0, COMPLETE: 0, CANCELLED: 0 };
    const now = new Date();
    state.requests.forEach(r => {
        const date = new Date(r.createdAt);
        let match = false;
        if (tf === 'Daily') match = date.toDateString() === now.toDateString();
        else if (tf === 'Weekly') {
            const weekAgo = new Date();
            weekAgo.setDate(now.getDate() - 7);
            match = date >= weekAgo;
        } else if (tf === 'Monthly') match = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        else if (tf === 'Yearly') match = date.getFullYear() === now.getFullYear();

        if (match) {
            const status = (r.status || 'APPLY').toUpperCase();
            if (counts[status] !== undefined) counts[status]++;
        }
    });

    console.log(`[Audit] ${state.user.name} generated Status Distribution for ${tf}. Counts:`, counts);

    renderView();
    showToast(`Timeframe updated to ${tf}`, "info");
}

function toggleStatusChart() {
    state.statusChartView = state.statusChartView === 'bar' ? 'trend' : 'bar';
    renderView();
}

function exportStatusDistribution() {
    const timeframe = state.statusTimeframe;
    const now = new Date();
    const counts = { APPLY: 0, SENT: 0, NOTIFY: 0, COLLECT: 0, COMPLETE: 0, CANCELLED: 0 };

    state.requests.forEach(r => {
        const date = new Date(r.createdAt);
        let match = false;
        if (timeframe === 'Daily') match = date.toDateString() === now.toDateString();
        else if (timeframe === 'Weekly') {
            const weekAgo = new Date();
            weekAgo.setDate(now.getDate() - 7);
            match = date >= weekAgo;
        } else if (timeframe === 'Monthly') match = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        else if (timeframe === 'Yearly') match = date.getFullYear() === now.getFullYear();

        if (match) {
            const status = (r.status || 'APPLY').toUpperCase();
            if (counts[status] !== undefined) counts[status]++;
        }
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    let csvContent = `Status Distribution Report (${timeframe})\n`;
    csvContent += `Generated by: ${state.user.name}\n`;
    csvContent += `Timestamp: ${new Date().toLocaleString()}\n\n`;
    csvContent += `Status,Count,Percentage\n`;

    Object.entries(counts).forEach(([status, count]) => {
        const perc = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        csvContent += `${status},${count},${perc}%\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Status_Distribution_${timeframe}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Distribution report exported", "success");
}

function renderDailyRoutineView() {
    const routine = state.dailyRoutine;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeframe = routine.timeframe || 'Day';
    const searchTerm = state.routineSearch.toLowerCase();

    // Helper to filter by timeframe
    const filterByTime = (items) => {
        return items.filter(item => {
            const itemDate = new Date(item.date);
            if (timeframe === 'Day') {
                return item.date === todayStr;
            } else if (timeframe === 'Week') {
                const weekAgo = new Date();
                weekAgo.setDate(now.getDate() - 7);
                return itemDate >= weekAgo;
            } else if (timeframe === 'Month') {
                return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
            } else if (timeframe === 'Year') {
                return itemDate.getFullYear() === now.getFullYear();
            }
            return true;
        });
    };

    let filteredEmails = filterByTime(routine.emails);
    let filteredCalls = filterByTime(routine.calls);
    let filteredCQ = filterByTime(routine.counterQueries || []);

    if (searchTerm) {
        filteredEmails = filteredEmails.filter(e =>
            (e.identifier && e.identifier.toLowerCase().includes(searchTerm)) ||
            (e.sender && e.sender.toLowerCase().includes(searchTerm))
        );
        filteredCalls = filteredCalls.filter(c =>
            (c.caller && c.caller.toLowerCase().includes(searchTerm)) ||
            (c.identifier && c.identifier.toLowerCase().includes(searchTerm)) ||
            (c.type && c.type.toLowerCase().includes(searchTerm))
        );
        filteredCQ = filteredCQ.filter(cq =>
            (cq.visitor && cq.visitor.toLowerCase().includes(searchTerm)) ||
            (cq.identifier && cq.identifier.toLowerCase().includes(searchTerm)) ||
            (cq.type && cq.type.toLowerCase().includes(searchTerm))
        );
    }

    // Email Stats
    const totalEmails = filteredEmails.length;
    const repliedEmails = filteredEmails.filter(e => e.status === 'Replied').length;
    const escalatedEmails = filteredEmails.filter(e => e.status === 'Escalated').length;
    const pendingEmails = totalEmails - repliedEmails - escalatedEmails;

    // Call Stats
    const totalCalls = filteredCalls.length;
    const callInCount = filteredCalls.filter(c => c.direction === 'Call In').length;
    const callOutCount = filteredCalls.filter(c => c.direction === 'Call Out').length;
    const pendingCalls = filteredCalls.filter(c => c.action === '').length;

    // Counter Stats
    const totalCQ = filteredCQ.length;
    const cqDirectionCount = filteredCQ.filter(q => q.type === 'Ask Direction').length;
    const cqProcessCount = filteredCQ.filter(q => q.type === 'Ask Process').length;
    const cqOthersCount = totalCQ - cqDirectionCount - cqProcessCount;

    // Completion Ratio
    const totalWorkload = totalEmails + totalCalls + totalCQ;
    const completedWorkload = repliedEmails + (totalCalls - pendingCalls) + totalCQ;
    const ratio = totalWorkload > 0 ? ((completedWorkload / totalWorkload) * 100).toFixed(0) : 0;

    return `
        <div class="daily-routine-container fade-in">
            <div class="routine-header">
                <div class="header-actions" style="display: flex; gap: 16px; align-items: center; flex: 1;">
                    <div class="search-input-wrapper" style="max-width: 250px; position: relative;">
                        <input type="text" class="f-input" placeholder="Search Filter..." 
                               style="padding-left: 36px;"
                               value="${state.routineSearch}" oninput="state.routineSearch = this.value; renderView()">
                        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%);">🔍</span>
                    </div>
                    <select class="f-input" style="width: 140px;" onchange="state.dailyRoutine.timeframe = this.value; apiCall('save_routine.php', 'POST', state.dailyRoutine); renderView()">
                        <option value="Day" ${timeframe === 'Day' ? 'selected' : ''}>Today</option>
                        <option value="Week" ${timeframe === 'Week' ? 'selected' : ''}>Weekly</option>
                        <option value="Month" ${timeframe === 'Month' ? 'selected' : ''}>Monthly</option>
                        <option value="Year" ${timeframe === 'Year' ? 'selected' : ''}>Yearly</option>
                    </select>
                </div>
                <div class="live-clock" style="font-family: 'Courier New', monospace; font-weight: 800; color: var(--primary);">${now.toLocaleDateString()} ${timeframe} View</div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-ghost" onclick="window.print()">🖨️ PDF / PRINT</button>
                    <button class="btn btn-primary" onclick="exportRoutineData()">📥 EXPORT CSV</button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="routine-summary-grid">
                <div class="routine-card workload-card-email">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin:0;">📧 EMAIL WORKLOAD</h3>
                        <span style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">${totalEmails}</span>
                    </div>
                    <div class="routine-stats-details">
                        <div class="stat-item"><span class="label">Replied</span><span class="value" style="color:var(--success);">${repliedEmails}</span></div>
                        <div class="stat-item"><span class="label">Escalated</span><span class="value" style="color:var(--danger);">${escalatedEmails}</span></div>
                        <div class="stat-item"><span class="label">Pending</span><span class="value" style="color:var(--warning);">${pendingEmails}</span></div>
                    </div>
                </div>
                <div class="routine-card workload-card-call">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin:0;">📞 CALLER QUERIES</h3>
                        <span style="font-size: 1.5rem; font-weight: 800; color: var(--secondary);">${totalCalls}</span>
                    </div>
                    <div class="routine-stats-details">
                        <div class="stat-item"><span class="label">IN</span><span class="value">${callInCount}</span></div>
                        <div class="stat-item"><span class="label">OUT</span><span class="value">${callOutCount}</span></div>
                        <div class="stat-item"><span class="label">Pending</span><span class="value" style="color:var(--warning);">${pendingCalls}</span></div>
                    </div>
                </div>
                <div class="routine-card workload-card-counter" style="border-left: 4px solid #8b5cf6;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin:0;">🏢 COUNTER QUERIES</h3>
                        <span class="tooltip" data-tooltip="${totalCQ} counter queries logged today" style="font-size: 1.5rem; font-weight: 800; color: #8b5cf6;">${totalCQ}</span>
                    </div>
                    <div class="routine-stats-details-vertical">
                        <div class="stat-item-row">
                            <span class="label">Ask Direction</span>
                            <span class="badge-red">${cqDirectionCount}</span>
                        </div>
                        <div class="stat-item-row">
                            <span class="label">Ask Process</span>
                            <span class="badge-red">${cqProcessCount}</span>
                        </div>
                        <div class="stat-item-row">
                            <span class="label">Others</span>
                            <span class="badge-red">${cqOthersCount}</span>
                        </div>
                    </div>
                </div>
                <div class="routine-card workload-card-ratio" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 4px solid var(--success);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin:0;">⚙️ EFFICIENCY</h3>
                        <span style="font-size: 1.5rem; font-weight: 800; color: var(--success);">${ratio}%</span>
                    </div>
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
                        ${completedWorkload} / ${totalWorkload} Tasks Completed
                    </div>
                    <div class="ratio-bar-container" style="height: 8px; background: #e2e8f0; border-radius: 4px; margin-top: 12px; overflow: hidden;">
                        <div style="width: ${ratio}%; height: 100%; background: var(--success);"></div>
                    </div>
                </div>
            </div>

            <!-- Workload Tables -->
            <div class="routine-tables-grid">
                <!-- Email Table -->
                <div class="routine-table-card">
                    <div class="routine-table-header">
                        <h4><span>📧</span> RECENT EMAILS</h4>
                        <button class="btn btn-primary btn-sm" onclick="openRoutineModal('email')">+ EMAIL</button>
                    </div>
                    <div style="max-height: 400px; overflow-y: auto;">
                        <table class="routine-table">
                            <thead>
                                <tr>
                                    <th style="width: 120px;">MRN/NRIC</th>
                                    <th>Sender</th>
                                    <th>Subject</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredEmails.slice(0, 10).map(e => {
        const topic = ROUTINE_TOPICS.find(t => t.label === e.subject);
        const topicClass = topic ? topic.class : '';
        return `
                                        <tr>
                                            <td style="font-weight:700; color:var(--primary); font-size: 0.8rem;">${e.identifier || 'N/A'}</td>
                                            <td>${e.sender}</td>
                                            <td>
                                                <span class="topic-pill ${topicClass}">${e.subject}</span>
                                            </td>
                                            <td>
                                                <select onchange="updateRoutineStatus('emails', ${e.id}, this.value)" 
                                                        class="status-pill-${e.status.toLowerCase()}">
                                                    <option value="Pending" ${e.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                                    <option value="Replied" ${e.status === 'Replied' ? 'selected' : ''}>Replied</option>
                                                    <option value="Escalated" ${e.status === 'Escalated' ? 'selected' : ''}>Escalated</option>
                                                </select>
                                            </td>
                                        </tr>
                                    `;
    }).join('') || '<tr><td colspan="4" style="text-align:center; padding:20px;">No emails matching filter</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Call Table -->
                <div class="routine-table-card">
                    <div class="routine-table-header">
                        <h4><span>📞</span> RECENT CALLS</h4>
                        <button class="btn btn-primary btn-sm" onclick="openRoutineModal('call')">+ CALL</button>
                    </div>
                    <div style="max-height: 300px; overflow-y: auto;">
                        <table class="routine-table">
                            <thead>
                                <tr>
                                    <th style="width: 100px;">MRN/NRIC</th>
                                    <th>Caller</th>
                                    <th>Info</th>
                                    <th>Type</th>
                                    <th>Action Taken</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredCalls.slice(0, 10).map(c => {
        const allCallTopics = [...CALL_IN_TOPICS, ...CALL_OUT_TOPICS];
        const topic = allCallTopics.find(t => t.label === c.type);
        const topicClass = topic ? topic.class : '';
        const dirClass = c.direction === 'Call Out' ? 'direction-out' : 'direction-in';
        return `
                                                <tr>
                                                    <td style="font-weight:700; color:var(--primary); font-size: 0.75rem;">${c.identifier || 'N/A'}</td>
                                                    <td>
                                                        <div style="font-weight:600;">${c.caller}</div>
                                                        <div style="font-size:0.7rem; color:var(--text-muted);">${c.phone || 'No Phone'}</div>
                                                    </td>
                                                    <td>
                                                        <span class="call-direction-pill ${dirClass}">${c.direction || 'In'}</span>
                                                    </td>
                                                    <td>
                                                        <span class="topic-pill ${topicClass}" style="font-size:0.7rem; padding: 2px 8px;">${c.type}</span>
                                                    </td>
                                                    <td><input type="text" value="${c.action}" onblur="updateRoutineAction(${c.id}, this.value)" placeholder="Add action..." style="border:none; border-bottom:1px solid #ddd; outline:none; font-size:0.8rem; width:100%;"></td>
                                                </tr>
                                            `;
    }).join('') || '<tr><td colspan="5" style="text-align:center; padding:20px;">No calls today</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Distribution Charts row 1 -->
            <div class="routine-chart-grid" style="grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); margin-bottom: 24px;">
                <div class="chart-routine-card">
                    <div class="panel-subtitle">📊 EMAIL VOLUME BY SUBJECT & STAFF (${timeframe})</div>
                    ${renderEmailStatsChart(filteredEmails)}
                </div>
                <div class="chart-routine-card">
                    <div class="panel-subtitle">📈 CALL QUERIES BY TYPE & STAFF (${timeframe})</div>
                    ${renderCallStatsChart(filteredCalls)}
                </div>
            </div>

            <!-- Distribution Charts row 2 -->
            <div class="routine-chart-grid" style="grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); margin-bottom: 24px;">
                <div class="chart-routine-card">
                    <div class="panel-subtitle">🥧 STAFF WORKLOAD DISTRIBUTION (%)</div>
                    ${renderStaffWorkloadPie(filteredEmails, filteredCalls)}
                </div>
                <div class="chart-routine-card">
                    <div class="panel-subtitle">📈 WORKLOAD TREND (${timeframe})</div>
                    ${renderWorkloadTrendLine(filteredEmails, filteredCalls, timeframe)}
                </div>
            </div>

            <!-- Distribution Charts row 3 -->
            <div class="routine-chart-grid" style="grid-template-columns: 1fr;">
                <div class="chart-routine-card">
                    <div class="panel-subtitle">👩‍⚕️ DOCTOR WORKLOAD DISTRIBUTION (ACTIVE APPLICATIONS)</div>
                    ${renderDoctorWorkloadChart()}
                </div>
            </div>
        </div>
    `;
}

const STAFF_COLORS = {
    'Pn. Siti': '#f43f5e',
    'En. Ali': '#3b82f6',
    'Cik Maria': '#10b981',
    'Pn. Rohani': '#f59e0b',
    'Shikamaru': '#6366f1',
    'Hinata': '#ec4899',
    'Orihime': '#8b5cf6',
    'Akamaru': '#06b6d4',
    'Naruto': '#f97316',
    'Sasuke': '#1e293b',
    'Sakura': '#f472b6',
    'Kakashi': '#64748b'
};

function renderDoctorWorkloadChart() {
    const activeRequests = state.requests.filter(r => !['COMPLETE', 'CANCELLED', 'COLLECT'].includes(r.status));
    const doctorStats = {};

    state.doctors.forEach(d => doctorStats[d.name] = 0);
    activeRequests.forEach(r => {
        if (r.monitoring.doctor && doctorStats[r.monitoring.doctor] !== undefined) {
            doctorStats[r.monitoring.doctor]++;
        }
    });

    const doctors = Object.keys(doctorStats).filter(name => doctorStats[name] > 0);
    const maxVal = Math.max(...Object.values(doctorStats), 5); // Minimum scale of 5

    return `
    <div style="margin-top: 16px;">
        ${doctors.length > 0 ? doctors.map(name => {
        const count = doctorStats[name];
        const status = getWorkloadStatus(count);
        const perc = (count / maxVal * 100);
        return `
                <div class="stat-row" style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px; font-weight: 600;">
                        <span>${name}</span>
                        <span style="color: ${status.color}">${count} Active</span>
                    </div>
                    <div style="height: 12px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
                        <div style="width: ${perc}%; height: 100%; background: ${status.color}; transition: width 0.5s ease;"></div>
                    </div>
                </div>
            `;
    }).join('') : '<div style="text-align:center; padding: 20px; color: #94a3b8;">No active applications assigned to doctors</div>'}
    </div>
    `;
}

function getStaffColor(name) {
    if (!name) return '#94a3b8';
    if (STAFF_COLORS[name]) return STAFF_COLORS[name];

    // Generate hash-based color for unknown staff
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 45%)`;
}

function renderDoctorWorkloadView() {
    const activeRequests = state.requests.filter(r => !['COMPLETE', 'CANCELLED', 'COLLECT'].includes(r.status));
    const doctorStats = state.doctors.map(d => {
        const workload = activeRequests.filter(r => r.monitoring.doctor === d.name).length;
        const status = getWorkloadStatus(workload);
        const onLeave = isCurrentlyOnLeave(d.name);
        return { ...d, workload, status, onLeave };
    }).sort((a, b) => b.workload - a.workload);

    return `
    <div class="doctor-workload-container fade-in">
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 24px;">
            <div class="stat-card" style="background: #eff6ff; border-left: 4px solid #3b82f6;">
                <div class="stat-label">TOTAL ACTIVE REPORTS</div>
                <div class="stat-value" style="color: #1e40af;">${activeRequests.length}</div>
            </div>
            <div class="stat-card" style="background: #fff7ed; border-left: 4px solid #f97316;">
                <div class="stat-label">AVG WORKLOAD / DOC</div>
                <div class="stat-value" style="color: #9a3412;">${(activeRequests.length / (state.doctors.length || 1)).toFixed(1)}</div>
            </div>
            <div class="stat-card" style="background: #fef2f2; border-left: 4px solid #ef4444;">
                <div class="stat-label">HIGH WORKLOAD DOCS</div>
                <div class="stat-value" style="color: #991b1b;">${doctorStats.filter(d => d.workload > 15).length}</div>
            </div>
        </div>

        <div class="panel-card" style="padding: 24px;">
            <div class="table-header-row">
                <div class="panel-subtitle">👩‍⚕️ DETAILED WORKLOAD LIST</div>
                <div style="display: flex; gap: 8px;">
                    <span class="status-pill-pending" style="font-size: 0.7rem;">Normal: 0-10</span>
                    <span class="status-pill-escalated" style="font-size: 0.7rem; background: var(--warning);">Mod: 11-15</span>
                    <span class="status-pill-cancelled" style="font-size: 0.7rem;">High: >15</span>
                </div>
            </div>
            <div class="data-table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>DOCTOR NAME</th>
                            <th>ASSIGNED SECRETARY</th>
                            <th>CURRENT WORKLOAD</th>
                            <th>STATUS</th>
                            <th>AVAILABILITY</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${doctorStats.map(d => `
                            <tr>
                                <td style="font-weight: 700; color: var(--primary);">${d.name}</td>
                                <td>${d.secretary || '<span style="color:#94a3b8;">Not Assigned</span>'}</td>
                                <td style="font-size: 1.1rem; font-weight: 800; color: ${d.status.color};">
                                    ${d.workload} 
                                    <span style="font-size: 0.7rem; font-weight: 400; color: #64748b;">reports</span>
                                </td>
                                <td>
                                    <span class="workload-pill-mini" style="background: ${d.status.color}; width: 80px; text-align: center;">
                                        ${d.status.label}
                                    </span>
                                </td>
                                <td>
                                    ${d.onLeave ?
            `<span class="on-leave-badge" style="display: inline-block;">🚫 ON LEAVE</span>` :
            `<span style="color: var(--success); font-weight: 600;">🟢 AVAILABLE</span>`}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
}

function renderEmailStatsChart(emails) {
    const stats = {};
    const staffs = [...new Set(emails.map(e => e.staff))];

    ROUTINE_TOPICS.forEach(t => {
        stats[t.label] = { total: 0, byStaff: {} };
        staffs.forEach(s => stats[t.label].byStaff[s] = 0);
    });

    emails.forEach(e => {
        if (stats[e.subject]) {
            stats[e.subject].total++;
            stats[e.subject].byStaff[e.staff]++;
        }
    });

    const maxVal = Math.max(...Object.values(stats).map(s => s.total), 1);

    return `
    <div class="stats-bar-list" style="margin-top: 16px;">
        ${ROUTINE_TOPICS.map(t => {
        const data = stats[t.label];
        if (data.total === 0 && emails.length > 0) return '';
        return `
                <div class="stat-row" style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px; font-weight: 600;">
                        <span>${t.label}</span>
                        <span>${data.total}</span>
                    </div>
                    <div style="height: 14px; background: #f1f5f9; border-radius: 7px; overflow: hidden; display: flex;">
                        ${Object.entries(data.byStaff).map(([staff, count]) => {
            if (count === 0) return '';
            const perc = (count / maxVal * 100);
            return `<div style="width: ${perc}%; height: 100%; background: ${getStaffColor(staff)};" title="${staff}: ${count}"></div>`;
        }).join('')}
                    </div>
                </div>
            `;
    }).join('') || '<div style="text-align:center; padding: 20px; color: #94a3b8;">No data for selected timeframe</div>'}
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; justify-content: center;">
            ${staffs.map(s => `
                <div style="display:flex; align-items:center; gap:4px; font-size: 0.65rem;">
                    <div style="width:8px; height:8px; background:${getStaffColor(s)}; border-radius:50%;"></div>
                    <span>${s}</span>
                </div>
            `).join('')}
        </div>
    </div>
    `;
}

function renderCallStatsChart(calls) {
    const allTopics = [...CALL_IN_TOPICS, ...CALL_OUT_TOPICS];
    const stats = {};
    const staffs = [...new Set(calls.map(c => c.staff))];

    allTopics.forEach(t => {
        stats[t.label] = { total: 0, byStaff: {} };
        staffs.forEach(s => stats[t.label].byStaff[s] = 0);
    });

    calls.forEach(c => {
        if (stats[c.type]) {
            stats[c.type].total++;
            stats[c.type].byStaff[c.staff]++;
        }
    });

    const maxVal = Math.max(...Object.values(stats).map(s => s.total), 1);

    return `
    <div class="stats-bar-list" style="margin-top: 16px;">
        ${allTopics.map(t => {
        const data = stats[t.label];
        if (data.total === 0 && calls.length > 0) return '';
        return `
                <div class="stat-row" style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px; font-weight: 600;">
                        <span style="color: ${t.color}">${t.label}</span>
                        <span>${data.total}</span>
                    </div>
                    <div style="height: 14px; background: #f1f5f9; border-radius: 7px; overflow: hidden; display: flex;">
                        ${Object.entries(data.byStaff).map(([staff, count]) => {
            if (count === 0) return '';
            const perc = (count / maxVal * 100);
            return `<div style="width: ${perc}%; height: 100%; background: ${getStaffColor(staff)};" title="${staff}: ${count}"></div>`;
        }).join('')}
                    </div>
                </div>
        `;
    }).join('') || '<div style="text-align:center; padding: 20px; color: #94a3b8;">No data for selected timeframe</div>'}
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; justify-content: center;">
        ${staffs.map(s => `
            <div style="display:flex; align-items:center; gap:4px; font-size: 0.65rem;">
                <div style="width:8px; height:8px; background:${getStaffColor(s)}; border-radius:50%;"></div>
                <span>${s}</span>
            </div>
        `).join('')}
    </div>
    `;
}

function renderStaffWorkloadPie(emails, calls) {
    const combined = [...emails, ...calls];
    const staffs = [...new Set(combined.map(item => item.staff))];
    const total = combined.length || 1;

    const staffCounts = {};
    staffs.forEach(s => staffCounts[s] = combined.filter(item => item.staff === s).length);

    // Simple CSS conic-gradient pie chart
    let cumulativePercent = 0;
    const gradientParts = staffs.map(s => {
        const perc = (staffCounts[s] / total * 100);
        const part = `${getStaffColor(s)} ${cumulativePercent}% ${cumulativePercent + perc}%`;
        cumulativePercent += perc;
        return part;
    });

    return `
    <div style="display: flex; align-items: center; gap: 32px; padding: 16px;">
        <div style="width: 150px; height: 150px; border-radius: 50%; background: conic-gradient(${gradientParts.join(', ')}); box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);"></div>
        <div style="flex: 1;">
            ${staffs.map(s => {
        const count = staffCounts[s];
        const perc = (count / total * 100).toFixed(1);
        return `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.8rem;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 10px; height: 10px; background: ${getStaffColor(s)}; border-radius: 2px;"></div>
                            <span style="font-weight: 600;">${s}</span>
                        </div>
                        <span style="color: #64748b;">${count} (${perc}%)</span>
                    </div>
                `;
    }).join('')}
        </div>
    </div>
    `;
}

function renderWorkloadTrendLine(emails, calls, timeframe) {
    const combined = [...emails, ...calls];
    const intervals = [];
    const now = new Date();

    if (timeframe === 'Day') {
        for (let i = 9; i >= 0; i--) {
            const h = (now.getHours() - i);
            if (h < 0) continue;
            const label = h.toString().padStart(2, '0') + ':00';
            const count = combined.filter(item => item.time.startsWith(h.toString().padStart(2, '0'))).length;
            intervals.push({ label, count });
        }
    } else if (timeframe === 'Week') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-US', { weekday: 'short' });
            const count = combined.filter(item => item.date === dateStr).length;
            intervals.push({ label, count });
        }
    } else if (timeframe === 'Month') {
        for (let i = 3; i >= 0; i--) {
            const start = new Date();
            start.setDate(now.getDate() - (i + 1) * 7);
            const end = new Date();
            end.setDate(now.getDate() - i * 7);
            const label = `W${4 - i}`;
            const count = combined.filter(item => {
                const d = new Date(item.date);
                return d >= start && d <= end;
            }).length;
            intervals.push({ label, count });
        }
    } else if (timeframe === 'Year') {
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(now.getMonth() - i);
            const label = d.toLocaleDateString('en-US', { month: 'short' });
            const count = combined.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate.getMonth() === d.getMonth() && itemDate.getFullYear() === d.getFullYear();
            }).length;
            intervals.push({ label, count });
        }
    }
    const maxVal = Math.max(...intervals.map(i => i.count), 1);

    return `
    <div class="trend-chart" style="height: 180px; display: flex; align-items: flex-end; gap: 4px; padding: 20px 0; margin-top: 10px;">
        ${intervals.map(i => {
        const perc = (i.count / maxVal * 100);
        return `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <div style="width: 100%; position: relative; height: 140px; display: flex; align-items: flex-end;">
                        <div style="width: 100%; height: ${perc}%; background: linear-gradient(to top, var(--primary), #818cf8); border-radius: 4px; min-height: 4px; transition: height 0.3s ease;" title="${i.label}: ${i.count}"></div>
                        <div style="position: absolute; top: -20px; width: 100%; text-align: center; font-size: 0.65rem; font-weight: 700; color: var(--primary);">${i.count > 0 ? i.count : ''}</div>
                    </div>
                    <span style="font-size: 0.65rem; color: #64748b; font-weight: 600;">${i.label}</span>
                </div>
            `;
    }).join('')}
    </div>
    `;
}

function renderWeeklyTrendChart() {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    const max = 20;
    return `
    <div class="bar-container" style="align-items: flex-end;">
        ${days.map(d => {
        const total = (state.dailyRoutine.emails.filter(e => e.date === d).length +
            state.dailyRoutine.calls.filter(c => c.date === d).length);
        const height = Math.min((total / max) * 100, 100);
        return `
                <div class="bar-col" title="${d}: ${total} records">
                    <div class="bar-visual" style="height: ${height}%; background: linear-gradient(to top, var(--primary), var(--primary-light)); width: 24px;"></div>
                    <span class="bar-label">${d.split('-').slice(1, 3).join('/')}</span>
                </div>
            `;
    }).join('')}
    </div>
    `;
}

function openRoutineModal(type) {
    const title = type === 'email' ? 'Capture Email Workload' : 'Capture Caller Query';
    const fields = type === 'email' ? `
        <div class="form-group">
            <label>MRN / NRIC *</label>
            <input type="text" id="rt-email-identifier" class="f-input" placeholder="e.g. 375401">
        </div>
        <div class="form-group">
            <label>Sender (Name/Email)</label>
            <input type="text" id="rt-sender" class="f-input" placeholder="e.g John Doe / john@example.com">
        </div>
        <div class="form-group">
            <label>Subject / Topic *</label>
            <select id="rt-subject" class="f-input" style="font-size: 10pt;">
                <option value="">-- Select Subject/Topic --</option>
                ${ROUTINE_TOPICS.map(t => `<option value="${t.label}">${t.label}</option>`).join('')}
            </select>
        </div>
    ` : `
        <div class="form-group">
            <label>Caller Name</label>
            <input type="text" id="rt-caller" class="f-input" placeholder="e.g. En. Abu">
        </div>
        <div class="form-group">
            <label>MRN / NRIC *</label>
            <input type="text" id="rt-call-identifier" class="f-input" placeholder="e.g. 375401 / 900101-14-5678">
        </div>
        <div class="form-group">
            <label>Phone Number</label>
            <input type="text" id="rt-phone" class="f-input" placeholder="e.g. 012-3456789">
        </div>
        <div class="form-group">
            <label>Direction *</label>
            <select id="rt-direction" class="f-input" onchange="updateQueryOptions(this.value, 'rt-query-type')">
                <option value="Call In">Call In</option>
                <option value="Call Out">Call Out</option>
            </select>
        </div>
        <div class="form-group">
            <label>Query Type *</label>
            <select id="rt-query-type" class="f-input">
                <option value="">-- Select Query Type --</option>
                ${CALL_IN_TOPICS.map(t => `<option value="${t.label}">${t.label}</option>`).join('')}
            </select>
        </div>
    `;

    const modalHtml = `
    <div class="modal-overlay" id="routine-modal">
        <div class="modal-content" style="max-width: 400px; padding: 32px;">
            <div class="panel-subtitle"><span>📝</span> ${title}</div>
            <div style="margin-top: 20px;">
                ${fields}
            </div>
            <div style="margin-top: 32px; display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn btn-ghost" onclick="document.body.removeChild(document.getElementById('routine-modal'))">Cancel</button>
                <button class="btn btn-primary" onclick="addRoutineItem('${type}')">Save Entry</button>
            </div>
        </div>
    </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstChild);
}

function setWorkloadTab(tab) {
    state.workloadTab = tab;
    renderView();
}

function renderWorkloadEntryView() {
    const routine = state.dailyRoutine;
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    return `
    <div class="workload-entry-container fade-in">
        <!-- Tab Navigation -->
        <div style="display: flex; gap: 8px; margin-bottom: 24px;">
            <button class="btn ${state.workloadTab === 'emails' ? 'btn-primary' : 'btn-ghost'}" style="flex: 1; padding: 12px;" onclick="setWorkloadTab('emails')">
                📧 Emails & Calls
            </button>
            <button class="btn ${state.workloadTab === 'counter' ? 'btn-primary' : 'btn-ghost'}" style="flex: 1; padding: 12px;" onclick="setWorkloadTab('counter')">
                🏢 Counter Queries
            </button>
        </div>

        ${state.workloadTab === 'counter' ? `
            <div class="workload-form-card" style="max-width: 600px; margin: 0 auto 32px auto;">
                <div class="panel-subtitle"><span>🏢</span> RECORD COUNTER QUERY</div>
                <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
                    <div class="form-group">
                        <label>Visitor Name (Optional)</label>
                        <input type="text" id="cq-visitor" class="f-input" placeholder="e.g. En. Abu">
                    </div>
                    <div class="form-group">
                        <label>MRN / NRIC (Optional)</label>
                        <input type="text" id="cq-identifier" class="f-input" placeholder="6-digit MRN or NRIC">
                    </div>
                    <div class="form-group span-2">
                        <label>Query Type *</label>
                        <select id="cq-type" class="f-input" required>
                            <option value="">-- Select Query Type --</option>
                            <option value="Ask Direction">Ask Direction</option>
                            <option value="Ask Process">Ask Process</option>
                            <option value="General Enquiry (Non-Medical Report)">General Enquiry (Non-Medical Report)</option>
                        </select>
                    </div>
                    <div class="form-group span-2">
                        <label>Notes</label>
                        <textarea id="cq-notes" class="f-input" style="min-height: 80px;" placeholder="Catatan ringkas..."></textarea>
                    </div>
                </div>
                <div style="margin-top: 24px;">
                    <button class="btn btn-primary btn-block" onclick="submitWorkloadFromScreen('counter')">SAVE COUNTER QUERY</button>
                </div>
            </div>
        ` : `
            <div class="workload-forms-grid">
                <!-- Email Form -->
            <div class="workload-form-card">
                <h3><span>📧</span> RECORD EMAIL DATA</h3>
                <div class="form-group">
                    <label>MRN / NRIC *</label>
                        <input type="text" id="screen-rt-email-identifier" class="f-input" placeholder="e.g. 375401 / 900101-14-5678">
                </div>
                <div class="form-group">
                    <label>Sender (Name/Email)</label>
                        <input type="text" id="screen-rt-sender" class="f-input" placeholder="e.g John Doe">
                </div>
                <div class="form-group">
                    <label>Subject / Topic *</label>
                    <select id="screen-rt-subject" class="f-input" style="font-size: 10pt;">
                        <option value="">-- Select Subject/Topic --</option>
                        ${ROUTINE_TOPICS.map(t => `<option value="${t.label}">${t.label}</option>`).join('')}
                    </select>
                </div>
                <div style="margin-top: 24px;">
                        <button class="btn btn-primary btn-block" onclick="submitWorkloadFromScreen('email')">SAVE EMAIL RECORD</button>
                </div>
            </div>

                <!-- Call Form -->
            <div class="workload-form-card">
                <h3><span>📞</span> RECORD CALLER QUERY</h3>
                <div class="form-group">
                    <label>Caller Name</label>
                        <input type="text" id="screen-rt-caller" class="f-input" placeholder="e.g. En. Abu">
                </div>
                <div class="form-group">
                    <label>MRN / NRIC *</label>
                        <input type="text" id="screen-rt-call-identifier" class="f-input" placeholder="e.g. 375401 / 900101-14-5678">
                </div>
                <div class="form-group">
                    <label>Phone Number</label>
                        <input type="text" id="screen-rt-phone" class="f-input" placeholder="e.g. 012-3456789">
                </div>
                <div class="form-group">
                    <label>Direction *</label>
                        <select id="screen-rt-direction" class="f-input" onchange="updateQueryOptions(this.value, 'screen-rt-query-type')">
                        <option value="Call In">Call In</option>
                        <option value="Call Out">Call Out</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Query Type *</label>
                    <select id="screen-rt-query-type" class="f-input">
                        <option value="">-- Select Query Type --</option>
                        ${CALL_IN_TOPICS.map(t => `<option value="${t.label}">${t.label}</option>`).join('')}
                    </select>
                </div>
                <div style="margin-top: 24px;">
                        <button class="btn btn-primary btn-block" onclick="submitWorkloadFromScreen('call')">SAVE CALL RECORD</button>
                </div>
            </div>
            </div>
        `}

        <div class="routine-table-card quick-log-section">
            <div class="routine-table-header">
                <h4><span>📜</span> TODAY'S QUICK LOG</h4>
                <button class="btn btn-ghost btn-sm" onclick="switchView('dailyRoutine')">VIEW FULL DASHBOARD</button>
            </div>
            <div class="routine-tables-grid">
                <div>
                    <p style="font-weight:700; font-size: 0.8rem; margin-bottom: 8px;">Latest Emails</p>
                    <table class="routine-table">
                        ${routine.emails.filter(e => e.date === today).slice(0, 3).map(e => `
                            <tr>
                                <td style="font-size: 0.7rem; color: var(--primary); font-weight: 700;">${e.identifier || 'N/A'}</td>
                                <td>${e.sender}</td>
                                <td><span class="status-pill-${e.status.toLowerCase()}" style="padding: 2px 8px; border-radius: 4px;">${e.status}</span></td>
                            </tr>
                        `).join('') || '<tr><td style="color:var(--text-muted);">No records</td></tr>'}
                    </table>
                </div>
                <div>
                    <p style="font-weight:700; font-size: 0.8rem; margin-bottom: 8px;">Latest Calls</p>
                    <table class="routine-table">
                        ${routine.calls.filter(c => c.date === today).slice(0, 3).map(c => `
                            <tr>
                                <td style="font-size: 0.7rem; color: var(--primary); font-weight: 700;">${c.identifier || 'N/A'}</td>
                                <td>${c.caller}</td>
                                <td>${c.type}</td>
                            </tr>
                        `).join('') || '<tr><td style="color:var(--text-muted);">No records</td></tr>'}
                    </table>
                </div>
                <div>
                    <p style="font-weight:700; font-size: 0.8rem; margin-bottom: 8px;">Latest Counter Queries</p>
                    <table class="routine-table">
                        ${(routine.counterQueries || []).filter(cq => cq.date === today).slice(0, 3).map(cq => `
                            <tr>
                                <td style="font-size: 0.7rem; color: var(--primary); font-weight: 700;">${cq.identifier || 'N/A'}</td>
                                <td>${cq.visitor || 'Visitor'}</td>
                                <td>${cq.type}</td>
                            </tr>
                        `).join('') || '<tr><td style="color:var(--text-muted);">No records</td></tr>'}
                    </table>
                </div>
            </div>
        </div>
    </div>
    `;
}

function submitWorkloadFromScreen(type) {
    if (type === 'email') {
        const identifier = document.getElementById('screen-rt-email-identifier').value;
        const sender = document.getElementById('screen-rt-sender').value;
        const subject = document.getElementById('screen-rt-subject').value;

        if (!identifier || identifier.length < 6 || identifier.length > 20) {
            return showToast("MRN/NRIC required for audit logging (6-20 chars).", "warning");
        }
        if (!subject) return showToast("Please select a Subject/Topic", "warning");
        if (!sender) return showToast("Please enter sender info", "warning");

        addRoutineItemData('email', { identifier, sender, subject });
        document.getElementById('screen-rt-email-identifier').value = '';
        document.getElementById('screen-rt-sender').value = '';
        document.getElementById('screen-rt-subject').value = '';
    } else if (type === 'call') {
        const caller = document.getElementById('screen-rt-caller').value;
        const identifier = document.getElementById('screen-rt-call-identifier').value;
        const phone = document.getElementById('screen-rt-phone').value;
        const direction = document.getElementById('screen-rt-direction').value;
        const queryType = document.getElementById('screen-rt-query-type').value;

        if (!identifier || identifier.length < 6 || identifier.length > 20) {
            return showToast("MRN/NRIC required for audit logging (6-20 chars).", "warning");
        }
        if (!queryType) return showToast("Please select a Query Type", "warning");
        if (!caller) return showToast("Please fill all fields", "warning");

        addRoutineItemData('call', { caller, identifier, phone, direction, queryType });
        document.getElementById('screen-rt-caller').value = '';
        document.getElementById('screen-rt-call-identifier').value = '';
        document.getElementById('screen-rt-phone').value = '';
        document.getElementById('screen-rt-query-type').value = '';
    } else if (type === 'counter') {
        const visitor = document.getElementById('cq-visitor').value;
        const identifier = document.getElementById('cq-identifier').value;
        const queryType = document.getElementById('cq-type').value;
        const notes = document.getElementById('cq-notes').value;

        if (!queryType) return showToast("Please select a Query Type", "warning");

        addRoutineItemData('counter', { visitor, identifier, queryType, notes });
        document.getElementById('cq-visitor').value = '';
        document.getElementById('cq-identifier').value = '';
        document.getElementById('cq-type').value = '';
        document.getElementById('cq-notes').value = '';
    }
}

function addRoutineItem(type) {
    let data = {};
    if (type === 'email') {
        data.identifier = document.getElementById('rt-email-identifier').value;
        data.sender = document.getElementById('rt-sender').value || 'Unknown';
        data.subject = document.getElementById('rt-subject').value || 'No Subject';

        if (!data.identifier || data.identifier.length < 6 || data.identifier.length > 20) {
            return showToast("MRN/NRIC required for audit logging (6-20 chars).", "warning");
        }
        if (!data.subject) return showToast("Please select a Subject/Topic", "warning");
    } else if (type === 'call') {
        data.caller = document.getElementById('rt-caller').value || 'Unknown Caller';
        data.identifier = document.getElementById('rt-call-identifier').value;
        data.phone = document.getElementById('rt-phone').value || 'N/A';
        data.direction = document.getElementById('rt-direction').value;
        data.queryType = document.getElementById('rt-query-type').value;

        if (!data.identifier || data.identifier.length < 6 || data.identifier.length > 20) {
            return showToast("MRN/NRIC required for audit logging (6-20 chars).", "warning");
        }
        if (!data.queryType) return showToast("Please select a Query Type", "warning");
    }

    addRoutineItemData(type, data);
    const modal = document.getElementById('routine-modal');
    if (modal) document.body.removeChild(modal);
}

function addRoutineItemData(type, data) {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];

    if (type === 'email') {
        const newEmail = {
            id: Date.now(),
            date,
            time,
            identifier: data.identifier || 'N/A',
            sender: data.sender || 'Unknown',
            subject: data.subject || 'No Subject',
            status: 'Pending',
            staff: state.user.name
        };
        state.dailyRoutine.emails.unshift(newEmail);
        console.log(`[Audit] ${state.user.name} recorded Email for ${data.identifier} from ${data.sender}`);
    } else if (type === 'call') {
        const newCall = {
            id: Date.now(),
            date,
            time,
            caller: data.caller || 'Unknown Caller',
            identifier: data.identifier || 'N/A',
            phone: data.phone || 'N/A',
            direction: data.direction || 'Call In',
            type: data.queryType,
            action: '',
            staff: state.user.name
        };
        state.dailyRoutine.calls.unshift(newCall);
        console.log(`[Audit] ${state.user.name} recorded Call(${data.direction}) from ${data.caller} [MRN: ${data.identifier}](${data.queryType})`);
    } else if (type === 'counter') {
        const newCQ = {
            id: Date.now(),
            date,
            time,
            visitor: data.visitor || 'Visitor',
            identifier: data.identifier || 'N/A',
            type: data.queryType,
            notes: data.notes || '',
            staff: state.user.name
        };
        if (!state.dailyRoutine.counterQueries) state.dailyRoutine.counterQueries = [];
        state.dailyRoutine.counterQueries.unshift(newCQ);
        console.log(`[Audit] ${state.user.name} recorded Counter Query [${data.queryType}] from ${data.visitor || 'Visitor'}`);

        // Mocking API call
        apiCall('save_counter_query.php', 'POST', newCQ);
        renderView();
        showToast("Counter query recorded.", "success");
        return; // Already saved and rendered
    }

    apiCall('save_routine.php', 'POST', state.dailyRoutine);
    renderView();
    showToast("Workload recorded.", "success");
}

function updateQueryOptions(direction, targetId) {
    const select = document.getElementById(targetId);
    if (!select) return;

    const topics = direction === 'Call Out' ? CALL_OUT_TOPICS : CALL_IN_TOPICS;

    select.innerHTML = '<option value="">--Select Query Type--</option>' +
        topics.map(t => `<option value="${t.label}">${t.label}</option>`).join('');
}

function updateRoutineStatus(type, id, val) {
    const idx = state.dailyRoutine[type].findIndex(item => item.id === id);
    if (idx !== -1) {
        state.dailyRoutine[type][idx].status = val;
        apiCall('save_routine.php', 'POST', state.dailyRoutine);

        // Audit
        console.log(`[Audit] ${state.user.name} updated status of ${type} #${id} to ${val}`);
        renderView();
    }
}

function updateRoutineAction(id, val) {
    const idx = state.dailyRoutine.calls.findIndex(c => c.id === id);
    if (idx !== -1) {
        state.dailyRoutine.calls[idx].action = val;
        apiCall('save_routine.php', 'POST', state.dailyRoutine);

        // Audit
        console.log(`[Audit] ${state.user.name} updated action for call #${id}`);
        renderView();
    }
}

function exportRoutineData() {
    const routine = state.dailyRoutine;
    const timeframe = routine.timeframe || 'Day';
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const filterByTime = (items) => {
        return items.filter(item => {
            const itemDate = new Date(item.date);
            if (timeframe === 'Day') return item.date === todayStr;
            if (timeframe === 'Week') {
                const weekAgo = new Date();
                weekAgo.setDate(now.getDate() - 7);
                return itemDate >= weekAgo;
            }
            if (timeframe === 'Month') return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
            if (timeframe === 'Year') return itemDate.getFullYear() === now.getFullYear();
            return true;
        });
    };

    const emails = filterByTime(routine.emails);
    const calls = filterByTime(routine.calls);
    const counters = filterByTime(routine.counterQueries || []);

    const staffBreakdown = {};
    emails.forEach(e => staffBreakdown[e.staff] = (staffBreakdown[e.staff] || 0) + 1);
    calls.forEach(c => staffBreakdown[c.staff] = (staffBreakdown[c.staff] || 0) + 1);
    counters.forEach(cq => staffBreakdown[cq.staff] = (staffBreakdown[cq.staff] || 0) + 1);

    let csv = `DAILY ROUTINE WORKLOAD REPORT - ${timeframe.toUpperCase()} VIEW\n`;
    csv += `Generated by: ${state.user.name}\n`;
    csv += `Timestamp: ${new Date().toLocaleString()}\n`;
    csv += `Timeframe Range: ${timeframe}\n\n`;

    csv += "--- SUMMARY STATISTICS ---\n";
    csv += `Total Emails, ${emails.length}\n`;
    csv += `Total Calls, ${calls.length}\n`;
    csv += "--- STAFF BREAKDOWN ---\n";
    Object.entries(staffBreakdown).forEach(([name, count]) => csv += `${name},${count}\n`);
    csv += "\n";

    csv += "--- EMAILS ---\n";
    csv += "Date,Time,MRN/NRIC,Sender,Subject / Topic,Color Tag,Status,Staff\n";
    emails.forEach(e => {
        const topic = ROUTINE_TOPICS.find(t => t.label === e.subject);
        const colorTag = topic ? topic.color.toUpperCase() : 'N/A';
        csv += `${e.date},${e.time}, "${e.identifier || 'N/A'}", "${e.sender}", "${e.subject}", "${colorTag}", ${e.status},${e.staff}\n`;
    });

    csv += "\n--- CALLS ---\n";
    csv += "Date,Time,MRN/NRIC,Caller,Phone,Direction,Query Type,Action Taken,Staff\n";
    calls.forEach(c => csv += `${c.date},${c.time}, "${c.identifier || 'N/A'}", "${c.caller}", "${c.phone || 'N/A'}", "${c.direction || 'In'}", ${c.type}, "${c.action}", ${c.staff}\n`);

    csv += "\n--- COUNTER QUERIES ---\n";
    csv += "Date,Time,MRN/NRIC,Visitor,Query Type,Notes,Staff\n";
    counters.forEach(cq => csv += `${cq.date},${cq.time}, "${cq.identifier || 'N/A'}", "${cq.visitor || 'Visitor'}", "${cq.type}", "${(cq.notes || '').replace(/"/g, '""')}", ${cq.staff}\n`);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Routine_Staff_Audit_${timeframe}_${todayStr}.csv`;
    link.click();

    const breakdownStr = Object.entries(staffBreakdown).map(([n, c]) => `${n}: ${c}`).join(', ');
    console.log(`[Audit] ${state.user.name} generated staff analytics report. Total Workload: ${emails.length + calls.length}. Breakdown: ${breakdownStr}`);
    showToast(`${timeframe} staff audit report exported`, "success");
}

document.addEventListener('DOMContentLoaded', init);

// --- MOBILE SIDEBAR HANDLERS ---
function toggleSidebar() {
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
    }
}

// Auto-close sidebar on menu item click (mobile)
setTimeout(() => {
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.app-sidebar');
                const overlay = document.querySelector('.sidebar-overlay');
                if (sidebar) sidebar.classList.remove('mobile-open');
                if (overlay) overlay.classList.remove('active');
            }
        });
    });
}, 1000);
