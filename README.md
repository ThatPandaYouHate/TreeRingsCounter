# Tree Rings Counter - Webserver

En Python-webserver för Tree Rings Counter webbapplikationen.

## Installation

1. Installera Python-beroenden:
```bash
pip install -r requirements.txt
```

## Användning

### Lokal utveckling

Starta servern:
```bash
python app.py
```

Eller med Python 3:
```bash
python3 app.py
```

Servern kommer att starta på `http://localhost:5000`

Öppna din webbläsare och gå till:
```
http://localhost:5000
```

### Docker

#### Bygg Docker-image lokalt:
```bash
docker build -t tree-rings-counter .
```

#### Kör Docker-containern:
```bash
docker run -p 5000:5000 tree-rings-counter
```

Servern kommer att vara tillgänglig på `http://localhost:5000`

## GitHub Actions

När koden pushas till `main`-branchen på GitHub, byggs automatiskt en Docker-container via GitHub Actions. Den byggda containern pushas till GitHub Container Registry (GHCR).

### Använda den byggda containern från GHCR:

```bash
docker pull ghcr.io/[ditt-användarnamn]/TreeRingsCounter:latest
docker run -p 5000:5000 ghcr.io/[ditt-användarnamn]/TreeRingsCounter:latest
```

## Funktioner

- Servar `index.html` som huvudsida
- Servar alla statiska filer (JavaScript, bilder, etc.)
- Automatisk omladdning vid kodändringar (debug-läge i utveckling)
- Docker-stöd för enkel deployment
- Automatisk Docker-build vid push till main

## Stoppa servern

Tryck `Ctrl+C` i terminalen för att stoppa servern (lokalt) eller `docker stop [container-id]` för Docker.

