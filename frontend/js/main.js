let currentUser = null;
let avatarCacheKey = Date.now();
let tabState = {
    currentLessonId: null,
    currentLevel: 1,
    lessonData: { transcript: "", translation: "", audioSrc: "", clozeData: [] },
    aiData: { transcript: "", audioB64: "" }
};
let currentPayment = null;

// Authentication UI
const AuthUI = {
    isLoginMode: true,

    async init() {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                currentUser = await API.getMe();
            } catch (e) {
                this.logout();
            }
        }
        this.renderHeader();
        applyTheme();
        renderUserAccessState();
        loadDailyContent();
        showWelcomeModal();
        initMotionReveal();
        if (currentUser && ['admin', 'manager'].includes(currentUser.role)) {
            switchView('view-admin');
        } else if (currentUser) {
            switchView('view-profile');
        }
    },

    openModal(isLogin) {
        this.isLoginMode = isLogin;
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById('auth-error').classList.add('hidden');
            this.updateModalUI();
        }
    },

    closeModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.classList.add('hidden');
    },

    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        this.updateModalUI();
    },

    updateModalUI() {
        document.getElementById('auth-title').innerText = this.isLoginMode ? "Đăng nhập" : "Đăng ký";
        document.getElementById('btn-auth-submit').innerText = this.isLoginMode ? "Đăng nhập" : "Đăng ký";
        document.getElementById('auth-switch-text').innerText = this.isLoginMode ? "Chưa có tài khoản?" : "Đã có tài khoản?";
        document.getElementById('auth-switch-btn').innerText = this.isLoginMode ? "Đăng ký ngay" : "Đăng nhập ngay";
        document.getElementById('auth-forgot-row')?.classList.toggle('hidden', !this.isLoginMode);
    },

    async forgotPassword() {
        const username = document.getElementById('auth-username').value.trim();
        const errorEl = document.getElementById('auth-error');
        if (!username) {
            errorEl.innerText = 'Nhập tên tài khoản trước khi dùng quên mật khẩu.';
            errorEl.classList.remove('hidden');
            return;
        }
        try {
            const res = await API.forgotPassword(username);
            errorEl.innerText = res.msg;
            errorEl.className = 'mb-4 p-3 bg-blue-50 text-blue-700 text-sm font-bold rounded-lg border border-blue-100';
        } catch (e) {
            errorEl.innerText = e.message;
            errorEl.className = 'mb-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg border border-red-100';
        }
    },

    async submit() {
        const user = document.getElementById('auth-username').value;
        const pass = document.getElementById('auth-password').value;
        const errorEl = document.getElementById('auth-error');

        try {
            let data;
            if (this.isLoginMode) {
                data = await API.login(user, pass);
                localStorage.setItem('access_token', data.access_token);
                location.reload(); 
            } else {
                data = await API.register(user, pass);
                showWelcomeModal({
                    title: 'Chào mừng bạn đến với HanLingua',
                    message: data.msg || 'Tài khoản đã sẵn sàng. Bạn có 5 ngày dùng thử.',
                    icon: 'fa-heart'
                });
                this.toggleMode();
            }
        } catch (e) {
            errorEl.innerText = formatSuggestionMessage(e);
            errorEl.classList.remove('hidden');
        }
    },

    renderHeader() {
        const container = document.getElementById('header-auth-container');
        const mainNav = document.getElementById('main-nav');
        if (!container) return;
        if (mainNav) {
            if (currentUser && ['admin', 'manager'].includes(currentUser.role)) {
                mainNav.innerHTML = `
                    <div class="bg-white/70 border border-blue-100 rounded-lg p-1 flex items-center gap-1 shadow-sm">
                        <button id="nav-admin" onclick="switchView('view-admin')" class="main-nav-btn px-4 py-2.5 rounded-md text-sm font-black transition bg-gray-950 text-white shadow-sm">Bảng quản trị</button>
                    </div>`;
            } else {
                mainNav.innerHTML = `
                    <div class="bg-white/70 border border-gray-200 rounded-lg p-1 flex items-center gap-1 shadow-sm">
                        <button id="nav-home" onclick="switchView('view-landing')" class="main-nav-btn px-4 py-2.5 rounded-md text-sm font-black transition bg-gray-950 text-white shadow-sm">Trang chủ</button>
                        <button id="nav-learning" onclick="switchView('view-profile')" class="main-nav-btn px-4 py-2.5 rounded-md text-sm font-black transition text-gray-500 hover:text-hanred-600">Không gian học tập</button>
                        <div class="relative">
                            <button id="nav-more" onclick="toggleMoreMenu()" class="main-nav-btn px-4 py-2.5 rounded-md text-sm font-black transition text-gray-500 hover:text-hanred-600">Khác <i class="fa-solid fa-chevron-down ml-1 text-xs"></i></button>
                            <div id="more-menu" class="hidden absolute left-1/2 -translate-x-1/2 top-12 w-[420px] bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-50 text-left">
                                <div class="grid grid-cols-4 gap-2 mb-4 text-xs font-black">
                                    <button onclick="switchMorePanel('account')" id="more-tab-account" class="more-tab bg-hanred-600 text-white rounded-md px-3 py-2">Hồ sơ</button>
                                    <button onclick="switchMorePanel('payment')" id="more-tab-payment" class="more-tab bg-gray-100 text-gray-600 rounded-md px-3 py-2">Thanh toán</button>
                                    <button onclick="switchMorePanel('features')" id="more-tab-features" class="more-tab bg-gray-100 text-gray-600 rounded-md px-3 py-2">Tính năng</button>
                                    <button onclick="switchMorePanel('about')" id="more-tab-about" class="more-tab bg-gray-100 text-gray-600 rounded-md px-3 py-2">Giới thiệu</button>
                                </div>
                                <div id="more-panel-account" class="more-panel"><div class="text-xs font-black text-gray-400 uppercase mb-3">Thông tin người dùng</div><div id="more-user-info" class="space-y-3 text-sm text-gray-600"><p>Vui lòng đăng nhập để xem thông tin tài khoản.</p></div></div>
                                <div id="more-panel-payment" class="more-panel hidden text-sm text-gray-600 space-y-3"><div class="text-xs font-black text-gray-400 uppercase">Thanh toán</div><p>Chọn gói học và thanh toán bằng QR Vietcombank. Sau khi chuyển khoản, admin xác minh và mở quyền học.</p><button onclick="switchView('view-profile'); setTimeout(() => switchUserPanel('user-payment-section'), 50); toggleMoreMenu();" class="w-full bg-hanred-600 hover:bg-hanred-700 text-white px-4 py-3 rounded-xl font-bold">Mở gói học</button></div>
                                <div id="more-panel-features" class="more-panel hidden text-sm text-gray-600 space-y-3"><div class="text-xs font-black text-gray-400 uppercase">Tính năng</div><p><b>AI Dictation:</b> nghe chép, chấm điểm, hiện lỗi sai và đáp án.</p><p><b>AI Speaking:</b> luyện nói theo ngữ cảnh, tăng phản xạ giao tiếp.</p><p><b>Forecast Vocabulary:</b> học thẻ từ TOPIK theo chủ đề, có nghĩa và ví dụ.</p><p><b>Dashboard:</b> streak, lộ trình ngày, accuracy, activity log.</p></div>
                                <div id="more-panel-about" class="more-panel hidden text-sm text-gray-600 space-y-3"><div class="text-xs font-black text-gray-400 uppercase">Giới thiệu</div><p>HanLingua là nền tảng học tiếng Hàn tập trung vào Dictation, Speaking và từ vựng TOPIK theo chủ đề.</p><p>Nền tảng có lộ trình học rõ ràng, dashboard tiến độ, AI Dictation, AI Speaking và Forecast Vocabulary.</p></div>
                            </div>
                        </div>
                    </div>`;
                renderMoreUserInfo();
            }
        }
        if (currentUser) {
            const btnExtra = `
                <button onclick="openUpgradePlans()" class="h-12 inline-flex items-center gap-2 bg-hanred-600 hover:bg-hanred-700 text-white px-3 sm:px-4 rounded-lg text-sm font-black shadow-md transition cursor-pointer whitespace-nowrap" title="Nâng cấp gói">
                    <i class="fa-solid fa-credit-card"></i>
                    <span>Nâng cấp gói</span>
                </button>`;
            
            container.innerHTML = `
                <div class="flex items-center gap-3 relative">
                    <button onclick="toggleDarkMode()" class="w-12 h-12 bg-gray-900 text-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-black transition shrink-0" title="Dark mode">
                        <i class="theme-toggle-icon fa-solid fa-moon"></i>
                    </button>
                    ${btnExtra}
                    <div class="h-14 flex items-center gap-2 bg-gray-50 border border-gray-200 hover:border-hanred-200 rounded-3xl pl-2 pr-3 transition">
                        <div onclick="openProfileAvatarViewer()" class="relative w-12 h-12 bg-hanred-100 text-hanred-500 rounded-[1.35rem] flex items-center justify-center font-black shrink-0 overflow-visible profile-avatar shadow-sm cursor-pointer" title="Xem ảnh đại diện">
                            <div class="absolute inset-0 rounded-[1.35rem] overflow-hidden bg-hanred-100">
                                ${currentUser.avatar_url ? `<img src="${getAvatarSrc(currentUser.avatar_url)}" alt="Avatar" class="w-full h-full object-cover">` : `<span data-avatar-letter class="absolute inset-x-0 top-2 flex justify-center text-xl leading-none">${currentUser.username.charAt(0).toUpperCase()}</span>`}
                                ${currentUser.is_pro ? '<span class="absolute left-0 right-0 bottom-2 text-center text-white text-[12px] font-black leading-none tracking-tight drop-shadow">PRO</span>' : ''}
                            </div>
                            <span onclick="event.stopPropagation(); toggleAvatarActionMenu();" class="absolute -right-1.5 -top-1.5 w-6 h-6 rounded-full bg-gray-950 text-white border-2 border-white flex items-center justify-center text-[11px] shadow-md"><i class="fa-solid fa-camera"></i></span>
                        </div>
                        <button onclick="toggleAccountMenu()" class="w-7 h-10 flex items-center justify-center text-gray-400 hover:text-hanred-600 cursor-pointer" title="Menu tài khoản"><i class="fa-solid fa-chevron-down text-xs shrink-0"></i></button>
                    </div>
                    <div id="account-menu" class="hidden absolute right-0 top-[3.75rem] bg-white border border-gray-200 rounded-2xl shadow-xl p-1.5 min-w-[150px] z-50">
                        <button onclick="switchView('view-profile'); setTimeout(() => switchUserPanel('user-account-section'), 50); toggleAccountMenu();" class="w-full h-8 flex items-center gap-1.5 text-left px-2.5 rounded-lg text-[11px] font-medium leading-none text-gray-600 hover:bg-gray-50 cursor-pointer"><i class="fa-solid fa-user-shield text-gray-400 w-3 text-center text-[11px]"></i><span>Tài khoản</span></button>
                        <button onclick="AuthUI.logout()" class="w-full h-8 flex items-center gap-1.5 text-left px-2.5 rounded-lg text-[11px] font-medium leading-none text-gray-600 hover:bg-gray-50 cursor-pointer"><i class="fa-solid fa-arrow-right-from-bracket text-gray-400 w-3 text-center text-[11px]"></i><span>Đăng xuất</span></button>
                    </div>
                    <div id="avatar-action-menu" class="hidden absolute right-12 top-[3.2rem] bg-white border border-gray-200 rounded-2xl shadow-xl p-1.5 min-w-[135px] z-50">
                        <button onclick="removeProfileAvatar(); toggleAvatarActionMenu();" class="w-full h-8 flex items-center gap-1.5 text-left px-2.5 rounded-lg text-[11px] font-medium leading-none text-gray-600 hover:bg-gray-50 cursor-pointer"><i class="fa-solid fa-ban text-gray-400 w-3 text-center text-[11px]"></i><span>None</span></button>
                        <button onclick="document.getElementById('header-avatar-file')?.click(); toggleAvatarActionMenu();" class="w-full h-8 flex items-center gap-1.5 text-left px-2.5 rounded-lg text-[11px] font-medium leading-none text-gray-600 hover:bg-gray-50 cursor-pointer"><i class="fa-solid fa-upload text-gray-400 w-3 text-center text-[11px]"></i><span>Chọn từ máy</span></button>
                    </div>
                    <input id="header-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" onchange="uploadSelectedAvatar(this)">
                </div>`;
            renderMoreUserInfo();
        } else {
            container.innerHTML = `
                <button onclick="toggleDarkMode()" class="w-12 h-12 bg-gray-900 text-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-black transition shrink-0" title="Dark mode">
                    <i class="theme-toggle-icon fa-solid fa-moon"></i>
                </button>
                <button onclick="AuthUI.openModal(true)" class="hidden md:block text-gray-600 font-medium hover:text-hanred-600 transition cursor-pointer">Đăng nhập</button>
                <button onclick="AuthUI.openModal(false)" class="bg-hanred-600 hover:bg-hanred-700 text-white px-5 py-2.5 rounded-lg font-black transition shadow-md cursor-pointer">Bắt đầu ngay</button>`;
        }
    },

    logout() {
        localStorage.removeItem('access_token');
        location.reload();
    }
};

