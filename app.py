from flask import Flask, render_template, request, jsonify, send_from_directory
import requests
import sqlite3
import os
import logging

# Enable logging for Flask app
logging.basicConfig(level=logging.DEBUG)

# Create a database (or connect if it already exists)
def create_db():
    conn = sqlite3.connect('user_history.db')
    c = conn.cursor()
    
    # Create table for storing user queries (route + weather)
    c.execute(''' 
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            query_type TEXT,
            query_data TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

# Call this function once to create the DB and table
create_db()

def save_user_history(user_id, query_type, query_data):
    conn = sqlite3.connect('user_history.db')
    c = conn.cursor()
    try:
        c.execute(''' 
            INSERT INTO history (user_id, query_type, query_data)
            VALUES (?, ?, ?)
        ''', (user_id, query_type, query_data))
        conn.commit()
        print(f"History saved for user_id: {user_id}, query_type: {query_type}, query_data: {query_data}")
    except Exception as e:
        print(f"Error saving history: {e}")
    finally:
        conn.close()

app = Flask(__name__, static_folder='.', static_url_path='')

# Route/ETA handler (route query is passed from frontend)
@app.route('/get_route', methods=['GET'])
def get_route():
    startCoords = request.args.get('startCoords')
    endCoords = request.args.get('endCoords')

    if not startCoords or not endCoords:
        return jsonify({"error": "Missing start or end coordinates"}), 400

    eta = "30 minutes"  # Mock ETA

    user_id = "some_user_id"
    query_type = "route"
    query_data = f"Start: {startCoords}, End: {endCoords}"

    save_user_history(user_id, query_type, query_data)

    return jsonify({"eta": eta})

# Weather handler (weather query is passed from frontend)
WEATHER_API_KEY = "6efb29efee2b4ba988c155930251804"

@app.route('/get_weather', methods=['GET'])
def get_weather():
    location = request.args.get('location')
    date = request.args.get('date')
    if not location or not date:
        return jsonify({"error": "Missing location or date"}), 400

    url = f"https://api.weatherapi.com/v1/history.json?key={WEATHER_API_KEY}&q={location}&dt={date}"

    try:
        response = requests.get(url)
        data = response.json()
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to fetch weather data: {str(e)}"}), 500

    try:
        user_id = "some_user_id"
        query_type = "weather"
        query_data = f"Location: {location}, Date: {date}"

        save_user_history(user_id, query_type, query_data)

        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Route to save user history (POST request from frontend)
@app.route('/save_history', methods=['POST'])
def save_history():
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        query_type = data.get('query_type')
        query_data = data.get('query_data')

        if not user_id or not query_type or not query_data:
            return jsonify({"error": "Missing required fields"}), 400

        save_user_history(user_id, query_type, query_data)

        return jsonify({"success": True}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Final version of the /history route (only one)
@app.route('/history')
def history():
    try:
        conn = sqlite3.connect('user_history.db')
        c = conn.cursor()
        c.execute("SELECT * FROM history")
        rows = c.fetchall()
        conn.close()

        app.logger.debug("Rows from DB: %s", rows)

        return render_template('history.html', rows=rows)
    except Exception as e:
        app.logger.error("Error fetching history: %s", str(e))
        return "Internal Server Error", 500

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    app.run(debug=True)
