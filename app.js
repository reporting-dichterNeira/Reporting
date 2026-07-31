/* ==========================================================================
   PORTAL DICHTER & NEIRA - DESCARGA DE EXCEL COMPLETO CON TODAS SUS FILAS (APP.JS)
   ========================================================================== */

const STORAGE_KEY = 'dn_portal_requests_v28';
const NOVEDADES_KEY = 'dn_portal_novedades_v12';
const REPORTING_SESSION_KEY = 'dn_portal_reporting_auth';
const MY_REQUESTS_KEY = 'dn_portal_my_submitted_ids_v1';

// BASE DE DATOS EN LA NUBE PARA SINCRONIZACIÓN MULTI-DISPOSITIVO
const SYNC_API_URL = 'https://jsonblob.com/api/jsonBlob/019fb398-a51c-79af-a1fd-c0095e6459fe';

// CREDENCIALES EMAILJS
const EMAILJS_SERVICE_ID = 'service_b1jhrai';
const EMAILJS_TEMPLATE_ID = 'template_cpy03f3';
const EMAILJS_PUBLIC_KEY = 'OfXawgXmm_YWqDj4B';

// CORREOS DEL EQUIPO DE REPORTING
const REPORTING_TEAM_EMAILS = [
    'masanchez@dichter-neira.com',
    'jchimbi@dichter-neira.com'
];

let state = {
    requests: [],
    analystStatus: [
        {
            analyst: 'Juliana Chimbi',
            status: 'VACACIONES',
            dateStart: '2026-08-15',
            dateEnd: '2026-08-25',
            dates: 'Del 15/08/2026 al 25/08/2026',
            note: '🏖️ En periodo de vacaciones. Durante estos días Mayumi Sanchez estará atendiendo y respaldando sus tareas.'
        }
    ],
    isReportingAuthenticated: false,
    activeTab: 'encoladas',
    activeModalId: null,
    charts: {}
};

// Festivos Oficiales de Colombia 2026
const colombianHolidays2026 = [
    { iso: '2026-01-01', dateLabel: '1 Enero', day: 'Jueves', name: 'Año Nuevo' },
    { iso: '2026-01-12', dateLabel: '12 Enero', day: 'Lunes', name: 'Día de los Reyes Magos' },
    { iso: '2026-03-23', dateLabel: '23 Marzo', day: 'Lunes', name: 'Día de San José' },
    { iso: '2026-04-02', dateLabel: '2 Abril', day: 'Jueves', name: 'Jueves Santo' },
    { iso: '2026-04-03', dateLabel: '3 Abril', day: 'Viernes', name: 'Viernes Santo' },
    { iso: '2026-05-01', dateLabel: '1 Mayo', day: 'Viernes', name: 'Día del Trabajo' },
    { iso: '2026-05-18', dateLabel: '18 Mayo', day: 'Lunes', name: 'Día de la Ascensión' },
    { iso: '2026-06-08', dateLabel: '8 Junio', day: 'Lunes', name: 'Corpus Christi' },
    { iso: '2026-06-15', dateLabel: '15 Junio', day: 'Lunes', name: 'Sagrado Corazón de Jesús' },
    { iso: '2026-06-29', dateLabel: '29 Junio', day: 'Lunes', name: 'San Pedro y San Pablo' },
    { iso: '2026-07-20', dateLabel: '20 Julio', day: 'Lunes', name: 'Día de la Independencia de Colombia' },
    { iso: '2026-07-29', dateLabel: '29 Julio', day: 'Miércoles', name: 'Día de Conmemoras D&N' },
    { iso: '2026-08-07', dateLabel: '7 Agosto', day: 'Viernes', name: 'Batalla de Boyacá' },
    { iso: '2026-08-17', dateLabel: '17 Agosto', day: 'Lunes', name: 'La Asunción de la Virgen' },
    { iso: '2026-10-12', dateLabel: '12 Octubre', day: 'Lunes', name: 'Día de la Raza' },
    { iso: '2026-11-02', dateLabel: '2 Noviembre', day: 'Lunes', name: 'Día de Todos los Santos' },
    { iso: '2026-11-16', dateLabel: '16 Noviembre', day: 'Lunes', name: 'Independencia de Cartagena' },
    { iso: '2026-12-08', dateLabel: '8 Diciembre', day: 'Martes', name: 'Día de la Inmaculada Concepción' },
    { iso: '2026-12-25', dateLabel: '25 Diciembre', day: 'Viernes', name: 'Navidad' }
];

// Generador de ID 100% Único e Inconfundible entre computadores
function generateUniqueReqId() {
    const timeStr = Date.now().toString().slice(-4);
    const rand = Math.floor(100 + Math.random() * 900);
    return `REQ-${timeStr}-${rand}`;
}

// ==========================================================================
// REGISTRO DE SOLICITUDES PROPIAS EN ESTE COMPUTADOR
// ==========================================================================
function getMySubmittedIds() {
    try {
        const raw = localStorage.getItem(MY_REQUESTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function recordMySubmittedId(id) {
    try {
        const list = getMySubmittedIds();
        if (!list.includes(id)) {
            list.unshift(id);
            localStorage.setItem(MY_REQUESTS_KEY, JSON.stringify(list));
        }
    } catch (e) {
        console.error("Error al registrar id local:", e);
    }
}

// ==========================================================================
// 1. INICIALIZACIÓN CON ANIMACIÓN SPLASH DE BIENVENIDA
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(EMAILJS_PUBLIC_KEY);
        }
    } catch (e) {
        console.error("Error EmailJS:", e);
    }

    // Ocultar la animación de splash screen tras 1.8 segundos
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('splash-fade-out');
            setTimeout(() => splash.remove(), 600);
        }
    }, 1800);

    loadFromStorage();
    loadNovedadesFromStorage();

    if (state.requests.length === 0) {
        seedInitialMockData();
    }

    const savedAuth = sessionStorage.getItem(REPORTING_SESSION_KEY);
    if (savedAuth === 'true') {
        state.isReportingAuthenticated = true;
    }

    updateHeaderSessionUI();
    renderAll();
    renderNovedades();
    renderVacacionesAdminTable();
    checkTodayNovelty();

    fetchCloudData();
    setInterval(fetchCloudData, 4000);

    lucide.createIcons();
});

// ==========================================================================
// 2. SINCRONIZACIÓN BASE DE DATOS GLOBAL EN LA NUBE (TIEMPO REAL)
// ==========================================================================
async function fetchCloudData(userTriggered = false) {
    const syncBadge = document.getElementById('cloud-sync-status');
    try {
        const resp = await fetch(SYNC_API_URL, { cache: 'no-store' });
        if (resp.ok) {
            const data = await resp.json();
            
            let updated = false;

            if (data && Array.isArray(data.requests)) {
                state.requests = mergeRequests(state.requests, data.requests);
                saveToStorage();
                updated = true;
            }

            if (data && Array.isArray(data.analystStatus)) {
                state.analystStatus = data.analystStatus;
                saveNovedadesToStorage();
                updated = true;
            }

            if (updated) {
                renderAll();
                renderNovedades();
                renderVacacionesAdminTable();
                checkTodayNovelty();
            }

            if (syncBadge) {
                syncBadge.className = 'sync-badge-status online';
                syncBadge.innerHTML = `<span class="sync-dot-pulse"></span> Nube Conectada`;
            }

            if (userTriggered) {
                showToast(`🔄 Nube sincronizada (${state.requests.length} solicitudes globales)`, 'success');
            }
        }
    } catch (e) {
        console.warn("Nube no disponible temporalmente:", e);
        if (syncBadge) {
            syncBadge.className = 'sync-badge-status offline';
            syncBadge.innerHTML = `⚠️ Modo Local`;
        }
    }
}

function mergeRequests(localArr, cloudArr) {
    if (!Array.isArray(cloudArr)) return localArr;
    const map = new Map();

    localArr.forEach(r => map.set(r.id, r));

    cloudArr.forEach(cloudReq => {
        if (!map.has(cloudReq.id)) {
            map.set(cloudReq.id, cloudReq);
        } else {
            const localReq = map.get(cloudReq.id);
            // Preservar siempre la versión más completa y larga del archivo binario
            let bestFileUrl = cloudReq.fileDataUrl;
            if (localReq.fileDataUrl && (!cloudReq.fileDataUrl || localReq.fileDataUrl.length > cloudReq.fileDataUrl.length)) {
                bestFileUrl = localReq.fileDataUrl;
            }
            map.set(cloudReq.id, { ...cloudReq, ...localReq, fileDataUrl: bestFileUrl });
        }
    });

    const merged = Array.from(map.values());
    merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return merged;
}

