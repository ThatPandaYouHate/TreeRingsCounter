#!/usr/bin/env python3
"""
Python webserver för Tree Rings Counter webbplats
Använder Flask för att serva statiska filer och HTML
"""

from flask import Flask, send_from_directory
import os

app = Flask(__name__)

# Hämta projektets rotkatalog
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.route('/')
def index():
    """Servar huvudsidan"""
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Servar statiska filer (JS, CSS, bilder, etc.)"""
    return send_from_directory(BASE_DIR, filename)

if __name__ == '__main__':
    # Hämta port från miljövariabel eller använd 5000 som standard
    port = int(os.environ.get('PORT', 5000))
    # Hämta debug-läge från miljövariabel (False i produktion)
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    
    print("=" * 50)
    print("Tree Rings Counter - Webserver")
    print("=" * 50)
    print(f"Server startar på: http://0.0.0.0:{port}")
    print("Tryck Ctrl+C för att stoppa servern")
    print("=" * 50)
    
    # Starta servern
    # host='0.0.0.0' gör att servern är tillgänglig från alla nätverksgränssnitt (viktigt för Docker)
    app.run(host='0.0.0.0', port=port, debug=debug)

