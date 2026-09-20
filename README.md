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
- Belegeinreichungen
    - Geführte Einreichung von Ausgaben (Auslagenerstattung, Zahlung aus Gremiumskonto/-kasse, Zahlungsauftrag an die Kassenführung) und Einnahmebelegen
    - Entwürfe, Fristen (Deadlines mit automatischer Ablehnung), Kommentare und Prüfworkflow
- SSO/OAuth2 Authentifizierung
- Benutzer- und Rechteverwaltung

## Architektur / API

Die Haupt-API ist eine protobuf-first HTTP/JSON-API unter `/api/v1` (grpc-gateway, generiert aus `proto/`; OpenAPI-Spezifikation in `openapi.swagger.yaml`). Routen, die sich nicht als protobuf-CRUD ausdrücken lassen (z. B. Binär-Uploads/-Downloads), werden als Huma-Endpunkte betrieben und über Humas OpenAPI-Endpunkt (`/openapi`) selbstdokumentiert.
