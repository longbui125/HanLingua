function showAccountSettingsMessage(message, type = 'success') {
    const box = document.getElementById('account-settings-message');
    if (!box) return;
    box.className = type === 'success'
        ? 'mt-5 rounded-xl p-4 text-sm font-bold bg-green-50 border border-green-100 text-green-700'
        : 'mt-5 rounded-xl p-4 text-sm font-bold bg-red-50 border border-red-100 text-red-700';
    box.innerText = message;
}

function getAvatarSrc(url) {
    return url ? `${url}${url.includes('?') ? '&' : '?'}v=${avatarCacheKey}` : '';
}

function openProfileAvatarViewer() {
    const modal = document.getElementById('profile-avatar-viewer');
    const content = document.getElementById('profile-avatar-viewer-content');
    if (!modal || !content || !currentUser) return;
    content.innerHTML = currentUser.avatar_url
        ? `<div class="flex flex-col items-center gap-4"><img src="${getAvatarSrc(currentUser.avatar_url)}" alt="Avatar" class="max-w-[80vw] max-h-[70vh] rounded-3xl object-contain shadow-2xl"><button onclick="event.stopPropagation(); removeProfileAvatar();" class="bg-white text-gray-900 px-5 py-3 rounded-xl text-sm font-black cursor-pointer hover:bg-gray-100">Gỡ ảnh</button></div>`
        : `<div class="relative w-64 h-64 rounded-[3rem] bg-hanred-100 text-hanred-500 flex items-center justify-center overflow-hidden shadow-2xl"><span class="text-8xl font-black">${currentUser.username.charAt(0).toUpperCase()}</span>${currentUser.is_pro ? '<span class="absolute bottom-8 left-0 right-0 text-center text-white text-5xl font-black drop-shadow">PRO</span>' : ''}</div>`;
    modal.classList.remove('hidden');
}

function closeProfileAvatarViewer() {
    document.getElementById('profile-avatar-viewer')?.classList.add('hidden');
}

const FOOTER_INFO = {
    about: {
        title: 'Về chúng tôi',
        items: [
            'HanLingua là nền tảng học tiếng Hàn tập trung vào Dictation, luyện nói cùng AI và Forecast Vocabulary theo chủ đề.',
            'Sứ mệnh: giúp người học duy trì thói quen học tiếng Hàn mỗi ngày.',
            'Điểm mạnh: lộ trình học rõ ràng, dashboard tiến độ, AI Dictation, AI Speaking và kho thẻ từ TOPIK.',
            'Đối tượng phù hợp: người mới bắt đầu và người học trung cấp.'
        ]
    },
    terms: {
        title: 'Điều khoản',
        items: [
            'Quy định sử dụng tài khoản.',
            'Không chia sẻ tài khoản cho người khác.',
            'Quy định về gói học, thời hạn sử dụng và thanh toán.',
            'Nội dung học chỉ dùng cho mục đích cá nhân.',
            'HanLingua có quyền khóa tài khoản nếu phát hiện lạm dụng, gian lận hoặc vi phạm.',
            'Chính sách xử lý thanh toán thủ công: người học chuyển khoản, admin xác minh và mở quyền.'
        ]
    },
    privacy: {
        title: 'Bảo mật',
        items: [
            'Cam kết bảo vệ thông tin tài khoản người dùng.',
            'Mật khẩu được mã hóa, không lưu mật khẩu dạng văn bản.',
            'Không chia sẻ thông tin cá nhân cho bên thứ ba nếu không có yêu cầu pháp lý.',
            'Người dùng nên tự bảo mật tài khoản và không chia sẻ mật khẩu.',
            'Dữ liệu học tập được dùng để hiển thị tiến độ, thống kê và cải thiện trải nghiệm học.'
        ]
    },
    support: {
        title: 'Hỗ trợ',
        items: [
            'Hướng dẫn liên hệ khi gặp lỗi đăng nhập, thanh toán, hết hạn tài khoản.',
            'Hỗ trợ xác minh thanh toán QR.',
            'Hỗ trợ đổi mật khẩu/quên mật khẩu qua admin hoặc manager.',
            'Hỗ trợ lỗi bài học, audio, Dictation, Speaking và Forecast Vocabulary.',
            'Có thể thêm thông tin liên hệ: email, Zalo, Facebook page hoặc số điện thoại.'
        ]
    }
};

