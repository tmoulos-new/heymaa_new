export type AuthLang = 'el' | 'en'

const STRINGS = {
  el: {
    signupTitle: 'Για να συνεχίσεις, συμπλήρωσε τα στοιχεία σου!',
    loginTitle: 'Καλωσήρθες πίσω!',
    name: 'Όνομα',
    namePh: 'Το όνομά σου',
    email: 'Email',
    emailPh: 'you@example.com',
    password: 'Κωδικός πρόσβασης',
    passwordPh: 'Εισαγάγετε κωδικό πρόσβασης',
    confirmPassword: 'Επιβεβαίωση Κωδικού πρόσβασης',
    confirmPasswordPh: 'Επαναλάβετε τον κωδικό πρόσβασης',
    inviteTitle: 'Έχεις κωδικό πρόσκλησης;',
    invitePh: 'π.χ. HEYMAA-ABC123',
    wantChild: 'Θέλω να αποκτήσω παιδί',
    pregnantOrMom: 'Είμαι έγκυος ή μαμά',
    newsletter:
      'Επιθυμείς να λαμβάνεις ενημερώσεις ηλεκτρονικά, τηλεφωνικά, ταχυδρομικά και Newsletters από το Heymaa και τις συνεργαζόμενες εταιρίες της Care Direct, με σκοπό τη διεξαγωγή ερευνών και την προώθηση προϊόντων και υπηρεσιών των συνεργαζόμενων με αυτήν εταιρειών;',
    privacy: 'Έχω διαβάσει και αποδέχομαι την',
    privacyLink: 'Πολιτική Απορρήτου & Προστασίας Δεδομένων',
    terms: 'Αποδέχομαι τους',
    termsLink: 'Όρους & Προϋποθέσεις Χρήσης',
    register: 'Εγγραφή',
    registering: 'Εγγραφή…',
    or: 'ή',
    google: 'Συνέχεια με Google',
    googleSoon: 'Η σύνδεση με Google θα είναι σύντομα διαθέσιμη.',
    hasAccount: 'Έχεις ήδη λογαριασμό;',
    login: 'Σύνδεση',
    noAccount: 'Δεν έχεις λογαριασμό;',
    signup: 'Εγγραφή',
    loginBtn: 'Είσοδος',
    loggingIn: 'Σύνδεση…',
    forgot: 'Ξέχασες τον κωδικό;',
    closeHome: 'Επιστροφή στην αρχική',
    errConnection: 'Σφάλμα σύνδεσης.',
    errPasswordMin: 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.',
    errPasswordMismatch: 'Οι κωδικοί δεν ταιριάζουν.',
    errName: 'Συμπλήρωσε το όνομά σου.',
    errEmail: 'Συμπλήρωσε το email σου.',
    errEmailInvalid: 'Μη έγκυρο email.',
    errPrivacy: 'Αποδέχσου την Πολιτική Απορρήτου & Προστασίας Δεδομένων.',
    errTerms: 'Αποδέχσου τους Όρους & Προϋποθέσεις Χρήσης.',
    errLogin: 'Λάθος email ή κωδικός.',
    errRegister: 'Αποτυχία εγγραφής.',
    errEmailExists: 'Το email είναι ήδη καταχωρημένο.',
    errInviteInvalid: 'Μη έγκυρος κωδικός πρόσκλησης.',
    errInviteRequired: 'Απαιτείται κωδικός πρόσκλησης.',
  },
  en: {
    signupTitle: 'To continue, fill in your details!',
    loginTitle: 'Welcome back!',
    name: 'Name',
    namePh: 'Your name',
    email: 'Email',
    emailPh: 'you@example.com',
    password: 'Password',
    passwordPh: 'Enter your password',
    confirmPassword: 'Confirm password',
    confirmPasswordPh: 'Re-enter your password',
    inviteTitle: 'Have an invite code?',
    invitePh: 'e.g. HEYMAA-ABC123',
    wantChild: 'I want to have a child',
    pregnantOrMom: 'I am pregnant or a mom',
    newsletter: 'I want to receive updates and newsletters with useful motherhood tips.',
    privacy: 'I have read and accept the',
    privacyLink: 'Privacy Policy & Data Protection',
    terms: 'I accept the',
    termsLink: 'Terms & Conditions of Use',
    register: 'Sign up',
    registering: 'Signing up…',
    or: 'or',
    google: 'Continue with Google',
    googleSoon: 'Google sign-in will be available soon.',
    hasAccount: 'Already have an account?',
    login: 'Log in',
    noAccount: "Don't have an account?",
    signup: 'Sign up',
    loginBtn: 'Sign in',
    loggingIn: 'Signing in…',
    forgot: 'Forgot password?',
    closeHome: 'Back to home',
    errConnection: 'Connection error.',
    errPasswordMin: 'Password must be at least 6 characters.',
    errPasswordMismatch: 'Passwords do not match.',
    errName: 'Please enter your name.',
    errEmail: 'Please enter your email.',
    errEmailInvalid: 'Invalid email address.',
    errPrivacy: 'Please accept the Privacy Policy & Data Protection.',
    errTerms: 'Please accept the Terms & Conditions of Use.',
    errLogin: 'Wrong email or password.',
    errRegister: 'Registration failed.',
    errEmailExists: 'Email is already registered.',
    errInviteInvalid: 'Invalid invite code.',
    errInviteRequired: 'Invite code required.',
  },
} as const

export function authStrings(lang: AuthLang) {
  return STRINGS[lang] || STRINGS.el
}

/** Map common English API auth errors to the active UI language. */
export function localizeAuthApiMessage(message: string, lang: AuthLang): string {
  const s = authStrings(lang)
  if (lang !== 'el') return message
  const normalized = message.trim().toLowerCase()
  const map: Record<string, string> = {
    'email required.': s.errEmail,
    'email required': s.errEmail,
    'name is required.': s.errName,
    'name is required': s.errName,
    'email already registered.': s.errEmailExists,
    'email already registered': s.errEmailExists,
    'privacy policy and terms acceptance are required.': `${s.errPrivacy} ${s.errTerms}`,
    'invalid invite code.': s.errInviteInvalid,
    'invalid invite code': s.errInviteInvalid,
    'invite code required.': s.errInviteRequired,
    'invite code required': s.errInviteRequired,
    'field required': s.errEmail,
    'value error, email address must be provided': s.errEmail,
  }
  if (map[normalized]) return map[normalized]
  if (normalized.includes('email') && normalized.includes('required')) return s.errEmail
  if (normalized.includes('name') && normalized.includes('required')) return s.errName
  if (normalized.includes('already registered')) return s.errEmailExists
  if (normalized.includes('invalid invite')) return s.errInviteInvalid
  return message
}

export const PRIVACY_URL = '/privacy'
export const TERMS_URL = '/terms'
