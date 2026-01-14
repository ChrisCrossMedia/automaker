/**
 * "Akzeptanzkriterien" Enhancement Mode
 * Fügt testbare Akzeptanzkriterien zu Aufgabenbeschreibungen hinzu.
 */

import type { EnhancementExample } from '@automaker/types';

/**
 * System-Prompt für den "akzeptanzkriterien" Enhancement-Modus.
 * Fügt testbare Akzeptanzkriterien zu Aufgabenbeschreibungen hinzu.
 */
export const ACCEPTANCE_SYSTEM_PROMPT = `Du bist ein QA-Spezialist, der sich darauf spezialisiert hat, testbare Akzeptanzkriterien für Software-Features zu definieren.

WICHTIG: Antworte IMMER auf Deutsch!

Deine Aufgabe ist es, eine Aufgabenbeschreibung durch klare Akzeptanzkriterien zu erweitern:

1. VERSTEHE das Feature:
   - Identifiziere alle benutzersichtbaren Verhaltensweisen
   - Notiere Systemzustandsänderungen
   - Berücksichtige verschiedene Benutzerrollen oder Szenarien

2. DEFINIERE Akzeptanzkriterien im GEGEBEN-WENN-DANN Format:
   - Gegeben: Der initiale Kontext oder Vorbedingungen
   - Wenn: Die Aktion oder der Auslöser
   - Dann: Das erwartete Ergebnis

3. DECKE wichtige Szenarien AB:
   - Erfolgspfad (erfolgreicher Abschluss)
   - Grenzfälle (Randbedingungen)
   - Fehlerszenarien (was NICHT passieren sollte)
   - Performance-Anforderungen falls relevant

4. MACHE Kriterien testbar:
   - Verwende spezifische, messbare Ergebnisse
   - Vermeide vage Begriffe wie "schnell" oder "einfach"
   - Füge spezifische Werte hinzu wo anwendbar

Gib die ursprüngliche Beschreibung gefolgt von einem klaren "Akzeptanzkriterien:"-Abschnitt mit nummerierten, testbaren Kriterien aus. Füge keine Erklärungen zu deinem Prozess hinzu.`;

/**
 * Beispiele für den "akzeptanzkriterien" Enhancement-Modus
 */
export const ACCEPTANCE_EXAMPLES: EnhancementExample[] = [
  {
    input: 'Passwort-Zurücksetzung hinzufügen',
    output: `Passwort-Zurücksetzungsfunktion hinzufügen

Ermögliche Benutzern, ihr Passwort per E-Mail zurückzusetzen, wenn sie es vergessen haben.

Akzeptanzkriterien:

1. Gegeben ein Benutzer ist auf der Login-Seite, wenn er auf "Passwort vergessen" klickt, dann sollte er ein Passwort-Zurücksetzungsformular sehen, das seine E-Mail anfordert.

2. Gegeben ein Benutzer gibt eine gültige registrierte E-Mail ein, wenn er das Formular absendet, dann sollte er innerhalb von 2 Minuten eine Passwort-Zurücksetzungs-E-Mail erhalten.

3. Gegeben ein Benutzer klickt auf den Zurücksetzungslink in seiner E-Mail, wenn der Link weniger als 1 Stunde alt ist, dann sollte er ein Formular zur Eingabe eines neuen Passworts sehen.

4. Gegeben ein Benutzer gibt ein neues gültiges Passwort ein (min. 8 Zeichen, 1 Zahl, 1 Sonderzeichen), wenn er absendet, dann sollte sein Passwort aktualisiert werden und er sollte zum Login weitergeleitet werden.

5. Gegeben ein Benutzer gibt eine nicht registrierte E-Mail ein, wenn er das Zurücksetzungsformular absendet, dann sollte er dieselbe Erfolgsmeldung sehen (Sicherheit: nicht preisgeben welche E-Mails existieren).

6. Gegeben ein Zurücksetzungslink älter als 1 Stunde, wenn ein Benutzer ihn anklickt, dann sollte er eine Ablaufmeldung mit Option zur Anforderung eines neuen Links sehen.`,
  },
  {
    input: 'Warenkorb-Checkout',
    output: `Warenkorb-Checkout

Implementiere den Checkout-Ablauf für den Kauf von Artikeln im Warenkorb.

Akzeptanzkriterien:

1. Gegeben ein Benutzer hat Artikel in seinem Warenkorb, wenn er auf "Zur Kasse" klickt, dann sollte er eine Bestellübersicht mit Artikeldetails und Gesamtpreis sehen.

2. Gegeben ein Benutzer ist auf der Checkout-Seite, wenn er gültige Versandinformationen eingibt, dann sollte das Formular in Echtzeit validieren und das geschätzte Lieferdatum anzeigen.

3. Gegeben gültige Versandinfos sind eingegeben, wenn der Benutzer zur Zahlung fortfährt, dann sollte er verfügbare Zahlungsmethoden sehen (Kreditkarte, PayPal).

4. Gegeben gültige Zahlungsdetails sind eingegeben, wenn der Benutzer die Bestellung bestätigt, dann sollte die Zahlung verarbeitet und die Bestellbestätigung innerhalb von 5 Sekunden angezeigt werden.

5. Gegeben eine erfolgreiche Bestellung, wenn die Bestätigung angezeigt wird, dann sollte der Benutzer eine E-Mail-Quittung erhalten und sein Warenkorb sollte geleert werden.

6. Gegeben ein Zahlungsfehler, wenn der Fehler auftritt, dann sollte der Benutzer eine klare Fehlermeldung sehen und sein Warenkorb sollte intakt bleiben.

7. Gegeben der Benutzer schließt den Browser während des Checkouts, wenn er zurückkehrt, dann sollte sein Warenkorbinhalt weiterhin verfügbar sein.`,
  },
];

/**
 * Beschreibung dessen, was dieser Enhancement-Modus macht
 */
export const ACCEPTANCE_DESCRIPTION =
  'Füge testbare Akzeptanzkriterien zu Aufgabenbeschreibungen hinzu';
