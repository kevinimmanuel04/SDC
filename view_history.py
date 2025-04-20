import sqlite3

conn = sqlite3.connect('user_history.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()

print("📋 Tables found:")
for t in tables:
    print(f" - {t[0]}")

for table_name in tables:
    print(f"\n🔍 Data from table: {table_name[0]}")
    cursor.execute(f"SELECT * FROM {table_name[0]}")
    rows = cursor.fetchall()
    col_names = [desc[0] for desc in cursor.description]
    
    print("Columns:", col_names)
    for row in rows:
        print(row)

conn.close()