function showWelcomeModal(custom = null) {
    const modal = document.getElementById('welcome-modal');
    if (!modal) return;

    const titleEl = document.getElementById('welcome-title');
    const messageEl = document.getElementById('welcome-message');
    const iconEl = document.getElementById('welcome-icon');

    let content = custom;
    if (!content && currentUser) {
        if (sessionStorage.getItem(`welcome_shown_${currentUser.username}`)) return;
        if (['admin', 'manager'].includes(currentUser.role)) {
            content = {
                title: `Chào ${currentUser.username}`,
                message: 'Sẵn sàng quản trị hôm nay.',
                icon: 'fa-shield-heart'
            };
        } else if (currentUser.trial_active) {
            content = {
                title: `Chào ${currentUser.username}`,
                message: `Còn ${currentUser.trial_days_left} ngày học.`,
                icon: 'fa-seedling'
            };
        } else {
            content = {
                title: `Chào ${currentUser.username}`,
                message: 'Hết quyền học. Chọn gói để tiếp tục.',
                icon: 'fa-lock-open'
            };
        }
        sessionStorage.setItem(`welcome_shown_${currentUser.username}`, '1');
    }

    if (!content) return;
    titleEl.innerText = content.title;
    messageEl.innerText = content.message;
    iconEl.innerHTML = `<i class="fa-solid ${content.icon}"></i>`;
    modal.classList.remove('hidden');
}

function closeWelcomeModal() {
    document.getElementById('welcome-modal')?.classList.add('hidden');
}

function toggleAccountMenu() {
    document.getElementById('avatar-action-menu')?.classList.add('hidden');
    document.getElementById('account-menu')?.classList.toggle('hidden');
}

function toggleAvatarActionMenu() {
    document.getElementById('account-menu')?.classList.add('hidden');
    document.getElementById('avatar-action-menu')?.classList.toggle('hidden');
}

function toggleMoreMenu() {
    document.getElementById('more-menu')?.classList.toggle('hidden');
    switchMorePanel('account');
    renderMoreUserInfo();
}

function openUpgradePlans() {
    document.getElementById('account-menu')?.classList.add('hidden');
    document.getElementById('avatar-action-menu')?.classList.add('hidden');
    document.getElementById('more-menu')?.classList.add('hidden');

    if (!currentUser) {
        AuthUI.openModal(true);
        return;
    }

    switchView('view-profile');
    setTimeout(() => switchUserPanel('user-payment-section'), 50);
}

function switchMorePanel(panel) {
    document.querySelectorAll('.more-panel').forEach(el => el.classList.add('hidden'));
    document.getElementById(`more-panel-${panel}`)?.classList.remove('hidden');
    document.querySelectorAll('.more-tab').forEach(tab => {
        tab.className = 'more-tab bg-gray-100 text-gray-600 rounded-xl px-3 py-2';
    });
    const active = document.getElementById(`more-tab-${panel}`);
    if (active) active.className = 'more-tab bg-hanred-600 text-white rounded-xl px-3 py-2';
}

function formatAccountDate(value) {
    if (!value) return 'Chưa có';
    return new Date(value).toLocaleDateString('vi-VN');
}

function accountStatusText() {
    if (!currentUser) return 'Chưa đăng nhập';
    if (currentUser.account_status !== 'approved') return 'Chưa hoạt động';
    return currentUser.trial_active ? 'Đang hoạt động' : 'Không hoạt động';
}

function renderMoreUserInfo() {
    const info = document.getElementById('more-user-info');
    if (!info) return;
    if (!currentUser) {
        info.innerHTML = '<p>Vui lòng đăng nhập để xem thông tin tài khoản.</p>';
        return;
    }
    const status = accountStatusText();
    const statusClass = status === 'Đang hoạt động' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    info.innerHTML = `
        <div class="flex items-center gap-3 pb-3 border-b border-gray-100">
            <div class="w-11 h-11 bg-hanred-100 text-hanred-600 rounded-2xl flex items-center justify-center font-black">${currentUser.username.charAt(0).toUpperCase()}</div>
            <div>
                <div class="font-black text-gray-900">${currentUser.username}</div>
                <div class="text-xs text-gray-400 font-bold">${currentUser.role}</div>
            </div>
        </div>
        <div class="flex justify-between gap-3"><span>Trạng thái</span><span class="px-2 py-1 rounded-full text-xs font-bold ${statusClass}">${status}</span></div>
        <div class="flex justify-between gap-3"><span>Ngày bắt đầu</span><b class="text-gray-900">${formatAccountDate(currentUser.approved_at || currentUser.created_at)}</b></div>
        <div class="flex justify-between gap-3"><span>Ngày kết thúc</span><b class="text-gray-900">${formatAccountDate(currentUser.trial_expires_at)}</b></div>`;
}

function toggleDarkMode() {
    const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    localStorage.setItem('hanlingua_theme', nextTheme);
    applyTheme();
}

function applyTheme() {
    const theme = localStorage.getItem('hanlingua_theme') || 'light';
    document.body.classList.toggle('dark-mode', theme === 'dark');
    document.querySelectorAll('.theme-toggle-icon').forEach(icon => {
        icon.className = theme === 'dark' ? 'theme-toggle-icon fa-solid fa-sun' : 'theme-toggle-icon fa-solid fa-moon';
    });
}