function openFooterInfo(type) {
    const data = FOOTER_INFO[type];
    const modal = document.getElementById('footer-info-modal');
    if (!data || !modal) return;
    document.getElementById('footer-info-title').innerText = data.title;
    document.getElementById('footer-info-content').innerHTML = `<ul class="space-y-3 list-disc pl-5">${data.items.map(item => `<li>${item}</li>`).join('')}</ul>`;
    modal.classList.remove('hidden');
}

function closeFooterInfo() {
    document.getElementById('footer-info-modal')?.classList.add('hidden');
}

function toggleSupportBot() {
    const panel = document.getElementById('support-bot-panel');
    if (!panel) return;
    const isOpening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (isOpening) {
        initSupportBot();
        setTimeout(() => document.getElementById('support-bot-input')?.focus(), 50);
    }
}

function initSupportBot() {
    const box = document.getElementById('support-bot-messages');
    if (!box || box.dataset.ready) return;
    box.dataset.ready = '1';
    addBotMessage('bot', 'Xin chào! Tôi là HanLingua Bot. Tôi có thể hỗ trợ về đăng nhập, quên mật khẩu, thanh toán, gia hạn, lỗi audio/bài học, Forecast Vocabulary và lộ trình học.');
}

function addBotMessage(sender, text) {
    const box = document.getElementById('support-bot-messages');
    if (!box) return;
    const isUser = sender === 'user';
    const item = document.createElement('div');
    item.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;
    item.innerHTML = `<div class="max-w-[85%] rounded-2xl px-4 py-3 ${isUser ? 'bg-hanred-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}">${text}</div>`;
    box.appendChild(item);
    box.scrollTop = box.scrollHeight;
}

function getSupportBotReply(message) {
    const text = message.toLowerCase();
    if (text.includes('thanh toán') || text.includes('qr') || text.includes('chuyển khoản') || text.includes('gia hạn')) {
        return 'Vào Thanh toán, chọn gói, quét QR, bấm đã chuyển.';
    }
    if (text.includes('quên') || text.includes('mật khẩu') || text.includes('password')) {
        return 'Bấm Quên mật khẩu và nhập tài khoản.';
    }
    if (text.includes('hết hạn') || text.includes('khóa') || text.includes('không hoạt động') || text.includes('mở quyền')) {
        return 'Hết hạn thì mua/gia hạn gói.';
    }
    if (text.includes('từ vựng') || text.includes('vocabulary') || text.includes('forecast') || text.includes('topik')) {
        return 'Vào Forecast từ vựng, chọn chủ đề và lật thẻ.';
    }
    if (text.includes('audio') || text.includes('bài học') || text.includes('lỗi') || text.includes('dictation')) {
        return 'Tải lại trang. Nếu còn lỗi, gửi tên bài cho admin.';
    }
    if (text.includes('lộ trình') || text.includes('học hôm nay') || text.includes('ngày học')) {
        return 'Mỗi ngày: Dictation, Speaking, Forecast.';
    }
    if (text.includes('admin') || text.includes('manager') || text.includes('duyệt')) {
        return 'Tài khoản mới cần admin duyệt.';
    }
    return 'Hỏi về đăng nhập, thanh toán, bài học hoặc Forecast nhé.';
}

function sendSupportBotMessage() {
    const input = document.getElementById('support-bot-input');
    const message = input?.value.trim();
    if (!message) return;
    addBotMessage('user', message);
    input.value = '';
    setTimeout(() => addBotMessage('bot', getSupportBotReply(message)), 250);
}

