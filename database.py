import sqlite3

DB_NAME = "bot.db"


def connect():
    return sqlite3.connect(DB_NAME)


def init_db():
    conn = connect()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            balance INTEGER DEFAULT 0
        )
    """)

    conn.commit()
    conn.close()


def add_user(user_id, username=None):
    conn = connect()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT OR IGNORE INTO users (user_id, username, balance)
        VALUES (?, ?, 0)
    """, (user_id, username))

    conn.commit()
    conn.close()


def get_user(user_id):
    conn = connect()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT user_id, username, balance FROM users WHERE user_id = ?",
        (user_id,)
    )

    user = cursor.fetchone()
    conn.close()

    return user


def get_balance(user_id):
    user = get_user(user_id)

    if user:
        return user[2]

    return 0


def set_balance(user_id, balance):
    conn = connect()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE users
        SET balance = ?
        WHERE user_id = ?
    """, (balance, user_id))

    conn.commit()
    conn.close()


def add_balance(user_id, amount):
    conn = connect()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE users
        SET balance = balance + ?
        WHERE user_id = ?
    """, (amount, user_id))

    conn.commit()
    conn.close()
