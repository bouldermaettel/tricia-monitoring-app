**Beschreibung des geplanten Monitoring-Tools**

Das geplante **Monitoring-Tool** dient der strukturierten Erfassung, Validierung und Überwachung von Klassifikationsresultaten sowie deren Qualität über die Zeit. Zentrales Element ist die Generierung und Analyse von **Confusion Matrices**, ergänzt durch diverse Kontroll‑, Filter‑ und Auswertungsmöglichkeiten. Das Tool unterstützt sowohl operative Nutzer (WiMi) als auch kontrollierende Rollen.

**1. Aufbau und Hauptmasken**

Das Tool besteht aus **drei zentralen Masken (Dashboards)**:

1. **Eingabemaske für WiMi**

- **Erfassung und Validierung einzelner Fälle**
- **Fokus auf einfache, schnelle Eingabe ohne redundante Felder**

3. **Matrix‑Dashboard (Confusion Matrix mit Dokumentationsmöglichkeiten)**

- **Darstellung und Analyse der Confusion Matrices**
- **Möglichkeit zur vertieften Analyse, Kommentierung und Kategorisierung**

5. **Kontroll‑Dashboard**

- **Überprüfung der Durchführung durch die WiMis (ob Arbeiten fristgerecht erledigt wurden)**

**2. Eingabe‑Dashboard für Nutzer**

Das Eingabe‑Dashboard unterstützt die strukturierte Erfassung eines Falls und enthält unter anderem:

- **Vk‑Nummer**
- **Device Name**
- **S, P, D Werte von Tricia**
- **S, D Werte des Users**

- Bestätigung der Validierung per Knopfdruck, falls keine Werte korrigiert werden müssen, wird S und D werden übernommen
- Abschliessen der Validierung über Save
- Input mam: wie macht man das am geschicktesten, dass es möglichst einfach ist für die WiMis ohne grossen Mehraufwand, wenn die Werte übernommen werden

- mam: User Management Minimal

- **Automatisch miterfasste Daten**

- Datum der Eingabe
- Datum für die rollende Analyse (automatisch aus der Vk‑Nummer abgeleitet)
- Registrierender User (automatisch wenn möglich, alternativ eigenes Feld)

- Bei erneuter Eingabe derselben Vk-Nummer soll ein Dialog erscheinen, welcher erlaubt:

- Die zuvor eingegebenen Werte zu Korrigieren
- Den Prozess abzubrechen

**3. Matrix‑Dashboard (Monitoring & Detailanalyse)**

Das Matrix‑Dashboard ist eng mit den Confusion Matrices verknüpft und erlaubt eine detaillierte Kontrolle einzelner Fälle.

Das Tool ermöglicht eine **rollende Analyse** der Confusion Matrices über definierte Zeiträume:

- **Fixe Auswertungsintervalle**

- letzte 3 Monate
- letzte 6 Monate
- letzte 12 Monate
- _All_: alle Werte seit Einführung des Tools

- **Manuelle Auswertung**

- Freie Eingabe eines individuellen Zeitraums
- Rollende Berechnung der Confusion Matrix basierend auf diesem Zeitraum

Alle Auswertungen erfolgen im **gleichen Dashboard**. Die Steuerung des Analyseintervalls erfolgt über ein **Dropdown**, das die Auswahl der fixen Intervalle vereinfacht und optional die manuelle Zeitraumsauswahl erlaubt.

Das Tool zeigt die Confusion Matrix der Ausgewählten Periode und alle Fälle der Auswertungsperiode in einer Tabelle daneben.

**3.1 Spalten Fallliste**

- Device
- Tricia S
- WiMi S
- Tricia D
- WiMi D
- Kategorie
- Kommentar
- Markierung als Streichresultat
- Markierung als Überprüft

**3.2 Fallisolierung und Problemfokus**

- Möglichkeit, Fälle aus bestimmten **Quadranten der Confusion Matrix** zu isolieren und als Liste darzustellen mittels Klick auf den Quadranten
- **Toggle‑Switch**:

- Anzeige aller Fälle
- Anzeige nur problematischer Fälle  
    (Definition: Abweichung von mindestens zwei Klassen zwischen WiMi und Tricia)

- Inklusion oder Exklusion der Streichresultate für die Auswertung
- Optionale Fokussierung auf **falsche Klassifikationen**, **falsch tiefe Klassifikationen** (hohes Risiko) oder **falsch hohe Klassifikationen** (tiefes Risiko)

**3.3 Listenfunktionen**

Für jeden einzelnen Wert in der Liste sind folgende Funktionen vorgesehen:

- Markierung als „überprüft“
- Hinzufügen eines **Kommentars**
- Markierung als Streichresultat
- Kategorisierung als:

- Kein Problem
- Zur Beobachtung
- Problem

- Anzeige der Kategorie direkt in der Liste
- Filtermöglichkeiten auf Spaltenebene
- _Nice‑to‑Have_:

- Farbige Markierung problematischer Werte

- Grün: Tricia RAT innerhalb der Akzeptanz (Abweichung <= 1 Risikoklasse)
- Rot: Tricia RAT ausserhalb der Akzeptanz (Abweichung > 1 Risikoklasse)

- Farbliche Differenzierung nach Risiko:

- hohes Risiko (falsch tief)
- geringeres Risiko (falsch hoch)

**3.4 Statistische Auswertung**

- Anzeige von **Akzeptanzwerten** und den berechneten Ist-Werten bei der Confusion Matrix
- Visuelle Einfärbung der berechneten Ist-Werte bei der Confusion Matrix:

- Grün: innerhalb der Akzeptanzkriterien
- Rot: ausserhalb der Akzeptanzkriterien

- Zusätzlich sollen **Streichresultate** berücksichtigt werden können.

- Toggle Switch erlaub Inklusion oder Exklusion der Streichresultate in der Auswertung

Alle Auswertungen stützen sich zeitlich auf das **Vk‑basierte Datum**. Dieses wird für die Generierung des Datensatzes für die jeweilige Auswertungsperiode genutzt.

Möglichkeit, diese Akzeptanzkriterien zentral anzupassen (Input mam: Wie und wo könnte man Settings anpassen)

**4. Kontroll‑Dashboard (Durchführung)**

Dieses Dashboard dient der Überprüfung der operativen Arbeit:

- Übersicht, ob die WiMi ihre Eingaben vorgenommen haben
- Listenansicht mit

- Vk-Nr
- Vk-basiertem Datum, basis für die Liste
- Eingabe Datum
- WiMi

- Generierung der Liste für einen ausgewählten Zeitraum

**5. Datenbasis, Export und Import**

- **Export**

- Ausgabe der (gefilterten) Listen als **Excel oder CSV**
- Verfügbar sowohl im Kontroll‑ als auch im Matrix‑Dashboard

- **Import**

- CSV‑ oder Excel Dateien als Basis für die gespeicherten Werte (Input mam)

- Vordefinierte Datei gilt als Basis
- Möglichkeit, eine andere CSV- oder Excel Datei hochzuladen für die Auswertung

- Nice-to-have:

- Generierung eines Report der jeweiligen Ansicht (ausser Eingabe)