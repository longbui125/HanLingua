import difflib
import re

def evaluate_dictation(original_text, user_input):
    def clean_word(word):
        word = word.lower() 
        return re.sub(r'[.,!?~"\'\(\)\[\]\{\}\-\s]+', '', word).strip()

    orig_words = [w for w in original_text.split() if w.strip()]
    user_words = [w for w in user_input.split() if w.strip()]
    
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