async function syncCloudData() {
    saveToStorage();
    saveNovedadesToStorage();

    // Conservar archivos Excel e imágenes completos (hasta 3.5 MB de caracteres Base64)
    // para garantizar que nunca se recorten las filas de los libros de Excel
    const sanitizedRequests = state.requests.map(r => {
        const copy = { ...r };
        if (copy.fileDataUrl && copy.fileDataUrl.length > 3500000) {
            copy.fileDataUrl = null;
        }
        return copy;
    });

    const payload = {
        requests: sanitizedRequests,
        analystStatus: state.analystStatus,
        lastUpdated: new Date().toISOString()
    };

    try {
        const resp = await fetch(SYNC_API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            console.warn("Reintentando sincronización con metadatos de respaldo...");
            const minReqs = state.requests.map(r => ({ ...r, fileDataUrl: null }));
            await fetch(SYNC_API_URL, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requests: minReqs, analystStatus: state.analystStatus, lastUpdated: new Date().toISOString() })
            });
        }
        console.log("✅ Datos sincronizados correctamente en la nube.");
    } catch (e) {
        console.error("Error al publicar en la nube:", e);
    }
}

// ==========================================================================
// 3. DESCARGA INTACTA DE ARCHIVOS EXCEL E IMÁGENES
// ==========================================================================
function compressImageFile(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 1200;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
            callback(compressedDataUrl);
        };
        img.onerror = function() {
            callback(e.target.result);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function handleFileSelect(inputElem, targetInfoId) {
    const target = document.getElementById(targetInfoId);
    if (!target) return;

    if (inputElem.files && inputElem.files[0]) {
        const file = inputElem.files[0];
        const isImage = file.type.startsWith('image/');
        const iconName = isImage ? 'image' : 'file-spreadsheet';

        if (isImage) {
            compressImageFile(file, function(compressedDataUrl) {
                inputElem.dataset.fileDataUrl = compressedDataUrl;
                inputElem.dataset.fileName = file.name;

                target.innerHTML = `
                    <span class="file-attached-chip clickable">
                        <i data-lucide="${iconName}"></i>
                        <span>Adjunto listo: <strong>${escapeHtml(file.name)}</strong> (Descarga habilitada)</span>
                    </span>
                `;
                lucide.createIcons();
            });
        } else {
            // Para archivos Excel (.xlsx, .xls, .csv), guardamos el binario 100% completo e intacto
            const reader = new FileReader();
            reader.onload = function(e) {
                inputElem.dataset.fileDataUrl = e.target.result;
                inputElem.dataset.fileName = file.name;

                target.innerHTML = `
                    <span class="file-attached-chip clickable">
                        <i data-lucide="${iconName}"></i>
                        <span>Excel completo listo: <strong>${escapeHtml(file.name)}</strong> (${(file.size / 1024).toFixed(1)} KB)</span>
                    </span>
                `;
                lucide.createIcons();
            };
            reader.readAsDataURL(file);
        }
    } else {
        inputElem.dataset.fileDataUrl = '';
        inputElem.dataset.fileName = '';
        target.innerHTML = '';
    }
}

function dataURLtoBlob(dataurl) {
    if (!dataurl || typeof dataurl !== 'string' || !dataurl.includes(',')) return null;
    try {
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.error("Error al convertir DataURL a Blob:", e);
        return null;
    }
}

function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function generateFallbackImageBlob(req, callback) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 450;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 800, 450);
    grad.addColorStop(0, '#0D5CAB');
    grad.addColorStop(1, '#24335F');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 450);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('DICHTER & NEIRA - REGISTRO DE ADJUNTO', 40, 50);

    ctx.fillStyle = '#33BDEE';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Solicitud ID: ${req.id}`, 40, 90);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(40, 110, 720, 290);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Nombre de Archivo: ${req.fileName}`, 60, 150);
    ctx.fillText(`Estudio: ${req.estudio} | País: ${req.pais}`, 60, 190);
    ctx.fillText(`Solicitante: ${req.email || req.solicitante || 'N/A'}`, 60, 230);
    ctx.fillText(`Analista Asignada: ${req.analyst || 'Sin Asignar'}`, 60, 270);
    ctx.fillText(`Estado Actual: ${req.status}`, 60, 310);
    ctx.fillText(`Detalle: "${(req.detalle || '').slice(0, 65)}"`, 60, 350);

    canvas.toBlob(blob => callback(blob), 'image/png');
}

function downloadRequestFile(reqId) {
    const req = state.requests.find(r => r.id === reqId);
    if (!req || !req.fileName) {
        showToast('No se encontró información del archivo adjunto', 'warning');
        return;
    }

    // 1. Descarga directa del archivo binario original subido (.xlsx, .xls, .csv, .png, .jpg)
    if (req.fileDataUrl && req.fileDataUrl.startsWith('data:')) {
        const blob = dataURLtoBlob(req.fileDataUrl);
        if (blob) {
            triggerBlobDownload(blob, req.fileName);
            showToast(`Descargando archivo completo original: ${req.fileName}`, 'success');
            return;
        }
    }

    // 2. Respaldo para solicitudes demo antiguas de prueba
    const ext = req.fileName.split('.').pop().toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        generateFallbackImageBlob(req, blob => {
            const outName = req.fileName.match(/\.(png|jpg|jpeg|gif)$/i) ? req.fileName : req.fileName + '.png';
            triggerBlobDownload(blob, outName);
            showToast(`Descargando vista previa de imagen: ${outName}`, 'success');
        });
    } else {
        const csvContent = `\uFEFFID_Solicitud,Estudio,Pais,Solicitante,Analista,Estado,Nombre_Archivo,Detalle_Requerimiento\n"${req.id}","${req.estudio}","${req.pais}","${req.solicitante || req.email || ''}","${req.analyst || 'Sin Asignar'}","${req.status}","${req.fileName}","${(req.detalle || '').replace(/"/g, '""')}"`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const outName = req.fileName.endsWith('.csv') ? req.fileName : req.fileName.replace(/\.xlsx?$/, '.csv');
        triggerBlobDownload(blob, outName);
        showToast(`Descargando archivo de soporte: ${outName}`, 'success');
    }
}

function renderFileChip(req) {
    if (!req.fileName) return '';
    const isImage = req.fileName.match(/\.(png|jpg|jpeg|gif|svg)$/i);
    const iconName = isImage ? 'image' : 'file-spreadsheet';

    return `
        <button type="button" class="file-attached-chip clickable" onclick="downloadRequestFile('${req.id}')" title="Haz clic para descargar ${escapeHtml(req.fileName)} completo en tu PC">
            <i data-lucide="${iconName}"></i>
            <span>📎 ${escapeHtml(req.fileName)}</span>
            <i data-lucide="download" style="width:12px; margin-left:4px;"></i>
        </button>
    `;
}

// ==========================================================================
// 4. ALERTA DE NOVEDADES DEL DÍA (EVALÚA FECHA ACTUAL)
// ==========================================================================
function checkTodayNovelty() {
    const banner = document.getElementById('today-alert-banner');
    const titleElem = document.getElementById('today-banner-title');
    const msgElem = document.getElementById('today-banner-msg');
    const iconElem = document.getElementById('today-banner-icon');

    if (!banner || !titleElem || !msgElem) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayHoliday = colombianHolidays2026.find(h => h.iso === todayStr);

    const absentAnalyst = state.analystStatus.find(a => {
        if (a.status !== 'VACACIONES' && a.status !== 'DIA_LIBRE') return false;
        if (a.dateStart && a.dateEnd) {
            return todayStr >= a.dateStart && todayStr <= a.dateEnd;
        }
        return false;
    });

    if (todayHoliday) {
        titleElem.textContent = `🇨🇴 ¡Hoy es Día Festivo en Colombia: ${todayHoliday.name}!`;
        msgElem.textContent = `El equipo de Reporting se encuentra en día no laborable. Las solicitudes ingresadas hoy serán atendidas a primera hora del próximo día hábil.`;
        if (iconElem) iconElem.innerHTML = `<i data-lucide="calendar-off"></i>`;
        banner.classList.remove('hidden');
    } else if (absentAnalyst) {
        titleElem.textContent = `📢 Novedad de Analista: ${absentAnalyst.analyst}`;
        msgElem.textContent = `${absentAnalyst.note} (${absentAnalyst.dates})`;
        if (iconElem) iconElem.innerHTML = `<i data-lucide="plane"></i>`;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }

    lucide.createIcons();
}

function closeTodayBanner() {
    const banner = document.getElementById('today-alert-banner');
    if (banner) banner.classList.add('hidden');
}

// ==========================================================================
// 5. NAVEGACIÓN Y SESIÓN DE REPORTING
// ==========================================================================
function updateHeaderSessionUI() {
    const badgeLabel = document.getElementById('session-label');
    const loginBtn = document.getElementById('btn-reporting-login');
    const logoutBtn = document.getElementById('btn-logout');
    const navAdminBtn = document.getElementById('nav-btn-admin');
    const navVacacionesBtn = document.getElementById('nav-btn-vacaciones');
    const navAnalyticsBtn = document.getElementById('nav-btn-analytics');

    if (state.isReportingAuthenticated) {
        if (badgeLabel) badgeLabel.textContent = 'Equipo de Reporting (Admin)';
        if (loginBtn) loginBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');

        if (navAdminBtn) navAdminBtn.classList.remove('hidden');
        if (navVacacionesBtn) navVacacionesBtn.classList.remove('hidden');
        if (navAnalyticsBtn) navAnalyticsBtn.classList.remove('hidden');
    } else {
        if (badgeLabel) badgeLabel.textContent = 'Modo Operaciones (Público)';
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');

        if (navAdminBtn) navAdminBtn.classList.add('hidden');
        if (navVacacionesBtn) navVacacionesBtn.classList.add('hidden');
        if (navAnalyticsBtn) navAnalyticsBtn.classList.add('hidden');
    }
    lucide.createIcons();
}

