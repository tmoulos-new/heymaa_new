"""Build _babyspace_ro_offline_docs.jsonl from curated Babyspace RO extracts."""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "_babyspace_ro_offline_docs.jsonl"

DOCS = [
    {
        "url": "https://www.babyspace.com.ro/ro/al%C4%83ptarea-%C8%99i-diversificarea",
        "title": "Alăptarea și diversificarea",
        "content": """
Alăptarea și diversificarea — Babyspace România.

Este recomandat să îți alăptezi bebelușul, mai ales în primele luni de viață. Mâncarea suplimentară (diversificarea) se adaugă de obicei după primele 6 luni, când sistemul digestiv s-a maturizat suficient și copilul poate sta în șezut, controla mișcările limbii și înghiți. Medicul pediatru decide dacă bebelușul este pregătit, ținând cont de creștere și sănătate. După 6 luni copilul are nevoie de mai multă energie și de mâncare solidă.

Tranziția: alimentele trebuie să fie hrănitoare și sigure, oferite progresiv, în cantități care cresc treptat. Mulți pediatri sugerează începerea cu o cremă de cereale (ex. vanilie) după-amiaza, câteva linguri în primele zile; după ~15 zile se poate adăuga cremă de fructe dimineața.

Exemplu de schemă: dimineața lapte; ~ora 10 cremă de fructe; prânz lapte; după-amiaza cremă de cereale; seara lapte. După creme, oferiți puțină apă.

Gătitul la abur este ideal (ex. carne slabă + legume, amestecate cu puțin ulei de măsline). Dacă bebelușul respinge un aliment, nu insista — reîncearcă după ~15 zile. Nu forța cantități mai mari decât dorește copilul.

La această vârstă copilul are nevoie de alimente bogate în fier, zinc, calciu, vitamine A și C și acid folic. Făina/crema de orez (bogată în fier, rar alergenică) și iaurtul (fier, calciu, eventual probiotice) sunt opțiuni frecvent recomandate, urmate de fructe, legume și carne.
""".strip(),
    },
    {
        "url": "https://www.babyspace.com.ro/ro/urm%C4%83rirea-medical%C4%83-prenatal%C4%83",
        "title": "Urmărirea medicală prenatală",
        "content": """
Urmărirea medicală prenatală — Babyspace România. Ce examene sunt necesare în timpul sarcinii.

La prima vizită obstetricianul află istoricul medical. Examene tipice:
1) Sânge: grupă sanguină și Rh; hemoglobină (anemie → fier); anticorpi rubeolă (dacă nu există imunitate, evitați contactul cu persoane bolnave); hepatită B (nou-născuții la risc se vaccinează la naștere); sifilis; toxoplasmoză; HIV (opțional).
2) Urină: glucoză (diabet), leucocite (infecție), cetone (metabolism/diabet).
3) Tensiune arterială: creștere bruscă poate indica preeclampsie; variații pe trimestre sunt posibile.
4) Examen clinic: palparea abdomenului, măsurarea fundului uterin din ~săptămâna 20, greutate, membre (edeme).
5) Col uterin: frotiu / evaluare (închis, hemoragii, infecții).
6) Ecografie: vârsta sarcinii, sarcina unică/multiplă, poziție făt/placenta, bătăi cardiace, lichid amniotic, malformații, eventual sex.
7) Examene speciale: dacă apar indicii de malformație/displazie sau vârsta mamei >35 ani (risc crescut de sindrom Down).
""".strip(),
    },
    {
        "url": "https://www.babyspace.com.ro/ro/10-alimente-pe-care-este-indicat-s%C4%83-le-consumi-%C3%AEn-timpul-sarcinii",
        "title": "10 alimente utile în timpul sarcinii",
        "content": """
10 alimente pe care este indicat să le consumi în timpul sarcinii — Babyspace România.

Păstrați un echilibru alimentar; un nutriționist poate ajuta la un plan personalizat. Alimente frecvent recomandate:
1. Avocado — acid folic, potasiu, vitamine C și B6 (poate ajuta grețurile matinale).
2. Broccoli — vitamine A și C, calciu, acid folic.
3. Ouă — proteine și Omega-3 pentru mama și dezvoltarea creierului bebelușului.
4. Linte — acid folic, B5, fier, proteine; poate ajuta digestia și tensiunea.
5. Nuci — magneziu, seleniu, zinc, potasiu, calciu, vitamina E.
6. Fulgi de ovăz — energie la micul dejun.
7. Spanac — acid folic, vitamina A, calciu.
8. Iaurt — calciu, proteine, acid folic, probiotice pentru digestie.
9. Smochine — vitamina K și fier (prevenirea anemiei).
10. Fasole (ex. Pinto) — cupru, fier, fosfor pentru oase și digestie.

Discutați suplimentele și restricțiile alimentare cu medicul care urmărește sarcina.
""".strip(),
    },
    {
        "url": "https://www.babyspace.com.ro/ro/ce-trebuie-s%C4%83-%C8%99tii-despre-colici",
        "title": "Ce trebuie să știi despre colici",
        "content": """
Ce trebuie să știi despre colici — Babyspace România.

Regula lui 3 (folosită de mulți pediatri): dacă un sugar bine hrănit și sănătos plânge >3 ore/zi, >3 zile/săptămână, >3 săptămâni, se poate vorbi de colici.

Simptome comune: plâns zgomotos fără cauză clară; genunchi trași la piept; crampe; gaze; stomac umflat; simptome amplificate după-amiaza.

La bebelușii alăptați, unele mame evită alimente care produc gaze (citrice/suc de portocale, cofeină, conopidă, mazăre, ceapă, mâncare puternic condimentată) — discutați cu medicul.

ATENȚIE: diareea, vomitul și febra NU sunt asociate tipic cu colicii; dacă apar, contactați pediatrul rapid.
""".strip(),
    },
    {
        "url": "https://www.babyspace.com.ro/ro/febra",
        "title": "Febra la copil — pași practici",
        "content": """
Febra — Babyspace România. Pași practici când copilul are febră.

1. Asigură-te că stă confortabil, indiferent că este așezat în pat sau pe canapea.
2. Fii sigură că bea suficientă apă sau lichide pentru hidratare.
3. Oferă-i copilului doar medicamentele recomandate de doctor (nu administra pe cont propriu tratamente fără consult).
4. Dacă temperatura este mult prea ridicată, încearcă să o echilibrezi cu ajutorul compreselor plasate pe frunte.
5. Compresele pot fi aplicate și pe restul suprafeței corpului, pentru confort.
6. Dacă temperatura persistă, apelează la opinia medicului de familie sau a pediatrului.

Febra poate fi un semnal că organismul luptă cu o infecție; urmăriți starea generală a copilului (hidratare, somn, respirăție) și nu amânați consultul dacă apar semne de agravare.
""".strip(),
    },
    {
        "url": "https://www.babyspace.com.ro/ro/sfaturi-pentru-un-nou-n%C4%83scut-s%C4%83n%C4%83tos",
        "title": "Sfaturi pentru un nou-născut sănătos",
        "content": """
Sfaturi pentru un nou-născut sănătos — Babyspace România.

Până la vaccinurile de rutină, nou-născutul este vulnerabil la infecții. Prioritizează curățenia și igiena.

Spălați mâinile sistematic (familia și vizitatorii) înainte și după contactul cu bebelușul; săpun antibacterian și prosoape curate (preferabil de hârtie). Limitați expunerea în primele săptămâni.

Curățați/dezinfectați regulat jucăriile și echipamentul. Atenție la animalele de casă (bacterii); dezinfectați zonele accesibile animalelor și ustensilele de hrană.
""".strip(),
    },
    {
        "url": "https://www.babyspace.com.ro/ro/5-sfaturi-practice-pentru-noile-m%C4%83mici",
        "title": "5 sfaturi practice pentru noile mămici",
        "content": """
5 sfaturi practice pentru noile mămici — Babyspace România.

Hrănire: bebelușii pot adormi în timpul mesei — e frecvent. Dacă se întâmplă foarte des, cereți sfatul pediatrului. Uneori gâdilarea ușoară a tălpilor ajută să rămână treji; nu forțați mese mai mari decât e nevoie — în primele luni somnul e esențial.

Colici: pot provoca plâns 3–5 ore, adesea seara. Ajută: mișcări de „pedalare” ale picioarelor; ridicarea după masă pentru eliminarea aerului; repetarea mișcărilor pe spate în pătuț.

Vizitatori: limitați pe cât posibil în primele săptămâni — sistemul imunitar e încă în dezvoltare.
""".strip(),
    },
    {
        "url": "https://www.babyspace.com.ro/ro/34721-sarcina",
        "title": "Ghid Sarcina — Babyspace România",
        "content": """
Ghid Sarcina — Babyspace România (hub).

Secțiuni utile: planificarea sarcinii; perioada prenatală; nașterea; etapele sarcinii săptămână cu săptămână (1–40); alimentație și stil de viață pe durata sarcinii; pregătirea pentru naștere și pentru sosirea bebelușului.

Obiectivul ghidului: să ajute viitorii părinți să înțeleagă schimbările corpului și dezvoltarea copilului pe săptămâni, ce să mănânce, cum să se pregătească pentru naștere și pentru perioada postnatală.
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