async function loadDailyContent() {
    const messageEl = document.getElementById('daily-message');
    const mediaEl = document.getElementById('daily-media');
    const playlistEl = document.getElementById('korean-playlist');
    const dateEl = document.getElementById('daily-date');
    if (!messageEl || !mediaEl) return;

    try {
        const data = await API.getDailyContent();
        if (dateEl) dateEl.innerText = data.date;
        messageEl.innerText = data.message;
        mediaEl.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="min-w-0">
                    <div class="text-xs font-black ${data.media.type === 'podcast' ? 'text-purple-600' : 'text-hanred-600'} uppercase">${data.media.type === 'podcast' ? 'Podcast' : 'Nhạc'}</div>
                    <div class="font-black text-gray-900 text-lg truncate">${data.media.title}</div>
                    <p class="text-sm text-gray-500 mt-1 compact-copy">${data.media.description}</p>
                </div>
                <a href="${data.media.url}" target="_blank" rel="noopener" class="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-black w-max hover:bg-black">
                    Nghe <i class="fa-solid fa-arrow-up-right-from-square ml-1"></i>
                </a>
            </div>`;
        const recommended = data.media;
        if (playlistEl) playlistEl.innerHTML = `
            <a href="${recommended.url}" target="_blank" rel="noopener" class="block bg-purple-50 border border-purple-100 hover:bg-purple-100 rounded-2xl px-4 py-4">
                <div class="text-xs text-purple-600 font-black uppercase mb-1">Gợi ý</div>
                <div class="font-black text-gray-900 compact-copy">${recommended.title}</div>
                <div class="text-sm text-gray-500 mt-2 compact-copy">${recommended.description}</div>
                <div class="text-xs text-purple-700 font-black mt-3">Mở bài <i class="fa-solid fa-arrow-up-right-from-square ml-1"></i></div>
            </a>`;
    } catch (e) {
        messageEl.innerText = "Không thể tải nội dung hôm nay. Bạn vẫn có thể bắt đầu bằng một bài nghe ngắn.";
        mediaEl.innerHTML = '';
        if (playlistEl) playlistEl.innerHTML = '';
    }
}

function renderUserAccessState() {
    const banner = document.getElementById('user-access-banner');
    const bannerContent = document.getElementById('user-access-banner-content');
    const learningDashboard = document.getElementById('user-learning-dashboard');
    const dictationBadge = document.getElementById('dictation-access-badge');
    const speakingBadge = document.getElementById('speaking-access-badge');
    const dictationAction = document.getElementById('dictation-access-action');
    const speakingAction = document.getElementById('speaking-access-action');
    const featureCards = [document.getElementById('feature-dictation-card'), document.getElementById('feature-speaking-card'), document.getElementById('feature-vocabulary-card')];

    if (!banner || !bannerContent) return;

    if (!currentUser) {
        banner.classList.add('hidden');
        learningDashboard?.classList.add('hidden');
        return;
    }

    if (['admin', 'manager'].includes(currentUser.role)) {
        banner.classList.add('hidden');
        learningDashboard?.classList.add('hidden');
        return;
    }

    banner.classList.add('hidden');
    learningDashboard?.classList.add('hidden');

    if (currentUser.trial_active) {
        bannerContent.className = 'rounded-2xl p-5 border shadow-sm bg-green-50 border-green-200 text-green-800';
        bannerContent.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <div class="font-black text-lg">Tài khoản đã mở quyền học</div>
                    <div class="text-sm">Còn ${currentUser.trial_days_left} ngày.</div>
                </div>
                <span class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold w-max">Đang hoạt động</span>
            </div>`;
        [dictationBadge, speakingBadge].forEach(el => {
            if (el) {
                el.className = 'bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full';
                el.innerHTML = '<i class="fa-solid fa-unlock mr-1"></i> Đã mở quyền';
            }
        });
        [dictationAction, speakingAction].forEach(el => {
            if (el) el.innerHTML = 'Vào học ngay <i class="fa-solid fa-arrow-right ml-2"></i>';
        });
        featureCards.forEach(card => card?.classList.remove('opacity-60', 'grayscale'));
        return;
    }

    bannerContent.className = 'rounded-2xl p-5 border shadow-sm bg-red-50 border-red-200 text-red-800';
    bannerContent.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
                <div class="font-black text-lg">Tài khoản đã hết quyền học</div>
                <div class="text-sm">Tính năng đang khóa. Mua gói để học tiếp.</div>
            </div>
            <button onclick="switchView('view-profile'); setTimeout(() => switchUserPanel('user-payment-section'), 50)" class="bg-hanred-600 text-white px-4 py-2 rounded-lg text-sm font-bold w-max cursor-pointer">Mua gói học</button>
        </div>`;
        [dictationBadge, speakingBadge].forEach(el => {
        if (el) {
            el.className = 'bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full';
            el.innerHTML = '<i class="fa-solid fa-lock mr-1"></i> Chưa mở quyền';
        }
    });
        [dictationAction, speakingAction].forEach(el => {
        if (el) el.innerHTML = 'Mua gói để mở khóa <i class="fa-solid fa-lock ml-2"></i>';
    });
    featureCards.forEach(card => card?.classList.add('opacity-60', 'grayscale'));
}

// --- 2. ĐIỀU HƯỚNG VIEW ---
function switchView(viewId) {
    document.getElementById('more-menu')?.classList.add('hidden');
    document.getElementById('account-menu')?.classList.add('hidden');
    document.getElementById('avatar-action-menu')?.classList.add('hidden');

    const protectedViews = ['view-dictation', 'view-admin', 'view-speaking', 'view-profile'];
    if (protectedViews.includes(viewId) && !currentUser) {
        AuthUI.openModal(true);
        return;
    }
    if ((viewId === 'view-dictation' || viewId === 'view-speaking') && !currentUser.trial_active) {
        alert('Hết quyền học. Vui lòng mua gói.');
        switchView('view-landing');
        setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }), 50);
        return;
    }

    document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
    updateMainNav(viewId);

    if (viewId === 'view-admin') {
        const title = document.getElementById('admin-dashboard-title');
        if (title && currentUser) {
            title.innerHTML = `<i class="fa-solid fa-shield-halved text-hanred-600 mr-2"></i> Bảng điều khiển ${currentUser.role === 'manager' ? 'Manager' : 'Quản trị viên'}`;
        }
        switchAdminPanel('admin-overview-section');
        AdminUI.loadLessonList();
        AdminUI.loadUsers();
        AdminUI.loadPayments();
        AdminUI.loadMonthlyProgress();
    }
    if (viewId === 'view-dictation') {
        loadUserLessonList(); 
    }
    if (viewId === 'view-profile') {
        switchUserPanel('user-overview-section');
        loadMyProgress();
    }
    setTimeout(initMotionReveal, 50);
}

function initMotionReveal() {
    const targets = Array.from(document.querySelectorAll([
        '.landing-card',
        '.landing-session',
        '.workflow-step',
        '.motion-card',
        '.motion-left',
        '.motion-right',
        '.motion-bottom',
        '.motion-pop',
        '.stat-card',
        '.plan-step',
        '.soft-panel',
        '.overview-hero-card',
        '.quest-card',
        '.cozy-side-card',
        '.overview-mini-stat',
        '.user-panel:not(.hidden)',
        '.admin-panel:not(.hidden)'
    ].join(',')));
    if (!targets.length) return;
    if (!('IntersectionObserver' in window)) {
        targets.forEach(el => el.classList.add('is-visible'));
        initScrollLinkedMotion(targets);
        return;
    }
    if (window.hanRevealObserver) {
        window.hanRevealObserver.disconnect();
    }
    window.hanRevealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const target = entry.target;
            if (entry.isIntersecting && entry.intersectionRatio > 0.08) {
                target.classList.add('is-visible');
                target.classList.remove('is-resetting');
                return;
            }
            if (entry.intersectionRatio <= 0.02) {
                target.classList.remove('is-visible');
                target.classList.add('is-resetting');
            }
        });
    }, { threshold: [0, 0.08, 0.18, 0.35], rootMargin: '-2% 0px -10% 0px' });
    targets.forEach((el, index) => {
        if (!el.classList.contains('motion-from-left') && !el.classList.contains('motion-from-right') && !el.classList.contains('motion-from-bottom') && !el.classList.contains('motion-pop')) {
            if (el.classList.contains('motion-left')) el.classList.add('motion-from-left');
            else if (el.classList.contains('motion-right')) el.classList.add('motion-from-right');
            else if (el.classList.contains('motion-bottom')) el.classList.add('motion-from-bottom');
            else if (el.classList.contains('motion-pop')) el.classList.add('motion-pop');
            else el.classList.add(index % 3 === 0 ? 'motion-from-left' : index % 3 === 1 ? 'motion-from-right' : 'motion-from-bottom');
        }
        el.style.setProperty('--reveal-delay', `${Math.min((index % 6) * 70, 350)}ms`);
        el.classList.add('reveal-on-scroll', 'scroll-motion-ready');
        window.hanRevealObserver.observe(el);
    });
    initScrollLinkedMotion(targets);
}

function initScrollLinkedMotion(targets) {
    if (window.hanScrollMotionSchedule) {
        window.removeEventListener('scroll', window.hanScrollMotionSchedule);
        window.removeEventListener('resize', window.hanScrollMotionSchedule);
    }
    window.hanScrollMotionTargets = [];
    window.hanScrollMotionSchedule = null;
    targets.forEach(resetScrollMotion);
}

function updateScrollLinkedMotion() {
    const targets = window.hanScrollMotionTargets || [];
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;

    targets.forEach((el, index) => {
        if (!el.isConnected || el.closest('.hidden')) {
            resetScrollMotion(el);
            return;
        }

        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height || rect.bottom < -120 || rect.top > viewportHeight + 120) {
            resetScrollMotion(el);
            return;
        }

        const centerOffset = ((rect.top + rect.height / 2) - viewportHeight / 2) / viewportHeight;
        const progress = Math.max(-1, Math.min(1, centerOffset));
        const direction = index % 2 === 0 ? 1 : -1;
        const isTextHeavy = el.classList.contains('overview-mini-stat') || el.classList.contains('quest-card');
        const lift = isTextHeavy ? 6 : el.classList.contains('cozy-side-card') ? 14 : 10;
        const drift = isTextHeavy ? 0 : 4;
        const rotate = isTextHeavy ? 0 : -progress * direction * 0.22;

        el.style.setProperty('--scroll-y', `${Math.round(-progress * lift)}px`);
        el.style.setProperty('--scroll-x', `${Math.round(progress * direction * drift)}px`);
        el.style.setProperty('--scroll-rotate', `${rotate.toFixed(3)}deg`);
    });
}

function resetScrollMotion(el) {
    el.style.setProperty('--scroll-x', '0px');
    el.style.setProperty('--scroll-y', '0px');
    el.style.setProperty('--scroll-rotate', '0deg');
}

function updateMainNav(viewId) {
    if (currentUser && ['admin', 'manager'].includes(currentUser.role)) {
        setMainNavActive('nav-admin');
        return;
    }
    const activeId = ['view-profile', 'view-dictation', 'view-speaking'].includes(viewId) ? 'nav-learning' : 'nav-home';
    setMainNavActive(activeId);
}

function setMainNavActive(activeId) {
    document.querySelectorAll('.main-nav-btn').forEach(btn => {
        btn.className = 'main-nav-btn px-4 py-2.5 rounded-md text-sm font-black transition text-gray-500 hover:text-hanred-600';
    });
    const active = document.getElementById(activeId);
    if (active) {
        active.className = 'main-nav-btn px-4 py-2.5 rounded-md text-sm font-black transition bg-gray-950 text-white shadow-sm';
    }
}

function returnToLearningSpace() {
    if (currentUser && !['admin', 'manager'].includes(currentUser.role)) {
        switchView('view-profile');
        setTimeout(() => switchUserPanel('user-overview-section'), 50);
        return;
    }
    switchView('view-landing');
}

function openVocabularyFeature() {
    switchView('view-profile');
    if (currentUser) {
        setTimeout(() => switchUserPanel('user-vocabulary-section'), 50);
    }
}

function formatStudyTime(minutes) {
    const safeMinutes = Number(minutes || 0);
    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    if (hours <= 0) return `${mins} phút`;
    if (mins <= 0) return `${hours} giờ`;
    return `${hours} giờ ${mins} phút`;
}

function formatActivityDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('vi-VN');
}

function getLocalProgressKey() {
    const username = currentUser ? currentUser.username : 'guest';
    return `hanlingua_progress_${username}`;
}

function getLocalActivities() {
    try {
        return JSON.parse(localStorage.getItem(getLocalProgressKey())) || [];
    } catch (e) {
        return [];
    }
}

function saveLocalActivities(items) {
    localStorage.setItem(getLocalProgressKey(), JSON.stringify(items.slice(0, 100)));
}

function recordLearningActivity(activity) {
    if (!currentUser) return;
    const items = getLocalActivities();
    items.unshift({
        title: activity.title || 'Bài học HanLingua',
        type: activity.type || 'Dictation',
        score: Number(activity.score || 0),
        created_at: new Date().toISOString(),
        lesson_id: activity.lesson_id || null
    });
    saveLocalActivities(items);
}

function buildLocalProgressSummary(serverData = null) {
    const items = getLocalActivities();
    const scores = items.map(item => Number(item.score || 0));
    const activeDates = [...new Set(items.map(item => (item.created_at || '').slice(0, 10)).filter(Boolean))];
    let streak = 0;
    let cursor = new Date();
    const dateSet = new Set(activeDates);
    while (dateSet.has(cursor.toISOString().slice(0, 10))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }
    const dictationItems = items.filter(item => item.type === 'Dictation' || item.type === 'AI Dictation');
    const monthlyMap = {};
    items.forEach(item => {
        const month = (item.created_at || '').slice(0, 7);
        if (!month) return;
        monthlyMap[month] = monthlyMap[month] || { month, attempts: 0, activeDays: new Set(), scores: [] };
        monthlyMap[month].attempts += 1;
        monthlyMap[month].activeDays.add((item.created_at || '').slice(0, 10));
        monthlyMap[month].scores.push(Number(item.score || 0));
    });
    const monthly = Object.values(monthlyMap).map(item => ({
        month: item.month,
        attempts: item.attempts,
        active_days: item.activeDays.size,
        avg_score: item.scores.length ? Math.round((item.scores.reduce((a, b) => a + b, 0) / item.scores.length) * 10) / 10 : 0
    }));
    const localData = {
        learning_day: serverData?.learning_day || 1,
        stage: serverData?.stage || 'Người mới học tiếng Hàn',
        total_attempts: items.length,
        dictation_completed: dictationItems.length,
        speaking_completed: 0,
        streak_days: Math.max(streak, serverData?.streak_days || 0),
        total_study_minutes: items.length * 10,
        active_days: activeDates.length,
        avg_score: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        dictation_avg: dictationItems.length ? Math.round((dictationItems.reduce((sum, item) => sum + Number(item.score || 0), 0) / dictationItems.length) * 10) / 10 : 0,
        speaking_avg: 0,
        last_activity: items[0] || null,
        recent_activities: items.slice(0, 8),
        monthly
    };
    if (!serverData) return localData;
    return {
        ...serverData,
        total_attempts: Math.max(serverData.total_attempts || 0, localData.total_attempts),
        dictation_completed: Math.max(serverData.dictation_completed || 0, localData.dictation_completed),
        streak_days: Math.max(serverData.streak_days || 0, localData.streak_days),
        total_study_minutes: Math.max(serverData.total_study_minutes || 0, localData.total_study_minutes),
        active_days: Math.max(serverData.active_days || 0, localData.active_days),
        avg_score: localData.avg_score || serverData.avg_score || 0,
        dictation_avg: localData.dictation_avg || serverData.dictation_avg || 0,
        last_activity: localData.last_activity || serverData.last_activity,
        recent_activities: localData.recent_activities.length ? localData.recent_activities : (serverData.recent_activities || []),
        monthly: localData.monthly.length ? localData.monthly : (serverData.monthly || [])
    };
}

function skillBar(label, value, colorClass) {
    const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
    return `
        <div class="rounded-lg bg-white/70 border border-orange-100 p-4">
            <div class="flex justify-between text-sm font-black mb-2">
                <span class="text-gray-700">${label}</span>
                <span class="text-gray-900">${safeValue}%</span>
            </div>
            <div class="skill-meter h-2.5 bg-white rounded-full overflow-hidden border border-gray-100">
                <div class="h-full ${colorClass} rounded-full" style="width: ${safeValue}%"></div>
            </div>
        </div>`;
}

function renderMetricCard({ label, value, caption, icon, accentClass, iconClass }) {
    return `
        <div class="overview-mini-stat motion-pop">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <div class="text-xs text-gray-500 font-black uppercase">${label}</div>
                    <div class="text-3xl font-black ${accentClass} mt-2 leading-none">${value}</div>
                </div>
                <span class="stat-icon ${iconClass}"><i class="fa-solid ${icon}"></i></span>
            </div>
            <div class="text-sm text-gray-500 mt-3">${caption}</div>
        </div>`;
}

function renderOverviewStats(data) {
    return `
        <div class="overview-meter-strip">
            ${renderMetricCard({
                label: 'Streak',
                value: `${data.streak_days || 0}`,
                caption: 'ngày liên tục',
                icon: 'fa-fire',
                accentClass: 'text-orange-600',
                iconClass: 'bg-orange-50 text-orange-600'
            })}
            ${renderMetricCard({
                label: 'Dictation',
                value: `${data.dictation_completed || 0}`,
                caption: 'bài đã chép',
                icon: 'fa-headphones-simple',
                accentClass: 'text-hanred-600',
                iconClass: 'bg-red-50 text-hanred-600'
            })}
            ${renderMetricCard({
                label: 'Thời gian',
                value: formatStudyTime(data.total_study_minutes),
                caption: 'tổng luyện tập',
                icon: 'fa-clock',
                accentClass: 'text-blue-700',
                iconClass: 'bg-blue-50 text-blue-700'
            })}
            ${renderMetricCard({
                label: 'Độ đúng',
                value: `${data.avg_score || 0}%`,
                caption: 'trung bình',
                icon: 'fa-bullseye',
                accentClass: 'text-green-700',
                iconClass: 'bg-green-50 text-green-700'
            })}
        </div>`;
}

function renderRecentActivities(activities = []) {
    if (!activities.length) {
        return '<div class="text-sm text-gray-400 py-5">Chưa có lịch sử.</div>';
    }
    return activities.map(item => `
        <div class="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-b-0">
            <div class="min-w-0">
                <div class="font-black text-gray-900 truncate">${escapeHtml(item.title || 'Bài học HanLingua')}</div>
                <div class="text-xs text-gray-500 mt-1">${escapeHtml(item.type || 'Dictation')} · ${formatActivityDate(item.created_at)}</div>
            </div>
            <span class="shrink-0 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-black">${Number(item.score || 0)}%</span>
        </div>`).join('');
}

function renderSkillPanel(data) {
    return `
        <div class="cozy-side-card motion-right">
            <div class="flex items-center justify-between gap-3 mb-4">
                <div>
                    <div class="text-xs font-black text-blue-700 uppercase">Kỹ năng</div>
                    <h4 class="text-lg font-black text-gray-900">Bạn đang lên nhịp</h4>
                </div>
                <span class="stat-icon bg-blue-50 text-blue-700"><i class="fa-solid fa-chart-simple"></i></span>
            </div>
            <div class="space-y-3">
                ${skillBar('Chép chính tả', data.dictation_avg || data.avg_score || 0, 'bg-hanred-600')}
                ${skillBar('Phát âm', data.speaking_avg || 0, 'bg-blue-600')}
                ${skillBar('Forecast', getVocabularyProgressPercent(), 'bg-purple-600')}
            </div>
        </div>`;
}

function renderLearningOverviewDashboard(data, forecast = null, badgeText = '') {
    return renderLearningOverviewDashboardV3(data, forecast, badgeText);
    return `
        <div class="overview-grid">
            <div class="space-y-5">
                ${renderDailyLearningPlan(data)}
                ${renderForecastPanel(forecast)}
            </div>
            <div class="space-y-5">
                ${renderOverviewStats(data)}
                ${renderSkillPanel(data)}
                <div class="cozy-side-card motion-card">
                    <div class="flex items-center justify-between gap-4 mb-3">
                        <div>
                            <div class="text-xs font-black text-gray-500 uppercase">Nhật ký</div>
                            <h4 class="text-lg font-black text-gray-900">Gần đây</h4>
                        </div>
                        ${badgeText ? `<span class="bg-white/80 text-gray-700 px-3 py-1 rounded-full text-xs font-black border border-orange-100">${badgeText}</span>` : ''}
                    </div>
                    ${renderRecentActivities(data.recent_activities || [])}
                </div>
            </div>
        </div>`;
}

function renderLearningOverviewDashboardV2(data, forecast = null, badgeText = '') {
    return `
        <div class="overview-stage">
            <section class="overview-hero-card motion-left">
                <div>
                    <div class="flex flex-wrap items-center gap-2 mb-3">
                        <span class="bg-white/80 border border-red-100 text-hanred-600 text-xs font-black uppercase px-3 py-1 rounded-full">Studio học hôm nay</span>
                        ${badgeText ? `<span class="bg-gray-950 text-white px-3 py-1 rounded-full text-xs font-black">${badgeText}</span>` : ''}
                    </div>
                    <h4 class="text-2xl md:text-4xl font-black text-gray-950 leading-tight">Học một chút, nhưng đúng nhịp.</h4>
                    <p class="text-sm md:text-base text-gray-600 mt-3 compact-copy">HanLingua gợi ý phiên học gọn: nghe chép, nói, rồi ôn từ. Bạn chọn nhiệm vụ, hệ thống giữ lại tiến độ.</p>
                    <div class="flex flex-wrap gap-3 mt-5">
                        <button onclick="switchView('view-dictation')" class="bg-hanred-600 hover:bg-hanred-700 text-white px-5 py-3 rounded-lg text-sm font-black shadow cursor-pointer"><i class="fa-solid fa-headphones-simple mr-2"></i>Dictation</button>
                        <button onclick="switchView('view-speaking')" class="bg-white/85 hover:bg-white border border-blue-100 text-blue-700 px-5 py-3 rounded-lg text-sm font-black cursor-pointer"><i class="fa-solid fa-microphone-lines mr-2"></i>Speaking</button>
                        <button onclick="switchUserPanel('user-vocabulary-section')" class="bg-white/85 hover:bg-white border border-purple-100 text-purple-700 px-5 py-3 rounded-lg text-sm font-black cursor-pointer"><i class="fa-solid fa-layer-group mr-2"></i>Forecast</button>
                    </div>
                </div>
                <div>
                    ${renderOverviewStats(data)}
                </div>
            </section>

            <div class="overview-flow-grid">
                <div class="space-y-5 motion-left">
                    ${renderDailyLearningPlan(data)}
                    ${renderForecastPanel(forecast)}
                </div>
                <div class="overview-side-stack motion-right">
                    ${renderSkillPanel(data)}
                    <div class="cozy-side-card motion-right">
                        <div class="flex items-center justify-between gap-4 mb-3">
                            <div>
                                <div class="text-xs font-black text-gray-500 uppercase">Nhật ký</div>
                                <h4 class="text-lg font-black text-gray-900">Gần đây</h4>
                            </div>
                            <span class="stat-icon bg-green-50 text-green-700"><i class="fa-solid fa-check"></i></span>
                        </div>
                        ${renderRecentActivities(data.recent_activities || [])}
                    </div>
                </div>
            </div>
        </div>`;
}

function renderLearningOverviewDashboardV3(data, forecast = null, badgeText = '') {
    return `
        <div class="overview-calm-stack overview-simple-stack">
            <section class="overview-metrics-panel overview-primary-progress motion-bottom">
                <div class="overview-section-head">
                    <div>
                        <div class="text-xs font-black text-orange-700 uppercase">Tiến độ học tập</div>
                        <h4 class="text-xl md:text-2xl font-black text-gray-950 mt-1">Nhìn nhanh hôm nay.</h4>
                    </div>
                    ${badgeText ? `<span class="overview-day-badge">${badgeText}</span>` : ''}
                </div>
                ${renderOverviewStats(data)}
            </section>

            ${renderDailyLearningPlan(data)}

            <section class="overview-support-grid">
                ${renderSkillPanel(data)}
                <div class="cozy-side-card overview-action-card motion-right">
                    <div>
                        <div class="text-xs font-black text-hanred-600 uppercase">Bắt đầu nhanh</div>
                        <h4 class="text-lg font-black text-gray-900 mt-1">Chọn kỹ năng muốn luyện.</h4>
                    </div>
                    <div class="overview-focus-actions">
                        <button onclick="switchView('view-dictation')" class="bg-hanred-600 hover:bg-hanred-700 text-white px-5 py-3 rounded-lg text-sm font-black shadow cursor-pointer"><i class="fa-solid fa-headphones-simple mr-2"></i>Nghe chép</button>
                        <button onclick="switchView('view-speaking')" class="bg-white/90 hover:bg-white border border-blue-100 text-blue-700 px-5 py-3 rounded-lg text-sm font-black cursor-pointer"><i class="fa-solid fa-microphone-lines mr-2"></i>Luyện nói</button>
                        <button onclick="switchUserPanel('user-vocabulary-section')" class="bg-white/90 hover:bg-white border border-purple-100 text-purple-700 px-5 py-3 rounded-lg text-sm font-black cursor-pointer"><i class="fa-solid fa-layer-group mr-2"></i>Ôn từ</button>
                    </div>
                </div>
            </section>

            <section class="overview-support-grid overview-bottom-grid">
                ${renderForecastPanel(forecast)}
                <div class="cozy-side-card overview-recent-card motion-right">
                    <div class="flex items-center justify-between gap-4 mb-3">
                        <div>
                            <div class="text-xs font-black text-gray-500 uppercase">Nhật ký</div>
                            <h4 class="text-lg font-black text-gray-900">Gần đây</h4>
                        </div>
                        <span class="stat-icon bg-green-50 text-green-700"><i class="fa-solid fa-check"></i></span>
                    </div>
                    ${renderRecentActivities(data.recent_activities || [])}
                </div>
            </section>
        </div>`;
}

function renderForecastPanel(forecast = null) {
    return renderForecastPanelV2(forecast);
    const data = forecast || {
        review_count: 0,
        review_topic: 'lỗi sai gần đây',
        suggested_lesson: 'Làm thêm Dictation để có gợi ý.',
        mistake_forecast: { message: 'Chưa đủ dữ liệu lỗi.' },
        weekly_insight: { days_to_topik: 45, message: 'Duy trì 15 phút/ngày.' },
        notification: 'Hoàn thành thêm bài để Forecast tốt hơn.'
    };
    return `
        <div class="cozy-side-card motion-card">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                    <div class="text-xs font-black text-purple-700 uppercase">Góc ôn tập</div>
                    <h4 class="text-xl font-black text-gray-900 mt-1">Nhắc nhẹ hôm nay</h4>
                    <p class="text-sm text-gray-500 mt-2 compact-copy">${escapeHtml(data.notification || '')}</p>
                </div>
                <button onclick="switchUserPanel('user-vocabulary-section')" class="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2.5 rounded-lg text-sm font-black shadow cursor-pointer">
                    Mở thẻ từ
                </button>
            </div>
            <div class="grid md:grid-cols-2 gap-3">
                <div class="forecast-tile p-4">
                    <div class="text-xs font-black text-purple-600 uppercase">Cần ôn</div>
                    <div class="flex items-end gap-2 mt-2">
                        <div class="text-3xl font-black text-purple-700 leading-none">${data.review_count || 0}</div>
                        <div class="text-sm text-gray-500 pb-1">thẻ</div>
                    </div>
                    <p class="text-sm text-gray-500 mt-3 compact-copy">${escapeHtml(data.review_topic || 'lỗi sai gần đây')}</p>
                </div>
                <div class="forecast-tile p-4">
                    <div class="text-xs font-black text-hanred-600 uppercase">Lỗi chính</div>
                    <p class="text-sm text-gray-600 mt-3 compact-copy">${escapeHtml(data.mistake_forecast?.message || '')}</p>
                </div>
                <div class="forecast-tile p-4">
                    <div class="text-xs font-black text-blue-700 uppercase">Việc tiếp theo</div>
                    <p class="text-sm text-gray-600 mt-3 compact-copy">${escapeHtml(data.suggested_lesson || '')}</p>
                </div>
                <div class="forecast-tile p-4">
                    <div class="text-xs font-black text-green-700 uppercase">TOPIK</div>
                    <div class="text-2xl font-black text-green-700 mt-2">${data.weekly_insight?.days_to_topik || 45} ngày</div>
                    <p class="text-sm text-gray-500 mt-3 compact-copy">${escapeHtml(data.weekly_insight?.message || '')}</p>
                </div>
            </div>
        </div>`;
}

function renderForecastPanelV2(forecast = null) {
    const data = forecast || {
        review_count: 0,
        review_topic: 'lỗi sai gần đây',
        suggested_lesson: 'Làm thêm Dictation để có gợi ý.',
        mistake_forecast: { message: 'Chưa đủ dữ liệu lỗi.' },
        weekly_insight: { days_to_topik: 45, message: 'Duy trì 15 phút/ngày.' },
        notification: 'Hoàn thành thêm bài để Forecast tốt hơn.'
    };
    return `
        <div class="cozy-side-card motion-bottom">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                    <div class="text-xs font-black text-purple-700 uppercase">Góc ôn tập</div>
                    <h4 class="text-xl font-black text-gray-900 mt-1">Nhắc nhẹ hôm nay</h4>
                    <p class="text-sm text-gray-500 mt-2 compact-copy">${escapeHtml(data.notification || '')}</p>
                </div>
                <button onclick="switchUserPanel('user-vocabulary-section')" class="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2.5 rounded-lg text-sm font-black shadow cursor-pointer">
                    Mở thẻ từ
                </button>
            </div>
            <div class="overview-forecast-grid">
                <div class="forecast-tile p-4 motion-pop">
                    <div class="text-xs font-black text-purple-600 uppercase">Cần ôn</div>
                    <div class="flex items-end gap-2 mt-2">
                        <div class="text-3xl font-black text-purple-700 leading-none">${data.review_count || 0}</div>
                        <div class="text-sm text-gray-500 pb-1">thẻ</div>
                    </div>
                    <p class="text-sm text-gray-500 mt-3 compact-copy">${escapeHtml(data.review_topic || 'lỗi sai gần đây')}</p>
                </div>
                <div class="forecast-tile p-4 motion-pop">
                    <div class="text-xs font-black text-hanred-600 uppercase">Lỗi chính</div>
                    <p class="text-sm text-gray-600 mt-3 compact-copy">${escapeHtml(data.mistake_forecast?.message || '')}</p>
                </div>
                <div class="forecast-tile p-4 motion-pop">
                    <div class="text-xs font-black text-blue-700 uppercase">Việc tiếp theo</div>
                    <p class="text-sm text-gray-600 mt-3 compact-copy">${escapeHtml(data.suggested_lesson || '')}</p>
                </div>
                <div class="forecast-tile p-4 motion-pop">
                    <div class="text-xs font-black text-green-700 uppercase">TOPIK</div>
                    <div class="text-2xl font-black text-green-700 mt-2">${data.weekly_insight?.days_to_topik || 45} ngày</div>
                    <p class="text-sm text-gray-500 mt-3 compact-copy">${escapeHtml(data.weekly_insight?.message || '')}</p>
                </div>
            </div>
        </div>`;
}

function formatMonthLabel(monthValue) {
    if (!monthValue) return 'Tháng này';
    const [year, month] = String(monthValue).split('-');
    if (!year || !month) return monthValue;
    return `Tháng ${Number(month)}/${year}`;
}

function getBestMonthlySummary(monthly = []) {
    if (!monthly.length) return null;
    return [...monthly].sort((a, b) => String(b.month || '').localeCompare(String(a.month || '')))[0];
}

function renderUserNotifications(data = {}, forecast = null) {
    const list = document.getElementById('user-notification-list');
    if (!list) return;

    const dayNumber = getCurrentPlanDay(data.learning_day);
    const plan = getDailyPlan(dayNumber, data);
    const doneCount = Object.values(getDailyPlanState(dayNumber).tasks || {}).filter(Boolean).length;
    const monthly = getBestMonthlySummary(data.monthly || []);
    const notifications = [
        {
            tone: 'red',
            icon: 'fa-calendar-check',
            label: 'Nhắc học hằng ngày',
            title: `${plan.totalMinutes} phút hôm nay`,
            message: `Ngày ${dayNumber}: ${doneCount}/${plan.tasks.length} bước.`,
            action: `<button onclick="switchUserPanel('user-overview-section')" class="bg-hanred-600 hover:bg-hanred-700 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition">Mở lịch học</button>`
        }
    ];

    if (forecast?.notification) {
        notifications.unshift({
            tone: 'purple',
            icon: 'fa-wand-magic-sparkles',
            label: 'Forecast thông minh',
            title: 'Forecast đã sẵn sàng',
            message: forecast.notification,
            action: `<button onclick="switchUserPanel('user-vocabulary-section')" class="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition">Khám phá ngay</button>`
        });
    }

    if (currentUser?.trial_active && Number(currentUser.trial_days_left) > 0 && Number(currentUser.trial_days_left) <= 3) {
        notifications.push({
            tone: 'orange',
            icon: 'fa-hourglass-half',
            label: 'Sắp hết quyền học',
            title: `Còn ${currentUser.trial_days_left} ngày`,
            message: 'Gia hạn để học tiếp.',
            action: `<button onclick="switchUserPanel('user-payment-section')" class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition">Đăng ký thêm</button>`
        });
    }

    if (!currentUser?.trial_active) {
        notifications.push({
            tone: 'red',
            icon: 'fa-lock',
            label: 'Cần gia hạn',
            title: 'Đang khóa',
            message: 'Mua gói để mở lại.',
            action: `<button onclick="switchUserPanel('user-payment-section')" class="bg-hanred-600 hover:bg-hanred-700 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition">Mở thanh toán</button>`
        });
    }

    notifications.push({
        tone: 'blue',
        icon: 'fa-chart-simple',
        label: 'Tổng kết tháng',
        title: monthly ? `${formatMonthLabel(monthly.month)}: ${monthly.attempts} lượt, ${monthly.avg_score}%` : 'Chưa có dữ liệu',
        message: monthly ? `${monthly.active_days} ngày hoạt động.` : 'Làm 1 bài để có báo cáo.',
        action: `<button onclick="switchUserPanel('user-progress-section')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition">Xem tiến độ</button>`
    });

    list.innerHTML = notifications.map(item => `
        <div class="bg-${item.tone}-50 border border-${item.tone}-100 rounded-2xl p-5 shadow-sm">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div class="flex gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-white border border-${item.tone}-100 text-${item.tone}-700 flex items-center justify-center text-xl shrink-0"><i class="fa-solid ${item.icon}"></i></div>
                    <div>
                        <div class="text-xs font-black text-${item.tone}-700 uppercase mb-1">${item.label}</div>
                        <div class="text-lg font-black text-gray-900">${item.title}</div>
                        <p class="text-sm text-gray-600 mt-2 leading-relaxed">${item.message}</p>
                    </div>
                </div>
                <div class="shrink-0">${item.action}</div>
            </div>
        </div>`).join('');
}

