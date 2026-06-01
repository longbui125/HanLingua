// Backend API base URL — set window.HANLINGUA_API_URL for cross-origin deployment
// Example: window.HANLINGUA_API_URL = 'https://hanlingua-backend.up.railway.app'
// When empty or unset, defaults to same-origin '/api' (local dev / Docker)
const API_BASE = (window.HANLINGUA_API_URL || '') + '/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
    } : { 
        'Content-Type': 'application/json' 
    };
};

const getAuthOnlyHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const apiError = async (res, fallback) => {
    let payload = null;
    try { payload = await res.json(); } catch (e) {}
    const detail = payload?.detail;
    const err = new Error(typeof detail === 'object' ? detail.message : (detail || fallback));
    if (detail?.suggestions) err.suggestions = detail.suggestions;
    return err;
};

const API = {
    // AUTH
    async register(username, password) {
        const res = await fetch(`${API_BASE}/auth/register`, { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({username, password}) 
        });
        if (!res.ok) throw await apiError(res, "Không thể đăng ký"); 
        return res.json();
    },

    async login(username, password) {
        const fd = new URLSearchParams(); 
        fd.append('username', username); 
        fd.append('password', password);
        
        const res = await fetch(`${API_BASE}/auth/login`, { 
            method: 'POST', 
            headers: {'Content-Type':'application/x-www-form-urlencoded'}, 
            body: fd 
        });
        if (!res.ok) throw await apiError(res, "Không thể đăng nhập"); 
        return res.json();
    },

    async forgotPassword(username) {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ username })
        });
        if (!res.ok) throw await apiError(res, "Không thể gửi yêu cầu quên mật khẩu");
        return res.json();
    },

    async getMe() {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Phiên đăng nhập hết hạn"); 
        return res.json();
    },

    async updateMyProfile(username, currentPassword) {
        const res = await fetch(`${API_BASE}/auth/me/profile`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ username, current_password: currentPassword })
        });
        if (!res.ok) throw await apiError(res, "Không thể cập nhật tài khoản");
        return res.json();
    },

    async updateMyAvatar(file) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${API_BASE}/auth/me/avatar`, {
            method: 'PUT',
            headers: getAuthOnlyHeaders(),
            body: form
        });
        if (!res.ok) throw await apiError(res, "Không thể cập nhật ảnh đại diện");
        return res.json();
    },

    async deleteMyAvatar() {
        const res = await fetch(`${API_BASE}/auth/me/avatar`, {
            method: 'DELETE',
            headers: getAuthOnlyHeaders()
        });
        if (!res.ok) throw await apiError(res, "Không thể gỡ ảnh đại diện");
        return res.json();
    },

    async updateMyPassword(currentPassword, newPassword) {
        const res = await fetch(`${API_BASE}/auth/me/password`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
        });
        if (!res.ok) throw await apiError(res, "Không thể đổi mật khẩu");
        return res.json();
    },

    async getDailyContent() {
        const res = await fetch(`${API_BASE}/daily-content`);
        if (!res.ok) throw new Error("Không thể tải nội dung truyền cảm hứng hôm nay");
        return res.json();
    },

    //LESSONS
    async getLessonList() {
        const res = await fetch(`${API_BASE}/lessons/list`); 
        if (!res.ok) throw new Error("Không thể tải danh sách bài học");
        return res.json();
    },

    async getLesson(id) {
        const res = await fetch(`${API_BASE}/lessons/${id}`, { headers: getAuthHeaders() }); 
        if (res.status === 401) throw new Error("Vui lòng đăng nhập để học bài");
        if (res.status === 403) throw new Error((await res.json()).detail);
        if (!res.ok) throw new Error("Không tìm thấy bài học");
        return res.json();
    },

    //EVALUATION
    async evaluateFull(targetText, userText, lessonId = null) {
        const res = await fetch(`${API_BASE}/evaluate`, { 
            method: 'POST', 
            headers: getAuthHeaders(), 
            body: JSON.stringify({ 
                target_text: targetText, 
                user_text: userText, 
                lesson_id: lessonId 
            }) 
        });
        if(res.status === 401) throw new Error("Vui lòng đăng nhập để thực hiện");
        if(res.status === 403) throw new Error((await res.json()).detail);
        return res.json();
    },

    async evaluateCloze(clozeAnswers, level, lessonId) {
        const res = await fetch(`${API_BASE}/evaluate-cloze`, { 
            method: 'POST', 
            headers: getAuthHeaders(), 
            body: JSON.stringify({ 
                cloze_answers: clozeAnswers, 
                level, 
                lesson_id: lessonId 
            }) 
        });
        if(res.status === 401) throw new Error("Vui lòng đăng nhập để thực hiện");
        if(res.status === 403) throw new Error((await res.json()).detail);
        return res.json();
    },

    //ADMIN
    async deleteLesson(id) {
        const res = await fetch(`${API_BASE}/admin/lessons/${id}`, { 
            method: 'DELETE', 
            headers: getAuthHeaders() 
        });
        if(!res.ok) throw new Error("Lỗi khi xóa bài");
        return res.json();
    },

    async addLesson(data) {
        const res = await fetch(`${API_BASE}/admin/lessons`, { 
            method: 'POST', 
            headers: getAuthHeaders(), 
            body: JSON.stringify(data) 
        });
        if(!res.ok) throw new Error("Không thể thêm bài học"); 
        return res.json();
    },

    async updateLesson(id, data) {
        const res = await fetch(`${API_BASE}/admin/lessons/${id}`, { 
            method: 'PUT', 
            headers: getAuthHeaders(), 
            body: JSON.stringify(data) 
        });
        if(!res.ok) throw new Error("Lỗi khi cập nhật bài");
        return res.json();
    },

    async addLessonFromUrl(data) {
        const res = await fetch(`${API_BASE}/admin/lessons/from-url`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Không thể tạo bài học từ link ngoài");
        return res.json();
    },

    async getMyProgress() {
        const res = await fetch(`${API_BASE}/me/progress`, { headers: getAuthHeaders() }); 
        if (!res.ok) throw new Error("Không thể tải tiến độ học tập");
        return res.json();
    },

    async getMyForecast() {
        const res = await fetch(`${API_BASE}/me/forecast`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Không thể tải Forecast học tập");
        return res.json();
    },

    async getMonthlyProgress() {
        const res = await fetch(`${API_BASE}/admin/progress/monthly`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Không thể tải tiến độ tháng");
        return res.json();
    },

    async getAllProgress() {
        const res = await fetch(`${API_BASE}/admin/progress`, { headers: getAuthHeaders() }); 
        return res.json();
    },

    async getUsers() {
        const res = await fetch(`${API_BASE}/admin/users`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Không thể tải danh sách người dùng");
        return res.json();
    },

    async grantUserAccess(userId, planName) {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/trial`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ plan_name: planName })
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Không thể cấp quyền học");
        return res.json();
    },

    async updateUserStatus(userId, status) {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Không thể cập nhật trạng thái tài khoản");
        return res.json();
    },

    async updateUserRole(userId, role) {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ role })
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Không thể cập nhật role");
        return res.json();
    },

    async createPayment(data) {
        const res = await fetch(`${API_BASE}/payments`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Không thể gửi thông báo thanh toán");
        return res.json();
    },

    async getPayments() {
        const res = await fetch(`${API_BASE}/admin/payments`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Không thể tải dữ liệu thu chi");
        return res.json();
    },

    async confirmPayment(paymentId) {
        const res = await fetch(`${API_BASE}/admin/payments/${paymentId}/confirm`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Không thể xác nhận thanh toán");
        return res.json();
    },

    async getVocabulary(params = {}) {
        const search = new URLSearchParams();
        if (params.topic) search.set('topic', params.topic);
        if (params.q) search.set('q', params.q);
        const suffix = search.toString() ? `?${search.toString()}` : '';
        const res = await fetch(`${API_BASE}/vocabulary${suffix}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error((await res.json()).detail || "Không thể tải từ vựng");
        return res.json();
    },

    async getVocabularyTopics() {
        const res = await fetch(`${API_BASE}/vocabulary/topics`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error((await res.json()).detail || "Không thể tải chủ đề từ vựng");
        return res.json();
    },

    async addVocabulary(data) {
        const res = await fetch(`${API_BASE}/vocabulary`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Không thể thêm từ vựng");
        return res.json();
    },

    async deleteVocabulary(id) {
        const res = await fetch(`${API_BASE}/admin/vocabulary/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Không thể xóa từ vựng");
        return res.json();
    },

    async updateVocabularyImage(id, file) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${API_BASE}/admin/vocabulary/${id}/image`, {
            method: 'PUT',
            headers: getAuthOnlyHeaders(),
            body: form
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Không thể cập nhật ảnh minh họa");
        return res.json();
    },

    async deleteVocabularyImage(id) {
        const res = await fetch(`${API_BASE}/admin/vocabulary/${id}/image`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Không thể gỡ ảnh minh họa");
        return res.json();
    },

    //AI WORKSPACE 
    async processAIFile(formData) {
        // FormData không cần Header Content-Type thủ công vì trình duyệt sẽ tự thêm
        const res = await fetch(`${API_BASE}/process-ai`, { 
            method: 'POST', 
            headers: getAuthOnlyHeaders(),
            body: formData 
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Lỗi xử lý file AI");
        return res.json();
    },

        async uploadAudio(formData) {
        const res = await fetch(`${API_BASE}/admin/upload-audio`, {
            method: 'POST',
            headers: getAuthOnlyHeaders(),
            body: formData 
        });
        if (!res.ok) throw new Error("Không thể tải lên file");
        return res.json();
    },

    async addLesson(data) {
        const res = await fetch(`${API_BASE}/admin/lessons`, { 
            method: 'POST', 
            headers: getAuthHeaders(), // Phải có Token Admin mới tạo được
            body: JSON.stringify(data) 
        });
        if (!res.ok) throw new Error("Không thể thêm bài học"); 
        return res.json();
    },

    async processYouTube(url) {
        let res;
        try {
            res = await fetch(`${API_BASE}/process-youtube`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ url })
            });
        } catch (e) {
            throw new Error("Không kết nối được tới backend Railway. Hãy kiểm tra Deployments/Logs của Railway, hoặc thử lại sau khi backend redeploy xong.");
        }
        if (!res.ok) throw await apiError(res, "Lỗi xử lý link YouTube");
        return res.json();
    }
};
