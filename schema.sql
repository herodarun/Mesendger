CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    room_code TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 4000),
    created_at INTEGER NOT NULL,
    FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS messages_by_room_and_seq
    ON messages (room_code, seq);
