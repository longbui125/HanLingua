const VocabularyUI = {
    async loadTopics(selectId, selected = '') {
        const container = document.getElementById(selectId);
        if (!container) return;
        const topics = await API.getVocabularyTopics();
        const handler = selectId.startsWith('admin') ? 'AdminUI.loadVocabulary' : 'VocabularyUI.load';
        const chip = (topic, label) => {
            const active = topic === selected;
            return `<button type="button" data-topic="${escapeHtml(topic)}" onclick="VocabularyUI.selectTopic('${selectId}', '${escapeHtml(topic)}'); ${handler}()" class="px-3 py-2 rounded-xl text-xs font-black border transition ${active ? 'bg-purple-700 border-purple-700 text-white' : 'bg-white border-purple-100 text-purple-700 hover:bg-purple-50'}">${escapeHtml(label)}</button>`;
        };
        container.innerHTML = chip('', 'Tất cả chủ đề') + topics.map(topic => chip(topic, topic)).join('');
    },

    selectTopic(containerId, topic) {
        const container = document.getElementById(containerId);
        if (container) container.dataset.selectedTopic = topic;
    },

    getSelectedTopic(containerId) {
        return document.getElementById(containerId)?.dataset.selectedTopic || '';
    },

    card(item, isAdmin = false) {
        const example = item.example ? `<div class="mt-3 text-xs text-gray-500 bg-white/70 border border-gray-100 rounded-xl p-3">${escapeHtml(item.example)}</div>` : '<div class="mt-3 text-xs text-gray-400 bg-white/70 border border-gray-100 rounded-xl p-3">Chưa có ví dụ.</div>';
        const resolvedImageUrl = resolveAssetUrl(item.image_url);
        const imageSrc = resolvedImageUrl ? `${resolvedImageUrl}?v=${Date.now()}` : '';
        const imageBlock = isAdmin
            ? `<label onclick="event.stopPropagation()" class="relative h-32 rounded-2xl overflow-hidden border border-dashed border-purple-100 bg-purple-50/50 text-purple-300 flex items-center justify-center cursor-pointer group">
                    ${imageSrc ? `<img src="${imageSrc}" alt="${escapeHtml(item.korean)}" class="absolute inset-0 w-full h-full object-cover">` : '<i class="fa-solid fa-image text-2xl"></i>'}
                    <span class="absolute inset-x-3 bottom-3 bg-white/90 text-purple-700 rounded-xl px-3 py-2 text-xs font-black text-center shadow-sm opacity-0 group-hover:opacity-100 transition">Thêm/đổi ảnh</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" onchange="AdminUI.uploadVocabularyImage(${item.id}, this)">
                </label>`
            : (imageSrc
                ? `<div class="h-32 rounded-2xl overflow-hidden border border-purple-100 bg-purple-50"><img src="${imageSrc}" alt="${escapeHtml(item.korean)}" class="w-full h-full object-cover"></div>`
                : `<div class="h-28 rounded-2xl border border-dashed border-purple-100 bg-purple-50/50 text-purple-200 flex items-center justify-center text-xl"><i class="fa-solid fa-image"></i></div>`);
        const action = isAdmin ? `
            <div class="mt-4 flex flex-wrap gap-2" onclick="event.stopPropagation()">
                ${item.image_url ? `<button type="button" onclick="AdminUI.deleteVocabularyImage(${item.id})" class="bg-white border border-gray-100 text-gray-500 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-50 transition">Gỡ ảnh</button>` : ''}
                <button type="button" onclick="AdminUI.deleteVocabulary(${item.id})" class="bg-white border border-red-100 text-red-600 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-red-50 transition">Xóa</button>
            </div>` : '';
        const safeKorean = escapeHtml(item.korean);
        return `
            <article class="vocab-card flip-card h-[260px]" onclick="this.classList.toggle('is-flipped')">
                <div class="flip-card-inner relative h-full transition-transform duration-500">
                    <div class="flip-card-face flip-card-front absolute inset-0 bg-white border border-purple-100 rounded-2xl p-5 shadow-sm hover:shadow-lg transition flex flex-col">
                        <div class="space-y-5">
                            ${imageBlock}
                        </div>
                        <div class="mt-auto mb-5 flex items-center justify-between gap-2 min-w-0">
                                <div class="text-3xl font-black text-gray-900 leading-tight break-keep min-w-0">${safeKorean}</div>
                                <button type="button" onclick="speakKorean('${safeKorean}', event)" class="w-9 h-9 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-700 flex items-center justify-center transition shrink-0" title="Nghe phát âm tiếng Hàn">
                                    <i class="fa-solid fa-volume-high"></i>
                                </button>
                        </div>
                        <div class="text-purple-700 text-xs font-black uppercase tracking-wide"><i class="fa-solid fa-rotate mr-1"></i> Lật thẻ</div>
                    </div>
                    <div class="flip-card-face flip-card-back absolute inset-0 bg-purple-50 border border-purple-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                        <div>
                            <div class="text-xs font-black text-purple-700 uppercase mb-2">Đáp án</div>
                            <button type="button" onclick="speakKorean('${safeKorean}', event)" class="mb-3 inline-flex items-center gap-2 bg-white border border-purple-100 text-purple-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-purple-100 transition">
                                <i class="fa-solid fa-volume-high"></i> Nghe phát âm
                            </button>
                            <div class="text-sm font-bold text-hanred-600">${escapeHtml(item.han_viet || 'Âm đọc/Hán Việt chưa có')}</div>
                            <div class="mt-3 text-gray-800 font-semibold leading-relaxed">${escapeHtml(item.meaning)}</div>
                            ${example}
                        </div>
                        <div onclick="event.stopPropagation()">${action}</div>
                    </div>
                </div>
            </article>`;
    },

    groupedCards(items, isAdmin = false, gridClass = 'sm:grid-cols-2 xl:grid-cols-3') {
        if (!items.length) {
            return '<p class="text-center text-gray-400 py-10">Chưa có từ vựng phù hợp.</p>';
        }
        const groups = items.reduce((acc, item) => {
            const topic = item.topic || 'Chủ đề khác';
            if (!acc[topic]) acc[topic] = [];
            acc[topic].push(item);
            return acc;
        }, {});

        return Object.entries(groups).map(([topic, topicItems]) => `
            <section class="bg-white border border-purple-100 rounded-2xl p-4 md:p-5 shadow-sm">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-purple-100">
                    <div>
                        <div class="text-xs font-black text-purple-600 uppercase">Chủ đề</div>
                        <h4 class="text-lg md:text-xl font-black text-gray-900">${escapeHtml(topic)}</h4>
                    </div>
                    <span class="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-bold w-max">${topicItems.length} từ vựng</span>
                </div>
                <div class="grid ${gridClass} gap-4">
                    ${topicItems.map(item => this.card(item, isAdmin)).join('')}
                </div>
            </section>`).join('');
    },

    topicGrid(topics) {
        if (!topics.length) {
            return '<p class="text-center text-gray-400 py-10">Chưa có chủ đề.</p>';
        }
        return `
            <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                ${topics.map((topic, index) => `
                    <button type="button" onclick="VocabularyUI.selectTopic('user-vocab-topic-filter', '${escapeHtml(topic)}'); VocabularyUI.load();" class="text-left bg-white border border-purple-100 hover:border-purple-300 hover:bg-purple-50 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition cursor-pointer">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-12 h-12 bg-purple-50 text-purple-700 rounded-xl flex items-center justify-center text-xl font-black">${index + 1}</div>
                        </div>
                        <div class="font-black text-gray-900 text-lg leading-snug">${escapeHtml(topic)}</div>
                    </button>`).join('')}
            </div>`;
    },

    setUserVocabularyLayout(isTopicOpen) {
        const layout = document.getElementById('user-vocabulary-layout');
        const form = document.getElementById('user-vocabulary-form');
        if (!layout || !form) return;
        layout.className = isTopicOpen ? 'grid gap-6 items-start' : 'grid xl:grid-cols-[1fr_330px] gap-6 items-start';
        form.classList.toggle('hidden', isTopicOpen);
    },

    renderTopicHeader(topic = '') {
        const header = document.getElementById('user-vocabulary-topic-header');
        const titleBlock = document.getElementById('user-vocabulary-title-block');
        if (!header) return;
        if (!topic) {
            header.classList.add('hidden');
            header.innerHTML = '';
            if (titleBlock) {
                titleBlock.innerHTML = '<div class="text-xs font-bold text-purple-700 uppercase">Forecast TOPIK</div><h3 class="font-black text-2xl text-gray-900">Chủ đề</h3>';
            }
            return;
        }
        if (titleBlock) {
            titleBlock.innerHTML = '<div class="text-xs font-bold text-purple-700 uppercase">Forecast TOPIK</div>';
        }
        header.className = 'mb-4 grid md:grid-cols-[auto_1fr_auto] md:items-center gap-4';
        header.innerHTML = `
            <button type="button" onclick="VocabularyUI.selectTopic('user-vocab-topic-filter', ''); VocabularyUI.load();" class="bg-white border border-purple-100 text-purple-700 hover:bg-purple-50 px-4 py-3 rounded-xl text-sm font-bold transition w-max">
                <i class="fa-solid fa-arrow-left mr-1"></i> Chủ đề
            </button>
            <h4 class="text-2xl font-black text-gray-900 text-center">${escapeHtml(topic)}</h4>
            <div class="hidden md:block w-[104px]"></div>`;
    },

    async load() {
        const container = document.getElementById('user-vocabulary-list');
        if (!container) return;
        const topic = this.getSelectedTopic('user-vocab-topic-filter');
        const q = document.getElementById('user-vocab-search')?.value || '';
        try {
            const topics = await API.getVocabularyTopics();
            if (!topic && !q.trim()) {
                this.setUserVocabularyLayout(false);
                this.renderTopicHeader('');
                container.innerHTML = this.topicGrid(topics);
                return;
            }
            this.setUserVocabularyLayout(!!topic);
            const items = await API.getVocabulary({ topic, q });
            this.renderTopicHeader(topic);
            container.innerHTML = topic
                ? `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${items.map(item => this.card(item)).join('')}</div>`
                : this.groupedCards(items);
        } catch (e) {
            container.innerHTML = '<p class="text-center py-10 text-red-500 sm:col-span-2 xl:col-span-3">Lỗi: ' + e.message + '</p>';
        }
    },

    async submit() {
        const payload = {
            korean: document.getElementById('user-vocab-korean').value,
            han_viet: document.getElementById('user-vocab-hanviet').value,
            meaning: document.getElementById('user-vocab-meaning').value,
            topic: document.getElementById('user-vocab-topic').value,
            example: document.getElementById('user-vocab-example').value
        };
        try {
            await API.addVocabulary(payload);
            ['user-vocab-korean', 'user-vocab-hanviet', 'user-vocab-meaning', 'user-vocab-topic', 'user-vocab-example'].forEach(id => document.getElementById(id).value = '');
            this.selectTopic('user-vocab-topic-filter', payload.topic.trim());
            await this.load();
            alert('Đã thêm thẻ từ vựng');
        } catch (e) {
            alert('Lỗi thêm từ vựng: ' + e.message);
        }
    }
};
