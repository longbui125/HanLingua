import difflib
import re

def evaluate_dictation(original_text, user_input):
    def contains_korean(text):
        return bool(re.search(r'[가-힣]', text or ''))

    def clean_word(word):
        word = word.lower() 
        return re.sub(r'[.,!?~"\'\(\)\[\]\{\}\-\s]+', '', word).strip()

    def tokenize(text):
        words = [w for w in text.split() if w.strip()]
        if contains_korean(text) and len(words) <= 1:
            compact = clean_word(text)
            return list(compact)
        return words

    orig_words = tokenize(original_text)
    user_words = tokenize(user_input)
    
    orig_clean = [clean_word(w) for w in orig_words]
    user_clean = [clean_word(w) for w in user_words]

    matcher = difflib.SequenceMatcher(None, orig_clean, user_clean)
    feedback = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            for word in orig_words[i1:i2]:
                feedback.append({"word": word, "status": "correct"})
        elif tag == 'replace':
            for word in user_words[j1:j2]:
                feedback.append({"word": word, "status": "wrong_user"})
            for word in orig_words[i1:i2]:
                feedback.append({"word": word, "status": "hint"})
        elif tag == 'delete':
            for word in orig_words[i1:i2]:
                feedback.append({"word": word, "status": "missing"})
        elif tag == 'insert':
            for word in user_words[j1:j2]:
                feedback.append({"word": word, "status": "wrong_user"})
    
    correct_count = sum(1 for item in feedback if item["status"] == "correct")
    max_len = max(len(orig_words), len(user_words))
    score = int((correct_count / max_len) * 100) if max_len else 0
    
    return {"score_percent": score, "feedback": feedback}
