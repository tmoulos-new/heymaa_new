"""Build _ms_offline_docs.jsonl from curated MS RO childhood extracts."""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "_ms_offline_docs.jsonl"

DOCS = [
    {
        "url": "https://www.ms.ro/media/documents/15_Poster_Calendar_National_Vaccinare.pdf",
        "title": "Calendarul Național de Vaccinare (poster MS)",
        "content": """
CALENDARUL NAȚIONAL DE VACCINARE — Ministerul Sănătății / insp.gov.ro
Mesaj: COPIL VACCINAT: COPIL PROTEJAT!

Vârste și vaccinuri:
- primele 24 ore: Vaccin hepatitic B (Hep B) — în maternitate
- 2-7 zile: Vaccin BCG (Calmette Guerrin) — în maternitate
- 2 luni: Vaccin DTPa-VPI-Hib-Hep.B și Vaccin pneumococic — la medicul de familie
- 4 luni: Vaccin DTPa-VPI-Hib-Hep.B și Vaccin pneumococic — la medicul de familie
- 11 luni: Vaccin DTPa-VPI-Hib-Hep.B și Vaccin pneumococic — la medicul de familie
- 12 luni: Vaccin rujeolic-rubeolic-oreion (ROR) — la medicul de familie
- 5 ani: Vaccin ROR — la medicul de familie
- 5-6 ani: Vaccin DTPa-VPI — la medicul de familie
- 14 ani: Vaccin dTpa — la medicul de familie
""".strip(),
    },
    {
        "url": "https://www.ms.ro/media/documents/07_Calendar_National_VACCINARE_2024.pdf",
        "title": "Calendarul Național de Vaccinare 2024 (MS)",
        "content": """
CALENDARUL NAȚIONAL DE VACCINARE 2024 — Ministerul Sănătății

- primele 24 ore: Vaccin hepatitic B (Hep B) — în maternitate
- 2-7 zile: Vaccin BCG — în maternitate
- 2 luni: Hexavaccin (DTPa-VPI-Hib-Hep.B) + Vaccin pneumococic — medicul de familie
- 4 luni: Hexavaccin (DTPa-VPI-Hib-Hep.B) + Vaccin pneumococic — medicul de familie
- 11 luni: Hexavaccin (DTPa-VPI-Hib-Hep.B) + Vaccin pneumococic — medicul de familie
- 12 luni: Vaccin rujeolic-rubeolic-urlian, viu atenuat (ROR) — medicul de familie
- 5 ani: Vaccin ROR — medicul de familie
- 6 ani: Vaccin combinat DTPa-VPI — medicul de familie
- 14 ani: Vaccin DTPa adulți — medicul de familie
""".strip(),
    },
    {
        "url": "https://www.ms.ro/media/documents/07_Pliant_Rujeola.pdf",
        "title": "Pliant Rujeola — informații pentru părinți (MS)",
        "content": """
RUJEOLA — Informații pentru părinți (Ministerul Sănătății). Mesaj: COPIL VACCINAT = COPIL PROTEJAT!

Rujeola este o boală foarte contagioasă cauzată de virusul rujeolic. Se transmite ușor când o persoană infectată respiră, tușește sau strănută. Poate duce la complicații severe și chiar la deces. Este prezentă cel mai frecvent la copii.

Simptome (încep de obicei la 10-14 zile după expunere): febră, rinită/rinoree, tuse, ochi roșii și înlăcrimați, mici pete albe pe mucoasa obrajilor; erupție pe față și gât care se extinde.

Complicații: otită medie, pneumonie rujeoloasă, encefalită, diaree severă și deshidratare, orbire. Dacă o femeie se îmbolnăvește de rujeolă în sarcină, poate duce la naștere prematură cu greutate mică la naștere. Complicațiile sunt cele mai frecvente la copiii sub 5 ani.

Cine este la risc: orice persoană neimunizată. Copiii mici nevaccinați și femeile însărcinate prezintă cel mai mare risc de complicații severe.

Prevenire: vaccinarea este singura modalitate eficientă de protecție. Vaccinul ROR protejează împotriva rujeolei, oreionului și rubeolei. Vaccinarea ROR nu crește riscul de autism. În România, schema națională PNV: prima doză la 12 luni, a doua doză la 5 ani, la medicul de familie. Este prevăzută și vaccinarea ROR în situații epidemiologice deosebite (contacții din focare).

Tratament: nu există tratament specific; hidratare, dietă sănătoasă; antibiotice pentru complicații bacteriene; două doze de vitamina A la 24 ore distanță pot reduce riscul de leziuni oculare și deces.
""".strip(),
    },
    {
        "url": "https://ms.ro/ro/centrul-de-presa/ministerul-s%C4%83n%C4%83t%C4%83%C8%9Bii-a-declarat-epidemie-de-rujeol%C4%83-la-nivel-na%C8%9Bional/",
        "title": "Ministerul Sănătății a declarat epidemie de rujeolă la nivel național",
        "content": """
5 Decembrie 2023 — Ministerul Sănătății a declarat epidemie de rujeolă la nivel național.

Având în vedere creșterea îngrijorătoare a cazurilor de rujeolă, precum și numărul mare de spitalizări în secțiile de pediatrie și boli infecțioase ale copiilor infectați, Ministerul Sănătății a declarat epidemie de rujeolă la nivel național, pentru a face posibilă vaccinarea copiilor cu vârsta cuprinsă între 9 și 11 luni, precum și recuperarea celor nevaccinați sau cu schema de vaccinare incompletă.

Se înregistrau aproape 2.000 de cazuri la nivel național, în 29 de județe.

Ministerul Sănătății derulează o campanie de informare a părinților, împreună cu medicii de familie, pentru o mai bună aderență la programul de vaccinare.

Rujeola este o boală infecțioasă care se transmite cu ușurință mai ales la copiii nevaccinați; uneori evoluția este gravă și pot apărea complicații.

Acoperirea vaccinală cu prima doză, la nivel național, era de 78%, iar cu doza a doua de 62% dintre copiii eligibili, pe un trend descrescător de mai mult de 10 ani.

Strategia Națională de Vaccinare are în vedere eliminarea riscurilor pentru sănătatea publică produse de bolile prevenibile prin vaccinare.
""".strip(),
    },
    {
        "url": "https://ms.ro/ro/centrul-de-presa/vaccinul-anti-hpv-este-disponibil-la-medicii-de-familie-%C8%99i-la-direc%C8%9Biile-de-s%C4%83n%C4%83tate-public%C4%83/",
        "title": "Vaccinul anti-HPV disponibil la medicii de familie și DSP",
        "content": """
31 August 2022 — Vaccinul anti-HPV este disponibil la medicii de familie și la Direcțiile de Sănătate Publică.

Vaccinarea împotriva HPV este gratuită și se realizează în cabinetele medicilor de familie, la fetele cu vârste cuprinse între 11 și 18 ani, pe baza solicitărilor depuse. Cererile sunt centralizate în ordinea cronologică a datei de înregistrare, iar trimestrial se solicită direcției de sănătate publică teritoriale numărul de doze necesare.

Pentru imunizarea persoanelor de până la 14 ani sunt necesare două doze, iar pentru cele ce depășesc această vârstă câte trei doze.

Vaccinarea anti-HPV este cea mai bună metodă de prevenire a cancerului de col uterin. Ministerul Sănătății încurajează părinții să solicite informații medicilor de familie și celor de specialitate cu privire la beneficiile acestui tip de vaccinare.

În primele 6 luni ale anului de referință au fost utilizate zeci de mii de doze în cadrul campaniei de vaccinare gratuită a Ministerului Sănătății.
""".strip(),
    },
    {
        "url": "https://www.ms.ro/ro/unitatea-de-implementare-si-coordonare-programe/rovac/",
        "title": "Proiectul ROVAC — optimizarea vaccinării în România",
        "content": """
Proiectul ROVAC („Dezvoltarea și introducerea de sisteme și standarde în Ministerul Sănătății ce optimizează procesele decizionale privind activitatea de vaccinare în România”) a urmărit întărirea capacității sistemului de sănătate publică în implementarea programelor naționale de vaccinare și creșterea acoperirii vaccinale.

Rezultate relevante pentru părinți și vaccinarea copiilor:
- Elaborarea Strategiei Naționale de Vaccinare 2023-2030 și diseminarea acesteia către specialiști medicali, inclusiv discutarea modalităților de implementare locală și a problemelor medicilor de familie în activitatea de vaccinare.
- Organizarea de reuniuni de informare și educare a părinților cu privire la vaccinare, precum și creșterea gradului de vaccinare în rândul comunităților vulnerabile în județe prioritare.
""".strip(),
    },
    {
        "url": (
            "https://www.ms.ro/ro/transparenta-decizionala/acte-normative-in-transparenta/"
            "hot%C4%83r%C3%A2re-a-guvernului-privind-aprobarea-strategiei-na%C8%9Bionale-de-vaccinare-"
            "%C3%AEn-rom%C3%A2nia-pentru-perioada-2023-2030/"
        ),
        "title": "Strategia Națională de Vaccinare în România 2023–2030",
        "content": """
1 August 2023 — Hotărâre a Guvernului privind aprobarea Strategiei naționale de vaccinare în România pentru perioada 2023–2030.

Documentele asociate publicate de Ministerul Sănătății includ:
- HG — Strategia Națională de Vaccinare 2023–2030
- Nota de fundamentare
- Anexa — Plan de acțiuni pentru implementarea Strategiei de vaccinare în România 2023
- Anexa — Strategia Națională de Vaccinare

Strategia urmărește creșterea acoperirii vaccinale și reducerea riscurilor pentru sănătatea publică produse de bolile prevenibile prin vaccinare, inclusiv pentru copii conform Calendarului/Programului Național de Vaccinare.
""".strip(),
    },
    {
        "url": "https://www.ms.ro/ro/informatii-de-interes-public/campanii-informare-educare-comunicare/spune-nu-rujeolei-spune-da-vaccin%C4%83rii/",
        "title": "Campanie: Spune NU rujeolei, spune DA vaccinării",
        "content": """
Campanie IEC a Ministerului Sănătății: „Spune NU rujeolei, spune DA vaccinării”.

Campania promovează vaccinarea împotriva rujeolei conform Programului/Calendarului Național de Vaccinare și informează părinții despre riscurile bolii și beneficiile vaccinului ROR (rujeolă-oreion-rubeolă). Materialele asociate includ analize de situație, planificare, pliante și infografice despre vaccinare.

Mesajul central pentru părinți: vaccinarea la timp protejează copiii de o boală foarte contagioasă care poate avea complicații severe; aderarea la schema națională (inclusiv dozele ROR) este esențială pentru imunitatea de grup.
""".strip(),
    },
]


def main() -> None:
    with OUT.open("w", encoding="utf-8") as f:
        for doc in DOCS:
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
    print(f"wrote {len(DOCS)} docs -> {OUT}")


if __name__ == "__main__":
    main()
