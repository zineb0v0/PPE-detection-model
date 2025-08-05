import sqlite3
from datetime import datetime

DB_FILE = "alerts_history.db"

def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                time TEXT NOT NULL,
                message TEXT NOT NULL,
                status TEXT NOT NULL
            )
        """)
        conn.commit()

def insert_alert(message, status):
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("INSERT INTO alerts (time, message, status) VALUES (?, ?, ?)",
                  (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), message, status))
        conn.commit()

def get_alert_history(limit=50):
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("SELECT time, message, status FROM alerts ORDER BY id DESC LIMIT ?", (limit,))
        return c.fetchall()
