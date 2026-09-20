# Belegeinreichungen (Submissions) — Design-Notiz

Stand: Umsetzung des Domains „Belegeinreichungen“ (Expenses & Income). Diese Notiz
hält die Design-Entscheidungen fest, die im Gespräch mit dem Product Owner
getroffen wurden, und die Stellen, die bewusst **nicht** implementiert sind.

## 1. Domäne

Eine **Submission** (`organizations/{organization}/submissions/{submission}`)
dokumentiert entweder eine **Ausgabe** (`direction = EXPENSE`) oder eine
**Einnahme** (`direction = INCOME`).

Ausgaben tragen genau einen von drei **Abrechnungswegen** (Settlement):

| Settlement | Bedeutung | Lifecycle | erfasste Daten |
|---|---|---|---|
| `PERSON` | privat vorgestreckt → Auszahlung an die Person | DRAFT → PENDING → APPROVED → COMPLETED (+ FURTHER_INFO_REQUIRED / REJECTED) | Auszahlungsart (Überweisung/Bar), Bankverbindung |
| `COMMITTEE_ACCOUNT` | bereits vom Gremiumskonto/-kasse bezahlt | DRAFT → PENDING → COMPLETED (Freigabe = Abschluss) | Zahlungskonto des Gremiums, Zahlungsdatum, Referenz |
| `PAYMENT_REQUEST` | noch nicht bezahlt → Kassenführung zahlt Empfänger | DRAFT → PENDING → APPROVED → COMPLETED | Empfänger, IBAN/BIC, Timing (auf Rechnung/Vorkasse) |

Einnahmen sind reine Dokumentation („wie ist dieses Geld entstanden?“) — **es
findet keine Verrechnung statt**, daher kein Settlement und kein Auszahlungs-
Schritt. Lifecycle: DRAFT → PENDING → COMPLETED.

### Bewusste Entscheidungen

- **Kein `PAID`-Status.** „Bezahlt“ und „Abgeschlossen“ unterscheiden sich nur
  durch den Eingang der Paper-Originale — das ist ein Merkmal je Beleg
  (`original_receive_time` am Item), kein eigener Status. `:complete`
  übernimmt die Zahlungsmetadaten (`paid_date`, `payment_reference`).
- **Drafts sind derselbe Ressourcentyp** (`SUBMISSION_STATUS_DRAFT`), keine
  eigene Entität. Die tatsächliche Erstellung passiert serverseitig beim
  Start des Assistenten — die SPA kann jederzeit sterben, ohne Daten zu
  verlieren; Anhänge hängen von Anfang an am Item und müssen nicht
  „übertragen“ werden. `:submit` validiert die Vollständigkeit und geht auf
  PENDING. Drafts erscheinen im List nur bei explizitem Status-Filter.
- **Keine Ledger-Anbindung.** vsfv ist nicht die Buchhaltung; Ist-Werte
  kommen aus der externen Finanzbuchhaltung über den Import. Submissions
  erzeugen **keine** Buchungen und referenzieren keine LedgerAccounts.
- **Generalisierung vor Projekt-Spezifik:** Abrechnungswege sind ein
  fester, erweiterbarer Enum; *ob* ein Weg verfügbar ist, ist
  **Organisations-Konfiguration** (`submission_settings`), kein Code-Branch.
  Z. B. Verbandsstrukturen mit nur einem zentralen Konto deaktivieren
  `COMMITTEE_ACCOUNT` schlicht über die Einstellungen.
- **Scope (hoheitlich/gewerblich)** ist für alle Richtungen und Wege möglich.
  Ob die Einreichende Person wählen darf, steuert
  `Committee.allow_scope_selection` (default: aus ⇒ immer hoheitlich).
  Nachträglich kann der Scope nur mit der vollen
  `submissions:update`-Berechtigung geändert werden — **nicht** mit
  `update_own` (serverseitig erzwungen).

## 2. Konfiguration

- `Organization.submission_settings`
  (`enabled_settlement_kinds`, `submission_deadline`) — gespeichert als
  **typisierte 1:1-Tabelle** `organization_submission_settings` (Muster:
  `UserSettings`), bewusst **nicht** als JSONB.
- `Committee.allow_scope_selection` und
  `Committee.payment_accounts[]` (`BANK_ACCOUNT` | `CASH_BOX` + Label).
  `COMMITTEE_ACCOUNT` ist pro Gremium verfügbar, sobald mindestens ein
  Zahlungskonto hinterlegt ist. Kassenwahl im Wizard zeigt den
  Kassenbuch-Hinweis plus Pflicht-Erklärung.
- Deadline-Überschreitung: ein Hintergrund-Sweeper
  (`submission-decay.interval`, Standard 1h) lehnt PENDING/FURTHER_INFO-
  Submissions ab (Systemkommentar + Audit-Eintrag). Drafts und APPROVED
  sind ausgenommen; Erzeugen/Einreichen nach der Deadline schlägt mit
  FAILED_PRECONDITION fehl (volle Update-Berechtigung umgeht das).