// Account/avatar UI lives in account-ui.js

function getLearningTrack(data = {}) {
    const selectedLevel = localStorage.getItem(getLearningLevelKey());
    if (selectedLevel === 'intermediate') return { key: 'intermediate', label: 'Trung cấp', color: 'blue' };
    if (selectedLevel === 'beginner') return { key: 'beginner', label: 'Người mới bắt đầu', color: 'green' };

    const dayNumber = Number(data.learning_day || 1);
    const stage = (data.stage || '').toLowerCase();
    if (stage.includes('trung') || dayNumber > 90) {
        return { key: 'intermediate', label: 'Trung cấp', color: 'blue' };
    }
    return { key: 'beginner', label: 'Người mới bắt đầu', color: 'green' };
}

function getLearningLevelKey() {
    const username = currentUser ? currentUser.username : 'guest';
    return `hanlingua_learning_level_${username}`;
}

function setLearningLevel(level) {
    localStorage.setItem(getLearningLevelKey(), level);
    loadMyProgress();
}

function getCurrentPlanDayKey() {
    const username = currentUser ? currentUser.username : 'guest';
    return `hanlingua_current_plan_day_${username}`;
}

function getCurrentPlanDay(serverDay = 1) {
    const saved = Number(localStorage.getItem(getCurrentPlanDayKey()) || 0);
    return Math.max(saved || serverDay || 1, 1);
}