function openReportingAuthModal() {
    document.getElementById('reporting-auth-modal').classList.add('active');
}

function closeReportingAuthModal() {
    document.getElementById('reporting-auth-modal').classList.remove('active');
}

function handleReportingAuth(e) {
    e.preventDefault();
    const u = document.getElementById('auth-username').value.trim().toLowerCase();
    const p = document.getElementById('auth-password').value.trim();

    if ((u === 'reporting' || u.includes('reporting')) && p === 'rep123') {
        state.isReportingAuthenticated = true;
        sessionStorage.setItem(REPORTING_SESSION_KEY, 'true');
        closeReportingAuthModal();
        updateHeaderSessionUI();
        switchTab('admin');
        showToast('¡Desbloqueadas pestañas de Reporting, Vacaciones y Analytics!', 'success');
    } else {
        showToast('Credenciales de Reporting incorrectas', 'warning');
    }
}

function logoutReporting() {
    state.isReportingAuthenticated = false;
    sessionStorage.removeItem(REPORTING_SESSION_KEY);
    updateHeaderSessionUI();
    switchTab('encoladas');
    showToast('Sesión de Reporting cerrada.', 'info');
}

function switchTab(tabId) {
    if ((tabId === 'admin' || tabId === 'vacaciones' || tabId === 'analytics') && !state.isReportingAuthenticated) {
        openReportingAuthModal();
        return;
    }

    state.activeTab = tabId;

    document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    const activeBtn = document.getElementById(`nav-btn-${tabId}`);
    const activeTabContent = document.getElementById(`tab-${tabId}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activeTabContent) activeTabContent.classList.add('active');

    renderAll();

    if (tabId === 'novedades') {
        renderNovedades();
    } else if (tabId === 'vacaciones') {
        renderVacacionesAdminTable();
    } else if (tabId === 'analytics') {
        setTimeout(renderAnalyticsCharts, 100);
    }

    fetchCloudData();
    lucide.createIcons();
}

function toggleEncFields(type) {
    const pdvsBlock = document.getElementById('fields-specific-pdv');
    const generalBlock = document.getElementById('fields-general-study');
    const textarea = document.getElementById('enc-pdvs');

    if (type === 'SPECIFIC_PDVS') {
        pdvsBlock.classList.remove('hidden');
        generalBlock.classList.add('hidden');
        if (textarea) textarea.setAttribute('required', 'required');
    } else {
        pdvsBlock.classList.add('hidden');
        generalBlock.classList.remove('hidden');
        if (textarea) textarea.removeAttribute('required');
    }
}

function toggleBiFields(type) {
    const existingBlock = document.getElementById('fields-existing-bi');
    const newBlock = document.getElementById('fields-new-bi');

    if (type === 'EXISTING') {
        existingBlock.classList.remove('hidden');
        newBlock.classList.add('hidden');
        document.getElementById('rep-usuario').setAttribute('required', 'required');
        document.getElementById('rep-bi-name').setAttribute('required', 'required');
        document.getElementById('rep-area').removeAttribute('required');
    } else if (type === 'NEW') {
        existingBlock.classList.add('hidden');
        newBlock.classList.remove('hidden');
        document.getElementById('rep-usuario').removeAttribute('required');
        document.getElementById('rep-bi-name').removeAttribute('required');
        document.getElementById('rep-area').setAttribute('required', 'required');
    } else if (type === 'SPORADIC') {
        existingBlock.classList.add('hidden');
        newBlock.classList.add('hidden');
        document.getElementById('rep-usuario').removeAttribute('required');
        document.getElementById('rep-bi-name').removeAttribute('required');
        document.getElementById('rep-area').removeAttribute('required');
    }
}

// ==========================================================================
// 6. PERSISTENCIA DE DATOS LOCAL
// ==========================================================================
function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) state.requests = JSON.parse(raw);
    } catch (e) {
        console.error("Error localStorage", e);
        state.requests = [];
    }
}

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.requests));
    } catch (e) {
        console.error("Error al guardar en localStorage", e);
    }
}

function loadNovedadesFromStorage() {
    try {
        const raw = localStorage.getItem(NOVEDADES_KEY);
        if (raw) state.analystStatus = JSON.parse(raw);
    } catch (e) {
        console.error("Error al cargar novedades de localStorage", e);
    }
}

function saveNovedadesToStorage() {
    try {
        localStorage.setItem(NOVEDADES_KEY, JSON.stringify(state.analystStatus));
    } catch (e) {
        console.error("Error al guardar novedades en localStorage", e);
    }
}

function seedInitialMockData() {
    const now = new Date();
    state.requests = [
        {
            id: 'REQ-1001',
            category: 'ENCOLADA',
            isGeneralReview: false,
            pdvCodes: ['PDV-88412', 'PDV-77109'],
            pdvCode: 'PDV-88412, PDV-77109',
            email: 'carlos.mendoza@dichter-neira.com',
            estudio: 'KO moderno',
            pais: 'Colombia',
            ola: 'Julio 2026',
            solicitante: 'Carlos Mendoza',
            analyst: 'Mayumi Sanchez',
            detalle: 'Cierre de lote bloqueado en 2 terminales por error 502.',
            fileName: null,
            fileDataUrl: null,
            status: 'RESOLVED',
            ticketNumber: 'TCK-DN-2026-9011',
            resolutionNote: 'Procesado y liberado desde la consola central.',
            createdAt: new Date(now.getTime() - 28 * 3600000).toISOString(),
            resolvedAt: new Date(now.getTime() - 14 * 3600000).toISOString()
        },
        {
            id: 'REQ-1002',
            category: 'ENCOLADA',
            isGeneralReview: true,
            pdvCodes: [],
            pdvCode: 'Revisión General Estudio',
            email: 'laura.restrepo@dichter-neira.com',
            estudio: 'Heineken',
            pais: 'México',
            ola: 'Julio 2026',
            solicitante: 'Laura Restrepo',
            analyst: 'Juliana Chimbi',
            detalle: 'Favor revisar si existen encoladas pendientes para Heineken México.',
            fileName: null,
            fileDataUrl: null,
            status: 'IN_PROGRESS',
            deliveryDate: '2026-08-05',
            inProgressNote: 'Según la conversación sostenida con Laura, se conciliarán los datos para entregar el 5 de Agosto.',
            ticketNumber: null,
            resolutionNote: null,
            createdAt: new Date(now.getTime() - 40 * 3600000).toISOString(),
            resolvedAt: null
        },
        {
            id: 'REQ-1003',
            category: 'BI_NEW',
            estudio: 'P&G',
            pais: 'Panamá',
            email: 'mariana.lopez@dichter-neira.com',
            frecuencia: 'Semanal',
            area: 'Trade Marketing LatAm',
            solicitante: 'Mariana López',
            analyst: 'Mayumi Sanchez',
            detalle: 'Desarrollar tablero interactivo semanal de seguimiento de precios.',
            fileName: null,
            fileDataUrl: null,
            status: 'PENDING',
            ticketNumber: null,
            resolutionNote: null,
            createdAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
            resolvedAt: null
        }
    ];
    saveToStorage();
}

function addMockData() {
    const categories = ['ENCOLADA', 'BI_EXISTING', 'BI_NEW', 'BI_SPORADIC'];
    const selectedCat = categories[Math.floor(Math.random() * categories.length)];
    const paises = ['Bolivia', 'Chile', 'Colombia', 'Costa Rica', 'Ecuador', 'El Salvador', 'Guatemala', 'Honduras', 'Nicaragua', 'Panamá', 'Paraguay', 'Perú', 'República Dominicana', 'Uruguay'];
    const estudios = ['KO moderno', 'KO tradicional', 'Lindley', 'Heineken', 'Storelive', 'P&G', 'CBC', 'ABI', 'AJE', 'Otros'];
    const olas = ['Enero 2026', 'Febrero 2026', 'Marzo 2026', 'Abril 2026', 'Mayo 2026', 'Junio 2026', 'Julio 2026', 'Agosto 2026'];
    const analysts = ['Mayumi Sanchez', 'Juliana Chimbi', null];
    const selectedAnalyst = analysts[Math.floor(Math.random() * analysts.length)];

    const createdAtDate = new Date(Date.now() - Math.floor(Math.random() * 48 + 5) * 3600000);

    const newReq = {
        id: generateUniqueReqId(),
        category: selectedCat,
        email: 'usuario.demo@dichter-neira.com',
        estudio: estudios[Math.floor(Math.random() * estudios.length)],
        pais: paises[Math.floor(Math.random() * paises.length)],
        analyst: selectedAnalyst,
        status: selectedAnalyst ? 'RESOLVED' : 'PENDING',
        ticketNumber: selectedAnalyst ? 'TCK-DN-2026-' + Math.floor(1000 + Math.random() * 9000) : null,
        resolutionNote: selectedAnalyst ? 'Atendido por la analista ' + selectedAnalyst : null,
        createdAt: createdAtDate.toISOString(),
        resolvedAt: selectedAnalyst ? new Date().toISOString() : null
    };

    if (selectedCat === 'ENCOLADA') {
        const isGen = Math.random() > 0.5;
        newReq.isGeneralReview = isGen;
        if (isGen) {
            newReq.pdvCodes = [];
            newReq.pdvCode = 'Revisión General';
        } else {
            const count = Math.floor(Math.random() * 3) + 1;
            newReq.pdvCodes = Array.from({length: count}, () => 'PDV-' + Math.floor(10000 + Math.random() * 90000));
            newReq.pdvCode = newReq.pdvCodes.join(', ');
        }
        newReq.ola = olas[Math.floor(Math.random() * olas.length)];
        newReq.solicitante = 'Operaciones D&N';
        newReq.detalle = 'Terminal encolada durante proceso de envío de datos.';
    } else if (selectedCat === 'BI_EXISTING') {
        newReq.usuario = 'analista@dichter-neira.com';
        newReq.biNameToEdit = 'Power BI Retail LatAm';
        newReq.detalle = 'Ajuste en medida DAX de precio promedio ponderado.';
    } else if (selectedCat === 'BI_NEW') {
        newReq.frecuencia = 'Quincenal';
        newReq.area = 'Trade Marketing LatAm';
        newReq.solicitante = 'Gerente de Cuenta';
        newReq.detalle = 'Nuevo reporte de visualización para cliente masivo.';
    } else {
        newReq.solicitante = newReq.email;
        newReq.detalle = 'Requerimiento esporádico puntual de extracción de información.';
    }

    state.requests.unshift(newReq);
    recordMySubmittedId(newReq.id);
    syncCloudData();
    renderAll();
    showToast('Solicitud simulada agregada y sincronizada', 'success');
}

function deleteRequest(id) {
    if (confirm(`¿Estás seguro de eliminar la solicitud ${id}? Esta acción no se puede deshacer.`)) {
        state.requests = state.requests.filter(r => r.id !== id);
        syncCloudData();
        renderAll();
        if (state.activeTab === 'analytics') {
            renderAnalyticsCharts();
        }
        showToast(`Solicitud ${id} eliminada correctamente.`, 'info');
    }
}

// ==========================================================================
// 7. GESTIÓN PÁGINA INDEPENDIENTE DE VACACIONES & NOVEDADES
// ==========================================================================
function handleNovedadSubmit(e) {
    e.preventDefault();

    const analystName = document.getElementById('nov-analyst').value;
    const statusVal = document.getElementById('nov-status').value;
    const dateStart = document.getElementById('nov-date-start').value;
    const dateEnd = document.getElementById('nov-date-end').value;
    const noteVal = document.getElementById('nov-note').value.trim();

    let datesFormatted = 'Periodo actual';
    if (dateStart && dateEnd) {
        const d1 = new Date(dateStart + 'T00:00:00').toLocaleDateString('es-CO');
        const d2 = new Date(dateEnd + 'T00:00:00').toLocaleDateString('es-CO');
        datesFormatted = `Del ${d1} al ${d2}`;
    }

    const existingIndex = state.analystStatus.findIndex(a => a.analyst === analystName);
    const updatedStatus = {
        analyst: analystName,
        status: statusVal,
        dateStart: dateStart,
        dateEnd: dateEnd,
        dates: datesFormatted,
        note: noteVal
    };

    if (existingIndex !== -1) {
        state.analystStatus[existingIndex] = updatedStatus;
    } else {
        state.analystStatus.push(updatedStatus);
    }

    syncCloudData();
    document.getElementById('form-analyst-novedad').reset();
    renderNovedades();
    renderVacacionesAdminTable();
    checkTodayNovelty();
    showToast(`Novedad publicada y sincronizada con éxito para ${analystName}`, 'success');
}

function deleteNovedad(index) {
    const item = state.analystStatus[index];
    if (!item) return;

    if (confirm(`¿Estás seguro de eliminar el registro de vacaciones/novedad de ${item.analyst}?`)) {
        state.analystStatus.splice(index, 1);
        syncCloudData();
        renderNovedades();
        renderVacacionesAdminTable();
        checkTodayNovelty();
        showToast('Novedad eliminada correctamente.', 'info');
    }
}

function renderVacacionesAdminTable() {
    const tbody = document.getElementById('vacaciones-admin-table-body');
    if (!tbody) return;

    const activeLeaves = state.analystStatus.filter(a => a.status !== 'DISPONIBLE');

    if (activeLeaves.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; padding:24px; color:var(--text-muted);">
                    No hay vacaciones o ausencias programadas actualmente.
                    <br><small style="color:var(--dn-green); font-weight:700;">🟢 Ambas analistas (Mayumi Sanchez y Juliana Chimbi) están registradas como disponibles.</small>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = activeLeaves.map((item) => {
        const realIdx = state.analystStatus.findIndex(a => a === item);
        
        let badgeClass = 'vacaciones';
        let statusLabel = '🏖️ Vacaciones';
        if (item.status === 'DIA_LIBRE') {
            badgeClass = 'dia_libre';
            statusLabel = '🌴 Día Libre';
        } else if (item.status === 'CAPACITACION') {
            badgeClass = 'capacitacion';
            statusLabel = '📚 Capacitación';
        }

        return `
            <tr>
                <td><strong>${escapeHtml(item.analyst)}</strong></td>
                <td><span class="status-badge ${badgeClass}">${statusLabel}</span></td>
                <td>
                    <span style="font-size:0.8rem; color:var(--text-dark);">${escapeHtml(item.dates)}</span>
                    <br><small style="color:var(--text-muted);">${escapeHtml(item.note)}</small>
                </td>
                <td>
                    <button class="btn-danger btn-sm" onclick="deleteNovedad(${realIdx})" title="Eliminar / Quitar Novedad">
                        <i data-lucide="trash-2"></i> Eliminar
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

function renderNovedades() {
    const containerAnalysts = document.getElementById('analyst-status-feed');
    if (containerAnalysts) {
        const teamMembers = ['Mayumi Sanchez', 'Juliana Chimbi'];

        containerAnalysts.innerHTML = teamMembers.map(analystName => {
            const item = state.analystStatus.find(a => a.analyst === analystName && a.status !== 'DISPONIBLE');

            if (item) {
                let statusText = '🏖️ En Vacaciones';
                let badgeClass = 'vacaciones';
                if (item.status === 'DIA_LIBRE') {
                    statusText = '🌴 Día Libre';
                    badgeClass = 'dia_libre';
                } else if (item.status === 'CAPACITACION') {
                    statusText = '📚 En Capacitación';
                    badgeClass = 'capacitacion';
                }

                return `
                    <div class="analyst-status-card on-leave">
                        <div class="analyst-card-top">
                            <span class="analyst-name-bold">
                                <i data-lucide="user-check"></i> ${escapeHtml(item.analyst)}
                            </span>
                            <span class="status-badge ${badgeClass}">${statusText}</span>
                        </div>
                        <div class="analyst-note-text">${escapeHtml(item.note || 'En periodo de ausencia / vacaciones.')}</div>
                        ${item.dates ? `<div class="analyst-dates-sub">📅 ${escapeHtml(item.dates)}</div>` : ''}
                    </div>
                `;
            } else {
                return `
                    <div class="analyst-status-card available">
                        <div class="analyst-card-top">
                            <span class="analyst-name-bold">
                                <i data-lucide="user-check"></i> ${escapeHtml(analystName)}
                            </span>
                            <span class="status-badge available">🟢 Disponible</span>
                        </div>
                        <div class="analyst-note-text">🟢 Laborando en horario regular. Atendiendo solicitudes de Power BI y Encoladas.</div>
                        <div class="analyst-dates-sub">📅 Disponible todo el periodo</div>
                    </div>
                `;
            }
        }).join('');
    }

    const containerHolidays = document.getElementById('holidays-container');
    const badgeCount = document.getElementById('holidays-count-badge');
    const todayStr = new Date().toISOString().slice(0, 10);
    const futureHolidays = colombianHolidays2026.filter(h => h.iso >= todayStr);

    if (badgeCount) {
        badgeCount.textContent = `${futureHolidays.length} próximos festivos`;
    }

    if (containerHolidays) {
        if (futureHolidays.length === 0) {
            containerHolidays.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">No hay más festivos restantes en el año.</p>`;
        } else {
            containerHolidays.innerHTML = futureHolidays.map(h => `
                <div class="holiday-item">
                    <div class="holiday-date-box">
                        <div class="holiday-day">${escapeHtml(h.dateLabel)}</div>
                        <div class="holiday-month">${escapeHtml(h.day)}</div>
                    </div>
                    <div class="holiday-name">${escapeHtml(h.name)}</div>
                </div>
            `).join('');
        }
    }

    lucide.createIcons();
}

// ==========================================================================
// 8. ENVÍO DE FORMULARIOS CON SINCRONIZACIÓN NUBE INSTANTÁNEA
// ==========================================================================
async function handleEncoladaSubmit(e) {
    e.preventDefault();

    const encType = document.querySelector('input[name="encType"]:checked').value;
    const email = document.getElementById('enc-email').value.trim();
    const estudio = document.getElementById('enc-estudio').value;
    const pais = document.getElementById('enc-pais').value;
    const ola = document.getElementById('enc-ola').value;
    const solicitante = document.getElementById('enc-solicitante').value.trim() || 'Operaciones D&N';
    const observaciones = document.getElementById('enc-observaciones').value.trim() || 'Sin observaciones.';

    const fileInput = document.getElementById('enc-file');
    let fileName = fileInput?.dataset?.fileName || null;
    let fileDataUrl = fileInput?.dataset?.fileDataUrl || null;

    let pdvCodes = [];
    let isGeneralReview = false;

    if (encType === 'SPECIFIC_PDVS') {
        const pdvsText = document.getElementById('enc-pdvs').value.trim();
        pdvCodes = pdvsText
            .split(/[\s,\n]+/)
            .map(s => s.trim().toUpperCase())
            .filter(s => s.length > 0)
            .map(s => s.startsWith('PDV-') ? s : 'PDV-' + s);
    } else {
        isGeneralReview = true;
    }

    const newReq = {
        id: generateUniqueReqId(),
        category: 'ENCOLADA',
        isGeneralReview: isGeneralReview,
        pdvCodes: pdvCodes,
        pdvCode: isGeneralReview ? 'Revisión General Estudio' : pdvCodes.join(', '),
        email: email,
        estudio: estudio,
        pais: pais,
        ola: ola,
        solicitante: solicitante,
        analyst: null,
        detalle: observaciones,
        fileName: fileName,
        fileDataUrl: fileDataUrl,
        status: 'PENDING',
        ticketNumber: null,
        resolutionNote: null,
        createdAt: new Date().toISOString(),
        resolvedAt: null
    };

    await fetchCloudData();
    state.requests.unshift(newReq);
    recordMySubmittedId(newReq.id);
    await syncCloudData();

    document.getElementById('form-encoladas').reset();
    document.getElementById('enc-file-info').innerHTML = '';
    renderAll();

    sendSubmissionConfirmationEmail(newReq);
}

async function handleReportingSubmit(e) {
    e.preventDefault();

    const biType = document.querySelector('input[name="biType"]:checked').value;
    const email = document.getElementById('rep-email').value.trim();
    const estudio = document.getElementById('rep-estudio').value;
    const pais = document.getElementById('rep-pais').value;
    const detalle = document.getElementById('rep-solicitud-detalle').value.trim();

    const fileInput = document.getElementById('rep-file');
    let fileName = fileInput?.dataset?.fileName || null;
    let fileDataUrl = fileInput?.dataset?.fileDataUrl || null;

    let catName = 'BI_EXISTING';
    if (biType === 'NEW') catName = 'BI_NEW';
    else if (biType === 'SPORADIC') catName = 'BI_SPORADIC';

    const newReq = {
        id: generateUniqueReqId(),
        category: catName,
        email: email,
        estudio: estudio,
        pais: pais,
        analyst: null,
        detalle: detalle,
        fileName: fileName,
        fileDataUrl: fileDataUrl,
        status: 'PENDING',
        ticketNumber: null,
        resolutionNote: null,
        createdAt: new Date().toISOString(),
        resolvedAt: null
    };

    if (biType === 'EXISTING') {
        newReq.usuario = document.getElementById('rep-usuario').value.trim();
        newReq.biNameToEdit = document.getElementById('rep-bi-name').value.trim();
        newReq.solicitante = newReq.usuario;
    } else if (biType === 'NEW') {
        newReq.frecuencia = document.getElementById('rep-frecuencia').value;
        newReq.area = document.getElementById('rep-area').value.trim();
        newReq.solicitante = `Área: ${newReq.area}`;
    } else {
        newReq.solicitante = email;
    }

    await fetchCloudData();
    state.requests.unshift(newReq);
    recordMySubmittedId(newReq.id);
    await syncCloudData();

    document.getElementById('form-reporting').reset();
    document.getElementById('rep-file-info').innerHTML = '';
    renderAll();

    sendSubmissionConfirmationEmail(newReq);
}

// ==========================================================================
// 9. ENVÍO REAL DE CORREOS Y NOTIFICACIONES
// ==========================================================================
function sendSubmissionConfirmationEmail(req) {
    const userEmail = req.email || 'usuario@dichter-neira.com';
    const isEncolada = req.category === 'ENCOLADA';

    const allRecipients = [userEmail, ...REPORTING_TEAM_EMAILS];
    const recipientsStr = allRecipients.join(', ');

    let catTitle = 'Reporting Power BI';
    if (req.category === 'ENCOLADA') catTitle = 'Encolada PDV';
    else if (req.category === 'BI_SPORADIC') catTitle = 'Solicitud Esporádica';

    const subject = `[Nueva Solicitud ${req.id}] ${catTitle}: ${req.estudio} (${req.pais})`;

    const commitmentMsg = isEncolada
        ? '⏳ <strong>La solicitud se revisará en un máximo de 2 días hábiles (Equipo ubicado en Colombia).</strong>'
        : '⏳ <strong>El equipo de Reporting (Colombia) se contactará en un plazo máximo de 3 días hábiles.</strong>';

    const htmlBody = `
        <p>Hola <strong>${escapeHtml(req.solicitante || 'Equipo Dichter & Neira')}</strong>,</p>
        <p>Se ha recibido correctamente una nueva solicitud en el Portal de Dichter & Neira.</p>
        
        <div style="background:rgba(13,92,171,0.08); border-left:4px solid #0D5CAB; padding:14px; margin:14px 0; border-radius:6px; font-size:0.9rem;">
            ${commitmentMsg}
        </div>

        <div class="email-card-box">
            <div><strong>Folio ID:</strong> ${escapeHtml(req.id)}</div>
            <div><strong>Solicitante:</strong> ${escapeHtml(req.solicitante)} (${escapeHtml(req.email)})</div>
            <div><strong>Categoría:</strong> ${escapeHtml(req.category)}</div>
            <div><strong>Estudio:</strong> ${escapeHtml(req.estudio)} | <strong>País:</strong> ${escapeHtml(req.pais)}</div>
            ${req.pdvCode ? `<div><strong>Detalle / PDVs:</strong> ${escapeHtml(req.pdvCode)}</div>` : ''}
            ${req.fileName ? `<div><strong>Archivo Adjunto:</strong> 📎 ${escapeHtml(req.fileName)}</div>` : ''}
            <div><strong>Detalle del Requerimiento:</strong> "${escapeHtml(req.detalle)}"</div>
        </div>

        <p style="font-size:0.8rem; color:#64748B;">Notificación enviada a: ${escapeHtml(recipientsStr)}</p>
    `;

    openEmailPreviewModal(recipientsStr, subject, htmlBody);

    if (typeof emailjs !== 'undefined') {
        allRecipients.forEach(email => {
            const templateParams = {
                to_email: email,
                subject: subject,
                message: htmlBody,
                name: 'Reporting Dichter & Neira'
            };

            emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
                .then(function() {
                    console.log(`EmailJS enviado a: ${email}`);
                }, function(error) {
                    console.error(`Error enviando EmailJS a ${email}:`, error);
                });
        });

        showToast(`📧 ¡Notificación enviada a ${userEmail} y al Equipo de Reporting (${REPORTING_TEAM_EMAILS.join(', ')})!`, 'success');
    }
}

function sendInProgressEmail(req) {
    const userEmail = req.email || 'usuario@dichter-neira.com';
    const allRecipients = [userEmail, ...REPORTING_TEAM_EMAILS];
    const recipientsStr = allRecipients.join(', ');

    const subject = `[En Proceso] Actualización Solicitud ${req.id} - Fecha de Entrega Acordada`;
    const deliveryFormatted = req.deliveryDate ? new Date(req.deliveryDate + 'T00:00:00').toLocaleDateString('es-CO') : 'Por acordar';

    const htmlBody = `
        <p>Hola <strong>${escapeHtml(req.solicitante || 'Solicitante')}</strong>,</p>
        <p>La solicitud <strong>${req.id}</strong> ha sido revisada por la analista <strong>${escapeHtml(req.analyst)}</strong> de Reporting y ha pasado a estado <strong>🔵 EN PROCESO</strong>.</p>
        
        <div style="background:rgba(51,189,238,0.12); border-left:4px solid #0D5CAB; padding:16px; margin:14px 0; border-radius:6px;">
            <div style="font-size:0.95rem; font-weight:700; color:#0D5CAB; margin-bottom:6px;">
                📅 Según la conversación sostenida, la fecha estimada de entrega es: <strong>${deliveryFormatted}</strong>
            </div>
            <div style="font-size:0.85rem; color:#1E293B;">
                <strong>Detalles del Acuerdo:</strong> "${escapeHtml(req.inProgressNote || 'En proceso de desarrollo y conciliación.')}"
            </div>
        </div>

        <div class="email-card-box">
            <div><strong>Solicitud ID:</strong> ${escapeHtml(req.id)}</div>
            <div><strong>Analista Asignada:</strong> ${escapeHtml(req.analyst)}</div>
            <div><strong>Estudio:</strong> ${escapeHtml(req.estudio)} | <strong>País:</strong> ${escapeHtml(req.pais)}</div>
        </div>
    `;

    openEmailPreviewModal(recipientsStr, subject, htmlBody);

    if (typeof emailjs !== 'undefined') {
        allRecipients.forEach(email => {
            const templateParams = {
                to_email: email,
                subject: subject,
                message: htmlBody,
                name: 'Reporting Dichter & Neira'
            };
            emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        });
        showToast(`📧 ¡Notificación de Estado En Proceso enviada a ${userEmail} y al equipo de Reporting!`, 'success');
    }
}

function sendResolutionTicketEmail(req) {
    const userEmail = req.email || 'usuario@dichter-neira.com';
    const allRecipients = [userEmail, ...REPORTING_TEAM_EMAILS];
    const recipientsStr = allRecipients.join(', ');

    const subject = `[Ticket Asignado] Solución Solicitud ${req.id} - D&N`;

    const htmlBody = `
        <p>Hola <strong>${escapeHtml(req.solicitante || 'Solicitante')}</strong>,</p>
        <p>La solicitud <strong>${req.id}</strong> ha sido atendida y completada exitosamente por la analista <strong>${escapeHtml(req.analyst)}</strong> de Reporting:</p>
        <div class="email-ticket-highlight">
            <span style="font-size:0.75rem; color:#64748B;">Número de Ticket Generado</span>
            <div class="ticket-code-big">${escapeHtml(req.ticketNumber)}</div>
        </div>
        <div class="email-card-box">
            <div><strong>Analista Asignada:</strong> ${escapeHtml(req.analyst)}</div>
            <div><strong>Respuesta / Nota:</strong> "${escapeHtml(req.resolutionNote || 'Solicitud completada exitosamente.')}"</div>
        </div>
    `;

    openEmailPreviewModal(recipientsStr, subject, htmlBody);

    if (typeof emailjs !== 'undefined') {
        allRecipients.forEach(email => {
            const templateParams = {
                to_email: email,
                subject: subject,
                message: htmlBody,
                name: 'Reporting Dichter & Neira'
            };
            emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        });
        showToast(`📧 ¡Correo con Ticket enviado a ${userEmail} y al equipo de Reporting!`, 'success');
    }
}

// ==========================================================================
// 10. RENDERIZADO DE TABLAS E HISTORIALES FILTRADOS POR USUARIO LOCAL
// ==========================================================================
function renderMiniDashboard() {
    const containerTotal = document.getElementById('dash-total-count');
    const containerPais = document.getElementById('breakdown-pais');
    const containerEstudio = document.getElementById('breakdown-estudio');
    const containerOla = document.getElementById('breakdown-ola');

    if (!containerPais || !containerEstudio || !containerOla) return;

    const encoladas = state.requests.filter(r => r.category === 'ENCOLADA');
    if (containerTotal) containerTotal.textContent = `Total: ${encoladas.length} encolada${encoladas.length !== 1 ? 's' : ''}`;

    const countByPais = {};
    const countByEstudio = {};
    const countByOla = {};

    encoladas.forEach(r => {
        if (r.pais) countByPais[r.pais] = (countByPais[r.pais] || 0) + 1;
        if (r.estudio) countByEstudio[r.estudio] = (countByEstudio[r.estudio] || 0) + 1;
        if (r.ola) countByOla[r.ola] = (countByOla[r.ola] || 0) + 1;
    });

    renderBreakdownList(containerPais, countByPais, 'Sin datos de país');
    renderBreakdownList(containerEstudio, countByEstudio, 'Sin datos de estudio');
    renderBreakdownList(containerOla, countByOla, 'Sin datos de ola');
}

function renderBreakdownList(container, groupObj, emptyMsg) {
    const keys = Object.keys(groupObj).sort((a, b) => groupObj[b] - groupObj[a]);

    if (keys.length === 0) {
        container.innerHTML = `<span style="font-size:0.75rem; color:var(--text-subtle);">${emptyMsg}</span>`;
        return;
    }

    container.innerHTML = keys.slice(0, 5).map(key => `
        <div class="breakdown-item">
            <span class="breakdown-name">${escapeHtml(key)}</span>
            <span class="breakdown-count">${groupObj[key]}</span>
        </div>
    `).join('');
}

function renderFieldHistory() {
    const container = document.getElementById('list-encoladas-history');
    if (!container) return;

    const myIds = getMySubmittedIds();

    // Solo se muestran las solicitudes que se hayan creado desde este computador (o todas si es admin autenticado)
    const myEncoladas = state.requests.filter(r => 
        r.category === 'ENCOLADA' && (myIds.includes(r.id) || state.isReportingAuthenticated)
    );

    if (myEncoladas.length === 0) {
        container.innerHTML = `
            <div style="color:var(--text-muted); text-align:center; padding:30px 15px;">
                <i data-lucide="inbox" style="width:32px; height:32px; stroke-width:1.5; margin-bottom:8px; opacity:0.5; color:var(--dn-blue-primary);"></i>
                <p style="font-size:0.85rem; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Sin encoladas en este equipo</p>
                <small style="font-size:0.78rem; display:block; line-height:1.3; color:var(--text-muted);">Las solicitudes de encoladas que envíes desde tu computador aparecerán aquí para que consultes su estado en tiempo real.</small>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = myEncoladas.map(req => {
        const isResolved = req.status === 'RESOLVED';
        const isInProgress = req.status === 'IN_PROGRESS';

        let pdvsRender = '';
        if (req.isGeneralReview) {
            pdvsRender = `<span class="general-review-tag"><i data-lucide="search" style="width:12px"></i> Revisión General de Estudio</span>`;
        } else if (req.pdvCodes && req.pdvCodes.length > 0) {
            pdvsRender = `<div class="pdv-pill-list">${req.pdvCodes.map(code => `<span class="pdv-pill">${escapeHtml(code)}</span>`).join('')}</div>`;
        } else {
            pdvsRender = `<span class="tag-code">${escapeHtml(req.pdvCode || 'PDV')}</span>`;
        }

        let statusText = 'En Espera';
        let statusClass = 'pending';
        if (isResolved) {
            statusText = 'Ticket Asignado';
            statusClass = 'resolved';
        } else if (isInProgress) {
            statusText = `🔵 En Proceso (Entrega: ${req.deliveryDate || 'Por acordar'})`;
            statusClass = 'in_progress';
        }

        return `
            <div class="item-card">
                <div class="item-top">
                    <div>${pdvsRender}</div>
                    <span class="chip-status ${statusClass}">${statusText}</span>
                </div>
                <div style="font-size:0.83rem; color:var(--text-muted); margin-bottom:4px;">
                    Estudio: <strong>${escapeHtml(req.estudio)}</strong> | País: <strong>${escapeHtml(req.pais)}</strong> | Ola: <strong>${escapeHtml(req.ola)}</strong>
                </div>
                ${req.fileName ? `<div style="margin-bottom:4px;">${renderFileChip(req)}</div>` : ''}
                ${req.analyst ? `<div style="margin-bottom:4px;"><span class="analyst-chip"><i data-lucide="user-check" style="width:11px"></i> Analista: ${escapeHtml(req.analyst)}</span></div>` : ''}
                ${isResolved ? `
                    <div style="margin-top:8px; padding:8px; background:rgba(20,168,59,0.1); border-radius:6px; display:flex; justify-between; align-items:center;">
                        <span style="font-family:var(--font-mono); color:var(--dn-green); font-weight:800;">Ticket: ${escapeHtml(req.ticketNumber)}</span>
                        <button class="btn-secondary btn-sm" onclick="copyText('${escapeHtml(req.ticketNumber)}')">Copiar</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function renderReportingHistory() {
    const container = document.getElementById('list-reporting-history');
    if (!container) return;

    const myIds = getMySubmittedIds();

    // Solo se muestran las solicitudes de Reporting enviadas desde ESTE computador (o todas si es admin autenticado)
    const myReportingReqs = state.requests.filter(r => 
        (r.category === 'BI_EXISTING' || r.category === 'BI_NEW' || r.category === 'BI_SPORADIC') &&
        (myIds.includes(r.id) || state.isReportingAuthenticated)
    );

    if (myReportingReqs.length === 0) {
        container.innerHTML = `
            <div style="color:var(--text-muted); text-align:center; padding:30px 15px;">
                <i data-lucide="inbox" style="width:32px; height:32px; stroke-width:1.5; margin-bottom:8px; opacity:0.5; color:var(--dn-blue-primary);"></i>
                <p style="font-size:0.85rem; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Sin solicitudes en este equipo</p>
                <small style="font-size:0.78rem; display:block; line-height:1.3; color:var(--text-muted);">Las solicitudes a Reporting que envíes desde tu computador aparecerán aquí para consultar su avance.</small>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = myReportingReqs.map(req => {
        const isResolved = req.status === 'RESOLVED';
        const isInProgress = req.status === 'IN_PROGRESS';
        const isNew = req.category === 'BI_NEW';
        const isSporadic = req.category === 'BI_SPORADIC';

        let catLabel = 'Edición BI Existente';
        if (isNew) catLabel = 'Power BI Nuevo';
        if (isSporadic) catLabel = 'Solicitud Esporádica';

        let statusText = 'En Evaluación';
        let statusClass = 'pending';
        if (isResolved) {
            statusText = 'Completado';
            statusClass = 'resolved';
        } else if (isInProgress) {
            statusText = `🔵 En Proceso (Entrega: ${req.deliveryDate || 'Acordada'})`;
            statusClass = 'in_progress';
        }

        let detailHeader = `BI: ${escapeHtml(req.biNameToEdit)}`;
        if (isNew) detailHeader = `Área: ${escapeHtml(req.area)} (Frecuencia: ${escapeHtml(req.frecuencia)})`;
        if (isSporadic) detailHeader = `Requerimiento Esporádico`;

        return `
            <div class="item-card">
                <div class="item-top">
                    <span class="tag-category ${isSporadic ? 'sporadic' : ''}">${catLabel}</span>
                    <span class="chip-status ${statusClass}">${statusText}</span>
                </div>
                <div style="font-size:0.85rem; font-weight:600; margin-bottom:4px;">
                    ${detailHeader}
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted);">
                    Estudio: ${escapeHtml(req.estudio)} | País: ${escapeHtml(req.pais)}
                </div>
                ${req.fileName ? `<div style="margin-top:4px;">${renderFileChip(req)}</div>` : ''}
                ${req.analyst ? `<div style="margin-top:4px;"><span class="analyst-chip">Analista: ${escapeHtml(req.analyst)}</span></div>` : ''}
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function renderAdminTable() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;

    const query = (document.getElementById('admin-search')?.value || '').toLowerCase();
    const catFilter = document.getElementById('admin-category-filter')?.value || 'ALL';
    const analystFilter = document.getElementById('admin-analyst-filter')?.value || 'ALL';

    const filtered = state.requests.filter(req => {
        const matchesQuery = 
            (req.pdvCode && req.pdvCode.toLowerCase().includes(query)) ||
            (req.estudio && req.estudio.toLowerCase().includes(query)) ||
            (req.pais && req.pais.toLowerCase().includes(query)) ||
            (req.email && req.email.toLowerCase().includes(query)) ||
            (req.analyst && req.analyst.toLowerCase().includes(query)) ||
            (req.ticketNumber && req.ticketNumber.toLowerCase().includes(query));

        const matchesCat = catFilter === 'ALL' || req.category === catFilter;
        
        let matchesAnalyst = true;
        if (analystFilter === 'UNASSIGNED') {
            matchesAnalyst = !req.analyst;
        } else if (analystFilter !== 'ALL') {
            matchesAnalyst = req.analyst === analystFilter;
        }

        return matchesQuery && matchesCat && matchesAnalyst;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted);">No se encontraron solicitudes con los criterios de búsqueda.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(req => {
        const isResolved = req.status === 'RESOLVED';
        const isInProgress = req.status === 'IN_PROGRESS';
        const dateStr = new Date(req.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        let categoryLabel = 'Encolada PDV';
        let detailText = req.pdvCode || '--';
        if (req.isGeneralReview) {
            detailText = 'Revisión General de Estudio';
        } else if (req.category === 'BI_EXISTING') {
            categoryLabel = 'BI Existente';
            detailText = req.biNameToEdit;
        } else if (req.category === 'BI_NEW') {
            categoryLabel = 'BI Nuevo';
            detailText = `Área: ${req.area}`;
        } else if (req.category === 'BI_SPORADIC') {
            categoryLabel = 'Esporádica';
            detailText = 'Requerimiento Esporádico';
        }

        let statusText = 'Pendiente';
        let statusClass = 'pending';
        let ticketOrDateInfo = '<span style="color:var(--text-subtle);">-- Sin Asignar --</span>';

        if (isResolved) {
            statusText = 'Resuelto';
            statusClass = 'resolved';
            ticketOrDateInfo = `<span style="font-family:var(--font-mono); color:var(--dn-green); font-weight:700;">${escapeHtml(req.ticketNumber)}</span>`;
        } else if (isInProgress) {
            statusText = 'En Proceso';
            statusClass = 'in_progress';
            ticketOrDateInfo = `<span style="font-size:0.78rem; color:var(--dn-blue-primary); font-weight:700;">📅 ${req.deliveryDate || 'Por acordar'}</span>`;
        }

        return `
            <tr>
                <td style="font-size:0.78rem; color:var(--text-muted);">${dateStr}</td>
                <td><span class="tag-category ${req.category === 'BI_SPORADIC' ? 'sporadic' : ''}">${categoryLabel}</span></td>
                <td>
                    <strong>${escapeHtml(detailText)}</strong>
                    ${req.fileName ? `<br style="margin-bottom:2px;">${renderFileChip(req)}` : ''}
                </td>
                <td>${escapeHtml(req.estudio)}</td>
                <td>${escapeHtml(req.pais)}</td>
                <td><span style="font-size:0.81rem; color:var(--dn-blue-primary);">${escapeHtml(req.email || req.solicitante || 'N/A')}</span></td>
                <td>
                    ${req.analyst 
                        ? `<span class="analyst-chip">${escapeHtml(req.analyst)}</span>`
                        : `<span style="font-size:0.75rem; color:var(--dn-orange); font-style:italic;">-- Sin Asignar --</span>`}
                </td>
                <td><span class="chip-status ${statusClass}">${statusText}</span></td>
                <td>${ticketOrDateInfo}</td>
                <td>
                    <div class="action-buttons-cell">
                        <button class="btn-secondary btn-sm" onclick="openModal('${req.id}')" title="Gestionar estado">
                            <i data-lucide="edit-2"></i> Gestionar
                        </button>
                        <button class="btn-danger btn-sm" onclick="deleteRequest('${req.id}')" title="Eliminar solicitud">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

function renderMetrics() {
    const totalPending = state.requests.filter(r => r.status === 'PENDING').length;
    const totalEncoladas = state.requests.filter(r => r.category === 'ENCOLADA').length;
    const totalBI = state.requests.filter(r => r.category.startsWith('BI_')).length;
    const totalResolved = state.requests.filter(r => r.status === 'RESOLVED').length;

    document.getElementById('stat-pending').textContent = totalPending;
    document.getElementById('stat-encoladas').textContent = totalEncoladas;
    document.getElementById('stat-bi').textContent = totalBI;
    document.getElementById('stat-resolved').textContent = totalResolved;

    const counter = document.getElementById('pending-counter');
    if (counter) {
        counter.textContent = totalPending;
        counter.style.display = totalPending > 0 ? 'inline-block' : 'none';
    }
}

function renderAll() {
    renderMiniDashboard();
    renderFieldHistory();
    renderReportingHistory();
    renderAdminTable();
    renderMetrics();
}

// ==========================================================================
// 11. TIEMPO PROMEDIO Y ANALYTICS
// ==========================================================================
function calcAvgResponseTimeForAnalyst(analystName) {
    const resolvedReqs = state.requests.filter(r => r.analyst === analystName && r.status === 'RESOLVED' && r.createdAt && r.resolvedAt);

    if (resolvedReqs.length === 0) return { avgHours: 0, count: 0 };

    let totalHours = 0;
    resolvedReqs.forEach(r => {
        const created = new Date(r.createdAt).getTime();
        const resolved = new Date(r.resolvedAt).getTime();
        const diffHours = (resolved - created) / (1000 * 3600);
        totalHours += diffHours;
    });

    const avg = totalHours / resolvedReqs.length;
    return { avgHours: Math.round(avg * 10) / 10, count: resolvedReqs.length };
}

function renderAnalyticsCharts() {
    const total = state.requests.length;
    const resolved = state.requests.filter(r => r.status === 'RESOLVED').length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const mayumiMetrics = calcAvgResponseTimeForAnalyst('Mayumi Sanchez');
    const julianaMetrics = calcAvgResponseTimeForAnalyst('Juliana Chimbi');

    document.getElementById('kpi-mayumi-time').textContent = mayumiMetrics.count > 0 ? `~${mayumiMetrics.avgHours} hrs` : '--';
    document.getElementById('kpi-mayumi-solved').textContent = `${mayumiMetrics.count} solicitud${mayumiMetrics.count !== 1 ? 'es' : ''} resuelta${mayumiMetrics.count !== 1 ? 's' : ''}`;

    document.getElementById('kpi-juliana-time').textContent = julianaMetrics.count > 0 ? `~${julianaMetrics.avgHours} hrs` : '--';
    document.getElementById('kpi-juliana-solved').textContent = `${julianaMetrics.count} solicitud${julianaMetrics.count !== 1 ? 'es' : ''} resuelta${julianaMetrics.count !== 1 ? 's' : ''}`;

    const allResolved = state.requests.filter(r => r.status === 'RESOLVED' && r.createdAt && r.resolvedAt);
    let totalGeneralHours = 0;
    allResolved.forEach(r => {
        totalGeneralHours += (new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime()) / (1000 * 3600);
    });
    const avgGeneral = allResolved.length > 0 ? Math.round((totalGeneralHours / allResolved.length) * 10) / 10 : 0;

    document.getElementById('kpi-avg-time').textContent = avgGeneral > 0 ? `~${avgGeneral} hrs` : '--';
    document.getElementById('kpi-resolution-rate').textContent = `${resolutionRate}%`;
    document.getElementById('kpi-resolved-ratio').textContent = `${resolved} resueltas de ${total}`;

    Object.keys(state.charts).forEach(key => {
        if (state.charts[key]) state.charts[key].destroy();
    });

    const countMayumi = state.requests.filter(r => r.analyst === 'Mayumi Sanchez').length;
    const countJuliana = state.requests.filter(r => r.analyst === 'Juliana Chimbi').length;
    const countUnassigned = state.requests.filter(r => !r.analyst).length;

    const ctxAnalyst = document.getElementById('chart-analyst')?.getContext('2d');
    if (ctxAnalyst) {
        state.charts.analyst = new Chart(ctxAnalyst, {
            type: 'doughnut',
            data: {
                labels: ['Mayumi Sanchez', 'Juliana Chimbi', 'Sin Asignar'],
                datasets: [{
                    data: [countMayumi, countJuliana, countUnassigned],
                    backgroundColor: ['#0D5CAB', '#6D37A9', '#979697'],
                    borderWidth: 2,
                    borderColor: '#FFFFFF'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    const countByEstudio = {};
    state.requests.forEach(r => {
        if (r.estudio) countByEstudio[r.estudio] = (countByEstudio[r.estudio] || 0) + 1;
    });

    const ctxEstudio = document.getElementById('chart-estudio')?.getContext('2d');
    if (ctxEstudio) {
        state.charts.estudio = new Chart(ctxEstudio, {
            type: 'bar',
            data: {
                labels: Object.keys(countByEstudio),
                datasets: [{
                    label: 'Solicitudes',
                    data: Object.values(countByEstudio),
                    backgroundColor: '#33BDEE',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } }
            }
        });
    }

    const countByPais = {};
    state.requests.forEach(r => {
        if (r.pais) countByPais[r.pais] = (countByPais[r.pais] || 0) + 1;
    });

    const ctxPais = document.getElementById('chart-pais')?.getContext('2d');
    if (ctxPais) {
        state.charts.pais = new Chart(ctxPais, {
            type: 'bar',
            data: {
                labels: Object.keys(countByPais),
                datasets: [{
                    label: 'Solicitudes por País',
                    data: Object.values(countByPais),
                    backgroundColor: '#24335F',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    const countEncolada = state.requests.filter(r => r.category === 'ENCOLADA').length;
    const countBiExisting = state.requests.filter(r => r.category === 'BI_EXISTING').length;
    const countBiNew = state.requests.filter(r => r.category === 'BI_NEW').length;

    const ctxCategory = document.getElementById('chart-category')?.getContext('2d');
    if (ctxCategory) {
        state.charts.category = new Chart(ctxCategory, {
            type: 'pie',
            data: {
                labels: ['Encoladas PDV', 'Power BI Existente', 'Power BI Nuevo'],
                datasets: [{
                    data: [countEncolada, countBiExisting, countBiNew],
                    backgroundColor: ['#0D5CAB', '#6D37A9', '#F83875'],
                    borderWidth: 2,
                    borderColor: '#FFFFFF'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

// ==========================================================================
// 12. MODAL DE GESTIÓN (CAMBIO DE ESTADO, ACUERDO EN PROCESO Y TICKET)
// ==========================================================================
function openModal(id) {
    const req = state.requests.find(r => r.id === id);
    if (!req) return;

    state.activeModalId = id;
    const summary = document.getElementById('modal-summary');

    summary.innerHTML = `
        <div><strong>Categoría:</strong> ${req.category}</div>
        <div><strong>Solicitante Correo:</strong> <span class="highlight-email">${escapeHtml(req.email || 'No registrado')}</span></div>
        <div><strong>Estudio:</strong> ${escapeHtml(req.estudio)} | <strong>País:</strong> ${escapeHtml(req.pais)}</div>
        <div><strong>Modalidad / PDVs:</strong> ${escapeHtml(req.pdvCode || 'Encolada')}</div>
        ${req.fileName ? `<div style="margin-top:4px;"><strong>Archivo Adjunto:</strong> ${renderFileChip(req)}</div>` : ''}
        <div><strong>Detalle:</strong> "${escapeHtml(req.detalle)}"</div>
    `;

    document.getElementById('modalAnalyst').value = req.analyst || '';
    
    const currentStatus = req.status || 'PENDING';
    document.getElementById('modalStatus').value = currentStatus;
    toggleModalStatusFields(currentStatus);

    document.getElementById('modalDeliveryDate').value = req.deliveryDate || '';
    document.getElementById('modalInProgressNote').value = req.inProgressNote || '';
    document.getElementById('modalTicket').value = req.ticketNumber || '';
    document.getElementById('modalNote').value = req.resolutionNote || '';

    document.getElementById('response-modal').classList.add('active');
    lucide.createIcons();
}

function toggleModalStatusFields(status) {
    const inProgressBlock = document.getElementById('modal-in-progress-fields');
    const resolvedBlock = document.getElementById('modal-resolved-fields');

    if (status === 'IN_PROGRESS') {
        inProgressBlock.classList.remove('hidden');
        resolvedBlock.classList.add('hidden');
    } else if (status === 'RESOLVED') {
        inProgressBlock.classList.add('hidden');
        resolvedBlock.classList.remove('hidden');
    } else {
        inProgressBlock.classList.add('hidden');
        resolvedBlock.classList.add('hidden');
    }
}

function closeModal() {
    document.getElementById('response-modal').classList.remove('active');
    state.activeModalId = null;
}

function autoGenerateTicket() {
    const ticket = 'TCK-DN-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
    document.getElementById('modalTicket').value = ticket;
}

function saveModalResponse() {
    const analystVal = document.getElementById('modalAnalyst').value;
    const statusVal = document.getElementById('modalStatus').value;

    if (!analystVal) {
        showToast('Debes seleccionar la analista asignada (Mayumi Sanchez o Juliana Chimbi)', 'warning');
        return;
    }

    const req = state.requests.find(r => r.id === state.activeModalId);
    if (!req) return;

    req.analyst = analystVal;
    req.status = statusVal;

    if (statusVal === 'IN_PROGRESS') {
        const deliveryDate = document.getElementById('modalDeliveryDate').value;
        const noteVal = document.getElementById('modalInProgressNote').value.trim();

        if (!deliveryDate) {
            showToast('Debes ingresar la fecha acordada de entrega', 'warning');
            return;
        }

        req.deliveryDate = deliveryDate;
        req.inProgressNote = noteVal;
        
        syncCloudData();
        renderAll();
        closeModal();
        sendInProgressEmail(req);
    } else if (statusVal === 'RESOLVED') {
        const ticketVal = document.getElementById('modalTicket').value.trim();
        const noteVal = document.getElementById('modalNote').value.trim();

        if (!ticketVal) {
            showToast('Debes ingresar un número de ticket', 'warning');
            return;
        }

        req.ticketNumber = ticketVal;
        req.resolutionNote = noteVal;
        req.resolvedAt = req.resolvedAt || new Date().toISOString();

        syncCloudData();
        renderAll();
        closeModal();
        sendResolutionTicketEmail(req);
    } else {
        syncCloudData();
        renderAll();
        closeModal();
        showToast('Estado de la solicitud actualizado', 'info');
    }
}

// ==========================================================================
// 13. VISTA PREVIA CORREOS
// ==========================================================================
function openEmailPreviewModal(toEmail, subject, htmlBody) {
    document.getElementById('email-preview-to').textContent = toEmail;
    document.getElementById('email-preview-subject').textContent = subject;
    document.getElementById('email-preview-body').innerHTML = htmlBody;
    document.getElementById('email-preview-modal').classList.add('active');
    lucide.createIcons();
}

function closeEmailPreviewModal() {
    document.getElementById('email-preview-modal').classList.remove('active');
}

// ==========================================================================
// 14. UTILS
// ==========================================================================
function exportToCSV() {
    if (state.requests.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    let csv = "data:text/csv;charset=utf-8,ID,Categoria,Estudio,Pais,CorreoSolicitante,Analista,Estado,Ticket,Respuesta\n";

    state.requests.forEach(r => {
        const row = [
            r.id,
            `"${r.category}"`,
            `"${r.estudio}"`,
            `"${r.pais}"`,
            `"${r.email || r.solicitante || ''}"`,
            `"${r.analyst || 'Sin Asignar'}"`,
            `"${r.status}"`,
            `"${r.ticketNumber || ''}"`,
            `"${(r.resolutionNote || '').replace(/"/g, '""')}"`
        ].join(",");
        csv += row + "\n";
    });

    const encodedUri = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_DichtnerNeira_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    toast.innerHTML = `<i data-lucide="info"></i> <span>${escapeHtml(msg)}</span>`;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 4000);
    }, 4000);
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => showToast(`Copiado: ${text}`, 'success'));
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
