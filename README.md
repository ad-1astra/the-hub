# National ICT Innovation Hub – 3D

Interactive 3D model of the Hub building, its rooms and walk-throughs, built with three.js.

- `index.html` – gallery / entry page
- `building/` – full building model (`building/index.html`)
- `rooms/`, `walk/`, `walkbaked/`, `tour/`, `guide/`, `upper-floor/`, `lite/` – room pages, walk modes and lighter versions

Plain static site: no build step. To run locally:

```
python -m http.server 8000
```

then open http://127.0.0.1:8000/.

**Render:** New → Static Site, Build Command empty, Publish Directory `.`