function setCurrentPlanDay(dayNumber) {
    localStorage.setItem(getCurrentPlanDayKey(), String(Math.max(1, Number(dayNumber || 1))));
}

function getDailyPlan(dayNumber, data = {}) {
    const track = getLearningTrack({ ...data, learning_day: dayNumber });
    const dayType = dayNumber % 3;
    if (track.key === 'intermediate') {
        const variants = [
            {
                title: 'Tăng tốc nghe',
                totalMinutes: 60,
                tasks: [
                    { id: 'dictation', label: 'AI Dictation', minutes: 25, description: 'Nghe chép 1 bài.', action: "switchView('view-dictation')" },
                    { id: 'speaking', label: 'AI Speaking', minutes: 15, description: 'Nói lại 5 câu.', action: "switchView('view-speaking')" },
                    { id: 'vocabulary', label: 'Forecast Vocabulary', minutes: 10, description: 'Ôn 5 thẻ.', action: "switchUserPanel('user-vocabulary-section')" }
                ]
            },
            {
                title: 'Nghe rồi nói',
                totalMinutes: 55,
                tasks: [
                    { id: 'dictation', label: 'AI Dictation', minutes: 20, description: 'Chép hội thoại.', action: "switchView('view-dictation')" },
                    { id: 'speaking', label: 'AI Speaking', minutes: 20, description: 'Đóng vai.', action: "switchView('view-speaking')" },
                    { id: 'vocabulary', label: 'Forecast Vocabulary', minutes: 15, description: 'Ôn thẻ liên quan.', action: "switchUserPanel('user-vocabulary-section')" }
                ]
            },
            {
                title: 'Cân bằng kỹ năng',
                totalMinutes: 60,
                tasks: [
                    { id: 'speaking', label: 'AI Speaking', minutes: 15, description: 'Khởi động nói.', action: "switchView('view-speaking')" },
                    { id: 'dictation', label: 'AI Dictation', minutes: 25, description: 'Nghe chép.', action: "switchView('view-dictation')" },
                    { id: 'vocabulary', label: 'Forecast Vocabulary', minutes: 20, description: 'Ôn từ khó.', action: "switchUserPanel('user-vocabulary-section')" }
                ]
            }
        ];
        return { ...variants[dayType], track };
    }

    if (dayType === 1) {
        return {
            title: 'Nền tảng',
            totalMinutes: 50,
            track,
            tasks: [
                { id: 'dictation', label: 'AI Dictation', minutes: 20, description: 'Nghe chép.', action: "switchView('view-dictation')" },
                { id: 'speaking', label: 'AI Speaking', minutes: 15, description: 'Đọc lại.', action: "switchView('view-speaking')" },
                { id: 'vocabulary', label: 'Forecast Vocabulary', minutes: 15, description: 'Ôn thẻ dễ.', action: "switchUserPanel('user-vocabulary-section')" }
            ]
        };
    }
    if (dayType === 2) {
        return {
            title: 'Tăng cường nghe',
            totalMinutes: 50,
            track,
            tasks: [
                { id: 'dictation', label: 'AI Dictation', minutes: 25, description: 'Làm 1 bài.', action: "switchView('view-dictation')" },
                { id: 'speaking', label: 'AI Speaking', minutes: 10, description: 'Nói 5 câu.', action: "switchView('view-speaking')" },
                { id: 'vocabulary', label: 'Forecast Vocabulary', minutes: 15, description: 'Ôn 5 từ.', action: "switchUserPanel('user-vocabulary-section')" }
            ]
        };
    }
    return {
        title: 'Cân bằng',
        totalMinutes: 50,
        track,
        tasks: [
            { id: 'dictation', label: 'AI Dictation', minutes: 15, description: 'Nghe ngắn.', action: "switchView('view-dictation')" },
            { id: 'speaking', label: 'AI Speaking', minutes: 15, description: 'Nói chủ đề.', action: "switchView('view-speaking')" },
            { id: 'vocabulary', label: 'Forecast Vocabulary', minutes: 20, description: 'Ôn từ.', action: "switchUserPanel('user-vocabulary-section')" }
        ]
    };
}