function quickBotQuestion(message) {
    const input = document.getElementById('support-bot-input');
    if (input) input.value = message;
    sendSupportBotMessage();
}

function handleBotInputKey(event) {
    if (event.key === 'Enter') sendSupportBotMessage();
}

function formatSuggestionMessage(error) {
    if (!error?.suggestions?.length) return error.message;
    return `${error.message} Gợi ý: ${error.suggestions.join(', ')}`;
}

function syncAccountSettingsForm() {
    const usernameInput = document.getElementById('account-username');
    if (usernameInput && currentUser) usernameInput.value = currentUser.username;
    const preview = document.getElementById('account-avatar-preview');
    if (preview && currentUser) {
        preview.innerHTML = currentUser.avatar_url
            ? `<img src="${getAvatarSrc(currentUser.avatar_url)}" alt="Avatar" class="w-full h-full object-cover">`
            : `<span>${currentUser.username.charAt(0).toUpperCase()}</span>`;
    }
}

async function uploadSelectedAvatar(input) {
    const file = input?.files?.[0];
    if (!file) return;
    try {
        const res = await API.updateMyAvatar(file);
        avatarCacheKey = Date.now();
        currentUser = await API.getMe();
        if (res.avatar_url) currentUser.avatar_url = res.avatar_url;
        AuthUI.renderHeader();
        renderMoreUserInfo();
        syncAccountSettingsForm();
        input.value = '';
        showAccountSettingsMessage('Đã cập nhật ảnh đại diện.');
    } catch (e) {
        showAccountSettingsMessage(e.message, 'error');
    }
}

async function updateProfileAvatar(event) {
    event.preventDefault();
    await uploadSelectedAvatar(document.getElementById('account-avatar-file'));
}

async function removeProfileAvatar() {
    try {
        await API.deleteMyAvatar();
        avatarCacheKey = Date.now();
        currentUser = await API.getMe();
        AuthUI.renderHeader();
        renderMoreUserInfo();
        syncAccountSettingsForm();
        closeProfileAvatarViewer();
        showAccountSettingsMessage('Đã gỡ ảnh đại diện.');
    } catch (e) {
        showAccountSettingsMessage(e.message, 'error');
    }
}

async function updateAccountProfile(event) {
    event.preventDefault();
    const username = document.getElementById('account-username')?.value.trim();
    const password = document.getElementById('account-profile-password')?.value;
    try {
        const res = await API.updateMyProfile(username, password);
        if (res.access_token) localStorage.setItem('access_token', res.access_token);
        currentUser = await API.getMe();
        AuthUI.renderHeader();
        renderMoreUserInfo();
        syncAccountSettingsForm();
        document.getElementById('account-profile-password').value = '';
        showAccountSettingsMessage('Đã cập nhật tên tài khoản.');
    } catch (e) {
        showAccountSettingsMessage(formatSuggestionMessage(e), 'error');
    }
}

async function updateAccountPassword(event) {
    event.preventDefault();
    const currentPassword = document.getElementById('account-current-password')?.value;
    const newPassword = document.getElementById('account-new-password')?.value;
    const confirmPassword = document.getElementById('account-confirm-password')?.value;
    if (newPassword !== confirmPassword) {
        showAccountSettingsMessage('Mật khẩu mới nhập lại chưa khớp. Vui lòng nhập tay lại cả hai ô.', 'error');
        return;
    }
    try {
        await API.updateMyPassword(currentPassword, newPassword);
        document.getElementById('account-current-password').value = '';
        document.getElementById('account-new-password').value = '';
        document.getElementById('account-confirm-password').value = '';
        showAccountSettingsMessage('Đã đổi mật khẩu. Lần đăng nhập sau hãy dùng mật khẩu mới.');
    } catch (e) {
        showAccountSettingsMessage(e.message, 'error');
    }
}

