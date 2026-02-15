# Använd Python 3.9 som base image
FROM python:3.9-slim

# Sätt arbetskatalogen
WORKDIR /app

# Kopiera requirements.txt och installera beroenden
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kopiera alla projektfiler
COPY . .

# Exponera port 5000 (Flask default port)
EXPOSE 5000

# Miljövariabler
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV PORT=5000

# Starta Flask-servern
CMD ["python", "app.py"]

