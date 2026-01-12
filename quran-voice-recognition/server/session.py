# session.py
from dataclasses import dataclass

@dataclass
class Session:
    word_pos: int = 0
    confidence: float = 1.0

class SessionManager:
    def __init__(self):
        self.sessions = {}

    def get(self, sid):
        if sid not in self.sessions:
            self.sessions[sid] = Session()
        return self.sessions[sid]

    def update(self, sid, new_pos):
        s = self.get(sid)
        s.word_pos = max(s.word_pos, new_pos)
# ================= UTILITIES =================