function getDailyPlanKey(dayNumber) {
    const username = currentUser ? currentUser.username : 'guest';
    return `hanlingua_daily_plan_${username}_${dayNumber}`;
}

function getDailyPlanState(dayNumber) {
    try {
        const state = JSON.parse(localStorage.getItem(getDailyPlanKey(dayNumber))) || { tasks: {}, completed: false };
        state.tasks = state.tasks || {};
        return state;
    } catch (e) {
        return { tasks: {}, completed: false };
    }
}

function getVocabularyProgressPercent() {
    const currentDay = getCurrentPlanDay();
    let completed = 0;
    for (let day = 1; day <= currentDay; day += 1) {
        if (getDailyPlanState(day).tasks?.vocabulary) completed += 1;
    }
    return Math.min(100, Math.round((completed / Math.max(1, currentDay)) * 100));
}

function saveDailyPlanState(dayNumber, state) {
    localStorage.setItem(getDailyPlanKey(dayNumber), JSON.stringify(state));
}

function renderDailyLearningPlan(data) {
    const dayNumber = getCurrentPlanDay(data.learning_day || 1);
    const plan = getDailyPlan(dayNumber, data);
    const state = getDailyPlanState(dayNumber);
    const taskIds = plan.tasks.map(task => task.id);
    Object.keys(state.tasks).forEach(key => {
        if (!taskIds.includes(key)) delete state.tasks[key];
    });
    const doneCount = plan.tasks.filter(task => state.tasks[task.id]).length;
    const percent = Math.round((doneCount / plan.tasks.length) * 100);
    const trackBadgeClass = plan.track.key === 'intermediate'
            ? 'bg-blue-50 border-blue-100 text-blue-700'
            : 'bg-green-50 border-green-100 text-green-700';
    return `
        <div class="quest-board motion-left">
            <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-5">
                <div>
                    <div class="flex flex-wrap items-center gap-2 mb-2">
                        <span class="bg-hanred-600 text-white text-xs font-black px-3 py-1 rounded-full">Ngày ${dayNumber}</span>
                        <span class="bg-white/80 border border-blue-100 text-gray-700 text-xs font-black px-3 py-1 rounded-full">${plan.totalMinutes} phút</span>
                    </div>
                    <h4 class="text-2xl md:text-3xl font-black text-gray-950">Nhiệm vụ: ${plan.title}</h4>
                    <p class="text-sm text-gray-600 mt-2">Hoàn thành từng bước nhỏ, không cần học quá nặng.</p>
                </div>
                <div class="grid sm:grid-cols-[minmax(0,1fr)_112px] gap-3 w-full xl:w-[360px]">
                    <div class="${trackBadgeClass} border rounded-lg px-4 py-3">
                        <div class="text-xs font-black uppercase mb-2">Cấp độ</div>
                        <select onchange="setLearningLevel(this.value)" class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-black outline-none">
                            <option value="beginner" ${plan.track.key === 'beginner' ? 'selected' : ''}>Người mới bắt đầu</option>
                            <option value="intermediate" ${plan.track.key === 'intermediate' ? 'selected' : ''}>Trung cấp</option>
                        </select>
                    </div>
                    <div class="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                        <div class="text-xs font-black text-hanred-600 uppercase">Xong</div>
                        <div class="text-3xl font-black text-hanred-600 leading-none mt-2">${percent}%</div>
                    </div>
                </div>
            </div>
            <div class="skill-meter h-2.5 bg-gray-100 rounded-full overflow-hidden mb-5"><div class="h-full bg-hanred-600 rounded-full transition-all" style="width: ${percent}%"></div></div>
            <div class="mission-strip">
                ${plan.tasks.map((task, index) => {
                    const checked = !!state.tasks[task.id];
                    const icon = task.id === 'dictation' ? 'fa-headphones-simple' : task.id === 'speaking' ? 'fa-microphone-lines' : 'fa-layer-group';
                    return `
                        <div class="quest-card motion-pop ${checked ? 'border-green-200 bg-green-50' : ''} flex flex-col justify-between">
                            <div>
                                <div class="flex items-start justify-between gap-3 mb-4">
                                    <span class="stat-icon ${checked ? 'bg-green-600 text-white' : index === 0 ? 'bg-red-50 text-hanred-600' : index === 1 ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}"><i class="fa-solid ${checked ? 'fa-check' : icon}"></i></span>
                                    <div class="text-xs font-black text-gray-400 uppercase">${task.minutes} phút</div>
                                </div>
                                <div>
                                    <div class="text-xs font-black text-gray-400 uppercase">Nhiệm vụ ${index + 1}</div>
                                    <div class="font-black text-gray-900 text-lg mt-1">${task.label}</div>
                                </div>
                                <p class="text-sm text-gray-500 mt-2 compact-copy">${task.description}</p>
                            </div>
                            <button onclick="startDailyTask(${dayNumber}, '${task.id}')" class="mt-5 w-full ${checked ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-900 hover:bg-black'} text-white px-4 py-2.5 rounded-lg text-sm font-black cursor-pointer">${checked ? 'Đã xong' : 'Bắt đầu'}</button>
                        </div>`;
                }).join('')}
            </div>
            <div class="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white/70 border border-blue-100 rounded-lg p-4">
                <div class="text-sm text-gray-600"><b>${doneCount}/${plan.tasks.length}</b> việc đã xong</div>
                <button id="btn-complete-day" onclick="completeLearningDay(${dayNumber})" ${doneCount < plan.tasks.length || state.completed ? 'disabled' : ''} class="px-5 py-3 rounded-lg text-sm font-black transition ${state.completed ? 'bg-green-100 text-green-700' : doneCount < plan.tasks.length ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-hanred-600 hover:bg-hanred-700 text-white cursor-pointer'}">${state.completed ? `Đã hoàn thành` : `Hoàn thành ngày ${dayNumber}`}</button>
            </div>
        </div>`;
}

function refreshLearningOverviewLocal() {
    const summary = document.getElementById('user-progress-summary');
    if (!summary) return;
    const data = buildLocalProgressSummary();
    summary.innerHTML = renderLearningOverviewDashboard(
        data,
        null,
        `Ngày ${getCurrentPlanDay(data.learning_day)}`
    );
    initMotionReveal();
}

async function loadMyProgress() {
    const summary = document.getElementById('user-progress-summary');
    const table = document.getElementById('user-progress-list');
    const profileName = document.getElementById('profile-name');
    const profileAvatar = document.getElementById('profile-avatar');
    if (!summary || !table) return;
    if (currentUser) {
        document.querySelectorAll('#profile-name, .profile-name').forEach(el => el.innerText = currentUser.username);
        document.querySelectorAll('#profile-avatar, .profile-avatar').forEach(el => {
            const avatarText = el.querySelector('[data-avatar-letter]');
            if (avatarText) avatarText.innerText = currentUser.username.charAt(0).toUpperCase();
            else if (!el.querySelector('img')) el.innerText = currentUser.username.charAt(0).toUpperCase();
        });
        syncAccountSettingsForm();
    }
    const renderProgressDashboard = (data, forecast = null) => {
        summary.innerHTML = renderLearningOverviewDashboard(
            data,
            forecast,
            `Ngày ${data.learning_day} · ${data.stage}`
        );
        initMotionReveal();
        table.innerHTML = data.monthly.length ? data.monthly.map(m => `
            <tr>
                <td class="py-3 px-4 font-bold">${m.month}</td>
                <td class="py-3 px-4">${m.attempts}</td>
                <td class="py-3 px-4">${m.active_days}</td>
                <td class="py-3 px-4 font-bold text-hanred-600">${m.avg_score}%</td>
            </tr>`).join('') : '<tr><td colspan="4" class="py-8 px-4 text-center text-gray-400">Chưa có dữ liệu học tập.</td></tr>';
        renderUserNotifications(data, forecast);
    };

    try {
        const [progress, forecast] = await Promise.all([API.getMyProgress(), API.getMyForecast()]);
        const data = buildLocalProgressSummary(progress);
        renderProgressDashboard(data, forecast);
    } catch (e) {
        const data = buildLocalProgressSummary();
        renderProgressDashboard(data);
        const warning = document.createElement('div');
        warning.className = 'mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 text-sm font-bold';
        warning.innerText = 'Đang dùng dữ liệu tạm.';
        summary.appendChild(warning);
    }
}

