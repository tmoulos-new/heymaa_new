import re

GREEK_ACCENT_MAP = str.maketrans(
    "άέήίόύώϊΐϋΰΆΈΉΊΌΎΏ",
    "αεηιουωιιυυΑΕΗΙΟΥΩ",
)

GREEK_LETTER = re.compile(r"[α-ωά-ώΑ-ΩΆ-Ώ]")

VOCATIVE_EXACT = {
    "γεωργιος": "Γεώργιε",
    "γιωργος": "Γιώργο",
    "γιωργης": "Γιώργη",
    "μαρια": "Μαρία",
    "νικος": "Νίκο",
    "νικολαος": "Νικόλαε",
    "κωστας": "Κώστα",
    "κωνσταντινος": "Κωνσταντίνε",
    "δημητρης": "Δημήτρη",
    "δημητριος": "Δημήτριε",
    "γιαννης": "Γιάννη",
    "ιωαννης": "Ιωάννη",
    "ελενη": "Ελένη",
    "σοφια": "Σοφία",
    "κατερινα": "Κατερίνα",
    "ανδρεας": "Ανδρέα",
    "χρηστος": "Χρήστο",
    "μιχαλης": "Μιχάλη",
    "μιχαηλος": "Μιχαήλε",
    "παυλος": "Παύλε",
    "στεφανος": "Στέφανε",
    "αθανασιος": "Αθανάσιε",
    "θανασης": "Θανάση",
    "ευαγγελια": "Ευαγγελία",
    "βασιλικη": "Βασιλική",
    "αγγελικη": "Αγγελική",
    "αναστασια": "Αναστασία",
    "χριστινα": "Χριστίνα",
    "παναγιωτα": "Παναγιώτα",
    "πετρος": "Πέτρο",
    "μακης": "Μάκη",
    "μαρκος": "Μάρκο",
    "αλεξανδρος": "Αλέξανδρε",
    "αλεξης": "Άλεξη",
    "βαγγελης": "Βαγγέλη",
    "σωτηρης": "Σωτήρη",
    "σπυρος": "Σπύρο",
    "σπυριδων": "Σπυρίδωνα",
    "φωτης": "Φώτη",
    "φωτεινη": "Φωτεινή",
    "ολγα": "Όλγα",
    "ιρινα": "Ιρίνα",
    "νεκταρια": "Νεκταρία",
    "δεσποινα": "Δέσποινα",
    "αθηνα": "Αθήνα",
    "ηρακλης": "Ηρακλή",
    "λεωνιδας": "Λεωνίδα",
    "παρις": "Πάρη",
    "τζενη": "Τζένη",
    "μαμ": "Μαμ",
    "μαμα": "Μαμά",
}


def strip_greek_accents(text: str) -> str:
    return text.translate(GREEK_ACCENT_MAP)


def _greek_key(text: str) -> str:
    return strip_greek_accents(text.strip().lower())


def _has_greek_letters(text: str) -> bool:
    return bool(GREEK_LETTER.search(text))


def _apply_vocative_rules(word: str) -> str:
    lower = _greek_key(word)
    if not lower:
        return word
    if lower.endswith("ιος") and len(word) > 3:
        return word[:-2] + "ε"
    if lower.endswith("σης"):
        return word[:-2] + "η"
    if lower.endswith("ης"):
        return word[:-1]
    if lower.endswith("ας"):
        return word[:-1] + "α"
    if lower.endswith("ος"):
        return word[:-2] + "ο"
    return word


def _vocative_word(word: str) -> str:
    trimmed = word.strip()
    if not trimmed or not _has_greek_letters(trimmed):
        return trimmed
    exact = VOCATIVE_EXACT.get(_greek_key(trimmed))
    if exact:
        return exact
    return _apply_vocative_rules(trimmed)


def greek_vocative(name: str) -> str:
    trimmed = (name or "").strip()
    if not trimmed or not _has_greek_letters(trimmed):
        return trimmed
    parts = trimmed.split()
    if not parts:
        return trimmed
    first = _vocative_word(parts[0])
    if len(parts) == 1:
        return first
    return " ".join([first, *parts[1:]])


def name_in_vocative(name: str, lang: str) -> str:
    if not (name or "").strip():
        return name
    if not (lang or "").startswith("el"):
        return name
    return greek_vocative(name)
