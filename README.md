# VS-Finanzverwaltung

[![GitHub Release](https://img.shields.io/github/v/release/pixlcrashr/vsfv)](https://github.com/pixlcrashr/vsfv/releases/latest)
[![Docker Image Version](https://img.shields.io/docker/v/pixlcrashr/vsfv)](https://hub.docker.com/r/pixlcrashr/vsfv)
[![Docker Image Size (tag)](https://img.shields.io/docker/image-size/pixlcrashr/vsfv/latest)](https://hub.docker.com/r/pixlcrashr/vsfv)
[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/pixlcrashr/vsfv/build.yml)](https://github.com/pixlcrashr/vsfv/actions/workflows/build.yml)
[![GitHub License](https://img.shields.io/github/license/pixlcrashr/vsfv)](https://github.com/pixlcrashr/vsfv/blob/main/LICENSE)



Finanzverwaltungssoftware für Verfasste Studierendenschaften.

## Features

- Haushaltsplanung
    - Integration von Doppelter Buchführung als Single Source of Truth (SSoT)
    - Zuordnung von SSoT-Buchungen zu Haushaltskonten und Anträgen, bzw. beschlossenen Geldern
    - Errechnung von Ist-Werten durch SSoT
    - Verschachtelte Haushaltskonten
    - Übersichtliche Darstellung des Haushaltsplans
    - Export des Haushaltsplans
- Antragsverwaltung
    - Vorlagenverwaltung für Anträge
    - Zuordnung von (Finanz-)Anträgen zu Haushaltskonten
- SSO/OAuth2 Authentifizierung
- Benutzer- und Rechteverwaltung

## Fastify Server

This app has a minimal [Fastify server](https://fastify.dev/) implementation. After running a full build, you can preview the build using the command:

```
npm run serve
```

Then visit [http://localhost:3000/](http://localhost:3000/)