function switchDictationTab(tab) {
    const isAI = tab === 'ai';
    
    // Đổi trạng thái nút tab
    document.getElementById('btn-tab-default').className = isAI ? "px-6 py-2 bg-white text-gray-600 font-bold rounded-lg border border-gray-200" : "px-6 py-2 bg-hanred-600 text-white font-bold rounded-lg shadow";
    document.getElementById('btn-tab-ai').className = isAI ? "px-6 py-2 bg-hanred-600 text-white font-bold rounded-lg shadow" : "px-6 py-2 bg-white text-gray-600 font-bold rounded-lg border border-gray-200";

    document.getElementById('panel-default-control').classList.toggle('hidden', isAI);
    document.getElementById('panel-ai-control').classList.toggle('hidden', !isAI);
    
    // Xóa sạch nội dung cũ để không bị lẫn
    document.getElementById('audio-container').innerHTML = '<audio controls style="width: 100%;" src=""></audio>';
    document.getElementById('input-area-container').innerHTML = '';
    document.getElementById('feedback-container').classList.add('hidden');
    document.getElementById('translation-section').classList.add('hidden');
    document.getElementById('translation-box').classList.add('hidden');
    document.getElementById('ai-status').innerText = "";
    
    tabState.currentLessonId = null;
    tabState.aiData = { transcript: "", audioB64: "" };

    if (!isAI) {
        loadDefaultData(1);
    } else {
        tabState.lessonData = { transcript: "", translation: "", audioSrc: "", clozeData: [] };
        renderInputArea(2, []); 
    }
}

// Lessons logic
async function loadDefaultData(id) {
    try {
        const data = await API.getLesson(id);
        tabState.currentLessonId = data.id;
        tabState.currentLevel = Number(data.level); 
        tabState.lessonData = { 
            title: data.title,
            transcript: data.transcript, 
            translation: data.translation,
            audioSrc: resolveAssetUrl(data.audio_src), 
            clozeData: data.cloze_data 
        };

        document.getElementById('feedback-container').classList.add('hidden');
        document.getElementById('translation-box').classList.add('hidden');
        
        // Load Audio
        document.getElementById('audio-container').innerHTML = `<audio controls style="width: 100%;"><source src="${tabState.lessonData.audioSrc}" type="audio/mp3"></audio>`;
        
        // Load Transcript
        if (data.translation) {
            document.getElementById('translation-box').innerText = data.translation;
            document.getElementById('translation-section').classList.remove('hidden');
        }

        renderInputArea(data.level, data.cloze_data);
    } catch (e) {
        console.error("Lỗi tải bài học:", e);
    }
}

