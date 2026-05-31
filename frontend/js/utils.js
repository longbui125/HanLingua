function speakKorean(text, event = null) {
    if (event) event.stopPropagation();
    if (!('speechSynthesis' in window)) {
        alert('Trình duyệt không hỗ trợ phát âm.');
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find(voice => voice.lang && voice.lang.toLowerCase().startsWith('ko'));
    if (koreanVoice) utterance.voice = koreanVoice;
    window.speechSynthesis.speak(utterance);
}

function escapeHtml(value = '') {
    return String(value).replace(/[&<>"]/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
    }[char]));
}

function resolveAssetUrl(url = '') {
    if (!url || url.startsWith('http') || url.startsWith('data:')) return url;
    const base = (window.HANLINGUA_API_URL || '').replace(/\/$/, '');
    return base ? `${base}${url.startsWith('/') ? url : `/${url}`}` : url;
}

function formatSuggestionMessage(error) {
    if (!error?.suggestions?.length) return error.message;
    return `${error.message} Gợi ý: ${error.suggestions.join(', ')}`;
}
