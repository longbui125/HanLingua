const AdminUI = {
    async loadLessonList() {
        const container = document.getElementById('admin-lesson-management');
        try {
            const lessons = await API.getLessonList();
            if (lessons.length === 0) {
                container.innerHTML = '<p class="text-center py-10 text-gray-400">Chưa có bài học nào.</p>';
                return;
            }
            container.innerHTML = lessons.map(l => `
                <div class="flex justify-between items-center p-4 border-b hover:bg-gray-50 transition">
                    <div>
                        <span class="font-bold text-hanred-600">#${l.id}</span>
                        <span class="ml-2 font-bold text-gray-800">${l.title}</span>
                    </div>
                    <button onclick="AdminUI.delete(${l.id})" class="text-red-500 font-bold hover:underline cursor-pointer">Xóa</button>
                </div>`).join('');
        } catch (e) {
            container.innerHTML = '<p class="text-center py-10 text-red-500">Lỗi: ' + e.message + '</p>';
        }
    },

    async loadUsers() {
        const container = document.getElementById('admin-user-management');
        if (!container) return;
        try {
            const [users, paymentsData] = await Promise.all([API.getUsers(), API.getPayments()]);
            const totalUsersEl = document.getElementById('admin-stat-users');
            const pendingUsersEl = document.getElementById('admin-stat-pending-users');
            const usersTodayEl = document.getElementById('admin-stat-users-today');
            const usersMonthEl = document.getElementById('admin-stat-users-month');
            const expiredUsersEl = document.getElementById('admin-stat-expired-users');
            const expiryNotifications = document.getElementById('admin-expiry-notifications');
            const now = new Date();
            const todayKey = now.toISOString().slice(0, 10);
            const monthKey = now.toISOString().slice(0, 7);
            const regularUsers = users.filter(u => u.role === 'user');
            const expiredUsers = regularUsers.filter(u => !u.trial_active && u.account_status === 'approved');
            if (totalUsersEl) totalUsersEl.innerText = users.length;
            if (pendingUsersEl) pendingUsersEl.innerText = paymentsData.items.filter(p => p.status !== 'success' && p.status !== 'unlocked').length;
            if (usersTodayEl) usersTodayEl.innerText = regularUsers.filter(u => (u.created_at || '').slice(0, 10) === todayKey).length;
            if (usersMonthEl) usersMonthEl.innerText = regularUsers.filter(u => (u.created_at || '').slice(0, 7) === monthKey).length;
            if (expiredUsersEl) expiredUsersEl.innerText = expiredUsers.length;
            if (expiryNotifications) {
                expiryNotifications.innerHTML = expiredUsers.length ? expiredUsers.map(u => {
                    const expiredAt = u.trial_expires_at ? new Date(u.trial_expires_at).toLocaleDateString('vi-VN') : 'không rõ ngày';
                    return `
                        <div class="py-4 flex items-start justify-between gap-4">
                            <div>
                                <div class="font-bold text-gray-900">${u.username} đã hết hạn</div>
                                <div class="text-xs text-gray-500 mt-1">Hết quyền học từ: ${expiredAt}</div>
                            </div>
                            <span class="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">Hết hạn</span>
                        </div>`;
                }).join('') : '<p class="text-center text-gray-400 py-10">Chưa có tài khoản hết hạn.</p>';
            }
            container.innerHTML = users.map(u => {
                const statusLabels = { pending: 'Chờ duyệt', approved: 'Đang hoạt động', rejected: 'Bị từ chối', locked: 'Bị khóa' };
                const status = u.role === 'admin'
                    ? '<span class="text-gray-500 font-bold">Admin không giới hạn</span>'
                    : `<span class="${u.trial_active ? 'text-green-600' : 'text-red-600'} font-bold">${u.trial_active ? `Còn ${u.trial_days_left} ngày` : 'Hết hạn'}</span>`;
                return `
                    <div class="grid xl:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center p-4 border-b hover:bg-gray-50 transition">
                        <div>
                            <div class="font-bold text-gray-800">${u.username}</div>
                            <div class="text-xs text-gray-400">Vai trò: ${u.role} - Trạng thái: ${statusLabels[u.account_status] || u.account_status} - ${status}</div>
                        </div>
                        <select id="account-status-${u.id}" class="p-2 border rounded-lg text-sm outline-none" ${u.role === 'admin' ? 'disabled' : ''}>
                            <option value="pending" ${u.account_status === 'pending' ? 'selected' : ''}>Chờ duyệt</option>
                            <option value="approved" ${u.account_status === 'approved' ? 'selected' : ''}>Duyệt</option>
                            <option value="rejected" ${u.account_status === 'rejected' ? 'selected' : ''}>Từ chối</option>
                            <option value="locked" ${u.account_status === 'locked' ? 'selected' : ''}>Khóa</option>
                        </select>
                        <button onclick="AdminUI.updateStatus(${u.id})" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-200 transition" ${u.role === 'admin' ? 'disabled' : ''}>Cập nhật</button>
                        <select id="access-plan-${u.id}" class="p-2 border rounded-lg text-sm outline-none" ${u.role === 'admin' ? 'disabled' : ''}>
                            <option value="Gói 1 tháng">Gói 1 tháng</option>
                            <option value="Gói 3 tháng">Gói 3 tháng</option>
                            <option value="Gói 6 tháng">Gói 6 tháng</option>
                            <option value="Gói 12 tháng">Gói 12 tháng</option>
                        </select>
                        <button onclick="AdminUI.grantAccess(${u.id})" class="bg-hanred-600 text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-hanred-700 transition" ${u.role === 'admin' ? 'disabled' : ''}>Cấp quyền học</button>
                    </div>`;
            }).join('');
        } catch (e) {
            container.innerHTML = '<p class="text-center py-10 text-red-500">Lỗi: ' + e.message + '</p>';
        }
    },

    async updateStatus(userId) {
        const status = document.getElementById(`account-status-${userId}`).value;
        try {
            await API.updateUserStatus(userId, status);
            alert("Đã cập nhật trạng thái tài khoản");
            this.loadUsers();
        } catch (e) {
            alert("Lỗi cập nhật trạng thái: " + e.message);
        }
    },

    async grantAccess(userId) {
        const planName = document.getElementById(`access-plan-${userId}`).value;
        try {
            await API.grantUserAccess(userId, planName);
            alert("Đã cấp quyền học cho người dùng");
            this.loadUsers();
        } catch (e) {
            alert("Lỗi cấp quyền: " + e.message);
        }
    },

    async loadPayments() {
        const container = document.getElementById('admin-payment-list');
        if (!container) return;
        try {
            const data = await API.getPayments();
            const formattedRevenue = new Intl.NumberFormat('vi-VN').format(data.total_success) + ' VNĐ';
            document.getElementById('admin-payment-total').innerText = formattedRevenue;
            const revenueEl = document.getElementById('admin-stat-revenue');
            const pendingPaymentsEl = document.getElementById('admin-stat-pending-payments');
            const paymentNotifications = document.getElementById('admin-payment-notifications');
            if (revenueEl) revenueEl.innerText = formattedRevenue;
            if (pendingPaymentsEl) pendingPaymentsEl.innerText = data.items.filter(p => p.status !== 'success' && p.status !== 'unlocked').length;
            if (paymentNotifications) {
                const recentPayments = data.items.slice(0, 10);
                paymentNotifications.innerHTML = recentPayments.length ? recentPayments.map(p => {
                    const isSuccess = p.status === 'success' || p.status === 'unlocked';
                    const amount = new Intl.NumberFormat('vi-VN').format(p.amount) + ' VNĐ';
                    const date = p.created_at ? new Date(p.created_at).toLocaleString('vi-VN') : '';
                    return `
                        <div class="py-4 flex items-start justify-between gap-4">
                            <div>
                                <div class="font-bold text-gray-900">${p.username} ${isSuccess ? 'đã thanh toán' : 'báo đã chuyển khoản'}</div>
                                <div class="text-xs text-gray-500 mt-1">${p.plan_name} - ${amount}</div>
                                <div class="text-xs text-gray-400 mt-1">${date}</div>
                            </div>
                            <span class="px-2 py-1 rounded-full text-xs font-bold ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${isSuccess ? 'Đã xác nhận' : 'Chờ xác minh'}</span>
                        </div>`;
                }).join('') : '<p class="text-center text-gray-400 py-10">Chưa có thông báo thanh toán.</p>';
            }
            if (!data.items.length) {
                container.innerHTML = '<p class="text-center py-10 text-gray-400">Chưa có thanh toán nào.</p>';
                return;
            }
            container.innerHTML = data.items.map(p => {
                const isSuccess = p.status === 'success' || p.status === 'unlocked';
                const statusText = isSuccess ? 'Đã mở quyền' : 'Chờ xác minh';
                const statusClass = isSuccess ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
                const amount = new Intl.NumberFormat('vi-VN').format(p.amount) + ' VNĐ';
                const date = p.created_at ? new Date(p.created_at).toLocaleString('vi-VN') : '';
                return `
                    <div class="grid lg:grid-cols-[1fr_auto_auto] gap-4 items-center p-4 border-b hover:bg-gray-50 transition">
                        <div>
                            <div class="font-bold text-gray-900">${p.username} - ${p.plan_name}</div>
                            <div class="text-xs text-gray-500 mt-1">${p.note || ''}</div>
                            <div class="text-xs text-gray-400 mt-1">Gửi lúc: ${date}</div>
                        </div>
                        <div class="text-right">
                            <div class="font-black text-hanred-600">${amount}</div>
                            <span class="inline-block mt-1 px-2 py-1 rounded-full text-xs font-bold ${statusClass}">${statusText}</span>
                        </div>
                        ${isSuccess ? '<span class="text-sm text-green-600 font-bold">Đã xác nhận</span>' : `<button onclick="AdminUI.confirmPayment(${p.id})" class="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black cursor-pointer transition">Xác nhận</button>`}
                    </div>`;
            }).join('');
        } catch (e) {
            container.innerHTML = '<p class="text-center py-10 text-red-500">Lỗi: ' + e.message + '</p>';
        }
    },

    async confirmPayment(paymentId) {
        if (!confirm('Xác nhận người dùng đã thanh toán thành công và cấp quyền học theo gói?')) return;
        try {
            await API.confirmPayment(paymentId);
            alert('Đã xác nhận thanh toán và cấp quyền học');
            this.loadPayments();
            this.loadUsers();
        } catch (e) {
            alert('Lỗi xác nhận: ' + e.message);
        }
    },

    async loadMonthlyProgress() {
        const body = document.getElementById('admin-progress-list');
        const title = document.getElementById('admin-progress-title');
        if (!body) return;
        try {
            const data = await API.getMonthlyProgress();
            if (title) title.innerText = `Tiến độ học viên tháng ${data.month}`;
            const studyTodayEl = document.getElementById('admin-stat-study-today');
            const attemptsTodayEl = document.getElementById('admin-stat-attempts-today');
            const activeMonthEl = document.getElementById('admin-stat-active-month');
            const attemptsMonthEl = document.getElementById('admin-stat-attempts-month');
            if (studyTodayEl) studyTodayEl.innerText = data.stats?.today_active_users || 0;
            if (attemptsTodayEl) attemptsTodayEl.innerText = data.stats?.today_attempts || 0;
            if (activeMonthEl) activeMonthEl.innerText = data.stats?.month_active_users || 0;
            if (attemptsMonthEl) attemptsMonthEl.innerText = data.stats?.month_attempts || 0;
            body.innerHTML = data.items.length ? data.items.map(item => `
                <tr>
                    <td class="py-3 px-4 font-bold">${item.username}</td>
                    <td class="py-3 px-4">Ngày ${item.learning_day}</td>
                    <td class="py-3 px-4">${item.stage}</td>
                    <td class="py-3 px-4">${item.month_attempts}</td>
                    <td class="py-3 px-4">${item.month_active_days}</td>
                    <td class="py-3 px-4 font-bold text-hanred-600">${item.month_avg_score}%</td>
                    <td class="py-3 px-4"><span class="px-2 py-1 rounded-full text-xs font-bold ${item.trial_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${item.trial_active ? 'Đang học' : 'Hết quyền'}</span></td>
                </tr>`).join('') : '<tr><td colspan="7" class="py-8 px-4 text-center text-gray-400">Chưa có học viên.</td></tr>';
        } catch (e) {
            body.innerHTML = '<tr><td colspan="7" class="py-8 px-4 text-center text-red-500">Lỗi tải tiến độ: ' + e.message + '</td></tr>';
        }
    },

    async loadVocabulary() {
        const container = document.getElementById('admin-vocabulary-list');
        if (!container) return;
        const topic = VocabularyUI.getSelectedTopic('admin-vocab-topic-filter');
        const q = document.getElementById('admin-vocab-search')?.value || '';
        try {
            await VocabularyUI.loadTopics('admin-vocab-topic-filter', topic);
            const items = await API.getVocabulary({ topic, q });
            container.innerHTML = VocabularyUI.groupedCards(items, true, 'md:grid-cols-2');
        } catch (e) {
            container.innerHTML = '<p class="text-center py-10 text-red-500 md:col-span-2">Lỗi: ' + e.message + '</p>';
        }
    },

    async submitVocabulary() {
        const payload = {
            korean: document.getElementById('admin-vocab-korean').value,
            han_viet: document.getElementById('admin-vocab-hanviet').value,
            meaning: document.getElementById('admin-vocab-meaning').value,
            topic: document.getElementById('admin-vocab-topic').value,
            example: document.getElementById('admin-vocab-example').value
        };
        try {
            await API.addVocabulary(payload);
            ['admin-vocab-korean', 'admin-vocab-hanviet', 'admin-vocab-meaning', 'admin-vocab-topic', 'admin-vocab-example'].forEach(id => document.getElementById(id).value = '');
            await this.loadVocabulary();
            alert('Đã thêm từ vựng');
        } catch (e) {
            alert('Lỗi thêm từ vựng: ' + e.message);
        }
    },

    async deleteVocabulary(id) {
        if (!confirm('Bạn chắc chắn muốn xóa từ vựng này?')) return;
        try {
            await API.deleteVocabulary(id);
            await this.loadVocabulary();
        } catch (e) {
            alert('Lỗi xóa từ vựng: ' + e.message);
        }
    },

    async uploadVocabularyImage(id, input) {
        const file = input?.files?.[0];
        if (!file) return;
        try {
            await API.updateVocabularyImage(id, file);
            input.value = '';
            await this.loadVocabulary();
        } catch (e) {
            alert('Lỗi cập nhật ảnh: ' + e.message);
        }
    },

    async deleteVocabularyImage(id) {
        try {
            await API.deleteVocabularyImage(id);
            await this.loadVocabulary();
        } catch (e) {
            alert('Lỗi gỡ ảnh: ' + e.message);
        }
    },

    async uploadAudio(input) {
        if (!input.files[0]) return;
        
        const textInput = document.getElementById('admin-audio');
        const status = input.nextElementSibling; // Nút chọn file
        
        try {
            status.innerText = "Đang tải...";
            const formData = new FormData();
            formData.append('file', input.files[0]);
            
            const data = await API.uploadAudio(formData);
            
            textInput.value = data.url;
            status.innerText = "Đã chọn";
        } catch (e) { 
            alert("Lỗi tải file: " + e.message); 
            status.innerText = "Chọn file";
        }
    },

    async submitLesson() {
        const payload = {
            title: document.getElementById('admin-title').value,
            level: parseInt(document.getElementById('admin-level').value),
            category: document.getElementById('admin-category').value,
            audio_url: document.getElementById('admin-audio').value,
            transcript: document.getElementById('admin-transcript').value,
            translation: document.getElementById('admin-translation').value
        };

        if (!payload.title || !payload.transcript) {
            return alert("Vui lòng nhập ít nhất là Tiêu đề và Transcript!");
        }

        try {
            await API.addLesson(payload);
            alert("Tạo bài học thành công!");
            
            this.resetForm();
            this.loadLessonList();
        } catch (e) {
            alert("Lỗi khi tạo: " + e.message);
        }
    },

    async submitLessonFromUrl() {
        const payload = {
            title: document.getElementById('admin-url-title').value,
            level: parseInt(document.getElementById('admin-url-level').value),
            category: document.getElementById('admin-url-category').value,
            source_url: document.getElementById('admin-source-url').value,
            translation: document.getElementById('admin-url-translation').value
        };
        const status = document.getElementById('admin-url-status');

        if (!payload.title || !payload.source_url) {
            return alert("Vui lòng nhập tiêu đề và link nguồn!");
        }

        try {
            status.innerText = "Đang tải audio và tạo transcript bằng AI...";
            await API.addLessonFromUrl(payload);
            alert("Đã tạo bài học từ link ngoài!");
            ['admin-url-title', 'admin-source-url', 'admin-url-translation'].forEach(id => {
                document.getElementById(id).value = '';
            });
            status.innerText = "";
            this.loadLessonList();
        } catch (e) {
            status.innerText = "Lỗi: " + e.message;
        }
    },


    resetForm() {
        ['admin-title', 'admin-audio', 'admin-transcript', 'admin-translation'].forEach(id => {
            document.getElementById(id).value = '';
        });
        document.getElementById('admin-level').value = '1';
        document.getElementById('admin-category').value = 'beginner';
    },
    
    async delete(id) {
        if(confirm("Bạn chắc chắn muốn xóa bài học này?")) {
            try {
                await API.deleteLesson(id);
                this.loadLessonList();
            } catch(e) { alert(e.message); }
        }
    }
};