function renderInputArea(level, clozeData) {
    const container = document.getElementById('input-area-container');
    if (!container) return;
    
    const isAI = !document.getElementById('panel-ai-control').classList.contains('hidden');
    const isFirstLesson = Number(tabState.currentLessonId) === 1;

    if (isAI || isFirstLesson || Number(level) === 2 || !clozeData || clozeData.length === 0) {
        container.innerHTML = `
            <textarea id="user-input-text" rows="6" 
                class="w-full p-4 border rounded-xl shadow-inner outline-none focus:border-hanred-500" 
                placeholder="Nghe và gõ lại nội dung bài học..."></textarea>`;
    } else {

        let html = '<div class="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-xl">';
        clozeData.forEach((sentence) => {
            sentence.forEach((item) => {
                if (item.is_blank) {
                    html += `<input type="text" class="cloze-input border-b-2 w-24 text-center text-hanred-600 font-bold">`;
                } else {
                    html += `<span class="py-1 px-0.5">${item.word}</span>`;
                }
            });
            html += '<div class="w-full h-1"></div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }
}

// Scoring

async function submitEval() {
    if (!currentUser) return AuthUI.openModal(true);

    const isAI = !document.getElementById('panel-ai-control').classList.contains('hidden');

    const isTextAreaMode = !!document.getElementById('user-input-text');

    try {
        if (isTextAreaMode || isAI) {
            const inputEl = document.getElementById('user-input-text');
            const userText = inputEl.value.trim();
            if (!userText) return alert("Vui lòng nhập bài làm!");

            const target = isAI ? (tabState.aiData.transcript || '') : tabState.lessonData.transcript;
            if (isAI && !target) return alert("Chưa có transcript AI để chấm điểm. Hãy phân tích file trước.");
            const res = await API.evaluateFull(target, userText, isAI ? null : tabState.currentLessonId);
            recordLearningActivity({
                title: isAI ? 'AI Dictation tự tạo' : (tabState.lessonData.title || 'Bài Dictation'),
                type: 'Dictation',
                score: res.score_percent,
                lesson_id: isAI ? null : tabState.currentLessonId
            });
            markDailyTaskDone('dictation', { refresh: false });
            renderFeedback(res);
        } else {
            const inputs = document.querySelectorAll('.cloze-input');
            const answers = Array.from(inputs).map(i => i.value.trim());
            const res = await API.evaluateCloze(answers, 1, tabState.currentLessonId);
            recordLearningActivity({
                title: tabState.lessonData.title || 'Bài Dictation',
                type: 'Dictation',
                score: res.score_percent,
                lesson_id: tabState.currentLessonId
            });
            markDailyTaskDone('dictation', { refresh: false });
            renderClozeFeedback(res); 
        }
    } catch (e) {
        alert("Lỗi chấm điểm: " + e.message);
    }
}

function renderFeedback(res) {
    const container = document.getElementById('feedback-container');
    const rows = [];
    const feedback = res.feedback || [];
    for (let i = 0; i < feedback.length; i++) {
        const item = feedback[i];
        if (item.status === 'correct') {
            rows.push({ user: item.word, correct: item.word, status: 'correct' });
            continue;
        }
        if (item.status === 'wrong_user') {
            const next = feedback[i + 1];
            if (next && next.status === 'hint') {
                rows.push({ user: item.word, correct: next.word, status: 'wrong' });
                i++;
            } else {
                rows.push({ user: item.word, correct: '', status: 'extra' });
            }
            continue;
        }
        if (item.status === 'missing' || item.status === 'hint') {
            rows.push({ user: '___', correct: item.word, status: 'missing' });
        }
    }

    container.innerHTML = `
        <div class="p-6 bg-white border-2 border-hanred-600 rounded-2xl text-gray-900 shadow-xl">
            <div class="flex justify-between items-center mb-6">
                <h4 class="text-xl font-bold">Kết quả nghe chép</h4>
                <span class="text-4xl font-black text-hanred-500">${res.score_percent}%</span>
            </div>
            <div class="flex flex-wrap gap-3 leading-loose text-lg">
                ${rows.map(row => {
                    const safeUser = escapeHtml(row.user);
                    const safeCorrect = escapeHtml(row.correct);
                    if (row.status === 'correct') {
                        return `<span class="inline-flex items-center gap-1 bg-green-50 border border-green-100 text-green-700 font-bold px-2 py-1 rounded-lg">
                            <i class="fa-solid fa-check"></i> ${safeUser}
                        </span>`;
                    }
                    if (row.status === 'wrong') {
                        return `<span class="inline-flex items-center gap-2 bg-red-50 border border-red-100 px-2 py-1 rounded-lg">
                            <span class="text-red-600 font-bold"><i class="fa-solid fa-xmark"></i> <span class="line-through">${safeUser}</span></span>
                            <span class="text-gray-400">→</span>
                            <span class="text-green-700 font-bold"><i class="fa-solid fa-check"></i> ${safeCorrect}</span>
                        </span>`;
                    }
                    if (row.status === 'extra') {
                        return `<span class="inline-flex items-center gap-1 bg-orange-50 border border-orange-100 text-orange-700 font-bold px-2 py-1 rounded-lg">
                            <i class="fa-solid fa-xmark"></i> <span class="line-through">${safeUser}</span> <span class="text-xs font-medium">(thừa)</span>
                        </span>`;
                    }
                    return `<span class="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg">
                        <span class="text-gray-500 font-bold"><i class="fa-solid fa-minus"></i> ___</span>
                        <span class="text-gray-400">→</span>
                        <span class="text-green-700 font-bold"><i class="fa-solid fa-check"></i> ${safeCorrect}</span>
                    </span>`;
                }).join('')}
            </div>
        </div>`;
    container.classList.remove('hidden');
}

function renderClozeFeedback(res) {
    const container = document.getElementById('feedback-container');
    document.querySelectorAll('.cloze-correction').forEach(el => el.remove());
    document.querySelectorAll('.cloze-input').forEach((input, index) => {
        const feedback = res.feedback[index];
        if (!feedback) return;

        input.classList.remove('border-green-500', 'border-red-500', 'text-green-700', 'text-red-600');
        input.classList.add(feedback.status === 'correct' ? 'border-green-500' : 'border-red-500');
        input.classList.add(feedback.status === 'correct' ? 'text-green-700' : 'text-red-600');

        const correction = document.createElement('span');
        correction.className = 'cloze-correction inline-flex items-center gap-1 ml-2 mr-3 text-sm font-bold align-middle';
        if (feedback.status === 'correct') {
            correction.classList.add('text-green-600');
            correction.innerHTML = `<i class="fa-solid fa-check"></i> đúng`;
        } else {
            correction.classList.add('text-hanred-600');
            correction.innerHTML = `<span class="text-red-500"><i class="fa-solid fa-xmark"></i></span><span class="text-gray-400">→</span><span>${feedback.correct}</span>`;
        }
        input.insertAdjacentElement('afterend', correction);
    });

    container.innerHTML = `
        <div class="p-6 bg-white border-2 border-hanred-600 rounded-2xl shadow-lg">
            <h4 class="text-xl font-bold">Điểm của bạn: <span class="text-hanred-600">${res.score_percent}%</span></h4>
            <p class="text-sm text-gray-500 mt-2">Đáp án đã hiện cạnh ô.</p>
        </div>`;
    container.classList.remove('hidden');
}

// AI WORKSPACE (UPLOAD & YOUTUBE) 
async function processAIFile() {
    const fileInput = document.getElementById('ai-file-input');
    if (!fileInput.files[0]) return alert("Vui lòng chọn file!");

    const status = document.getElementById('ai-status');
    status.innerText = "Đang xử lý AI (Whisper)...";
    tabState.aiData = { transcript: "", audioB64: "" };
    document.getElementById('feedback-container').classList.add('hidden');
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const data = await API.processAIFile(formData);
        const transcript = (data.transcript || "").trim();
        if (!transcript) throw new Error("Whisper chưa nghe ra transcript. Hãy thử file audio rõ hơn hoặc ngắn hơn.");
        tabState.aiData = {
            transcript,
            audioB64: data.audio_b64 || ""
        };
        
        document.getElementById('audio-container').innerHTML = `
            <audio controls class="w-full">
                <source src="data:${data.audio_mime || 'audio/mpeg'};base64,${tabState.aiData.audioB64}" type="${data.audio_mime || 'audio/mpeg'}">
            </audio>`;
        
        status.innerText = "Xử lý thành công! Hãy bắt đầu nghe chép.";
        renderInputArea(2, []);
    } catch (e) {
        status.innerText = "Lỗi: " + e.message;
    }
}

async function processYouTube() {
    const url = document.getElementById('youtube-input').value;
    if (!url) return alert("Vui lòng dán link YouTube!");

    const status = document.getElementById('ai-status');
    status.innerText = "Đang tải dữ liệu từ YouTube...";
    tabState.aiData = { transcript: "", audioB64: "" };
    document.getElementById('feedback-container').classList.add('hidden');
    
    try {
        const data = await API.processYouTube(url);
        const transcript = (data.transcript || "").trim();
        if (!transcript) throw new Error("Whisper chưa nghe ra transcript. Hãy thử video/audio rõ hơn hoặc ngắn hơn.");
        tabState.aiData = {
            transcript,
            audioB64: data.audio_b64 || ""
        };
        
        document.getElementById('audio-container').innerHTML = `
            <audio controls class="w-full">
                <source src="data:${data.audio_mime || 'audio/mpeg'};base64,${tabState.aiData.audioB64}" type="${data.audio_mime || 'audio/mpeg'}">
            </audio>`;
            
        status.innerText = "Sẵn sàng!";
        renderInputArea(2, []);
    } catch (e) {
        status.innerText = "Lỗi: " + e.message;
    }
}

// ADMIN UI 
// AdminUI lives in admin-ui.js
// VocabularyUI lives in vocabulary-ui.js

// --- UTILS ---
function toggleTranslation() {
    const box = document.getElementById('translation-box');
    box.classList.toggle('hidden');
}

function toggleLevel(id) {
    document.getElementById(id)?.classList.toggle('active');
}

function scrollToSection(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setSideNavActive(buttons, activeButton, activeClasses) {
    buttons.forEach(btn => {
        btn.classList.remove('sidebar-pulse', 'bg-blue-50', 'text-blue-700', 'border-blue-600', 'bg-red-50', 'text-hanred-700', 'border-hanred-600', 'border-r-4');
        btn.classList.add('hover:bg-gray-50', 'text-gray-600');
        btn.querySelector('i')?.classList.add('text-gray-400');
    });
    if (!activeButton) return;
    activeButton.classList.remove('hover:bg-gray-50', 'text-gray-600');
    activeButton.classList.add(...activeClasses);
    activeButton.querySelector('i')?.classList.remove('text-gray-400');
}

function switchAdminPanel(panelId) {
    document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.add('hidden'));
    document.getElementById(panelId)?.classList.remove('hidden');
    const buttons = document.querySelectorAll('.admin-nav-btn');
    const activeButton = document.querySelector(`[data-admin-nav="${panelId}"]`);
    setSideNavActive(buttons, activeButton, ['bg-blue-50', 'text-blue-700', 'border-r-4', 'border-blue-600']);
    if (panelId === 'admin-vocabulary-section') AdminUI.loadVocabulary();
    setTimeout(initMotionReveal, 30);
}

function switchUserPanel(panelId) {
    document.querySelectorAll('.user-panel').forEach(panel => panel.classList.add('hidden'));
    document.getElementById(panelId)?.classList.remove('hidden');
    const buttons = document.querySelectorAll('.user-nav-btn');
    const activeButton = document.querySelector(`[data-user-nav="${panelId}"]`);
    setSideNavActive(buttons, activeButton, ['sidebar-pulse', 'bg-red-50', 'text-hanred-700', 'border-r-4', 'border-hanred-600']);
    if (panelId === 'user-vocabulary-section') VocabularyUI.load();
    setTimeout(initMotionReveal, 30);
}

function toggleLearningSidebar() {
    const layout = document.getElementById('learning-layout');
    const sidebar = document.getElementById('learning-sidebar');
    const edgeIcon = document.getElementById('sidebar-edge-icon');
    if (!layout || !sidebar) return;
    const isCollapsed = sidebar.classList.toggle('is-collapsed');
    layout.className = isCollapsed
        ? 'grid lg:grid-cols-[76px_minmax(0,1fr)] gap-6 items-start transition-all duration-300'
        : 'grid lg:grid-cols-[250px_minmax(0,1fr)] gap-6 items-start transition-all duration-300';
    sidebar.className = isCollapsed
        ? 'relative learning-shell rounded-2xl p-3 lg:sticky lg:top-24 min-h-[calc(100vh-130px)] transition-all duration-300 overflow-visible is-collapsed'
        : 'relative learning-shell rounded-2xl p-4 lg:sticky lg:top-24 min-h-[calc(100vh-130px)] transition-all duration-300 overflow-visible';
    if (edgeIcon) {
        edgeIcon.className = isCollapsed ? 'fa-solid fa-angle-right' : 'fa-solid fa-angle-left';
    }
}

function markDailyTaskDone(taskId, options = {}) {
    const dayNumber = getCurrentPlanDay();
    const state = getDailyPlanState(dayNumber);
    state.tasks[taskId] = true;
    saveDailyPlanState(dayNumber, state);
    if (options.refresh !== false) loadMyProgress();
}

function startDailyTask(dayNumber, taskId) {
    if (taskId === 'speaking' || taskId === 'review' || taskId === 'vocabulary') {
        const state = getDailyPlanState(dayNumber);
        state.tasks[taskId] = true;
        saveDailyPlanState(dayNumber, state);
    }

    if (taskId === 'dictation') switchView('view-dictation');
    if (taskId === 'speaking') switchView('view-speaking');
    if (taskId === 'vocabulary') switchUserPanel('user-vocabulary-section');
    if (taskId === 'review') switchUserPanel('user-progress-section');

    if (taskId === 'speaking') {
        setTimeout(() => alert('Tiếp theo: Forecast.'), 150);
    }
    if (taskId === 'vocabulary') {
        setTimeout(() => loadMyProgress(), 150);
    }
    if (taskId === 'review') {
        setTimeout(() => loadMyProgress(), 150);
    }
}

function toggleDailyTask(dayNumber, taskId, checked) {
    const state = getDailyPlanState(dayNumber);
    state.tasks[taskId] = checked;
    if (!checked) state.completed = false;
    saveDailyPlanState(dayNumber, state);

    if (checked && taskId === 'dictation') {
        loadMyProgress();
        setTimeout(() => {
            alert('Đã hoàn thành Dictation. HanLingua sẽ chuyển bạn sang AI Speaking để luyện nói tiếp.');
            switchView('view-speaking');
        }, 250);
        return;
    }
    if (checked && taskId === 'speaking') {
        loadMyProgress();
        setTimeout(() => {
            alert('Đã hoàn thành Speaking. Tiếp theo hãy review tiến độ học hôm nay.');
            switchView('view-profile');
            setTimeout(() => switchUserPanel('user-progress-section'), 50);
        }, 250);
        return;
    }
    loadMyProgress();
}

function completeLearningDay(dayNumber) {
    const plan = getDailyPlan(dayNumber);
    const state = getDailyPlanState(dayNumber);
    const doneCount = plan.tasks.filter(task => state.tasks[task.id]).length;
    if (doneCount < plan.tasks.length) {
        alert('Chưa đủ bước.');
        return;
    }
    state.completed = true;
    saveDailyPlanState(dayNumber, state);
    setCurrentPlanDay(dayNumber + 1);
    alert(`Chúc mừng! Bạn đã hoàn thành ngày học ${dayNumber}. HanLingua đã mở lộ trình ngày ${dayNumber + 1}.`);
    refreshLearningOverviewLocal();
}

function goToLandingSection(sectionId) {
    switchView('view-landing');
    setMainNavActive('nav-home');
    setTimeout(() => scrollToSection(sectionId), 50);
}

function comingSoon(name) {
    alert(`${name} sẽ được bổ sung trong phiên bản tiếp theo.`);
}

function openPaymentModal(planName, amount) {
    const modal = document.getElementById('payment-modal');
    const formattedAmount = new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
    const username = currentUser ? currentUser.username : 'khach';
    const note = `HANLINGUA ${username} ${planName}`.toUpperCase();
    currentPayment = { plan_name: planName, amount, note };
    const qrUrl = new URL('https://img.vietqr.io/image/VCB-1026858087-compact2.png');
    qrUrl.searchParams.set('amount', amount);
    qrUrl.searchParams.set('addInfo', note);
    qrUrl.searchParams.set('accountName', 'GIAP VAN KHANH');

    document.getElementById('payment-plan').innerText = planName;
    document.getElementById('payment-amount').innerText = formattedAmount;
    document.getElementById('payment-note').innerText = note;
    document.getElementById('payment-qr').src = qrUrl.toString();
    modal.classList.remove('hidden');
}

async function notifyPaymentDone() {
    if (!currentUser) {
        closePaymentModal();
        AuthUI.openModal(true);
        return;
    }
    if (!currentPayment) return;
    try {
        const res = await API.createPayment(currentPayment);
        alert(res.msg);
        closePaymentModal();
    } catch (e) {
        alert('Lỗi gửi thông báo thanh toán: ' + e.message);
    }
}

function closePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
}

AuthUI.init();

async function loadUserLessonList() {
    const beginnerContainer = document.getElementById('content-beginner');
    const intermediateContainer = document.getElementById('content-intermediate');
    
    if (!beginnerContainer || !intermediateContainer) return;

    try {
        const lessons = await API.getLessonList();
        
        beginnerContainer.innerHTML = '';
        intermediateContainer.innerHTML = '';

        lessons.forEach(l => {
            const category = l.category || (Number(l.level) === 2 ? 'intermediate' : 'beginner');
            const lessonNumber = Number(String(l.title || '').match(/\d+/)?.[0] || l.id || 0);
            const lessonImage = lessonNumber === 1
                ? 'assets/img_1.jpg'
                : (lessonNumber === 2 ? 'assets/img_2.jpg' : '');
            const theme = {
                beginner: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: 'fa-seedling', iconColor: 'text-green-500', play: 'text-green-700' },
                intermediate: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'fa-headphones-simple', iconColor: 'text-blue-500', play: 'text-blue-700' }
            }[category] || { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: 'fa-seedling', iconColor: 'text-green-500', play: 'text-green-700' };
            const thumbnail = lessonImage
                ? `<img src="${lessonImage}" alt="${escapeHtml(l.title)}" class="w-full h-full object-cover">`
                : `<i class="fa-solid ${theme.icon}"></i>`;

            const btnHtml = `
                <button onclick="loadDefaultData(${l.id})" 
                    class="w-full ${theme.bg} border ${theme.border} ${theme.text} p-2 rounded-xl text-sm md:text-base font-bold hover:opacity-80 transition flex justify-between items-center text-left mb-4 shadow-sm cursor-pointer">
                    <div class="flex items-center space-x-3 md:space-x-4">
                        <div class="w-12 h-12 md:w-14 md:h-14 bg-white rounded-lg border ${theme.border} shadow-sm flex items-center justify-center ${theme.iconColor} overflow-hidden">
                            ${thumbnail}
                        </div>
                        <span>${l.title}</span>
                    </div>
                    <i class="fa-solid fa-play mr-2 ${theme.play}"></i>
                </button>`;

            if (category === 'intermediate') intermediateContainer.insertAdjacentHTML('beforeend', btnHtml);
            else beginnerContainer.insertAdjacentHTML('beforeend', btnHtml);
        });

        if (!beginnerContainer.innerHTML) beginnerContainer.innerHTML = '<p class="text-sm text-gray-400 italic px-2">Chưa có bài cho người mới học.</p>';
        if (!intermediateContainer.innerHTML) intermediateContainer.innerHTML = '<p class="text-sm text-gray-400 italic px-2">Chưa có bài trung cấp.</p>';
    } catch (e) {
        console.error("Lỗi tải danh sách:", e);
    }
}
