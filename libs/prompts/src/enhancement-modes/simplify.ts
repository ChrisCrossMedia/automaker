/**
 * "Vereinfachen" Enhancement Mode
 * Macht ausführliche Beschreibungen prägnant und fokussiert.
 */

import type { EnhancementExample } from '@automaker/types';

/**
 * System-Prompt für den "vereinfachen" Enhancement-Modus.
 * Macht ausführliche Beschreibungen prägnant und fokussiert.
 */
export const SIMPLIFY_SYSTEM_PROMPT = `Du bist ein Experten-Redakteur, der sich darauf spezialisiert hat, ausführliche Texte prägnant zu machen ohne Bedeutung zu verlieren.

WICHTIG: Antworte IMMER auf Deutsch!

Deine Aufgabe ist es, eine Aufgabenbeschreibung zu vereinfachen und dabei wesentliche Informationen zu bewahren:

1. IDENTIFIZIERE die Kernbotschaft:
   - Extrahiere das primäre Ziel oder die Anforderung
   - Notiere wirklich wesentliche Details
   - Trenne "Wäre schön" von "Muss sein" Informationen

2. ELIMINIERE Redundanz:
   - Entferne wiederholte Informationen
   - Streiche unnötige Qualifizierer und vage Formulierungen
   - Entferne Füllwörter und -phrasen

3. KONSOLIDIERE verwandte Punkte:
   - Führe überlappende Anforderungen zusammen
   - Gruppiere verwandte Elemente
   - Verwende prägnante Sprache

4. BEWAHRE kritische Details:
   - Behalte spezifische technische Anforderungen
   - Bewahre wichtige Einschränkungen
   - Erhalte umsetzbare Spezifika

Gib NUR die vereinfachte Beschreibung aus. Strebe eine 30-50% Reduktion der Länge an, während alle wesentlichen Informationen erhalten bleiben. Erkläre deine Änderungen nicht.`;

/**
 * Beispiele für den "vereinfachen" Enhancement-Modus
 */
export const SIMPLIFY_EXAMPLES: EnhancementExample[] = [
  {
    input: `Wir müssen ein Feature implementieren, das unseren Benutzern ermöglicht, ihre Daten in verschiedenen unterschiedlichen Formaten zu exportieren. Die Formate, die wir in Betracht ziehen zu unterstützen, umfassen CSV, das häufig für Tabellenkalkulations-Anwendungen verwendet wird, und auch JSON, das gut für Entwickler ist, und möglicherweise PDF für Leute, die eine druckbare Version wollen. Der Benutzer sollte irgendwo in der UI ein Format auswählen können und dann seine Daten in diesem Format herunterladen. Wir sollten wahrscheinlich auch eine Art Fortschrittsanzeige zeigen, während der Export läuft, da es bei großen Datensätzen eine Weile dauern könnte.`,
    output: `Datenexport-Feature hinzufügen

Ermögliche Benutzern, ihre Daten im CSV-, JSON- oder PDF-Format zu exportieren.

Anforderungen:
- Füge Export-Button/Menü in der UI hinzu
- Unterstütze drei Formate: CSV (Tabellen), JSON (Entwickler), PDF (Drucken)
- Zeige Fortschrittsanzeige während Export
- Behandle große Datensätze elegant`,
  },
  {
    input: `Das aktuelle Benachrichtigungssystem funktioniert nicht sehr gut und Benutzer beschweren sich darüber. Manchmal erhalten sie überhaupt keine Benachrichtigungen, und manchmal erhalten sie zu viele Benachrichtigungen und fühlen sich überwältigt. Wir haben auch Berichte erhalten, dass die Benachrichtigungen auf mobilen Geräten nicht korrekt angezeigt werden. Zusätzlich haben einige Benutzer die Möglichkeit angefordert, anzupassen welche Arten von Benachrichtigungen sie erhalten. Wir sollten uns all diese Probleme ansehen und das Benachrichtigungssystem insgesamt besser machen.`,
    output: `Benachrichtigungssystem reparieren und verbessern

Behebe Zuverlässigkeitsprobleme und füge Benutzerkontrollen für Benachrichtigungen hinzu.

Zu behebende Probleme:
- Fehlende Benachrichtigungen (Zustellzuverlässigkeit)
- Benachrichtigungsüberflutung (implementiere Bündelung/Zusammenfassung)
- Mobile Anzeigeprobleme

Erweiterungen:
- Füge Benachrichtigungspräferenzen hinzu (Kontrollen pro Typ)
- Teste auf verschiedenen Geräten und Plattformen`,
  },
];

/**
 * Beschreibung dessen, was dieser Enhancement-Modus macht
 */
export const SIMPLIFY_DESCRIPTION = 'Mache ausführliche Beschreibungen prägnant und fokussiert';
