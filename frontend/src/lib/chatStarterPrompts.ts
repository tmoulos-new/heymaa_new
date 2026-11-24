/** Empty-chat starter questions + light follow-ups after the first reply. */

export type ChatPromptChip = { id: string; label: string; send: string }

export function chatStarterPrompts(lang: string): ChatPromptChip[] {
  const el = lang === 'el'
  const ro = lang === 'ro'
  if (el) {
    return [
      {
        id: 'sleep',
        label: 'Ύπνος τη νύχτα',
        send: 'Το μωρό μου δεν κοιμάται καλά τη νύχτα. Τι μπορώ να δοκιμάσω;',
      },
      {
        id: 'feeding',
        label: 'Τάισμα / θηλασμός',
        send: 'Έχω απορίες για το τάισμα ή τον θηλασμό. Τι να προσέξω;',
      },
      {
        id: 'crying',
        label: 'Κλάμα',
        send: 'Το μωρό μου κλαίει πολύ και δεν ξέρω πώς να το ηρεμήσω. Βοήθησέ με.',
      },
      {
        id: 'pregnancy',
        label: 'Εγκυμοσύνη',
        send: 'Είμαι έγκυος και θέλω να μάθω τι να περιμένω αυτή την περίοδο.',
      },
      {
        id: 'checkup',
        label: 'Επίσκεψη στον παιδίατρο',
        send: 'Τι να ρωτήσω στον παιδίατρο στην επόμενη επίσκεψη;',
      },
      {
        id: 'selfcare',
        label: 'Εγώ ως μαμά',
        send: 'Νιώθω κουρασμένη / αγχωμένη ως μαμά. Πώς μπορώ να φροντίσω λίγο και τον εαυτό μου;',
      },
    ]
  }
  if (ro) {
    return [
      {
        id: 'sleep',
        label: 'Somn pe noapte',
        send: 'Bebelușul meu nu doarme bine noaptea. Ce pot încerca?',
      },
      {
        id: 'feeding',
        label: 'Alăptare / hrană',
        send: 'Am întrebări despre alăptare sau hrană. La ce să fiu atentă?',
      },
      {
        id: 'crying',
        label: 'Plâns',
        send: 'Bebelușul plânge mult și nu știu cum să-l liniștesc. Ajută-mă.',
      },
      {
        id: 'pregnancy',
        label: 'Sarcină',
        send: 'Sunt însărcinată și vreau să știu la ce să mă aștept în perioada asta.',
      },
      {
        id: 'checkup',
        label: 'Vizită la pediatru',
        send: 'Ce să întreb pediatrul la următoarea vizită?',
      },
      {
        id: 'selfcare',
        label: 'Eu ca mamă',
        send: 'Mă simt obosită / anxioasă ca mamă. Cum pot avea grijă și de mine?',
      },
    ]
  }
  return [
    {
      id: 'sleep',
      label: 'Night sleep',
      send: "My baby isn't sleeping well at night. What can I try?",
    },
    {
      id: 'feeding',
      label: 'Feeding / nursing',
      send: 'I have questions about feeding or nursing. What should I watch for?',
    },
    {
      id: 'crying',
      label: 'Crying',
      send: "My baby cries a lot and I don't know how to soothe them. Please help.",
    },
    {
      id: 'pregnancy',
      label: 'Pregnancy',
      send: "I'm pregnant and want to know what to expect right now.",
    },
    {
      id: 'checkup',
      label: 'Pediatrician visit',
      send: 'What should I ask the pediatrician at the next visit?',
    },
    {
      id: 'selfcare',
      label: 'Me as a mom',
      send: "I'm tired / anxious as a mom. How can I take a little care of myself too?",
    },
  ]
}

/** Shown once after the first assistant reply to nudge a second turn. */
export function chatFollowUpPrompts(lang: string): ChatPromptChip[] {
  const el = lang === 'el'
  const ro = lang === 'ro'
  if (el) {
    return [
      {
        id: 'more',
        label: 'Πες μου περισσότερα',
        send: 'Πες μου περισσότερα γι’ αυτό, με πρακτικά βήματα.',
      },
      {
        id: 'when',
        label: 'Πότε να ανησυχήσω;',
        send: 'Πότε πρέπει να ανησυχήσω και να μιλήσω με γιατρό;',
      },
      {
        id: 'tonight',
        label: 'Τι να κάνω απόψε;',
        send: 'Τι μπορώ να κάνω απόψε, βήμα-βήμα;',
      },
    ]
  }
  if (ro) {
    return [
      {
        id: 'more',
        label: 'Spune-mi mai mult',
        send: 'Spune-mi mai mult despre asta, cu pași practici.',
      },
      {
        id: 'when',
        label: 'Când să mă îngrijorez?',
        send: 'Când ar trebui să mă îngrijorez și să vorbesc cu un medic?',
      },
      {
        id: 'tonight',
        label: 'Ce fac diseară?',
        send: 'Ce pot face diseară, pas cu pas?',
      },
    ]
  }
  return [
    {
      id: 'more',
      label: 'Tell me more',
      send: 'Tell me more about this, with practical steps.',
    },
    {
      id: 'when',
      label: 'When to worry?',
      send: 'When should I worry and talk to a doctor?',
    },
    {
      id: 'tonight',
      label: 'What tonight?',
      send: 'What can I do tonight, step by step?',
    },
  ]
}