## 3. Berechtigungsmodell

- Scopes: `submissions:read` / `submissions:write` (alt `reimbursements:*`
  ersetzt), zusätzlich `committees:*`.
- Actions: `create`, `read`, `read_own`, `update`, `update_own`,
  `comment`, `comment_own`, `delete`. `*_own` gilt nur für die
  einreichende Person (`created_by_user`).
- Statusübergänge (approve/reject/requestFurtherInfo/complete) erfordern
  die volle Update-Berechtigung (Kassenführung).

## 4. AIP-Konformität (geprüft gegen google.aip.dev)

- Standardmethoden gemäß AIP-131…135; `submission_id` als nutzer-
  setzbare ID bei Create (AIP-133); `update_mask` bei Update (AIP-134).
- **Status ist nie im Update-Mask** schreibbar (AIP-134: State-Felder
  nicht direkt beschreibbar) — Übergänge sind Custom Methods (`:submit`,
  `:approve`, `:reject`, `:requestFurtherInfo`, `:complete`, `:undelete`).
- Items und Comments sind **echte Sub-Resources** mit eigenem CRUD
  (AIP-133/136); kein „merge-by-uid“ im Parent-Update.
- Soft Delete nach AIP-164: `delete_time` + `purge_time`, Delete
  liefert die Ressource, Get liefert Soft-Gelöschtes, List mit
  `show_deleted`, `:undelete` vorhanden. Read-time-Purge nach 90 Tagen;
  `:expunge` und Purge-Job sind entworfen, nicht gebaut.
- AIP-142-Namensgebung: `paid_date` (google.type.Date),
  `original_receive_time`; AIP-140-Feldnamen (u. a. Booleans ohne
  `is`-Präfix); Enums englisch mit Präfix (`SCOPE_NONPROFIT`/
  `SCOPE_COMMERCIAL`, `DIRECTION_*`, `SETTLEMENT_*`,
  `SUBMISSION_STATUS_*`).
- Etag wird serverseitig berechnet und bei Update/Delete erzwungen
  (ABORTED bei Mismatch).
- Committee-Delete schlägt mit FAILED_PRECONDITION fehl, solange
  Submissions referenzieren; Label-Snapshots halten historische
  Einreichungen lesbar.

Bekannte, bewusst beibehaltene Abweichungen im Bestand (nicht neu
nachgezogen): `booked_at`/`document_date` in transaction.proto, dort
unbefüllte etags, `total_size` in List-Responses.

## 5. Binär-Anhänge über die Huma-Exception-API

Anhänge sind **bewusst nicht in protobuf**: Metadaten als JSON, Bytes als
Upload/Download — betrieben als Huma-Endpunkte
(`pkg/api/attachments/`), registriert in `pkg/api/router.go` **vor** dem
grpc-gateway-`/api/v1/*`-Catch-all (Fiber matched in
Registrierungsreihenfolge; das ist derselbe Mechanismus, über den auch
die XML-Import/Export-Routen funktionieren — der Nachweis lief
über die Umstellung von xmlformat auf Huma).

- Endpunkte (AIP-Namenskonventionen, snake_case-Pfadparameter):
  - `POST …/items/{item_id}/attachments` (multipart, 10 MiB, PDF/JPEG/PNG)
  - `GET …/items/{item_id}/attachments` und `GET …/attachments/{attachment_id}` (Metadaten)
  - `GET …/attachments/{attachment_id}/download` (Bytes)
  - `DELETE …/attachments/{attachment_id}`
  - **Kein `:verb`-Suffix** am Download: Fiber kann
    `{param}:verb`-Suffixe in einem Pfadsegment nicht auflösen (verifiziert);
    daher der Unterpfad `/download`.
- Auth über `pkg/api/humax` (gemeinsamer Bearer-Middleware-Primitiv,
  Legacy-Fehlerform `{"error": ...}` für die SPA).
- Storage: lokales Verzeichnis (`storage.attachments-path`), Keys =
  UUID + Extension.

Auch die XML-Import/Export-Routen wurden auf Huma umgestellt
(identische Pfade/Verhalten, jetzt selbstdokumentierend über `/openapi`).

## 6. Entwurf für später (nicht implementiert)

- **Kassenbuch-Abgabe** als eigene periodische Entität je Gremium
  (Zeitraum, Anfangs-/Endbestand, Posten mit Verweis auf Submissions,
  Anhang, Prüfung durch die Kassenführung).
- **E-Mail-Antworten** auf Rückfragen automatisch als Kommentare
  einziehen (kommentierbare uid als Thread-Referenz, späteres
  `origin`-Feld) und **Benachrichtigungen** für nutzer-sichtbare
  Kommentare.
- Archive/Restore-Verben, `:expunge` + Purge-Job,
  Settings-Editor-UI, Gremienverwaltungs-UI,
  Finanzantrag-Anbindung, pro Gremium konfigurierbare
  Scope-Modi (fest hoheitlich / frei / fest gewerblich).
