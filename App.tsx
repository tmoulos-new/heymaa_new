import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

const API = "https://api.vdarpp.com";
const TOKEN_KEY = "hm_token";

async function syncProfileToSupabase(token: string, profile: Profile): Promise<void> {
  try {
    const ch: ChildEntity[] = profile.children ||
      (profile.childBirthDate ? [{name: profile.childName||"", birthDate: profile.childBirthDate||""}] : []);
    const bds = ch.map((c: ChildEntity) => c.birthDate).filter((d: string) => d.length > 0);
    const pregnant = !!(profile.dueDate && profile.pregnancyStatus !== "completed");
    await fetch(`${API}/profile/sync`, {
      method: "POST",
      headers: {"Content-Type": "application/json", "x-token": token},
      body: JSON.stringify({
        country: profile.country || null,
        child_count: ch.length,
        pregnancy_active: pregnant,
        children_birthdates: bds,
        consent_marketing: !!profile.consentMarketing,
        consent_date: profile.consentDate || null,
      }),
    });
  } catch(_) {}
}

interface ChildEntity { name: string; birthDate: string; }
interface Profile { name: string; childName: string; childAge: string; childBirthDate?: string; lang: string; dueDate?: string; children?: ChildEntity[]; pregnancyStatus?: "active"|"awaiting_update"|"completed"; country?: string; consentMarketing?: boolean; consentDate?: string; }
interface Message { role: "user" | "assistant"; content: string; }
interface Memory { emoji: string; text: string; date: string; img?: string; ref?: string; } // ref = child name | "pregnancy" | family member name | undefined (general)
interface FamilyMember { name: string; role: string; color: string; email?: string; phone?: string; }
interface Thread { id: string; title: string; date: string; messages: Message[]; }
interface DocEntry { title: string; date: string; category: string; ref: string; addedDate: string; }

const LANGS = [
  {c:"el",f:"🇬🇷",n:"Ελληνικά",d:"ltr",s:"ΕΛ"},{c:"en",f:"🇬🇧",n:"English",d:"ltr",s:"EN"},
  {c:"ar",f:"🇸🇦",n:"العربية",d:"rtl",s:"AR"},{c:"zh",f:"🇨🇳",n:"中文",d:"ltr",s:"ZH"},
  {c:"es",f:"🇪🇸",n:"Español",d:"ltr",s:"ES"},{c:"fr",f:"🇫🇷",n:"Français",d:"ltr",s:"FR"},
  {c:"ro",f:"🇷🇴",n:"Română",d:"ltr",s:"RO"},{c:"pl",f:"🇵🇱",n:"Polski",d:"ltr",s:"PL"},
  {c:"tr",f:"🇹🇷",n:"Türkçe",d:"ltr",s:"TR"},{c:"hi",f:"🇮🇳",n:"हिन्दी",d:"ltr",s:"HI"},
  {c:"ur",f:"🇵🇰",n:"اردو",d:"rtl",s:"UR"},{c:"ja",f:"🇯🇵",n:"日本語",d:"ltr",s:"JA"},
  {c:"ru",f:"🇷🇺",n:"Русский",d:"ltr",s:"RU"},{c:"de",f:"🇩🇪",n:"Deutsch",d:"ltr",s:"DE"},
  {c:"pt",f:"🇧🇷",n:"Português",d:"ltr",s:"PT"},{c:"it",f:"🇮🇹",n:"Italiano",d:"ltr",s:"IT"},
  {c:"nl",f:"🇳🇱",n:"Nederlands",d:"ltr",s:"NL"},{c:"bn",f:"🇧🇩",n:"বাংলা",d:"ltr",s:"BN"},
  {c:"id",f:"🇮🇩",n:"Indonesia",d:"ltr",s:"ID"},{c:"sw",f:"🇰🇪",n:"Kiswahili",d:"ltr",s:"SW"},
  {c:"fil",f:"🇵🇭",n:"Filipino",d:"ltr",s:"FIL"},{c:"mr",f:"🇮🇳",n:"मराठी",d:"ltr",s:"MR"},
  {c:"te",f:"🇮🇳",n:"తెలుగు",d:"ltr",s:"TE"},
];

const COUNTRIES = [
  {code:"GR",name:"Greece"},{code:"CY",name:"Cyprus"},
  {code:"GB",name:"United Kingdom"},{code:"US",name:"United States"},{code:"AU",name:"Australia"},{code:"CA",name:"Canada"},{code:"IE",name:"Ireland"},
  {code:"SA",name:"Saudi Arabia"},{code:"AE",name:"UAE"},{code:"EG",name:"Egypt"},{code:"JO",name:"Jordan"},{code:"LB",name:"Lebanon"},{code:"MA",name:"Morocco"},
  {code:"CN",name:"China"},{code:"TW",name:"Taiwan"},{code:"HK",name:"Hong Kong"},
  {code:"ES",name:"Spain"},{code:"MX",name:"Mexico"},{code:"AR",name:"Argentina"},
  {code:"FR",name:"France"},{code:"BE",name:"Belgium"},
  {code:"RO",name:"Romania"},{code:"MD",name:"Moldova"},
  {code:"PL",name:"Poland"},{code:"TR",name:"Turkey"},{code:"IN",name:"India"},{code:"PK",name:"Pakistan"},{code:"JP",name:"Japan"},
  {code:"RU",name:"Russia"},{code:"UA",name:"Ukraine"},
  {code:"DE",name:"Germany"},{code:"AT",name:"Austria"},{code:"CH",name:"Switzerland"},
  {code:"BR",name:"Brazil"},{code:"PT",name:"Portugal"},{code:"IT",name:"Italy"},{code:"NL",name:"Netherlands"},
  {code:"BD",name:"Bangladesh"},{code:"ID",name:"Indonesia"},
  {code:"KE",name:"Kenya"},{code:"TZ",name:"Tanzania"},{code:"UG",name:"Uganda"},{code:"PH",name:"Philippines"},
  {code:"NZ",name:"New Zealand"},{code:"ZA",name:"South Africa"},{code:"NG",name:"Nigeria"},{code:"GH",name:"Ghana"},
  {code:"OTHER",name:"Other"},
];

function ageMonthsFromBirthDate(birthDateStr?: string): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

function formatChildAge(birthDateStr: string | undefined, lang: string): string {
  const months = ageMonthsFromBirthDate(birthDateStr);
  if (months === null) return "";
  if (months < 1) {
    const birth = new Date(birthDateStr!);
    const days = Math.max(0, Math.floor((Date.now() - birth.getTime()) / 86400000));
    return `${days} ${t("unit_days", lang)}`;
  }
  if (months < 24) return `${months} ${t("unit_months", lang)}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years} ${t("unit_years", lang)} ${rem} ${t("unit_months", lang)}` : `${years} ${t("unit_years", lang)}`;
}

function pregnancyWeekFromDueDate(dueDateStr?: string): number | null {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return null;
  const daysLeft = Math.round((due.getTime() - Date.now()) / 86400000);
  const gestDays = 280 - daysLeft;
  return Math.max(1, Math.min(42, Math.floor(gestDays / 7)));
}

function getAllChildren(profile: Profile): ChildEntity[] {
  if (profile.children && profile.children.length > 0) return profile.children;
  if (profile.childName) return [{ name: profile.childName, birthDate: profile.childBirthDate || "" }];
  return [];
}

function isDueDatePassed(dueDateStr?: string): boolean {
  if (!dueDateStr) return false;
  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

function parseAgeMonths(ageStr: string): number {
  const s = ageStr.toLowerCase();
  const m = s.match(/(\d+)\s*(μήν|month|mese|mois|monat|mes|mies|maand|miesi|lun|ay|bulan|mwez|buwan|महीन|ماه|月|ヶ月|мес|місяц|tháng)/);
  if (m) return parseInt(m[1]);
  const w = s.match(/(\d+)\s*(εβδ|week|settim|semain|woch|semana|tygod|hafta|minggu|wiki|linggo|सप्त|هفت|周|週|нед|тижн|tuần)/);
  if (w) return Math.floor(parseInt(w[1]) / 4.3);
  const y = s.match(/(\d+)\s*(έτ|χρον|year|anno|an\b|jahr|año|rok|jaar|yıl|tahun|mwak|taon|साल|سال|岁|歳|год|рік|năm)/);
  if (y) return parseInt(y[1]) * 12;
  const n = parseInt(s); if (!isNaN(n)) return n;
  return 0;
}

const MILESTONE_RANGES: [number,number][] = [
  [0,1],[1,3],[2,4],[3,5],[4,6],[6,9],[9,12],[12,18],[18,24],[24,36]
];

const MILESTONE_TRANSLATIONS: Record<string, string[][]> = {
  el: [
    ["Αντιδρά σε δυνατούς ήχους","Εστιάζει σε κοντινά πρόσωπα","Βγάζει μικρούς ήχους από το λαιμό","Φέρνει τα χέρια στο πρόσωπο","Κουνά χέρια και πόδια συμμετρικά"],
    ["Χαμογελά κοινωνικά","Ακολουθεί κινούμενα αντικείμενα με τα μάτια","Σηκώνει λίγο το κεφάλι στο στομάχι","Βγάζει ήχους ευχαρίστησης","Αναγνωρίζει τη φωνή των γονιών","Αντιδρά στην αγκαλιά"],
    ["Κρατά το κεφάλι σταθερό όρθιο","Ανοίγει και κλείνει τα χεράκια","Χτυπά κρεμαστά αντικείμενα","Αρχίζει να μπαμπαΐζει","Γελά δυνατά","Παρατηρεί τα χεράκια του"],
    ["Κυλιέται από το στομάχι στην πλάτη","Κάθεται με υποστήριξη","Απλώνεται και αρπάζει αντικείμενα","Μπαμπαΐζει με σύμφωνα","Αναγνωρίζει γνωστά πρόσωπα","Μιμείται εκφράσεις προσώπου"],
    ["Κυλιέται και προς τις δύο κατευθύνσεις","Βάζει αντικείμενα στο στόμα","Μεταφέρει αντικείμενα χέρι-χέρι","Δείχνει ετοιμότητα για στερεά τροφή","Ανταποκρίνεται στο όνομά του","Παρακολουθεί καλά κινούμενα αντικείμενα"],
    ["Κάθεται χωρίς υποστήριξη","Σέρνεται ή μετακινείται","Τραβιέται όρθιο","Λέει μαμά ή μπαμπά","Χτυπά αντικείμενα μεταξύ τους","Αναπτύσσει άγχος ξένου","Τρώει μόνο του με τα δαχτυλάκια"],
    ["Στέκεται μόνο του στιγμιαία","Κάνει τα πρώτα βήματα","Δείχνει με το δείκτη","Λέει 1-2 λέξεις","Παίζει κρυφτό","Χρησιμοποιεί ποτήρι με βοήθεια","Μιμείται πράξεις και ήχους"],
    ["Περπατά ανεξάρτητα","Λέει 3-6 λέξεις","Ακολουθεί απλές οδηγίες","Στοιβάζει 2 τουβλάκια","Χαιρετά αντίο","Δείχνει πράγματα","Πίνει από ποτήρι"],
    ["Τρέχει σταθερά","Λέει 10-20 λέξεις","Συνδυάζει 2 λέξεις","Χρησιμοποιεί κουτάλι","Δείχνει μέρη του σώματος","Παίζει δίπλα σε άλλα παιδιά","Ανεβοκατεβαίνει έπιπλα"],
    ["Μιλά με προτάσεις 2-3 λέξεων","Πηδά με τα δύο πόδια","Κλωτσά μπάλα","Γυρίζει σελίδες βιβλίου","Ονομάζει εικόνες","Παίζει φανταστικά παιχνίδια","Καταλαβαίνει δικό μου και δικό σου"],
  ],
  en: [
    ["Responds to loud sounds","Focuses on faces close up","Makes small throaty noises","Brings hands to face","Moves arms and legs symmetrically"],
    ["Smiles socially at faces","Follows moving objects with eyes","Holds head up briefly on tummy","Makes cooing sounds","Recognises parent voice","Reacts to being held"],
    ["Holds head steady when held upright","Opens and closes hands","Bats at dangling objects","Begins to babble","Laughs out loud","Notices own hands"],
    ["Rolls from tummy to back","Sits with support","Reaches for and grasps objects","Babbles with consonant sounds","Recognises familiar faces","Imitates facial expressions"],
    ["Rolls in both directions","Brings objects to mouth","Transfers objects hand to hand","Ready for solid foods","Responds to own name","Tracks moving objects well"],
    ["Sits without support","Crawls or scoots","Pulls to stand","Says mama or dada","Bangs objects together","Develops stranger anxiety","Feeds self finger foods"],
    ["Stands momentarily alone","Takes first steps","Points with index finger","Says 1-2 words","Plays peek-a-boo","Uses cup with help","Imitates actions and sounds"],
    ["Walks independently","Says 3-6 words","Follows simple instructions","Stacks 2 blocks","Waves bye-bye","Points to show things","Drinks from a cup"],
    ["Runs steadily","Says 10-20 words","Combines 2 words","Uses spoon","Points to body parts","Plays alongside other children","Climbs on/off furniture"],
    ["Speaks in 2-3 word sentences","Jumps with both feet","Kicks a ball","Turns book pages","Names pictures in a book","Plays make-believe","Understands mine and yours"],
  ],
  ar: [
    ["يستجيب للأصوات العالية","يركز على الوجوه القريبة","يصدر أصواتاً صغيرة من حلقه","يضع يديه على وجهه","يحرك ذراعيه وساقيه بشكل متماثل"],
    ["يبتسم اجتماعياً","يتابع الأشياء المتحركة بعينيه","يرفع رأسه قليلاً على بطنه","يصدر أصوات مناغاة","يتعرف على صوت والديه","يستجيب للاحتضان"],
    ["يثبت رأسه عند حمله","يفتح ويغلق يديه","يضرب الأشياء المعلقة","يبدأ في المناغاة","يضحك بصوت عالٍ","يلاحظ يديه"],
    ["يتدحرج من البطن إلى الظهر","يجلس بمساعدة","يمد يده ويمسك الأشياء","يناغي بأصوات الحروف","يتعرف على الوجوه المألوفة","يقلد تعابير الوجه"],
    ["يتدحرج في كلا الاتجاهين","يضع الأشياء في فمه","ينقل الأشياء من يد لأخرى","مستعد للطعام الصلب","يستجيب لاسمه","يتابع الأشياء المتحركة جيداً"],
    ["يجلس بدون مساعدة","يزحف أو يتحرك","يسحب نفسه للوقوف","يقول ماما أو بابا","يدق الأشياء معاً","يطور قلق الغرباء","يأكل بأصابعه"],
    ["يقف لحظياً وحده","يخطو أولى خطواته","يشير بإصبعه","يقول كلمة أو كلمتين","يلعب الغميضة","يستخدم الكوب بمساعدة","يقلد الأفعال والأصوات"],
    ["يمشي باستقلالية","يقول ثلاث إلى ست كلمات","يتبع التعليمات البسيطة","يكدس مكعبين","يلوح للوداع","يشير للأشياء","يشرب من الكوب"],
    ["يركض بثبات","يقول عشر إلى عشرين كلمة","يجمع كلمتين","يستخدم الملعقة","يشير لأجزاء جسمه","يلعب بجانب أطفال آخرين","يتسلق الأثاث"],
    ["يتحدث بجمل قصيرة","يقفز بكلتا قدميه","يركل كرة","يقلب صفحات الكتاب","يسمي الصور","يلعب الخيال","يفهم مفهوم ملكيتي وملكيتك"],
  ],
  zh: [
    ["对大声音有反应","能聚焦于近距离的脸","发出小喉音","把手放到脸上","手脚对称移动"],
    ["对着脸社交性微笑","用眼睛跟踪移动物体","趴着时短暂抬头","发出咿呀声","认出父母的声音","对被抱起有反应"],
    ["竖抱时头部稳定","张开和握紧手","拍打悬挂物体","开始咿呀学语","大声笑","注意自己的手"],
    ["从肚子翻到背部","有支撑地坐","伸手抓取物体","用辅音咿呀","认出熟悉的脸","模仿面部表情"],
    ["向两侧翻滚","把物体放进嘴里","双手传递物体","准备好吃辅食","对自己的名字有反应","很好地追踪移动物体"],
    ["独立坐","爬行或挪动","拉着站起来","说妈妈或爸爸","把物体敲在一起","产生陌生人焦虑","自己用手指吃东西"],
    ["短暂独立站立","迈出第一步","用食指指向","说一两个词","玩捉迷藏","在帮助下使用杯子","模仿动作和声音"],
    ["独立行走","说几个词","遵循简单指令","堆积木","挥手再见","指向事物","用杯子喝水"],
    ["稳定跑步","说更多词汇","组合词语","使用勺子","指向身体部位","与其他孩子一起玩","爬上爬下家具"],
    ["说短句子","双脚跳","踢球","翻书页","说出图片名称","玩角色扮演","理解我的和你的"],
  ],
  es: [
    ["Responde a sonidos fuertes","Se enfoca en caras cercanas","Hace pequeños ruidos de garganta","Lleva manos a la cara","Mueve brazos y piernas simétricamente"],
    ["Sonríe socialmente","Sigue objetos en movimiento con los ojos","Levanta la cabeza brevemente boca abajo","Hace sonidos de arrullo","Reconoce la voz de los padres","Reacciona al ser cargado"],
    ["Sostiene la cabeza estable","Abre y cierra las manos","Golpea objetos colgantes","Empieza a balbucear","Se ríe en voz alta","Observa sus propias manos"],
    ["Rueda de boca abajo a boca arriba","Se sienta con apoyo","Alcanza y agarra objetos","Balbucea con consonantes","Reconoce caras familiares","Imita expresiones faciales"],
    ["Rueda en ambas direcciones","Lleva objetos a la boca","Transfiere objetos de mano en mano","Listo para alimentos sólidos","Responde a su nombre","Sigue objetos en movimiento bien"],
    ["Se sienta sin apoyo","Gatea o se arrastra","Se jala para pararse","Dice mamá o papá","Golpea objetos juntos","Desarrolla ansiedad ante extraños","Se alimenta con los dedos"],
    ["Se para momentáneamente solo","Da los primeros pasos","Señala con el dedo índice","Dice algunas palabras","Juega a las escondidas","Usa taza con ayuda","Imita acciones y sonidos"],
    ["Camina de forma independiente","Dice varias palabras","Sigue instrucciones simples","Apila bloques","Dice adiós con la mano","Señala para mostrar cosas","Bebe de una taza"],
    ["Corre establemente","Dice muchas palabras","Combina palabras","Usa cuchara","Señala partes del cuerpo","Juega junto a otros niños","Sube y baja muebles"],
    ["Habla en oraciones cortas","Salta con ambos pies","Patea una pelota","Pasa páginas de libros","Nombra imágenes","Juega a la fantasía","Entiende mío y tuyo"],
  ],
  fr: [
    ["Réagit aux sons forts","Se concentre sur les visages proches","Fait de petits bruits de gorge","Porte les mains au visage","Bouge les bras et jambes symétriquement"],
    ["Sourit socialement","Suit des objets en mouvement des yeux","Lève brièvement la tête sur le ventre","Fait des sons de roucoulement","Reconnaît la voix des parents","Réagit au fait d'être tenu"],
    ["Tient la tête stable","Ouvre et ferme les mains","Frappe les objets suspendus","Commence à babiller","Rit aux éclats","Remarque ses propres mains"],
    ["Roule du ventre au dos","S'assoit avec soutien","Attrape et saisit des objets","Babille avec des consonnes","Reconnaît des visages familiers","Imite les expressions du visage"],
    ["Roule dans les deux sens","Porte des objets à la bouche","Transfère des objets de main en main","Prêt pour les aliments solides","Répond à son prénom","Suit bien les objets en mouvement"],
    ["S'assoit sans soutien","Rampe ou se déplace","Se tire debout","Dit maman ou papa","Frappe des objets ensemble","Développe l'anxiété des étrangers","Se nourrit avec les doigts"],
    ["Se tient debout momentanément","Fait ses premiers pas","Pointe avec l'index","Dit quelques mots","Joue à cache-cache","Utilise une tasse avec aide","Imite des actions et sons"],
    ["Marche de façon autonome","Dit plusieurs mots","Suit des instructions simples","Empile des blocs","Fait au revoir","Pointe pour montrer","Boit dans une tasse"],
    ["Court régulièrement","Dit beaucoup de mots","Combine des mots","Utilise une cuillère","Pointe les parties du corps","Joue avec d'autres enfants","Monte et descend des meubles"],
    ["Parle en phrases courtes","Saute avec les deux pieds","Botte un ballon","Tourne les pages","Nomme des images","Joue à faire semblant","Comprend le mien et le tien"],
  ],
  de: [
    ["Reagiert auf laute Geräusche","Fokussiert auf nahe Gesichter","Macht kleine Kehlgeräusche","Bringt Hände zum Gesicht","Bewegt Arme und Beine symmetrisch"],
    ["Lächelt sozial","Verfolgt bewegende Objekte mit Augen","Hebt kurz den Kopf auf dem Bauch","Macht Gurren-Geräusche","Erkennt die Stimme der Eltern","Reagiert auf Halten"],
    ["Hält Kopf stabil aufrecht","Öffnet und schließt Hände","Schlägt hängende Objekte","Fängt an zu plappern","Lacht laut","Bemerkt eigene Hände"],
    ["Rollt von Bauch auf Rücken","Sitzt mit Unterstützung","Greift nach Objekten","Plappern mit Konsonanten","Erkennt bekannte Gesichter","Imitiert Gesichtsausdrücke"],
    ["Rollt in beide Richtungen","Bringt Objekte zum Mund","Übergibt Objekte Hand zu Hand","Bereit für Beikost","Reagiert auf eigenen Namen","Verfolgt bewegende Objekte gut"],
    ["Sitzt ohne Unterstützung","Krabbelt oder robbt","Zieht sich zum Stehen","Sagt Mama oder Papa","Schlägt Objekte zusammen","Entwickelt Fremdenangst","Isst selbst mit Fingern"],
    ["Steht kurz allein","Macht erste Schritte","Zeigt mit dem Zeigefinger","Sagt einige Wörter","Spielt Kuckuck","Nutzt Tasse mit Hilfe","Imitiert Handlungen und Geräusche"],
    ["Geht selbstständig","Sagt mehrere Wörter","Befolgt einfache Anweisungen","Stapelt Blöcke","Winkt tschüss","Zeigt auf Dinge","Trinkt aus Tasse"],
    ["Läuft gleichmäßig","Sagt viele Wörter","Kombiniert Wörter","Nutzt Löffel","Zeigt Körperteile","Spielt neben anderen Kindern","Klettert auf Möbel"],
    ["Spricht in kurzen Sätzen","Springt mit beiden Beinen","Kickt einen Ball","Dreht Buchseiten","Benennt Bilder","Spielt Phantasiespiele","Versteht meins und deins"],
  ],
  pt: [
    ["Responde a sons altos","Foca em rostos próximos","Faz pequenos sons guturais","Leva mãos ao rosto","Move braços e pernas simetricamente"],
    ["Sorri socialmente","Segue objetos em movimento com os olhos","Levanta a cabeça brevemente de bruços","Faz sons de arrullo","Reconhece a voz dos pais","Reage a ser segurado"],
    ["Mantém a cabeça estável","Abre e fecha as mãos","Bate em objetos pendurados","Começa a balbuciar","Ri em voz alta","Nota as próprias mãos"],
    ["Rola de bruços para as costas","Senta com apoio","Estende-se e agarra objetos","Balbucia com consoantes","Reconhece rostos familiares","Imita expressões faciais"],
    ["Rola em ambas as direções","Leva objetos à boca","Transfere objetos de mão em mão","Pronto para sólidos","Responde ao próprio nome","Segue objetos em movimento"],
    ["Senta sem apoio","Engatinha ou se arrasta","Puxa-se para ficar de pé","Diz mamã ou papá","Bate objetos juntos","Desenvolve ansiedade com estranhos","Come com os dedos"],
    ["Fica de pé momentaneamente","Dá os primeiros passos","Aponta com o dedo indicador","Diz algumas palavras","Brinca de esconde-esconde","Usa copo com ajuda","Imita ações e sons"],
    ["Anda de forma independente","Diz várias palavras","Segue instruções simples","Empilha blocos","Acena tchau","Aponta para mostrar","Bebe de um copo"],
    ["Corre firmemente","Diz muitas palavras","Combina palavras","Usa colher","Aponta partes do corpo","Brinca ao lado de outras crianças","Sobe e desce móveis"],
    ["Fala em frases curtas","Salta com os dois pés","Chuta uma bola","Vira páginas de livros","Nomeia imagens","Brinca de faz-de-conta","Entende meu e seu"],
  ],
  it: [
    ["Risponde ai suoni forti","Si concentra sui visi vicini","Fa piccoli rumori di gola","Porta le mani al viso","Muove braccia e gambe simmetricamente"],
    ["Sorride socialmente","Segue gli oggetti in movimento con gli occhi","Solleva brevemente la testa a pancia in giù","Fa suoni di tubare","Riconosce la voce dei genitori","Reagisce all'essere tenuto"],
    ["Tiene la testa ferma","Apre e chiude le mani","Colpisce gli oggetti appesi","Inizia a balbettare","Ride forte","Nota le proprie mani"],
    ["Rotola dalla pancia alla schiena","Si siede con supporto","Si allunga e afferra oggetti","Balbetta con consonanti","Riconosce visi familiari","Imita le espressioni del viso"],
    ["Rotola in entrambe le direzioni","Porta oggetti alla bocca","Trasferisce oggetti da mano a mano","Pronto per i cibi solidi","Risponde al proprio nome","Segue bene gli oggetti in movimento"],
    ["Si siede senza supporto","Gattonа o striscia","Si tira in piedi","Dice mamma o papà","Batte oggetti insieme","Sviluppa ansia da estranei","Si nutre con le dita"],
    ["Sta in piedi momentaneamente","Fa i primi passi","Indica con il dito indice","Dice alcune parole","Gioca a nascondino","Usa il bicchiere con aiuto","Imita azioni e suoni"],
    ["Cammina in modo indipendente","Dice diverse parole","Segue istruzioni semplici","Impila blocchi","Fa ciao con la mano","Indica per mostrare","Beve da un bicchiere"],
    ["Corre stabilmente","Dice molte parole","Combina parole","Usa il cucchiaio","Indica le parti del corpo","Gioca accanto ad altri bambini","Sale e scende dai mobili"],
    ["Parla in frasi brevi","Salta con entrambi i piedi","Calcia un pallone","Gira le pagine dei libri","Nomina le immagini","Gioca a far finta","Capisce mio e tuo"],
  ],
  ru: [
    ["Реагирует на громкие звуки","Фокусируется на близких лицах","Издаёт маленькие горловые звуки","Подносит руки к лицу","Двигает руками и ногами симметрично"],
    ["Социально улыбается","Следит за движущимися объектами","Кратко поднимает голову лёжа на животе","Издаёт воркующие звуки","Узнаёт голос родителей","Реагирует на объятия"],
    ["Держит голову устойчиво","Открывает и закрывает руки","Бьёт по подвешенным предметам","Начинает лепетать","Смеётся громко","Замечает собственные руки"],
    ["Переворачивается с живота на спину","Сидит с поддержкой","Тянется и хватает предметы","Лепечет с согласными","Узнаёт знакомые лица","Имитирует выражения лица"],
    ["Переворачивается в обоих направлениях","Тянет предметы в рот","Перекладывает предметы из руки в руку","Готов к прикорму","Откликается на своё имя","Хорошо следит за движущимися объектами"],
    ["Сидит без поддержки","Ползает или передвигается","Подтягивается стоять","Говорит мама или папа","Стучит предметами","Развивается тревога перед чужими","Кормит себя пальцами"],
    ["Стоит мгновенно самостоятельно","Делает первые шаги","Указывает указательным пальцем","Говорит несколько слов","Играет в прятки","Пользуется кружкой с помощью","Имитирует действия и звуки"],
    ["Ходит самостоятельно","Говорит много слов","Выполняет простые инструкции","Складывает кубики","Машет пока","Указывает чтобы показать","Пьёт из кружки"],
    ["Бегает устойчиво","Говорит всё больше слов","Комбинирует слова","Пользуется ложкой","Указывает части тела","Играет рядом с другими детьми","Залезает на мебель"],
    ["Говорит короткими предложениями","Прыгает двумя ногами","Пинает мяч","Переворачивает страницы","Называет картинки","Играет в воображаемые игры","Понимает моё и твоё"],
  ],
  tr: [
    ["Yüksek seslere tepki verir","Yakın yüzlere odaklanır","Küçük boğaz sesleri çıkarır","Ellerini yüzüne götürür","Kollarını ve bacaklarını simetrik hareket ettirir"],
    ["Sosyal gülümseme yapar","Gözleriyle hareketli nesneleri takip eder","Karnında kısa süre başını kaldırır","Guguldama sesleri çıkarır","Ebeveynlerin sesini tanır","Tutulmaya tepki verir"],
    ["Dik tutulunca başını sabit tutar","Ellerini açıp kapatır","Asılı nesnelere vurur","Babıldamaya başlar","Yüksek sesle güler","Kendi ellerini fark eder"],
    ["Karından sırta yuvarlanır","Destekle oturur","Nesnelere uzanır ve kavrar","Ünsüzlerle babıldar","Tanıdık yüzleri tanır","Yüz ifadelerini taklit eder"],
    ["Her iki yönde yuvarlanır","Nesneleri ağzına götürür","Nesneleri elden ele aktarır","Katı gıdalara hazır","Kendi adına tepki verir","Hareketli nesneleri iyi takip eder"],
    ["Desteksiz oturur","Emekler veya kayar","Ayağa kalkmak için çeker","Mama veya baba der","Nesneleri birbirine vurur","Yabancı kaygısı gelişir","Kendi kendine parmak yiyecek yer"],
    ["Anlık tek başına durur","İlk adımlarını atar","İşaret parmağıyla gösterir","Birkaç kelime söyler","Saklambaç oynar","Yardımla bardak kullanır","Eylemleri ve sesleri taklit eder"],
    ["Bağımsız yürür","Birçok kelime söyler","Basit talimatları takip eder","Blok üst üste koyar","Hoşça kal için el sallar","Göstermek için işaret eder","Bardaktan içer"],
    ["Düzenli koşar","Çok kelime söyler","Kelimeleri birleştirir","Kaşık kullanır","Vücut parçalarını gösterir","Diğer çocukların yanında oynar","Mobilyalara çıkar"],
    ["Kısa cümleler kurar","İki ayakla zıplar","Topa vurur","Kitap sayfası çevirir","Resimleri adlandırır","Hayal oyunu oynar","Benimki ve seninki kavramını anlar"],
  ],
  hi: [
    ["तेज आवाजों पर प्रतिक्रिया देता है","पास के चेहरों पर ध्यान देता है","छोटी गले की आवाजें निकालता है","हाथ चेहरे पर लाता है","हाथ-पैर सममित रूप से हिलाता है"],
    ["सामाजिक मुस्कान देता है","आंखों से चलती वस्तुओं को देखता है","पेट के बल सिर थोड़ा उठाता है","गुनगुनाता है","माता-पिता की आवाज पहचानता है","गोद में रहने पर प्रतिक्रिया देता है"],
    ["सिर स्थिर रखता है","हाथ खोलता-बंद करता है","लटकती चीजों को मारता है","बोलने की शुरुआत करता है","जोर से हंसता है","अपने हाथ देखता है"],
    ["पेट से पीठ पर लुढ़कता है","सहारे से बैठता है","वस्तु पकड़ने की कोशिश करता है","व्यंजन ध्वनियों के साथ बोलता है","जाने-पहचाने चेहरे पहचानता है","चेहरे के भाव नकल करता है"],
    ["दोनों दिशाओं में लुढ़कता है","मुंह में वस्तु डालता है","एक हाथ से दूसरे में वस्तु देता है","ठोस आहार के लिए तैयार है","अपने नाम पर प्रतिक्रिया देता है","चलती वस्तुओं को अच्छे से देखता है"],
    ["बिना सहारे बैठता है","रेंगता है","खड़े होने के लिए खिंचाव करता है","माँ या पापा कहता है","वस्तुएं एक साथ ठोकता है","अजनबी से डरता है","उंगलियों से खाता है"],
    ["क्षण भर अकेले खड़ा होता है","पहले कदम उठाता है","उंगली से इशारा करता है","कुछ शब्द बोलता है","आँख-मिचौनी खेलता है","मदद से कप उपयोग करता है","क्रियाओं और ध्वनियों की नकल करता है"],
    ["स्वतंत्र रूप से चलता है","कई शब्द बोलता है","सरल निर्देश मानता है","ब्लॉक रखता है","अलविदा हाथ हिलाता है","चीजें दिखाने के लिए इशारा करता है","कप से पीता है"],
    ["स्थिर दौड़ता है","बहुत शब्द बोलता है","शब्द जोड़ता है","चम्मच उपयोग करता है","शरीर के अंग बताता है","अन्य बच्चों के साथ खेलता है","फर्नीचर पर चढ़ता है"],
    ["छोटे वाक्य बोलता है","दोनों पैरों से कूदता है","गेंद लात मारता है","किताब के पन्ने पलटता है","तस्वीरें नाम बताता है","कल्पना खेल खेलता है","मेरा और तुम्हारा समझता है"],
  ],
  ur: [
    ["تیز آوازوں پر ردعمل دیتا ہے","قریبی چہروں پر توجہ دیتا ہے","چھوٹی گلے کی آوازیں نکالتا ہے","ہاتھ چہرے پر لاتا ہے","بازو پاؤں یکساں حرکت کرتے ہیں"],
    ["سماجی مسکراہٹ دیتا ہے","آنکھوں سے حرکت کرتی اشیاء دیکھتا ہے","پیٹ کے بل سر اٹھاتا ہے","گنگناتا ہے","والدین کی آواز پہچانتا ہے","گود میں ہونے پر ردعمل دیتا ہے"],
    ["سر مستحکم رکھتا ہے","ہاتھ کھولتا بند کرتا ہے","لٹکتی چیزوں کو مارتا ہے","بولنا شروع کرتا ہے","زور سے ہنستا ہے","اپنے ہاتھ دیکھتا ہے"],
    ["پیٹ سے پیٹھ پر لڑھکتا ہے","سہارے سے بیٹھتا ہے","چیز پکڑتا ہے","حروف کے ساتھ بولتا ہے","جانے پہچانے چہرے پہچانتا ہے","چہرے کی نقل کرتا ہے"],
    ["دونوں طرف لڑھکتا ہے","منہ میں چیز ڈالتا ہے","ایک ہاتھ سے دوسرے میں چیز دیتا ہے","ٹھوس خوراک کے لیے تیار ہے","اپنے نام پر ردعمل دیتا ہے","حرکت کرتی چیزیں دیکھتا ہے"],
    ["بغیر سہارے بیٹھتا ہے","گھٹنوں کے بل چلتا ہے","کھڑے ہونے کی کوشش کرتا ہے","ماما یا بابا کہتا ہے","چیزیں ٹکراتا ہے","اجنبی سے خوف رکھتا ہے","انگلیوں سے کھاتا ہے"],
    ["لمحے کھڑا ہوتا ہے","پہلے قدم اٹھاتا ہے","انگلی سے اشارہ کرتا ہے","کچھ الفاظ بولتا ہے","آنکھ مچولی کھیلتا ہے","مدد سے کپ استعمال کرتا ہے","حرکات کی نقل کرتا ہے"],
    ["آزادانہ چلتا ہے","کئی الفاظ بولتا ہے","سادہ ہدایات مانتا ہے","بلاک رکھتا ہے","خداحافظ ہاتھ ہلاتا ہے","اشارہ کرتا ہے","کپ سے پیتا ہے"],
    ["مستحکم دوڑتا ہے","بہت الفاظ بولتا ہے","الفاظ ملاتا ہے","چمچ استعمال کرتا ہے","جسم کے حصے دکھاتا ہے","دوسرے بچوں کے ساتھ کھیلتا ہے","فرنیچر پر چڑھتا ہے"],
    ["مختصر جملے بولتا ہے","دونوں پاؤں سے کودتا ہے","گیند کو لات مارتا ہے","کتاب کے صفحے پلٹتا ہے","تصویریں نام بتاتا ہے","خیالی کھیل کھیلتا ہے","میرا اور تمہارا سمجھتا ہے"],
  ],
  ja: [
    ["大きな音に反応する","近くの顔に集中する","小さな喉の音を出す","手を顔に持ってくる","手足を対称的に動かす"],
    ["社会的に笑顔になる","動く物を目で追う","うつぶせで頭を少し上げる","クーイングをする","親の声を認識する","抱っこに反応する"],
    ["縦抱きで頭が安定する","手を開いたり閉じたりする","ぶら下がっているものを叩く","喃語を始める","声を出して笑う","自分の手に気づく"],
    ["うつぶせから仰向けに転がる","支えがあれば座る","物に手を伸ばしてつかむ","子音を使った喃語","見慣れた顔を認識する","表情を真似する"],
    ["両方向に転がる","物を口に持っていく","物を手から手へ移す","離乳食の準備ができる","自分の名前に反応する","動く物をよく追う"],
    ["支えなしで座る","ハイハイする","つかまり立ちをする","ママまたはパパという","物を叩き合わせる","人見知りが始まる","手づかみ食べをする"],
    ["一時的に一人で立つ","初めて歩く","人差し指で指差す","いくつかの言葉を話す","いないいないばあで遊ぶ","助けを借りてカップを使う","行動や音を真似する"],
    ["一人で歩く","たくさんの言葉を話す","簡単な指示に従う","ブロックを積む","バイバイをする","物を指差して示す","カップから飲む"],
    ["安定して走る","ますます言葉が増える","言葉を組み合わせる","スプーンを使う","体の部位を指す","他の子どもと並んで遊ぶ","家具に登り降りする"],
    ["短い文を話す","両足でジャンプする","ボールを蹴る","本のページをめくる","絵本の絵の名前を言う","ごっこ遊びをする","自分のものと相手のものを理解する"],
  ],
  nl: [
    ["Reageert op harde geluiden","Focust op dichtbij gezichten","Maakt kleine keelgeluiden","Brengt handen naar gezicht","Beweegt armen en benen symmetrisch"],
    ["Lacht sociaal","Volgt bewegende objecten met ogen","Heft hoofd kort op buik","Maakt koerende geluiden","Herkent stem van ouders","Reageert op vastgehouden worden"],
    ["Houdt hoofd stabiel rechtop","Opent en sluit handen","Slaat hangende objecten","Begint te brabbelen","Lacht hardop","Merkt eigen handen op"],
    ["Rolt van buik naar rug","Zit met ondersteuning","Reikt naar en pakt objecten","Brabbelt met medeklinkers","Herkent bekende gezichten","Imiteert gezichtsuitdrukkingen"],
    ["Rolt in beide richtingen","Brengt objecten naar mond","Draagt objecten van hand tot hand","Klaar voor vaste voeding","Reageert op eigen naam","Volgt bewegende objecten goed"],
    ["Zit zonder ondersteuning","Kruipt of beweegt","Trekt zichzelf omhoog","Zegt mama of papa","Slaat objecten samen","Ontwikkelt vreemdelingenangst","Eet zelf met vingers"],
    ["Staat kort alleen","Zet eerste stappen","Wijst met wijsvinger","Zegt enkele woorden","Speelt verstoppertje","Gebruikt beker met hulp","Imiteert acties en geluiden"],
    ["Loopt zelfstandig","Zegt meerdere woorden","Volgt eenvoudige instructies","Stapelt blokken","Zwaait doei","Wijst om dingen te tonen","Drinkt uit beker"],
    ["Rent stabiel","Zegt veel woorden","Combineert woorden","Gebruikt lepel","Wijst lichaamsonderdelen","Speelt naast andere kinderen","Klimt op meubilair"],
    ["Spreekt in korte zinnen","Springt met beide voeten","Schopt een bal","Draait boekpagina's","Noemt afbeeldingen","Speelt fantasiespelletjes","Begrijpt van mij en van jou"],
  ],
  pl: [
    ["Reaguje na głośne dźwięki","Skupia się na bliskich twarzach","Wydaje małe dźwięki gardłowe","Przynosi ręce do twarzy","Porusza ramionami i nogami symetrycznie"],
    ["Uśmiecha się społecznie","Śledzi wzrokiem poruszające się obiekty","Krótko unosi głowę na brzuchu","Wydaje gruchające dźwięki","Rozpoznaje głos rodziców","Reaguje na bycie trzymanym"],
    ["Trzyma głowę stabilnie","Otwiera i zamyka rączki","Uderza w wiszące obiekty","Zaczyna gaworzyć","Śmieje się głośno","Zauważa własne rączki"],
    ["Obraca się z brzucha na plecy","Siedzi z podparciem","Sięga i chwyta przedmioty","Gawory z spółgłoskami","Rozpoznaje znane twarze","Naśladuje mimikę"],
    ["Obraca się w obu kierunkach","Wkłada obiekty do ust","Przekłada przedmioty z ręki do ręki","Gotowy na pokarmy stałe","Reaguje na własne imię","Dobrze śledzi poruszające się obiekty"],
    ["Siedzi bez podparca","Raczkuje lub czołga się","Podciąga się do stania","Mówi mama lub tata","Uderza przedmiotami","Rozwija lęk przed obcymi","Samodzielnie je paluszkami"],
    ["Stoi chwilowo samotnie","Stawia pierwsze kroki","Wskazuje palcem wskazującym","Mówi kilka słów","Bawi się w chowanego","Używa kubka z pomocą","Naśladuje czynności i dźwięki"],
    ["Chodzi samodzielnie","Mówi wiele słów","Wykonuje proste polecenia","Układa klocki","Macha na do widzenia","Wskazuje by pokazać","Pije z kubka"],
    ["Biega równomiernie","Mówi coraz więcej słów","Łączy słowa","Używa łyżki","Wskazuje części ciała","Bawi się obok innych dzieci","Wspina się na meble"],
    ["Mówi krótkimi zdaniami","Skacze obiema nogami","Kopie piłkę","Obraca strony książki","Nazywa obrazki","Bawi się w udawanie","Rozumie moje i twoje"],
  ],
  ro: [
    ["Răspunde la sunete puternice","Se concentrează pe fețe apropiate","Face zgomote mici de gât","Aduce mâinile la față","Mișcă brațele și picioarele simetric"],
    ["Zâmbește social","Urmărește obiectele în mișcare cu ochii","Ridică scurt capul pe burtă","Face sunete de gângurit","Recunoaște vocea părinților","Reacționează la a fi ținut"],
    ["Ține capul stabil","Deschide și închide mâinile","Lovește obiectele agățate","Începe să gângurească","Râde cu voce tare","Observă propriile mâini"],
    ["Se rostogolește de pe burtă pe spate","Stă cu sprijin","Se întinde și apucă obiecte","Gângurește cu consoane","Recunoaște fețe familiare","Imită expresiile feței"],
    ["Se rostogolește în ambele direcții","Aduce obiecte la gură","Transferă obiecte din mână în mână","Pregătit pentru alimente solide","Răspunde la propriul nume","Urmărește bine obiectele în mișcare"],
    ["Stă fără sprijin","Se târăște sau se mișcă","Se ridică în picioare","Spune mama sau tata","Lovește obiectele împreună","Dezvoltă anxietate față de străini","Se hrănește cu degetele"],
    ["Stă în picioare momentan singur","Face primii pași","Arată cu degetul arătător","Spune câteva cuvinte","Se joacă de-a v-ați ascunselea","Folosește cana cu ajutor","Imită acțiuni și sunete"],
    ["Merge independent","Spune multe cuvinte","Urmează instrucțiuni simple","Stivuiește blocuri","Face cu mâna la revedere","Arată pentru a indica","Bea dintr-o cană"],
    ["Aleargă stabil","Spune tot mai multe cuvinte","Combină cuvinte","Folosește lingura","Arată părțile corpului","Se joacă lângă alți copii","Se cațără pe mobilă"],
    ["Vorbește în propoziții scurte","Sare cu ambele picioare","Lovește o minge","Întoarce paginile cărții","Numește imaginile","Se joacă de-a imaginarul","Înțelege al meu și al tău"],
  ],
  bn: [
    ["জোরে শব্দে সাড়া দেয়","কাছের মুখে মনোযোগ দেয়","ছোট গলার শব্দ করে","মুখে হাত আনে","হাত-পা সমান্তরালভাবে নাড়ায়"],
    ["সামাজিকভাবে হাসে","চলমান বস্তু চোখে অনুসরণ করে","পেটে শুয়ে মাথা তোলে","গুনগুন করে","বাবা-মায়ের কণ্ঠস্বর চেনে","কোলে নেওয়ায় সাড়া দেয়"],
    ["সোজা রাখলে মাথা স্থির রাখে","হাত খোলে-বন্ধ করে","ঝুলন্ত বস্তু মারে","বকবক শুরু করে","জোরে হাসে","নিজের হাত খেয়াল করে"],
    ["পেট থেকে পিঠে গড়িয়ে যায়","সাহায্যে বসে","বস্তু ধরতে হাত বাড়ায়","ব্যঞ্জনধ্বনি দিয়ে বকবক","পরিচিত মুখ চেনে","মুখভঙ্গি নকল করে"],
    ["দুই দিকে গড়াতে পারে","বস্তু মুখে নেয়","এক হাত থেকে অন্য হাতে","শক্ত খাবারের জন্য প্রস্তুত","নিজের নামে সাড়া দেয়","চলমান বস্তু ভালো দেখে"],
    ["সাহায্য ছাড়া বসে","হামাগুড়ি দেয়","উঠে দাঁড়ায়","মামা বা বাবা বলে","বস্তু একসাথে ঠোকে","অপরিচিতদের ভয়","আঙুলে খাবার খায়"],
    ["মুহূর্তের জন্য একা দাঁড়ায়","প্রথম পদক্ষেপ নেয়","তর্জনী দিয়ে দেখায়","কিছু শব্দ বলে","লুকোচুরি খেলে","সাহায্যে কাপ ব্যবহার","কাজ ও শব্দ নকল করে"],
    ["স্বাধীনভাবে হাঁটে","অনেক শব্দ বলে","সহজ নির্দেশ মানে","ব্লক সাজায়","বিদায়ে হাত নাড়ায়","দেখাতে ইশারা করে","কাপ থেকে পান করে"],
    ["স্থির দৌড়ায়","আরও শব্দ বলে","শব্দ মেলায়","চামচ ব্যবহার করে","শরীরের অংশ দেখায়","অন্য শিশুদের পাশে খেলে","আসবাবে ওঠে"],
    ["ছোট বাক্য বলে","দুই পায়ে লাফ দেয়","বল লাথি মারে","বইয়ের পাতা উল্টায়","ছবির নাম বলে","কল্পনার খেলা খেলে","আমার ও তোমার বোঝে"],
  ],
  id: [
    ["Bereaksi terhadap suara keras","Fokus pada wajah dekat","Membuat suara kecil di tenggorokan","Membawa tangan ke wajah","Menggerakkan lengan dan kaki simetris"],
    ["Tersenyum secara sosial","Mengikuti objek bergerak dengan mata","Mengangkat kepala sebentar tengkurap","Membuat suara mendekut","Mengenali suara orang tua","Bereaksi saat dipegang"],
    ["Menahan kepala stabil","Membuka dan menutup tangan","Memukul objek gantung","Mulai mengoceh","Tertawa keras","Memperhatikan tangannya sendiri"],
    ["Berguling dari perut ke punggung","Duduk dengan dukungan","Meraih dan menggenggam objek","Mengoceh dengan konsonan","Mengenali wajah familiar","Meniru ekspresi wajah"],
    ["Berguling dua arah","Membawa objek ke mulut","Memindahkan objek dari tangan ke tangan","Siap untuk makanan padat","Merespons namanya","Melacak objek bergerak"],
    ["Duduk tanpa dukungan","Merangkak atau bergerak","Menarik diri untuk berdiri","Mengucapkan mama atau papa","Membenturkan objek","Mengembangkan kecemasan orang asing","Makan sendiri dengan jari"],
    ["Berdiri sebentar sendiri","Mengambil langkah pertama","Menunjuk dengan jari telunjuk","Mengucapkan beberapa kata","Bermain petak umpet","Menggunakan cangkir dengan bantuan","Meniru tindakan dan suara"],
    ["Berjalan mandiri","Mengucapkan banyak kata","Mengikuti instruksi sederhana","Menumpuk balok","Melambaikan tangan selamat tinggal","Menunjuk untuk menunjukkan","Minum dari cangkir"],
    ["Berlari stabil","Mengucapkan semakin banyak kata","Menggabungkan kata","Menggunakan sendok","Menunjuk bagian tubuh","Bermain di samping anak lain","Memanjat furnitur"],
    ["Berbicara dalam kalimat pendek","Melompat dengan kedua kaki","Menendang bola","Membalik halaman buku","Menyebutkan gambar","Bermain berpura-pura","Memahami milikku dan milikmu"],
  ],
  sw: [
    ["Hujibu sauti kali","Huzingatia nyuso za karibu","Hutoa sauti ndogo za koo","Hupeleka mikono usoni","Huhamisha mikono na miguu kwa ulinganifu"],
    ["Hutabasamu kijamii","Hufuatilia vitu vinavyosogea kwa macho","Huinua kichwa kidogo akiwa tumbo chini","Hutoa sauti za kuimba","Hutambua sauti za wazazi","Hujibu anaposhikiliwa"],
    ["Hushikilia kichwa imara","Hufungua na kufunga mikono","Hupiga vitu vilivyoning'inia","Huanza kupiga kelele","Hucheka kwa sauti","Huona mikono yake mwenyewe"],
    ["Hugeuza kutoka tumbo hadi mgongoni","Hukaa na msaada","Hunyosha na kushika vitu","Hupiga kelele na konsonanti","Hutambua nyuso zinazojulikana","Huigiza sura za uso"],
    ["Hugeuza pande zote mbili","Hupeleka vitu mdomoni","Huhamisha vitu kutoka mkono mmoja hadi mwingine","Yuko tayari kwa chakula kigumu","Hujibu jina lake","Hufuatilia vitu vinavyosogea vizuri"],
    ["Hukaa bila msaada","Hutambaa au kusogea","Hujivuta kusimama","Husema mama au baba","Hugonga vitu pamoja","Huendeleza wasiwasi na wageni","Hujilisha kwa vidole"],
    ["Husimama peke yake kwa muda","Huchukua hatua za kwanza","Huonyesha kwa kidole cha shahada","Husema maneno machache","Hucheza siri siri","Hutumia kikombe kwa msaada","Huigiza vitendo na sauti"],
    ["Hutembea kwa uhuru","Husema maneno mengi","Hufuata maelekezo rahisi","Hupanga vitalu","Huaga kwa mkono","Huonyesha kwa kidole","Hunywa kutoka kikombe"],
    ["Hukimbia kwa utulivu","Husema maneno zaidi","Huchanganya maneno","Hutumia kijiko","Huonyesha sehemu za mwili","Hucheza karibu na watoto wengine","Hupanda samani"],
    ["Husema sentensi fupi","Huruka kwa miguu miwili","Hupiga teke mpira","Hugeuza kurasa za kitabu","Hutaja picha","Hucheza michezo ya kufanya kama","Huelewa yangu na yako"],
  ],
  fil: [
    ["Tumutugon sa malakas na tunog","Nagtutuon sa mga mukha malapit","Gumagawa ng maliliit na tunog sa lalamunan","Dinadala ang mga kamay sa mukha","Gumagalaw ng mga braso at binti nang simetriko"],
    ["Ngumingiti nang sosyal","Sinusundan ang mga gumagalaw na bagay sa mata","Naglalagay ng ulo nang sandali habang nakahiga","Gumagawa ng malambot na tunog","Kinikilala ang boses ng magulang","Tumutugon sa paghawak"],
    ["Pinananatiling matatag ang ulo nang nakatayo","Nagbubukas at nagsasara ng mga kamay","Tinatampal ang mga nakabitin na bagay","Nagsisimulang mag-utal","Tumatawa nang malakas","Napapansin ang sariling mga kamay"],
    ["Gumugulong mula sa tiyan hanggang sa likod","Nakaupo nang may suporta","Umaabot at humahawak ng mga bagay","Nag-uutal na may katinig","Kinikilala ang mga pamilyar na mukha","Ginagaya ang mga ekspresyon ng mukha"],
    ["Gumugulong sa magkabilang direksyon","Dinadala ang mga bagay sa bibig","Inililipat ang mga bagay mula kamay patungong kamay","Handa sa mga solid na pagkain","Tumutugon sa sariling pangalan","Sinusundan nang mabuti ang mga gumagalaw na bagay"],
    ["Nakaupo nang walang suporta","Gumagapang o kumakalaw","Humihila para tumayo","Nagsasabi ng mama o papa","Tinatampal ang mga bagay","Nagkakaroon ng takot sa estranghero","Kumakain gamit ang mga daliri"],
    ["Nakatayo nang sandali nang mag-isa","Gumagawa ng mga unang hakbang","Itinuro ng hintuturo","Nagsasabi ng ilang salita","Naglalaro ng taguan","Gumagamit ng tasa nang may tulong","Ginagaya ang mga aksyon at tunog"],
    ["Naglalakad nang malaya","Nagsasabi ng maraming salita","Sumusunod sa simpleng tagubilin","Nagtatambak ng mga bloke","Nagwawagayway ng paalam","Nagtuturo para ipakita","Umiinom mula sa tasa"],
    ["Tumatakbo nang matatag","Nagsasabi ng mas maraming salita","Pinagsasama ang mga salita","Gumagamit ng kutsara","Itinuro ang mga bahagi ng katawan","Naglalaro sa tabi ng ibang mga bata","Umaakyat sa mga kasangkapan"],
    ["Nagsasalita sa maikling pangungusap","Tumatalbog gamit ang magkabilang paa","Siniipa ang isang bola","Binibiling ang mga pahina ng aklat","Pinangalanan ang mga larawan","Naglalaro ng make-believe","Naiintindihan ang akin at iyo"],
  ],
  mr: [
    ["मोठ्या आवाजांना प्रतिसाद देतो","जवळच्या चेहऱ्यांवर लक्ष केंद्रित करतो","लहान घशाचे आवाज काढतो","चेहऱ्यावर हात आणतो","हात-पाय सममितपणे हलवतो"],
    ["सामाजिकरीत्या हसतो","डोळ्यांनी हलणाऱ्या वस्तू फॉलो करतो","पोटावर असताना थोडक्यात डोके वर करतो","गुणगुणतो","पालकांचा आवाज ओळखतो","उचलून घेतल्यावर प्रतिसाद देतो"],
    ["उभे धरल्यावर डोके स्थिर ठेवतो","हात उघडतो बंद करतो","लटकणाऱ्या वस्तू मारतो","बडबड सुरू करतो","मोठ्याने हसतो","स्वतःचे हात पाहतो"],
    ["पोटावरून पाठीवर लोळतो","आधाराने बसतो","वस्तू पकडण्यासाठी हात लांब करतो","व्यंजनांसह बडबड करतो","परिचित चेहरे ओळखतो","चेहऱ्याचे हावभाव नकलवतो"],
    ["दोन्ही दिशांनी लोळतो","वस्तू तोंडात आणतो","एका हातातून दुसऱ्यात हस्तांतरित करतो","घन अन्नासाठी तयार","स्वतःच्या नावाला प्रतिसाद","हलणाऱ्या वस्तू चांगल्याप्रकारे ट्रॅक करतो"],
    ["आधाराशिवाय बसतो","रांगतो किंवा सरकतो","उभे राहण्यासाठी ओढतो","आई किंवा बाबा म्हणतो","वस्तू एकत्र ठोकतो","अनोळखी व्यक्तींची भीती विकसित होते","बोटांनी स्वतः खातो"],
    ["क्षणभर एकट्याने उभा राहतो","पहिली पावले उचलतो","तर्जनीने निर्देश करतो","काही शब्द बोलतो","लपाछपी खेळतो","मदतीने कप वापरतो","क्रिया आणि आवाज नकलवतो"],
    ["स्वतंत्रपणे चालतो","अनेक शब्द बोलतो","साध्या सूचनांचे पालन करतो","ब्लॉक रचतो","बाय-बाय हात हलवतो","गोष्टी दाखवण्यासाठी निर्देश करतो","कपातून पितो"],
    ["स्थिरपणे धावतो","अधिक शब्द बोलतो","शब्द एकत्र करतो","चमचा वापरतो","शरीराचे भाग दाखवतो","इतर मुलांशेजारी खेळतो","फर्निचरवर चढतो"],
    ["छोट्या वाक्यात बोलतो","दोन्ही पायांनी उडी मारतो","चेंडू लाथ मारतो","पुस्तकाची पाने पलटतो","चित्रांची नावे सांगतो","खोटे-खोटे खेळतो","माझे आणि तुझे समजतो"],
  ],
  te: [
    ["గట్టి శబ్దాలకు స్పందిస్తుంది","దగ్గరి ముఖాలపై దృష్టి పెడుతుంది","చిన్న గొంతు శబ్దాలు చేస్తుంది","చేతులను ముఖానికి తీసుకొస్తుంది","చేతులు కాళ్ళు సమానంగా కదిలిస్తుంది"],
    ["సామాజికంగా నవ్వుతుంది","కదిలే వస్తువులను కళ్ళతో అనుసరిస్తుంది","పొట్టపై పడుకున్నప్పుడు తలను ఎత్తుతుంది","గుటగుట శబ్దాలు చేస్తుంది","తల్లిదండ్రుల గొంతు గుర్తిస్తుంది","ఎత్తుకున్నప్పుడు స్పందిస్తుంది"],
    ["నిలబెట్టినప్పుడు తల స్థిరంగా ఉంచుతుంది","చేతులు తెరుస్తుంది మూస్తుంది","వేలాడే వస్తువులను కొడుతుంది","మాట్లాడటం మొదలుపెడుతుంది","బిగ్గరగా నవ్వుతుంది","తన చేతులను గమనిస్తుంది"],
    ["పొట్ట నుండి వెనక్కి దొర్లుతుంది","సహాయంతో కూర్చుంటుంది","వస్తువులను చేరుకుంటుంది పట్టుకుంటుంది","హల్లులతో పలుకుతుంది","పరిచయమైన ముఖాలు గుర్తిస్తుంది","ముఖ భావాలు అనుకరిస్తుంది"],
    ["రెండు వైపులా దొర్లుతుంది","వస్తువులను నోటిలో పెడుతుంది","ఒక చేయి నుండి మరొక చేతికి బదిలీ","గట్టి ఆహారానికి సిద్ధం","తన పేరుకు స్పందిస్తుంది","కదిలే వస్తువులను బాగా అనుసరిస్తుంది"],
    ["సహాయం లేకుండా కూర్చుంటుంది","పాకుతుంది","నిలబడటానికి లాగుకుంటుంది","అమ్మ లేదా నాన్న అంటుంది","వస్తువులను కొడుతుంది","అపరిచితులపై భయం అభివృద్ధి","వేళ్ళతో తినుతుంది"],
    ["క్షణికంగా ఒంటరిగా నిలబడుతుంది","మొదటి అడుగులు వేస్తుంది","చూపుడు వేలుతో చూపిస్తుంది","కొన్ని పదాలు చెప్తుంది","దాక్కుంటూ ఆడుతుంది","సహాయంతో కప్పు ఉపయోగిస్తుంది","చర్యలు శబ్దాలు అనుకరిస్తుంది"],
    ["స్వతంత్రంగా నడుస్తుంది","చాలా పదాలు చెప్తుంది","సాధారణ సూచనలు అనుసరిస్తుంది","బ్లాకులు పేరుస్తుంది","బై-బై చేయి ఊపుతుంది","చూపించడానికి సూచిస్తుంది","కప్పు నుండి తాగుతుంది"],
    ["స్థిరంగా పరుగెత్తుతుంది","మరిన్ని పదాలు చెప్తుంది","పదాలు కలుపుతుంది","చెంచా ఉపయోగిస్తుంది","శరీర భాగాలు చూపిస్తుంది","ఇతర పిల్లల పక్కన ఆడుతుంది","ఫర్నిచర్ పై ఎక్కుతుంది"],
    ["చిన్న వాక్యాలు మాట్లాడుతుంది","రెండు కాళ్ళతో దూకుతుంది","బంతిని తన్నుతుంది","పుస్తక పేజీలు తిప్పుతుంది","చిత్రాల పేర్లు చెప్తుంది","నాటకీయ ఆట ఆడుతుంది","నాది మరియు నీది అర్థం చేసుకుంటుంది"],
  ],
};

function getMilestones(ageMonths: number, lang: string): string[] {
  const translations = MILESTONE_TRANSLATIONS[lang] || MILESTONE_TRANSLATIONS["en"];
  for (let i = 0; i < MILESTONE_RANGES.length; i++) {
    const [min, max] = MILESTONE_RANGES[i];
    if (ageMonths >= min && ageMonths < max) {
      return translations[i] || MILESTONE_TRANSLATIONS["en"][i];
    }
  }
  if (ageMonths < 0) return translations[0];
  return translations[translations.length - 1];
}


const BABY_MILESTONE_MSGS_TRANSLATIONS: Record<string, string[][]> = {
  el: [
    ["🌟 Τα πας πολύ καλά! Κάθε «πρώτη φορά» είναι μοναδική και την πρόσεξες.",
     "✨ Υπέροχη στιγμή! Το μωρό κάνει ένα ακόμη βήμα και εσύ είσαι δίπλα του."],
    ["💛 Μπράβο! Η φροντίδα σου κάνει τη διαφορά κάθε μέρα.",
     "🌸 Πόσο ωραία! Είναι υπέροχες αυτές οι στιγμές — αξίζει να τις θυμάσαι.",
     "❤️ Σημαντική στιγμή. Το μωρό εξελίσσεται όμορφα — και εσύ έχεις μεγάλη συμβολή σε αυτό."],
    ["🎯 Πολύ ωραία πρόοδος! Κάθε νέο βήμα δείχνει πόσο δυνατή είναι η σχέση σας.",
     "🏆 Άλλο ένα ορόσημο! Να θυμάσαι πόση φροντίδα και αγάπη υπάρχει πίσω από αυτό."],
  ],
  en: [
    ["🌟 You're doing great! Every 'first' is special, and you noticed this one.",
     "✨ Lovely moment! Your baby takes another step forward, with you right there."],
    ["💛 Well done! Your care makes a difference every day.",
     "🌸 How wonderful! These are special moments — worth remembering.",
     "❤️ An important moment. Your baby is developing beautifully — and you play a big part in that."],
    ["🎯 Great progress! Every new step shows how strong your bond is.",
     "🏆 Another milestone! Remember how much care and love is behind it."],
  ],
  ar: [
    ["🌟 أنتِ تقومين بعمل رائع! كل 'مرة أولى' مميزة، وقد لاحظتِ هذه.",
     "✨ لحظة جميلة! طفلك يخطو خطوة أخرى، وأنتِ بجانبه."],
    ["💛 أحسنتِ! رعايتك تصنع فرقاً كل يوم.",
     "🌸 كم هذا رائع! هذه لحظات مميزة تستحق أن تتذكريها.",
     "❤️ لحظة مهمة. طفلك يتطور بشكل جميل — وأنتِ جزء كبير من ذلك."],
    ["🎯 تقدم رائع! كل خطوة جديدة تُظهر مدى قوة ارتباطكما.",
     "🏆 إنجاز آخر! تذكري كل الرعاية والحب الذي يكمن وراءه."],
  ],
  zh: [
    ["🌟 你做得很好！每一个'第一次'都很特别，你注意到了这一刻。",
     "✨ 美好的时刻！宝宝又向前迈了一步，而你就在身边。"],
    ["💛 做得好！你的用心每天都在产生影响。",
     "🌸 多么美好！这些都是值得记住的特别时刻。",
     "❤️ 重要的时刻。宝宝正在健康成长——这离不开你的付出。"],
    ["🎯 进步很大！每一个新阶段都展示了你们之间深厚的联结。",
     "🏆 又一个里程碑！记住，这背后是满满的关爱。"],
  ],
  es: [
    ["🌟 ¡Lo estás haciendo muy bien! Cada 'primera vez' es especial, y la notaste.",
     "✨ ¡Momento precioso! Tu bebé da otro paso adelante, contigo a su lado."],
    ["💛 ¡Bien hecho! Tu cuidado marca la diferencia cada día.",
     "🌸 ¡Qué bonito! Son momentos especiales que vale la pena recordar.",
     "❤️ Un momento importante. Tu bebé se desarrolla maravillosamente — y tú tienes mucho que ver con eso."],
    ["🎯 ¡Gran progreso! Cada nuevo paso muestra lo fuerte que es vuestro vínculo.",
     "🏆 ¡Otro hito! Recuerda todo el cariño y dedicación que hay detrás."],
  ],
  fr: [
    ["🌟 Vous vous en sortez très bien ! Chaque 'première fois' est spéciale, et vous l'avez remarquée.",
     "✨ Joli moment ! Votre bébé fait un pas de plus, avec vous à ses côtés."],
    ["💛 Bravo ! Votre attention fait la différence chaque jour.",
     "🌸 Comme c'est beau ! Ce sont des moments précieux à retenir.",
     "❤️ Un moment important. Votre bébé se développe merveilleusement — et vous y contribuez beaucoup."],
    ["🎯 Belle progression ! Chaque nouvelle étape montre la force de votre lien.",
     "🏆 Une autre étape franchie ! Rappelez-vous tout l'amour qu'il y a derrière."],
  ],
  ro: [
    ["🌟 Te descurci foarte bine! Fiecare 'prima dată' este speciala, și ai observat-o.",
     "✨ Moment frumos! Bebelușul tău face un nou pas, alături de tine."],
    ["💛 Bravo! Grija ta face diferența în fiecare zi.",
     "🌸 Ce frumos! Sunt momente speciale, merită ținute minte.",
     "❤️ Un moment important. Bebelușul se dezvoltă frumos — iar tu ai un rol mare în asta."],
    ["🎯 Progres frumos! Fiecare pas nou arată cât de puternică este legătura voastră.",
     "🏆 Un alt reper! Ține minte câtă grijă și dragoste se află în spatele lui."],
  ],
  pl: [
    ["🌟 Świetnie sobie radzisz! Każde 'pierwsze razy' jest szczególne, i zauważyłaś to.",
     "✨ Piękny moment! Twoje dziecko robi kolejny krok, a ty jesteś przy nim."],
    ["💛 Brawo! Twoja troska codziennie ma znaczenie.",
     "🌸 Jak miło! To szczególne chwile, warto je zapamiętać.",
     "❤️ Ważny moment. Twoje dziecko rozwija się piękne — a ty masz w tym duży udział."],
    ["🎯 Świetny postęp! Każdy nowy krok pokazuje, jak silna jest wasza więź.",
     "🏆 Kolejny kamień milowy! Pamiętaj, ile troski i miłości za nim stoi."],
  ],
  tr: [
    ["🌟 Çok iyi gidiyorsun! Her 'ilk' özeldir, ve bunu fark ettin.",
     "✨ Güzel bir an! Bebeğin bir adım daha atıyor, sen de yanında."],
    ["💛 Aferin! İlginiz her gün fark yaratıyor.",
     "🌸 Ne güzel! Bunlar hatırlanmaya değer özel anlar.",
     "❤️ Önemli bir an. Bebeğin güzel gelişiyor — ve bunda senin büyük katkın var."],
    ["🎯 Güzel bir ilerleme! Her yeni adım bağınızın gücünü gösteriyor.",
     "🏆 Bir kilometre taşı daha! Arkasındaki tüm sevgi ve özeni hatırla."],
  ],
  hi: [
    ["🌟 आप बहुत अच्छा कर रही हैं! हर 'पहली बार' खास होती है, और आपने इसे नोटिस किया।",
     "✨ प्यारा पल! आपका शिशु एक और कदम बढ़ा रहा है, और आप उसके साथ हैं।"],
    ["💛 बहुत बढ़िया! आपकी देखभाल हर दिन फर्क लाती है।",
     "🌸 कितना सुंदर! ये खास पल हैं — याद रखने लायक।",
     "❤️ एक महत्वपूर्ण क्षण। आपका शिशु सुंदरता से विकसित हो रहा है — और इसमें आपकी बड़ी भूमिका है।"],
    ["🎯 बहुत अच्छी प्रगति! हर नया कदम आपके बंधन की ताकत दिखाता है।",
     "🏆 एक और पड़ाव! याद रखें इसके पीछे कितना प्यार और देखभाल है।"],
  ],
  ur: [
    ["🌟 آپ بہت اچھا کر رہی ہیں! ہر 'پہلی بار' خاص ہوتی ہے، اور آپ نے اسے نوٹس کیا۔",
     "✨ پیارا لمحہ! آپ کا بچہ ایک اور قدم بڑھا رہا ہے، اور آپ اس کے ساتھ ہیں۔"],
    ["💛 بہت خوب! آپ کی دیکھ بھال ہر روز فرق پیدا کرتی ہے۔",
     "🌸 کتنا پیارا! یہ خاص لمحات ہیں — یاد رکھنے کے لائق۔",
     "❤️ ایک اہم لحظہ۔ آپ کا بچہ خوبصورتی سے ترقی کر رہا ہے — اور اس میں آپ کا بڑا کردار ہے۔"],
    ["🎯 بہت اچھی پیش رفت! ہر نیا قدم آپ کے رشتے کی مضبوطی دکھاتا ہے۔",
     "🏆 ایک اور سنگ میل! یاد رکھیں اس کے پیچھے کتنی محبت اور دیکھ بھال ہے۔"],
  ],
  ja: [
    ["🌟 とても順調です！「はじめての一歩」はどれも特別で、それに気づけましたね。",
     "✨ 素敵な瞬間です！赤ちゃんがまた一歩前進し、あなたがそばにいます。"],
    ["💛 よくできました！毎日の関わりが大きな意味を持ちます。",
     "🌸 なんて素敵！記憶に残る特別な瞬間ですね。",
     "❤️ 大切な瞬間です。赤ちゃんはすくすくと成長しています — それにはあなたの存在が大きく関わっています。"],
    ["🎯 順調な成長です！新しい一歩はあなたたちの絆の強さを表しています。",
     "🏆 また一つの節目です！その裏にある愛情と努力を忘れずに。"],
  ],
  ru: [
    ["🌟 У вас всё отлично получается! Каждое 'впервые' особенное, и вы это заметили.",
     "✨ Прекрасный момент! Малыш делает ещё один шаг, а вы рядом."],
    ["💛 Молодец! Ваша забота каждый день имеет значение.",
     "🌸 Как чудесно! Это особенные моменты — стоит их запомнить.",
     "❤️ Важный момент. Малыш прекрасно развивается — и в этом большая ваша заслуга."],
    ["🎯 Отличный прогресс! Каждый новый шаг показывает, насколько крепка ваша связь.",
     "🏆 Еще одна веха! Помните, сколько любви и заботы за этим стоит."],
  ],
  de: [
    ["🌟 Du machst das großartig! Jedes 'erste Mal' ist besonders, und du hast es bemerkt.",
     "✨ Schöner Moment! Dein Baby macht einen weiteren Schritt, mit dir an seiner Seite."],
    ["💛 Gut gemacht! Deine Fürsorge macht jeden Tag einen Unterschied.",
     "🌸 Wie schön! Das sind besondere Momente — wert, sich zu merken.",
     "❤️ Ein wichtiger Moment. Dein Baby entwickelt sich wunderbar — und du hast großen Anteil daran."],
    ["🎯 Toller Fortschritt! Jeder neue Schritt zeigt, wie stark eure Verbindung ist.",
     "🏆 Ein weiterer Meilenstein! Denk daran, wie viel Liebe und Fürsorge dahintersteckt."],
  ],
  pt: [
    ["🌟 Estás a sair-te muito bem! Cada 'primeira vez' é especial, e reparaste nesta.",
     "✨ Momento adorável! O teu bebé dá mais um passo, contigo ao lado."],
    ["💛 Muito bem! O teu cuidado faz a diferença todos os dias.",
     "🌸 Que bonito! São momentos especiais — vale a pena guardar na memória.",
     "❤️ Um momento importante. O teu bebé está a desenvolver-se muito bem — e tu tens um grande papel nisso."],
    ["🎯 Ótimo progresso! Cada novo passo mostra o quão forte é a vossa ligação.",
     "🏆 Mais um marco! Lembra-te de todo o cuidado e amor que há por detrás."],
  ],
  it: [
    ["🌟 Stai andando alla grande! Ogni 'prima volta' è speciale, e l'hai notata.",
     "✨ Momento bellissimo! Il tuo bambino fa un altro passo, con te al suo fianco."],
    ["💛 Bravissima! Le tue cure fanno la differenza ogni giorno.",
     "🌸 Che bello! Sono momenti speciali — da custodire nei ricordi.",
     "❤️ Un momento importante. Il tuo bambino si sviluppa in modo meraviglioso — e tu hai un ruolo grande in questo."],
    ["🎯 Ottimi progressi! Ogni nuovo passo mostra quanto sia forte il vostro legame.",
     "🏆 Un altro traguardo! Ricorda quanta cura e amore ci sono dietro."],
  ],
  nl: [
    ["🌟 Je doet het heel goed! Elke 'eerste keer' is speciaal, en je hebt deze opgemerkt.",
     "✨ Mooi moment! Je baby zet weer een stap, met jou erbij."],
    ["💛 Goed gedaan! Jouw zorg maakt elke dag verschil.",
     "🌸 Wat fijn! Dit zijn speciale momenten — waard om te onthouden.",
     "❤️ Een belangrijk moment. Je baby ontwikkelt zich prachtig — en jij speelt daarin een grote rol."],
    ["🎯 Mooie voortgang! Elke nieuwe stap laat zien hoe sterk jullie band is.",
     "🏆 Weer een mijlpaal! Bedenk hoeveel zorg en liefde hier achter zit."],
  ],
  bn: [
    ["🌟 আপনি খুব ভালো করছেন! প্রতিটি 'প্রথমবার' বিশেষ, এবং আপনি এটি লক্ষ্য করেছেন।",
     "✨ সুন্দর মুহূর্ত! আপনার শিশু আরেকটি পদক্ষেপ নিচ্ছে, আর আপনি তার সাথে আছেন।"],
    ["💛 দারুণ! আপনার যত্ন প্রতিদিন পার্থক্য তৈরি করে।",
     "🌸 কত সুন্দর! এগুলো স্মরণীয় মুহূর্ত।",
     "❤️ একটি গুরুত্বপূর্ণ মুহূর্ত। আপনার শিশু সুন্দরভাবে বিকশিত হচ্ছে — এবং এতে আপনার বড় অবদান আছে।"],
    ["🎯 দারুণ অগ্রগতি! প্রতিটি নতুন পদক্ষেপ আপনাদের বন্ধনের শক্তি দেখায়।",
     "🏆 আরেকটি মাইলফলক! মনে রাখুন এর পেছনে কতটা ভালোবাসা ও যত্ন আছে।"],
  ],
  id: [
    ["🌟 Anda melakukannya dengan baik! Setiap 'pertama kali' itu istimewa, dan Anda menyadarinya.",
     "✨ Momen yang indah! Bayi Anda melangkah lagi, dengan Anda di sampingnya."],
    ["💛 Kerja bagus! Perhatian Anda membuat perbedaan setiap hari.",
     "🌸 Sungguh indah! Ini momen istimewa yang patut diingat.",
     "❤️ Momen penting. Bayi Anda berkembang dengan baik — dan Anda berperan besar dalam hal itu."],
    ["🎯 Kemajuan yang bagus! Setiap langkah baru menunjukkan betapa kuatnya hubungan Anda.",
     "🏆 Tonggak lainnya! Ingatlah betapa banyak kasih sayang di baliknya."],
  ],
  sw: [
    ["🌟 Unaendelea vizuri sana! Kila 'mara ya kwanza' ni maalum, na umeitambua.",
     "✨ Wakati mzuri! Mtoto wako anapiga hatua nyingine, na wewe upo karibu."],
    ["💛 Vizuri sana! Utunzaji wako unaleta tofauti kila siku.",
     "🌸 Jinsi inavyopendeza! Hii ni nyakati maalum — zinazofaa kukumbukwa.",
     "❤️ Wakati muhimu. Mtoto wako anakua vizuri — na wewe una mchango mkubwa katika hilo."],
    ["🎯 Maendeleo mazuri! Kila hatua mpya inaonyesha jinsi uhusiano wenu ulivyo na nguvu.",
     "🏆 Hatua nyingine! Kumbuka kiasi cha upendo na utunzaji nyuma yake."],
  ],
  fil: [
    ["🌟 Magaling ang ginagawa mo! Bawat 'unang pagkakataon' ay espesyal, at napansin mo ito.",
     "✨ Magandang sandali! Isa pang hakbang ng iyong sanggol, kasama ka."],
    ["💛 Magaling! Ang pagmamalasakit mo ay may pagbabago araw-araw.",
     "🌸 Ang ganda! Ito ay mga espesyal na sandali — sulit na alalahanin.",
     "❤️ Isang mahalagang sandali. Ang iyong sanggol ay umuunlad nang maganda — at malaki ang papel mo dito."],
    ["🎯 Magandang pag-unlad! Bawat bagong hakbang ay nagpapakita kung gaano katibay ang bond ninyo.",
     "🏆 Isa pang milestone! Tandaan kung gaano karaming pagmamahal at pag-aalaga ang nakapaloob dito."],
  ],
  mr: [
    ["🌟 तुम्ही खूप चांगले करत आहात! प्रत्येक 'पहिली वेळ' खास असते, आणि तुम्ही ती लक्षात घेतली.",
     "✨ सुंदर क्षण! तुमचे बाळ आणखी एक पाऊल पुढे टाकत आहे, आणि तुम्ही त्याच्यासोबत आहात."],
    ["💛 उत्तम! तुमची काळजी रोज फरक घडवते.",
     "🌸 किती छान! हे खास क्षण आहेत — लक्षात ठेवण्यासारखे.",
     "❤️ एक महत्त्वाचा क्षण. तुमचे बाळ सुंदर रीतीने वाढत आहे — आणि त्यात तुमचा मोठा वाटा आहे."],
    ["🎯 खूप चांगली प्रगती! प्रत्येक नवीन पाऊल तुमच्या नात्याची ताकद दाखवते.",
     "🏆 आणखी एक टप्पा! त्यामागे किती प्रेम आणि काळजी आहे हे लक्षात ठेवा."],
  ],
  te: [
    ["🌟 మీరు చాలా బాగా చేస్తున్నారు! ప్రతి 'మొదటిసారి' ప్రత్యేకమైనది, మరియు మీరు దీన్ని గమనించారు.",
     "✨ అందమైన క్షణం! మీ శిశువు మరో అడుగు తీసుకుంటోంది, మీరు దాని పక్కనే ఉన్నారు."],
    ["💛 బాగా చేసారు! మీ సంరక్షణ ప్రతిరోజూ తేడాను కలిగిస్తుంది.",
     "🌸 ఎంత బాగుంది! ఇవి గుర్తుంచుకోదగిన ప్రత్యేక క్షణాలు.",
     "❤️ ఒక ముఖ్యమైన క్షణం. మీ శిశువు అందంగా అభివృద్ధి చెందుతోంది — మరియు అందులో మీ పాత్ర పెద్దది."],
    ["🎯 చాలా మంచి పురోగతి! ప్రతి కొత్త అడుగు మీ బంధం యొక్క బలాన్ని చూపిస్తుంది.",
     "🏆 మరో మైలురాయి! దీని వెనుక ఎంత ప్రేమ మరియు సంరక్షణ ఉందో గుర్తుంచుకోండి."],
  ],
};

function getMilestoneMsg(idx: number, total: number, lang: string): string {
  const msgs = BABY_MILESTONE_MSGS_TRANSLATIONS[lang] || BABY_MILESTONE_MSGS_TRANSLATIONS["en"];
  const ratio = total > 1 ? idx / (total - 1) : 0;
  if (ratio <= 0.25) return msgs[0][idx % 2];
  if (ratio <= 0.65) return msgs[1][(idx - 2 + 3) % 3];
  return msgs[2][idx % 2];
}



// ── Pregnancy Milestones (by gestational week) ─────────────────
const PREGNANCY_MILESTONE_RANGES: [number,number][] = [
  [0,8],[8,12],[12,16],[16,20],[20,24],[24,28],[28,32],[32,36],[36,43]
];

const PREGNANCY_MILESTONE_TRANSLATIONS: Record<string, string[][]> = {
  el: [
    ["Ξεκινά η εμφύτευση του εμβρύου στη μήτρα","Σχηματίζεται η καρδιά του μωρού","Αρχίζουν να αναπτύσσονται τα κύρια όργανα","Το μέγεθός του είναι όσο ένας σπόρος σουσαμιού έως ένα βατόμουρο"],
    ["Σχηματίζονται τα δαχτυλάκια χεριών και ποδιών","Πραγματοποιείται το υπερηχογράφημα Αυχενικής Διαφάνειας","Το έμβρυο αποκτά πιο ανθρώπινη μορφή","Έχει πλέον το μέγεθος ενός λεμονιού"],
    ["Οι ναυτίες σταδιακά υποχωρούν","Το μωρό αναπτύσσει τα πρώτα αντανακλαστικά","Ίσως μάθεις το φύλο του μωρού σύντομα","Έχει το μέγεθος ενός αχλαδιού"],
    ["Ίσως νιώσεις τα πρώτα ανεπαίσθητα «φτερουγίσματα» του μωρού","Πραγματοποιείται το β' επίπεδο υπερηχογράφημα (ανατομικό)","Το πρόσωπό του έχει πλέον διαμορφωθεί","Έχει το μέγεθος μιας γλυκοπατάτας"],
    ["Νιώθεις τις πρώτες αισθητές κλωτσιές του μωρού","Η καρδιά του χτυπά περίπου 140-150 φορές το λεπτό","Το μωρό κουνιέται, τεντώνεται και μπορεί να παθαίνει λόξυγκα","Φτάνει στο μήκος μιας μπανάνας"],
    ["Το μωρό αναγνωρίζει τη φωνή σου και νιώθει ασφάλεια ακούγοντάς τη","Ανταποκρίνεται σε ήχους από το περιβάλλον","Έχει το μέγεθος ενός μικρού μαρουλιού","Πραγματοποιείται η καμπύλη γλυκόζης (τεστ κύησης)"],
    ["Η αίσθηση της γεύσης έχει αναπτυχθεί — γεύεται ό,τι τρως","Μπορεί να χασμουριέται μέσα στην κοιλιά","Ξεκινά το 3ο τρίμηνο της εγκυμοσύνης","Έχει το μέγεθος ενός μάνγκο"],
    ["Το δερμάτινο του μωρού γίνεται απαλό και λείο","Ανοίγει και κλείνει τα μάτια ανάλογα με τον ύπνο του","Τα οστά του δυναμώνουν συνεχώς","Έχει το μέγεθος ενός μικρού ανανά"],
    ["Το μωρό παίρνει την τελική του θέση για τη γέννα","Φτάνει περίπου 3.000-3.500 γραμμάρια","Είναι κλινικά έτοιμο για τον έξω κόσμο","Ώρα να ετοιμάσεις την τσάντα μαιευτηρίου"],
  ],
  en: [
    ["Implantation of the embryo in the uterus begins","The baby's heart begins to form","Major organs start developing","Size: about a sesame seed to a raspberry"],
    ["Tiny fingers and toes are forming","The nuchal translucency scan takes place","The embryo starts looking more human","Size: about a lemon"],
    ["Nausea gradually starts to ease","The baby develops first reflexes","You may soon find out the baby's sex","Size: about a pear"],
    ["You may feel the first faint 'flutters' of the baby","The detailed anatomy scan takes place","The baby's face is now well formed","Size: about a sweet potato"],
    ["You feel the first noticeable kicks","The baby's heart beats around 140-150 times per minute","Baby moves, stretches, and may get hiccups","Reaches the length of a banana"],
    ["The baby recognizes your voice and feels safe hearing it","Responds to sounds from outside the womb","Size: about a small lettuce","The glucose tolerance test takes place"],
    ["The sense of taste has developed — baby tastes what you eat","May yawn inside the womb","The third trimester begins","Size: about a mango"],
    ["The baby's skin becomes soft and smooth","Eyes open and close with sleep cycles","Bones continue to strengthen","Size: about a small pineapple"],
    ["The baby settles into its final position for birth","Reaches about 3,000-3,500 grams","Clinically ready for the outside world","Time to prepare your hospital bag"],
  ],
  ar: [
    ["تبدأ عملية انغراس الجنين في الرحم","يبدأ تكوّن قلب الطفل","تبدأ الأعضاء الرئيسية بالتكوّن","الحجم: من حبة سمسم إلى حبة توت العليق"],
    ["تتشكّل أصابع اليدين والقدمين الصغيرة","يتم إجراء فحص الشفافية القفوية","يبدأ الجنين بالتشكل بشكل أقرب للإنسان","الحجم: مثل حبة الليمون"],
    ["يبدأ الغثيان بالتراجع تدريجياً","يطوّر الطفل ردود الفعل المنعكسة الأولى","قد تعرفين قريباً جنس الطفل","الحجم: مثل حبة الكمثرى"],
    ["قد تشعرين بأولى الحركات الخفيفة للطفل","يتم إجراء فحص التشريح التفصيلي","ملامح وجه الطفل تكوّنت الآن بشكل جيد","الحجم: مثل البطاطا الحلوة"],
    ["تشعرين بأولى الحركات الواضحة للطفل","ينبض قلب الطفل حوالي 140-150 نبضة في الدقيقة","يتحرك الطفل ويتمطى وقد يصاب بالحازوقة","يصل إلى طول حبة الموز"],
    ["يتعرّف الطفل على صوتك ويشعر بالأمان عند سماعه","يستجيب للأصوات من خارج الرحم","الحجم: مثل خس صغير","يتم إجراء فحص تحمل الجلوكوز"],
    ["تطورت حاسة التذوق — يتذوق الطفل ما تأكلينه","قد يتثاءب داخل الرحم","يبدأ الثلث الثالث من الحمل","الحجم: مثل المانجو"],
    ["تصبح بشرة الطفل ناعمة وطرية","تُفتح وتُغلق العينان مع دورات النوم","تستمر العظام في التقوّي","الحجم: مثل أناناس صغير"],
    ["يتخذ الطفل وضعه النهائي للولادة","يصل إلى حوالي 3000-3500 جرام","جاهز سريرياً للعالم الخارجي","حان وقت تحضير حقيبة المستشفى"],
  ],
  zh: [
    ["胚胎开始植入子宫","宝宝的心脏开始形成","主要器官开始发育","大小：约一粒芝麻到一颗覆盆子"],
    ["小手指和小脚趾正在形成","进行颈部透明带扫描","胚胎逐渐呈现人形","大小：约一个柠檬"],
    ["恶心感逐渐缓解","宝宝开始发育最初的反射能力","你可能很快就能知道宝宝的性别","大小：约一个梨子"],
    ["你可能开始感受到宝宝最初轻微的胎动","进行详细的结构畸形超声检查","宝宝的面部特征已基本形成","大小：约一个红薯"],
    ["你会感受到明显的胎动","宝宝的心跳约每分钟140-150次","宝宝会活动、伸展，还可能打嗝","长度达到一根香蕉的长度"],
    ["宝宝能识别你的声音，听到时感到安心","对子宫外的声音有反应","大小：约一颗小生菜","进行糖耐量测试"],
    ["味觉已经发育——宝宝能尝到你吃的食物的味道","可能会在子宫内打哈欠","进入第三孕期","大小：约一个芒果"],
    ["宝宝的皮肤变得柔软光滑","眼睛随睡眠周期睁开和闭合","骨骼持续强化","大小：约一个小菠萝"],
    ["宝宝进入分娩前的最终胎位","体重约达3000-3500克","已具备临床分娩条件","该准备待产包了"],
  ],
  es: [
    ["Comienza la implantación del embrión en el útero","Empieza a formarse el corazón del bebé","Comienzan a desarrollarse los órganos principales","Tamaño: entre una semilla de sésamo y una frambuesa"],
    ["Se forman los deditos de manos y pies","Se realiza la ecografía de translucencia nucal","El embrión empieza a tener forma más humana","Tamaño: como un limón"],
    ["Las náuseas comienzan a disminuir","El bebé desarrolla sus primeros reflejos","Pronto podrías saber el sexo del bebé","Tamaño: como una pera"],
    ["Es posible que sientas los primeros y leves 'aleteos' del bebé","Se realiza la ecografía morfológica detallada","La carita del bebé ya está bien formada","Tamaño: como un boniato"],
    ["Sientes las primeras patadas notables del bebé","El corazón del bebé late entre 140 y 150 veces por minuto","El bebé se mueve, se estira y puede tener hipo","Alcanza el tamaño de un plátano"],
    ["El bebé reconoce tu voz y se siente seguro al oírla","Responde a sonidos del exterior","Tamaño: como una lechuga pequeña","Se realiza la prueba de tolerancia a la glucosa"],
    ["El sentido del gusto se ha desarrollado — el bebé saborea lo que comes","Puede bostezar dentro del útero","Comienza el tercer trimestre","Tamaño: como un mango"],
    ["La piel del bebé se vuelve suave y lisa","Los ojos se abren y cierran según el ciclo de sueño","Los huesos siguen fortaleciéndose","Tamaño: como una piña pequeña"],
    ["El bebé se coloca en su posición final para el parto","Alcanza unos 3.000-3.500 gramos","Está clínicamente listo para nacer","Es momento de preparar la maleta para el hospital"],
  ],
  fr: [
    ["L'implantation de l'embryon dans l'utérus commence","Le cœur du bébé commence à se former","Les principaux organes commencent à se développer","Taille : entre une graine de sésame et une framboise"],
    ["Les petits doigts et orteils se forment","L'échographie de la clarté nucale est réalisée","L'embryon prend une forme plus humaine","Taille : comme un citron"],
    ["Les nausées commencent à s'atténuer","Le bébé développe ses premiers réflexes","Vous découvrirez peut-être bientôt le sexe du bébé","Taille : comme une poire"],
    ["Vous pourriez sentir les premiers petits 'papillonnements' du bébé","L'échographie morphologique détaillée est réalisée","Le visage du bébé est maintenant bien formé","Taille : comme une patate douce"],
    ["Vous sentez les premiers coups de pied notables","Le cœur du bébé bat à environ 140-150 battements par minute","Le bébé bouge, s'étire et peut avoir le hoquet","Atteint la taille d'une banane"],
    ["Le bébé reconnaît votre voix et se sent rassuré en l'entendant","Réagit aux sons venant de l'extérieur","Taille : comme une petite laitue","Le test de tolérance au glucose est réalisé"],
    ["Le sens du goût s'est développé — le bébé goûte ce que vous mangez","Peut bâiller dans l'utérus","Le troisième trimestre commence","Taille : comme une mangue"],
    ["La peau du bébé devient douce et lisse","Les yeux s'ouvrent et se ferment selon le cycle de sommeil","Les os continuent de se renforcer","Taille : comme un petit ananas"],
    ["Le bébé se met en position finale pour la naissance","Il atteint environ 3 000-3 500 grammes","Il est cliniquement prêt pour le monde extérieur","Il est temps de préparer la valise pour la maternité"],
  ],
  ro: [
    ["Începe implantarea embrionului în uter","Începe formarea inimii bebelușului","Organele principale începe să se dezvolte","Dimensiune: de la o sămânță de susan la o zmeură"],
    ["Se formează degetele de la mâini și picioare","Se efectuează ecografia translucenței nucale","Embrionul începe să aibă o formă mai umană","Dimensiune: cât o lămâie"],
    ["Greața începe să se reducă treptat","Bebelușul dezvoltă primele reflexe","Este posibil să afli în scurt timp sexul bebelușului","Dimensiune: cât o pară"],
    ["Este posibil să simți primele 'fluturări' ușoare ale bebelușului","Se efectuează ecografia morfologică detaliată","Fața bebelușului este acum bine formată","Dimensiune: cât un cartof dulce"],
    ["Simți primele lovituri perceptibile ale bebelușului","Inima bebelușului bate cu aproximativ 140-150 bătăi pe minut","Bebelușul se mișcă, se întinde și poate avea sughițuri","Atinge mărimea unei banane"],
    ["Bebelușul îți recunoaște vocea și se simte în siguranță când o aude","Răspunde la sunetele din exterior","Dimensiune: cât o salată mică","Se efectuează testul de toleranță la glucoză"],
    ["Simțul gustului s-a dezvoltat — bebelușul gustă ce mănânci","Poate căsca în uter","Începe trimestrul al treilea","Dimensiune: cât un mango"],
    ["Pielea bebelușului devine fină și netedă","Ochii se deschid și se închid în funcție de ciclul de somn","Oasele continuă să se întărească","Dimensiune: cât un ananas mic"],
    ["Bebelușul se așază în poziția finală pentru naștere","Atinge aproximativ 3.000-3.500 grame","Este pregătit clinic pentru lumea exterioară","E timpul să pregătești geanta de maternitate"],
  ],
  pl: [
    ["Zaczyna się zagnieżdżenie zarodka w macicy","Zaczyna formować się serce dziecka","Główne narządy zaczynają się rozwijać","Wielkość: od ziarna sezamu do maliny"],
    ["Tworzą się małe paluszki rąk i stóp","Wykonywane jest USG przezierności karkowej","Zarodek zaczyna przypominać ludzką postać","Wielkość: jak cytryna"],
    ["Nudności zaczynają stopniowo ustępować","Dziecko rozwija pierwsze odruchy","Możesz wkrótce dowiedzieć się płci dziecka","Wielkość: jak gruszka"],
    ["Możesz poczuć pierwsze, delikatne 'machnięcia' dziecka","Wykonywane jest szczegółowe USG anatomiczne","Twarz dziecka jest już dobrze ukształtowana","Wielkość: jak słodki ziemniak"],
    ["Czujesz pierwsze wyraźne kopnięcia","Serce dziecka bije z częstotliwością 140-150 uderzeń na minutę","Dziecko się rusza, przeciąga i może mieć czkawkę","Osiąga długość banana"],
    ["Dziecko rozpoznaje twój głos i czuje się bezpiecznie, gdy go słyszy","Reaguje na odgłosy z zewnątrz","Wielkość: jak mała sałata","Wykonywany jest test tolerancji glukozy"],
    ["Zmysł smaku rozwinął się — dziecko czuje smak tego, co jesz","Może ziewać w macicy","Zaczyna się trzeci trymestr","Wielkość: jak mango"],
    ["Skóra dziecka staje się miękka i gładka","Oczy otwierają się i zamykają zgodnie z cyklem snu","Kości dalej się wzmacniają","Wielkość: jak mały ananas"],
    ["Dziecko ustawia się w pozycji końcowej do porodu","Osiąga ok. 3000-3500 gramów","Jest klinicznie gotowe do wejścia w świat","Czas przygotować torbę do szpitala"],
  ],
  tr: [
    ["Embriyonun rahme tutunması başlar","Bebeğin kalbi oluşmaya başlar","Ana organlar gelişmeye başlar","Boyut: bir susam tanesi ile bir ahududu arasında"],
    ["Küçük el ve ayak parmakları oluşur","Ense kalınlığı (NT) taraması yapılır","Embriyo daha insana benzer bir şekil alır","Boyut: bir limon kadar"],
    ["Bulantılar yavaş yavaş azalmaya başlar","Bebek ilk reflekslerini geliştirir","Yakında bebeğin cinsiyetini öğrenebilirsin","Boyut: bir armut kadar"],
    ["Bebeğin ilk hafif 'kıpırdanışlarını' hissedebilirsin","Detaylı anomali taraması yapılır","Bebeğin yüzü artık iyi şekillenmiştir","Boyut: bir tatlı patates kadar"],
    ["Bebeğin ilk belirgin tekmelerini hissedersin","Bebeğin kalbi dakikada 140-150 kez atar","Bebek hareket eder, gerinir ve hıçkırık tutabilir","Bir muz uzunluğuna erişir"],
    ["Bebek sesini tanır ve onu duyduğunda kendini güvende hisseder","Dış dünyadan gelen seslere tepki verir","Boyut: küçük bir marul kadar","Glukoz tolerans testi yapılır"],
    ["Tat alma duyusu gelişmiştir — bebek yediklerinin tadını alır","Rahim içinde esneyebilir","Üçüncü trimester başlar","Boyut: bir mango kadar"],
    ["Bebeğin cildi yumuşak ve düzgün olur","Gözler uyku döngüsüne göre açılıp kapanır","Kemikler güçlenmeye devam eder","Boyut: küçük bir ananas kadar"],
    ["Bebek doğum için son pozisyonuna geçer","Yaklaşık 3.000-3.500 grama ulaşır","Dış dünya için klinik olarak hazırdır","Hastane çantasını hazırlama zamanı"],
  ],
  hi: [
    ["भ्रूण का गर्भाशय में प्रत्यारोपण शुरू होता है","बच्चे का हृदय बनना शुरू होता है","मुख्य अंग विकसित होने लगते हैं","आकार: तिल के बीज से रास्पबेरी के बराबर"],
    ["हाथों और पैरों की उंगलियां बनने लगती हैं","न्यूकल ट्रांसलूसेंसी स्कैन किया जाता है","भ्रूण मानव आकार लेने लगता है","आकार: एक नींबू के बराबर"],
    ["मतली धीरे-धीरे कम होने लगती है","शिशु में पहले रिफ्लेक्स विकसित होते हैं","आपको शिशु का लिंग जल्द पता चल सकता है","आकार: एक नाशपाती के बराबर"],
    ["आप शिशु की पहली हल्की हलचल महसूस कर सकती हैं","विस्तृत एनोमली स्कैन किया जाता है","शिशु का चेहरा अब अच्छी तरह बन गया है","आकार: एक शकरकंद के बराबर"],
    ["आप शिशु की पहली स्पष्ट हलचल महसूस करती हैं","शिशु का हृदय लगभग 140-150 बार प्रति मिनट धड़कता है","शिशु हिलता है, खिंचाव करता है और हिचकी ले सकता है","एक केले के आकार तक पहुंचता है"],
    ["शिशु आपकी आवाज़ पहचानता है और इसे सुनकर सुरक्षित महसूस करता है","बाहरी आवाज़ों पर प्रतिक्रिया देता है","आकार: एक छोटे लेट्यूस के बराबर","ग्लूकोज टॉलरेंस टेस्ट किया जाता है"],
    ["स्वाद की समझ विकसित हो गई है — शिशु वही स्वाद लेता है जो आप खाती हैं","गर्भ में जम्हाई ले सकता है","तीसरा त्रैमास शुरू होता है","आकार: एक आम के बराबर"],
    ["शिशु की त्वचा मुलायम और चिकनी होती है","नींद के चक्र के अनुसार आंखें खुलती-बंद होती हैं","हड्डियां और मजबूत होती रहती हैं","आकार: एक छोटे अनानास के बराबर"],
    ["शिशु जन्म के लिए अंतिम स्थिति में आ जाता है","लगभग 3,000-3,500 ग्राम तक पहुंचता है","बाहरी दुनिया के लिए चिकित्सकीय रूप से तैयार है","हॉस्पिटल बैग तैयार करने का समय है"],
  ],
  ur: [
    ["جنین کی رحم میں پیوند کاری شروع ہوتی ہے","بچے کا دل بننا شروع ہوتا ہے","اہم اعضاء بننا شروع ہوتے ہیں","سائز: تل کے بیج سے رس بیری کے برابر"],
    ["ہاتھوں اور پاؤں کی انگلیاں بننے لگتی ہیں","نیوکل ٹرانسلیوسنسی اسکین کیا جاتا ہے","جنین انسانی شکل اختیار کرنے لگتا ہے","سائز: ایک لیموں کے برابر"],
    ["متلی آہستہ آہستہ کم ہونے لگتی ہے","بچے میں پہلی اضطراری حرکات پیدا ہوتی ہیں","آپ کو بچے کی جنس کا جلد پتہ چل سکتا ہے","سائز: ایک ناشپاتی کے برابر"],
    ["آپ بچے کی پہلی ہلکی حرکات محسوس کر سکتی ہیں","تفصیلی انومیلی اسکین کیا جاتا ہے","بچے کا چہرہ اب اچھی طرح بن گیا ہے","سائز: ایک شکرقندی کے برابر"],
    ["آپ بچے کی پہلی واضح حرکات محسوس کرتی ہیں","بچے کا دل تقریباً 140-150 بار فی منٹ دھڑکتا ہے","بچہ حرکت کرتا ہے، کھینچتا ہے اور ہچکی لے سکتا ہے","ایک کیلے کے سائز تک پہنچتا ہے"],
    ["بچہ آپ کی آواز پہچانتا ہے اور اسے سن کر محفوظ محسوس کرتا ہے","باہر کی آوازوں پر ردعمل دیتا ہے","سائز: ایک چھوٹے لیٹیوس کے برابر","گلوکوز ٹالرینس ٹیسٹ کیا جاتا ہے"],
    ["ذائقے کا احساس بن گیا ہے — بچہ وہی ذائقہ محسوس کرتا ہے جو آپ کھاتی ہیں","رحم میں جما سکتا ہے","تیسرا سہ ماہی شروع ہوتا ہے","سائز: ایک آم کے برابر"],
    ["بچے کی جلد نرم اور ہموار ہو جاتی ہے","آنکھیں نیند کے مطابق کھلتی اور بند ہوتی ہیں","ہڈیاں مزید مضبوط ہوتی رہتی ہیں","سائز: ایک چھوٹے انناس کے برابر"],
    ["بچہ پیدائش کے لیے آخری پوزیشن میں آ جاتا ہے","تقریباً 3,000-3,500 گرام تک پہنچتا ہے","باہر کی دنیا کے لیے طبی طور پر تیار ہے","ہسپتال کا بیگ تیار کرنے کا وقت ہے"],
  ],
  ja: [
    ["胚が子宮に着床し始めます","赤ちゃんの心臓が形成され始めます","主要な器官が発達し始めます","大きさ：ゴマ粒からラズベリーほど"],
    ["小さな指やつま先が形成されます","NT（後頸部浮腫）スキャンが行われます","胚が人間らしい形になっていきます","大きさ：レモンほど"],
    ["つわりが徐々に和らいでいきます","赤ちゃんに最初の反射が発達します","もうすぐ赤ちゃんの性別が分かるかもしれません","大きさ：洋ナシほど"],
    ["赤ちゃんの最初のかすかな「ひらひら」を感じるかもしれません","詳細な構造異常スキャンが行われます","赤ちゃんの顔がしっかり形成されています","大きさ：サツマイモほど"],
    ["赤ちゃんのはっきりした胎動を感じます","赤ちゃんの心拍は1分間に約140〜150回です","赤ちゃんは動いたり伸びたり、しゃっくりをすることもあります","バナナほどの大きさになります"],
    ["赤ちゃんはあなたの声を認識し、聞くと安心します","子宮外からの音に反応します","大きさ：小さなレタスほど","ブドウ糖負荷試験が行われます"],
    ["味覚が発達しています — 赤ちゃんはあなたが食べたものを味わいます","子宮内であくびをすることがあります","妊娠後期が始まります","大きさ：マンゴーほど"],
    ["赤ちゃんの肌が柔らかく滑らかになります","睡眠サイクルに合わせて目が開閉します","骨が強くなり続けます","大きさ：小さなパイナップルほど"],
    ["赤ちゃんが出産に向けて最終的な位置に収まります","約3,000〜3,500グラムに達します","外の世界に出る準備が臨床的に整っています","入院バッグを準備する時期です"],
  ],
  ru: [
    ["Начинается имплантация эмбриона в матку","Начинает формироваться сердце малыша","Начинают развиваться основные органы","Размер: от кунжутного семени до малины"],
    ["Формируются крошечные пальчики на руках и ногах","Проводится УЗИ воротникового пространства","Эмбрион приобретает более человеческую форму","Размер: как лимон"],
    ["Тошнота постепенно уменьшается","У малыша развиваются первые рефлексы","Скоро вы можете узнать пол малыша","Размер: как груша"],
    ["Вы можете почувствовать первые легкие 'трепетания' малыша","Проводится детальное УЗИ на пороки развития","Лицо малыша уже хорошо сформировано","Размер: как сладкий картофель"],
    ["Вы чувствуете первые заметные толчки малыша","Сердце малыша бьется со скоростью 140-150 ударов в минуту","Малыш двигается, потягивается и может икать","Достигает размера банана"],
    ["Малыш узнает ваш голос и чувствует себя спокойно, слыша его","Реагирует на звуки извне","Размер: как маленький салат","Проводится тест на толерантность к глюкозе"],
    ["Развилось чувство вкуса — малыш ощущает вкус того, что вы едите","Может зевать в утробе","Начинается третий триместр","Размер: как манго"],
    ["Кожа малыша становится мягкой и гладкой","Глаза открываются и закрываются в зависимости от сна","Кости продолжают укрепляться","Размер: как небольшой ананас"],
    ["Малыш занимает финальное положение перед рождением","Достигает примерно 3000-3500 грамм","Клинически готов к выходу во внешний мир","Время собирать сумку в роддом"],
  ],
  de: [
    ["Die Einnistung des Embryos in die Gebärmutter beginnt","Das Herz des Babys beginnt sich zu bilden","Die wichtigsten Organe beginnen sich zu entwickeln","Größe: zwischen einem Sesamkorn und einer Himbeere"],
    ["Kleine Finger und Zehen bilden sich","Die Nackentransparenz-Untersuchung findet statt","Der Embryo nimmt eine menschlichere Form an","Größe: wie eine Zitrone"],
    ["Die Übelkeit lässt allmählich nach","Das Baby entwickelt erste Reflexe","Bald erfährst du vielleicht das Geschlecht des Babys","Größe: wie eine Birne"],
    ["Du könntest die ersten leichten 'Flattern' des Babys spüren","Der detaillierte Organscreening-Ultraschall findet statt","Das Gesicht des Babys ist jetzt gut ausgeformt","Größe: wie eine Süßkartoffel"],
    ["Du spürst die ersten deutlichen Tritte","Das Herz des Babys schlägt etwa 140-150 Mal pro Minute","Das Baby bewegt sich, streckt sich und kann Schluckauf bekommen","Erreicht die Größe einer Banane"],
    ["Das Baby erkennt deine Stimme und fühlt sich sicher, wenn es sie hört","Reagiert auf Geräusche von außen","Größe: wie ein kleiner Kopfsalat","Der Glukosetoleranztest wird durchgeführt"],
    ["Der Geschmackssinn hat sich entwickelt — das Baby schmeckt, was du isst","Kann in der Gebärmutter gähnen","Das dritte Trimester beginnt","Größe: wie eine Mango"],
    ["Die Haut des Babys wird weich und glatt","Die Augen öffnen und schließen sich je nach Schlafzyklus","Die Knochen werden weiter gestärkt","Größe: wie eine kleine Ananas"],
    ["Das Baby nimmt seine endgültige Position für die Geburt ein","Erreicht etwa 3.000-3.500 Gramm","Ist klinisch bereit für die Außenwelt","Zeit, die Klinik-Tasche zu packen"],
  ],
  pt: [
    ["Começa a implantação do embrião no útero","O coração do bebé começa a formar-se","Os principais órgãos começam a desenvolver-se","Tamanho: entre uma semente de sésamo e uma framboesa"],
    ["Formam-se os pequenos dedos das mãos e dos pés","É realizada a ecografia da translucência nucal","O embrião começa a ter forma mais humana","Tamanho: como um limão"],
    ["As náuseas começam a diminuir gradualmente","O bebé desenvolve os primeiros reflexos","Em breve poderás saber o sexo do bebé","Tamanho: como uma pera"],
    ["Podes sentir os primeiros e leves 'movimentos' do bebé","É realizada a ecografia morfológica detalhada","A cara do bebé já está bem formada","Tamanho: como uma batata-doce"],
    ["Sentes os primeiros pontapés notáveis do bebé","O coração do bebé bate cerca de 140-150 vezes por minuto","O bebé move-se, espreguiça-se e pode ter soluços","Atinge o tamanho de uma banana"],
    ["O bebé reconhece a tua voz e sente-se seguro ao ouvi-la","Responde a sons do exterior","Tamanho: como uma alface pequena","É realizado o teste de tolerância à glicose"],
    ["O sentido do gosto desenvolveu-se — o bebé saboreia o que comes","Pode bocejar dentro do útero","Começa o terceiro trimestre","Tamanho: como uma manga"],
    ["A pele do bebé torna-se suave e lisa","Os olhos abrem e fecham conforme o ciclo de sono","Os ossos continuam a fortalecer-se","Tamanho: como um ananás pequeno"],
    ["O bebé instala-se na posição final para o nascimento","Atinge cerca de 3.000-3.500 gramas","Está clinicamente pronto para o mundo exterior","Hora de preparar a mala da maternidade"],
  ],
  it: [
    ["Inizia l'impianto dell'embrione nell'utero","Il cuore del bambino inizia a formarsi","Gli organi principali iniziano a svilupparsi","Dimensione: tra un seme di sesamo e un lampone"],
    ["Si formano le piccole dita di mani e piedi","Viene eseguita l'ecografia della translucenza nucale","L'embrione assume una forma più umana","Dimensione: come un limone"],
    ["La nausea inizia a diminuire gradualmente","Il bambino sviluppa i primi riflessi","Potresti presto scoprire il sesso del bambino","Dimensione: come una pera"],
    ["Potresti sentire i primi leggeri 'battiti d'ali' del bambino","Viene eseguita l'ecografia morfologica dettagliata","Il viso del bambino è ora ben formato","Dimensione: come una patata dolce"],
    ["Senti i primi calci notevoli del bambino","Il cuore del bambino batte a circa 140-150 battiti al minuto","Il bambino si muove, si stiracchia e può avere il singhiozzo","Raggiunge la dimensione di una banana"],
    ["Il bambino riconosce la tua voce e si sente al sicuro sentendola","Risponde ai suoni dall'esterno","Dimensione: come una lattuga piccola","Viene eseguito il test di tolleranza al glucosio"],
    ["Il senso del gusto si è sviluppato — il bambino sente il sapore di ciò che mangi","Può sbadigliare nell'utero","Inizia il terzo trimestre","Dimensione: come un mango"],
    ["La pelle del bambino diventa morbida e liscia","Gli occhi si aprono e chiudono secondo il ciclo del sonno","Le ossa continuano a rafforzarsi","Dimensione: come un piccolo ananas"],
    ["Il bambino si posiziona definitivamente per la nascita","Raggiunge circa 3.000-3.500 grammi","È clinicamente pronto per il mondo esterno","È il momento di preparare la borsa per l'ospedale"],
  ],
  nl: [
    ["De innesteling van het embryo in de baarmoeder begint","Het hartje van de baby begint te vormen","De belangrijkste organen beginnen zich te ontwikkelen","Grootte: tussen een sesamzaadje en een framboos"],
    ["Kleine vingers en tenen vormen zich","De nekplooimeting wordt uitgevoerd","Het embryo krijgt een meer menselijke vorm","Grootte: als een citroen"],
    ["Misselijkheid neemt geleidelijk af","De baby ontwikkelt de eerste reflexen","Je komt mogelijk binnenkort het geslacht van de baby te weten","Grootte: als een peer"],
    ["Je voelt misschien de eerste lichte 'fladderingen' van de baby","De gedetailleerde structurele echo wordt uitgevoerd","Het gezichtje van de baby is nu goed gevormd","Grootte: als een zoete aardappel"],
    ["Je voelt de eerste duidelijke schopjes","Het hartje van de baby klopt ongeveer 140-150 keer per minuut","De baby beweegt, rekt zich uit en kan de hik krijgen","Bereikt de grootte van een banaan"],
    ["De baby herkent jouw stem en voelt zich veilig als hij die hoort","Reageert op geluiden van buiten","Grootte: als een kleine sla","De glucosetolerantietest wordt uitgevoerd"],
    ["De smaakzin is ontwikkeld — de baby proeft wat jij eet","Kan gapen in de baarmoeder","Het derde trimester begint","Grootte: als een mango"],
    ["De huid van de baby wordt zacht en glad","Ogen gaan open en dicht volgens de slaapcyclus","Botten blijven sterker worden","Grootte: als een kleine ananas"],
    ["De baby neemt de eindpositie voor de geboorte in","Bereikt ongeveer 3.000-3.500 gram","Klinisch klaar voor de buitenwereld","Tijd om de ziekenhuistas te pakken"],
  ],
  bn: [
    ["ভ্রূণের জরায়ুতে ইমপ্লান্টেশন শুরু হয়","শিশুর হৃদয় গঠন শুরু হয়","মূল অঙ্গগুলি বিকাশ শুরু করে","আকার: তিলের বীজ থেকে রাস্পবেরির মতো"],
    ["ছোট আঙুল এবং পায়ের আঙুল তৈরি হয়","নুকাল ট্রান্সলুসেন্সি স্ক্যান করা হয়","ভ্রূণ মানুষের আকার নিতে শুরু করে","আকার: একটি লেবুর মতো"],
    ["বমি বমি ভাব ধীরে ধীরে কমতে থাকে","শিশুর মধ্যে প্রথম প্রতিক্রিয়া বিকশিত হয়","আপনি শীঘ্রই শিশুর লিঙ্গ জানতে পারেন","আকার: একটি নাশপাতির মতো"],
    ["আপনি শিশুর প্রথম হালকা নড়াচড়া অনুভব করতে পারেন","বিস্তারিত অ্যানাটমি স্ক্যান করা হয়","শিশুর মুখ এখন ভালোভাবে তৈরি হয়েছে","আকার: একটি মিষ্টি আলুর মতো"],
    ["আপনি শিশুর প্রথম স্পষ্ট লাথি অনুভব করেন","শিশুর হৃদস্পন্দন প্রতি মিনিটে প্রায় ১৪০-১৫০ বার","শিশু নড়াচড়া করে, প্রসারিত হয় এবং হেঁচকি দিতে পারে","একটি কলার আকারে পৌঁছায়"],
    ["শিশু আপনার কণ্ঠস্বর চিনতে পারে এবং শুনে নিরাপদ অনুভব করে","বাইরের শব্দে প্রতিক্রিয়া দেয়","আকার: একটি ছোট লেটুসের মতো","গ্লুকোজ টলারেন্স টেস্ট করা হয়"],
    ["স্বাদের অনুভূতি বিকশিত হয়েছে — আপনি যা খান শিশু তার স্বাদ পায়","গর্ভে হাঁপাতে পারে","তৃতীয় ত্রৈমাসিক শুরু হয়","আকার: একটি আমের মতো"],
    ["শিশুর ত্বক নরম এবং মসৃণ হয়ে যায়","ঘুমের চক্র অনুযায়ী চোখ খোলে এবং বন্ধ হয়","হাড় আরও মজবুত হতে থাকে","আকার: একটি ছোট আনারসের মতো"],
    ["শিশু জন্মের জন্য চূড়ান্ত অবস্থানে স্থির হয়","প্রায় ৩,০০০-৩,৫০০ গ্রাম পর্যন্ত পৌঁছায়","বাইরের বিশ্বের জন্য চিকিৎসাগতভাবে প্রস্তুত","হাসপাতালের ব্যাগ প্রস্তুত করার সময়"],
  ],
  id: [
    ["Implantasi embrio di rahim mulai terjadi","Jantung bayi mulai terbentuk","Organ-organ utama mulai berkembang","Ukuran: antara biji wijen hingga raspberry"],
    ["Jari-jari kecil tangan dan kaki mulai terbentuk","Pemindaian translusensi nuchal dilakukan","Embrio mulai menyerupai bentuk manusia","Ukuran: seperti lemon"],
    ["Mual secara bertahap mulai berkurang","Bayi mengembangkan refleks pertama","Anda mungkin segera mengetahui jenis kelamin bayi","Ukuran: seperti pir"],
    ["Anda mungkin merasakan 'kepakan' pertama yang lembut dari bayi","Pemindaian anatomi rinci dilakukan","Wajah bayi sekarang sudah terbentuk dengan baik","Ukuran: seperti ubi jalar"],
    ["Anda merasakan tendangan pertama yang jelas dari bayi","Jantung bayi berdetak sekitar 140-150 kali per menit","Bayi bergerak, meregang, dan mungkin cegukan","Mencapai panjang sebuah pisang"],
    ["Bayi mengenali suara Anda dan merasa aman saat mendengarnya","Merespons suara dari luar rahim","Ukuran: seperti selada kecil","Tes toleransi glukosa dilakukan"],
    ["Indra perasa telah berkembang — bayi mencicipi apa yang Anda makan","Mungkin menguap di dalam rahim","Trimester ketiga dimulai","Ukuran: seperti mangga"],
    ["Kulit bayi menjadi lembut dan halus","Mata terbuka dan tertutup sesuai siklus tidur","Tulang terus menguat","Ukuran: seperti nanas kecil"],
    ["Bayi menempatkan diri pada posisi akhir untuk persalinan","Mencapai sekitar 3.000-3.500 gram","Secara klinis siap untuk dunia luar","Saatnya menyiapkan tas rumah sakit"],
  ],
  sw: [
    ["Kupandikizwa kwa kiinitete kwenye mfuko wa uzazi kunaanza","Moyo wa mtoto unaanza kuumbika","Viungo vikuu vinaanza kukua","Ukubwa: kati ya mbegu ya ufuta na rasiberi"],
    ["Vidole vidogo vya mikono na miguu vinaumbika","Uchunguzi wa nuchal translucency unafanyika","Kiinitete kinaanza kufanana zaidi na binadamu","Ukubwa: kama limau"],
    ["Kichefuchefu kinaanza kupungua kidogo kidogo","Mtoto anakuza miitikio ya kwanza","Unaweza kujua hivi karibuni jinsia ya mtoto","Ukubwa: kama pea"],
    ["Unaweza kuhisi 'mipapatiko' ya kwanza nyepesi ya mtoto","Uchunguzi wa kina wa anatomia unafanyika","Uso wa mtoto sasa umeumbika vizuri","Ukubwa: kama kiazi kitamu"],
    ["Unahisi mateke ya kwanza yanayoonekana wazi","Moyo wa mtoto unapiga karibu mara 140-150 kwa dakika","Mtoto anasogea, anajinyoosha na anaweza kuwa na hicha","Anafikia urefu wa ndizi"],
    ["Mtoto anatambua sauti yako na anahisi salama akiisikia","Anaitikia sauti kutoka nje ya tumbo la uzazi","Ukubwa: kama lettuce ndogo","Kipimo cha uvumilivu wa glukosi kinafanyika"],
    ["Hisia ya ladha imekua — mtoto anaonja kile unachokula","Anaweza kupiga miayo tumboni","Robo ya tatu inaanza","Ukubwa: kama embe"],
    ["Ngozi ya mtoto inakuwa laini","Macho yanafunguka na kufunga kulingana na mzunguko wa usingizi","Mifupa inazidi kuwa na nguvu","Ukubwa: kama nanasi dogo"],
    ["Mtoto anajipanga katika hali yake ya mwisho kwa kujifungua","Anafikia takriban gramu 3,000-3,500","Tayari kitabibu kwa dunia ya nje","Wakati wa kutayarisha mfuko wa hospitali"],
  ],
  fil: [
    ["Nagsisimula ang implantation ng embryo sa matris","Nagsisimulang mabuo ang puso ng sanggol","Nagsisimulang umunlad ang mga pangunahing organo","Sukat: katumbas ng butil ng sesame hanggang raspberry"],
    ["Nabubuo ang maliliit na daliri sa kamay at paa","Isinasagawa ang nuchal translucency scan","Nagiging mas katulad ng tao ang anyo ng embryo","Sukat: katumbas ng limon"],
    ["Unti-unting bumababa ang pagduduwal","Nabubuo ang unang mga reflex ng sanggol","Maaaring malapit na malaman ang kasarian ng sanggol","Sukat: katumbas ng peras"],
    ["Maaari mong maramdaman ang unang banayad na 'pagpapakpak' ng sanggol","Isinasagawa ang detalyadong anatomy scan","Maayos na nabuo na ang mukha ng sanggol","Sukat: katumbas ng kamoteng kahoy"],
    ["Naramdaman mo ang unang malinaw na sipa ng sanggol","Tumitibok ang puso ng sanggol nang humigit-kumulang 140-150 bawat minuto","Gumagalaw, nag-uunat ang sanggol at maaaring magka-sinok","Umaabot sa haba ng saging"],
    ["Nakikilala ng sanggol ang iyong tinig at nakaramdam ng ligtas pagdinig nito","Tumutugon sa mga tunog mula sa labas","Sukat: katumbas ng maliit na letsugas","Isinasagawa ang glucose tolerance test"],
    ["Umunlad na ang pandama ng panlasa — natitikman ng sanggol ang iyong kinakain","Maaaring humikab sa loob ng matris","Nagsisimula ang ikatlong trimester","Sukat: katumbas ng mangga"],
    ["Nagiging malambot at makinis ang balat ng sanggol","Nagbubukas at nagsasara ang mata ayon sa siklo ng tulog","Nagpapatuloy na lumalakas ang mga buto","Sukat: katumbas ng maliit na pinya"],
    ["Naayos na ang sanggol sa huling posisyon para sa kapanganakan","Umaabot ng humigit-kumulang 3,000-3,500 grams","Klinikal na handa na para sa labas ng mundo","Panahon na upang ihanda ang bag para sa ospital"],
  ],
  mr: [
    ["भ्रूणाचे गर्भाशयात रोपण सुरू होते","बाळाचे हृदय तयार होऊ लागते","मुख्य अवयव विकसित होऊ लागतात","आकार: तिळाच्या बीपासून रासबेरीइतका"],
    ["हात आणि पायांची बोटे तयार होतात","न्यूकल ट्रान्सलुसन्सी स्कॅन केले जाते","भ्रूण अधिक मानवी आकार घेऊ लागतो","आकार: लिंबाइतका"],
    ["मळमळ हळूहळू कमी होऊ लागते","बाळामध्ये पहिले प्रतिक्षिप्त क्रिया विकसित होतात","तुम्हाला लवकरच बाळाचे लिंग कळू शकते","आकार: नाशपातीइतका"],
    ["तुम्हाला बाळाची पहिली सूक्ष्म हालचाल जाणवू शकते","सविस्तर अॅनाटॉमी स्कॅन केले जाते","बाळाचा चेहरा आता चांगला तयार झाला आहे","आकार: रताळ्याइतका"],
    ["तुम्हाला बाळाच्या पहिल्या स्पष्ट लाथा जाणवतात","बाळाचे हृदय दर मिनिटाला सुमारे १४०-१५० वेळा धडधडते","बाळ हलते, ताणते आणि उचकी देऊ शकते","केळ्याच्या लांबीपर्यंत पोहोचते"],
    ["बाळ तुमचा आवाज ओळखते आणि ऐकून सुरक्षित वाटते","गर्भाशयाबाहेरील आवाजांना प्रतिसाद देते","आकार: छोट्या लेट्यूसइतका","ग्लुकोज टॉलरन्स टेस्ट केली जाते"],
    ["चवीची संवेदना विकसित झाली आहे — तुम्ही जे खाता ते बाळ चाखते","गर्भात जांभई देऊ शकते","तिसरा त्रैमासिक सुरू होतो","आकार: आंब्याइतका"],
    ["बाळाची त्वचा मऊ आणि मुलायम होते","झोपेच्या चक्रानुसार डोळे उघडतात आणि बंद होतात","हाडे आणखी मजबूत होत राहतात","आकार: छोट्या अननसाइतका"],
    ["बाळ जन्मासाठी अंतिम स्थितीत स्थिरावते","सुमारे ३,०००-३,५०० ग्रॅम पर्यंत पोहोचते","बाहेरील जगासाठी वैद्यकीयदृष्ट्या तयार आहे","रुग्णालयाची बॅग तयार करण्याची वेळ आली आहे"],
  ],
  te: [
    ["పిండం గర్భాశయంలో అమరడం మొదలవుతుంది","శిశువు హృదయం రూపొందడం మొదలవుతుంది","ముఖ్యమైన అవయవాలు అభివృద్ధి చెందడం మొదలవుతుంది","పరిమాణం: నువ్వుల గింజ నుండి రాస్ప్‌బెర్రీ వరకు"],
    ["చేతులు, కాళ్ళ చిన్న వేళ్ళు ఏర్పడతాయి","న్యూకల్ ట్రాన్స్‌లూసెన్సీ స్కాన్ చేయబడుతుంది","పిండం మరింత మానవ ఆకారాన్ని పొందుతుంది","పరిమాణం: నిమ్మకాయ అంత"],
    ["వికారం క్రమంగా తగ్గుతుంది","శిశువులో మొదటి రిఫ్లెక్స్‌లు అభివృద్ధి చెందుతాయి","మీకు త్వరలో శిశువు లింగం తెలియవచ్చు","పరిమాణం: బేరి పండు అంత"],
    ["శిశువు మొదటి సూక్ష్మ కదలికలను మీరు అనుభవించవచ్చు","వివరణాత్మక అనాటమీ స్కాన్ చేయబడుతుంది","శిశువు ముఖం ఇప్పుడు బాగా ఏర్పడింది","పరిమాణం: చిలగడదుంప అంత"],
    ["శిశువు మొదటి స్పష్టమైన కిక్‌లను మీరు అనుభవిస్తారు","శిశువు హృదయం నిమిషానికి సుమారు 140-150 సార్లు కొట్టుకుంటుంది","శిశువు కదులుతుంది, సాగుతుంది మరియు హిచ్చులు రావచ్చు","అరటిపండు పొడవుకు చేరుకుంటుంది"],
    ["శిశువు మీ గొంతును గుర్తిస్తుంది మరియు వినగానే సురక్షితంగా భావిస్తుంది","గర్భాశయం బయటి శబ్దాలకు స్పందిస్తుంది","పరిమాణం: చిన్న లెట్యూస్ అంత","గ్లూకోజ్ టాలరెన్స్ టెస్ట్ చేయబడుతుంది"],
    ["రుచి భావం అభివృద్ధి చెందింది — మీరు తినేది శిశువు రుచి చూస్తుంది","గర్భంలో ఆవలించవచ్చు","మూడవ త్రైమాసికం మొదలవుతుంది","పరిమాణం: మామిడి అంత"],
    ["శిశువు చర్మం మృదువుగా, నునుపుగా మారుతుంది","నిద్ర చక్రానికి అనుగుణంగా కళ్ళు తెరుచుకుంటాయి, మూసుకుంటాయి","ఎముకలు మరింత బలపడుతూనే ఉంటాయి","పరిమాణం: చిన్న పైనాపిల్ అంత"],
    ["శిశువు జననానికి చివరి స్థితిలో స్థిరపడుతుంది","సుమారు 3,000-3,500 గ్రాముల వరకు చేరుకుంటుంది","బయటి ప్రపంచానికి వైద్యపరంగా సిద్ధంగా ఉంది","ఆసుపత్రి బ్యాగ్ సిద్ధం చేసుకునే సమయం"],
  ],
};

const PREGNANCY_MILESTONE_MSGS_TRANSLATIONS: Record<string, string[][]> = {
  el: [
    ["🌟 Τα πας πολύ καλά! Η HeyMaa σημειώνει με χαρά αυτό το σημαντικό στάδιο της πορείας σου.",
     "💫 Είναι υπέροχες αυτές οι στιγμές — ένα ακόμη βήμα της εγκυμοσύνης σου."],
    ["💛 Καλή πρόοδος. Κάθε εβδομάδα μετράει στην πορεία σου.",
     "🌸 Η εγκυμοσύνη σου εξελίσσεται ομαλά — αξίζει να το σημειώσεις.",
     "❤️ Σημαντική στιγμή. Η HeyMaa είναι στη διάθεσή σου για ό,τι χρειαστείς."],
    ["🎯 Πλησιάζεις προς το τέλος αυτού του σταδίου — καλή συνέχεια.",
     "🏆 Ορόσημο που αξίζει να σημειωθεί. Η HeyMaa σου εύχεται καλή συνέχεια."],
  ],
  en: [
    ["🌟 You're doing great! HeyMaa is glad to mark this important step in your journey.",
     "💫 These are wonderful moments — another step in your pregnancy."],
    ["💛 Good progress. Every week counts on this journey.",
     "🌸 Your pregnancy is progressing well — worth noting.",
     "❤️ An important moment. HeyMaa is available whenever you need."],
    ["🎯 You're approaching the end of this stage — wishing you well.",
     "🏆 A milestone worth noting. HeyMaa wishes you continued health."],
  ],
  ar: [
    ["🌷 يسرّ HeyMaa الإشارة إلى هذه الخطوة المهمة في رحلتك.",
     "🌟 خطوة أخرى في حملك — HeyMaa هنا لأي سؤال."],
    ["💛 تقدم جيد. كل أسبوع مهم في هذه الرحلة.",
     "🌸 حملك يتقدم بشكل جيد — يستحق التسجيل.",
     "❤️ لحظة مهمة. HeyMaa متاح متى احتجت."],
    ["🎯 تقتربين من نهاية هذه المرحلة — نتمنى لك كل خير.",
     "🏆 محطة تستحق التسجيل. HeyMaa يتمنى لك استمرار الصحة."],
  ],
  zh: [
    ["🌷 HeyMaa很高兴记录孕期中的这个重要阶段。",
     "🌟 孕期又一步——如有任何问题，HeyMaa随时为你解答。"],
    ["💛 进展顺利，孕期中的每一周都很重要。",
     "🌸 孕期进展良好——值得记录。",
     "❤️ 重要的时刻，HeyMaa随时为你提供帮助。"],
    ["🎯 你正接近这一阶段的尾声——祝一切顺利。",
     "🏆 值得记录的里程碑，HeyMaa祝你健康顺利。"],
  ],
  es: [
    ["🌷 HeyMaa se alegra de señalar esta etapa importante de tu proceso.",
     "🌟 Un paso más en tu embarazo — HeyMaa está aquí para cualquier consulta."],
    ["💛 Buen progreso. Cada semana cuenta en este proceso.",
     "🌸 Tu embarazo avanza bien — vale la pena registrarlo.",
     "❤️ Un momento importante. HeyMaa está disponible cuando lo necesites."],
    ["🎯 Te acercas al final de esta etapa — te deseamos lo mejor.",
     "🏆 Un hito que vale la pena registrar. HeyMaa te desea continua salud."],
  ],
  fr: [
    ["🌷 HeyMaa est heureux de souligner cette étape importante de votre parcours.",
     "🌟 Une étape de plus dans votre grossesse — HeyMaa est là pour toute question."],
    ["💛 Bonne progression. Chaque semaine compte dans ce parcours.",
     "🌸 Votre grossesse progresse bien — cela vaut la peine d'être noté.",
     "❤️ Un moment important. HeyMaa est disponible si besoin."],
    ["🎯 Vous approchez de la fin de cette étape — bonne continuation.",
     "🏆 Une étape qui mérite d'être notée. HeyMaa vous souhaite une bonne santé continue."],
  ],
  ro: [
    ["🌷 HeyMaa notează cu plăcere această etapă importantă a parcursului tău.",
     "🌟 Un alt pas în sarcina ta — HeyMaa este aici pentru orice întrebare."],
    ["💛 Progres bun. Fiecare săptămână contează în acest parcurs.",
     "🌸 Sarcina ta progresează bine — merită notat.",
     "❤️ Un moment important. HeyMaa este disponibil oricând ai nevoie."],
    ["🎯 Te apropii de finalul acestei etape — îți urăm numai bine.",
     "🏆 Un reper care merită notat. HeyMaa îți urează multă sănătate."],
  ],
  pl: [
    ["🌷 HeyMaa z radością odnotowuje ten ważny etap Twojej drogi.",
     "🌟 Kolejny krok w Twojej ciąży — HeyMaa jest tu na wypadek pytań."],
    ["💛 Dobry postęp. Każdy tydzień ma znaczenie.",
     "🌸 Twoja ciąża przebiega dobrze — warto to odnotować.",
     "❤️ Ważny moment. HeyMaa jest dostępna, kiedy potrzebujesz."],
    ["🎯 Zbliżasz się do końca tego etapu — wszystkiego dobrego.",
     "🏆 Kamień milowy warty odnotowania. HeyMaa życzy dalszego zdrowia."],
  ],
  tr: [
    ["🌷 HeyMaa, sürecindeki bu önemli aşamayı not etmekten memnuniyet duyar.",
     "🌟 Hamileliğinde bir adım daha — sorularınız için HeyMaa burada."],
    ["💛 İyi bir ilerleme. Bu süreçte her hafta önemlidir.",
     "🌸 Hamileliğin iyi ilerliyor — not etmeye değer.",
     "❤️ Önemli bir an. HeyMaa ihtiyacın olduğunda hazır."],
    ["🎯 Bu aşamanın sonuna yaklaşıyorsun — sağlıkla devam et.",
     "🏆 Not edilmeye değer bir kilometre taşı. HeyMaa sana sağlık diler."],
  ],
  hi: [
    ["🌷 HeyMaa आपकी इस यात्रा के महत्वपूर्ण चरण को दर्ज करते हुए खुशी महसूस करता है।",
     "🌟 आपकी गर्भावस्था में एक और कदम — किसी भी सवाल के लिए HeyMaa यहाँ है।"],
    ["💛 अच्छी प्रगति। इस यात्रा में हर सप्ताह महत्वपूर्ण है।",
     "🌸 आपकी गर्भावस्था अच्छी तरह आगे बढ़ रही है — इसे नोट करना उचित है।",
     "❤️ एक महत्वपूर्ण क्षण। जब भी आवश्यकता हो, HeyMaa उपलब्ध है।"],
    ["🎯 आप इस चरण के अंत के करीब हैं — शुभकामनाएं।",
     "🏆 नोट करने योग्य पड़ाव। HeyMaa आपके स्वास्थ्य की कामना करता है।"],
  ],
  ur: [
    ["🌷 HeyMaa آپ کے سفر کے اس اہم مرحلے کو نوٹ کرتے ہوئے خوشی محسوس کرتا ہے۔",
     "🌟 آپ کے حمل میں ایک اور قدم — کسی بھی سوال کے لیے HeyMaa حاضر ہے۔"],
    ["💛 اچھی پیش رفت۔ اس سفر میں ہر ہفتہ اہم ہے۔",
     "🌸 آپ کا حمل اچھی طرح آگے بڑھ رہا ہے — اسے نوٹ کرنا مناسب ہے۔",
     "❤️ ایک اہم لحظہ۔ جب بھی ضرورت ہو، HeyMaa دستیاب ہے۔"],
    ["🎯 آپ اس مرحلے کے اختتام کے قریب ہیں — نیک خواہشات۔",
     "🏆 نوٹ کرنے کے لائق سنگ میل۔ HeyMaa آپ کی صحت کی خواہش کرتا ہے۔"],
  ],
  ja: [
    ["🌷 HeyMaaはあなたの妊娠における大切な段階を記録できることを嬉しく思います。",
     "🌟 妊娠のまた一つの段階です — ご質問があればHeyMaaがいつでもお答えします。"],
    ["💛 順調な進み具合です。この過程では毎週が大切です。",
     "🌸 妊娠は順調に進んでいます — 記録しておく価値があります。",
     "❤️ 大切な瞬間です。必要なときはHeyMaaをご利用ください。"],
    ["🎯 この段階の終盤に近づいています — 順調にお過ごしください。",
     "🏆 記録しておきたい一区切りです。HeyMaaは健康をお祈りしています。"],
  ],
  ru: [
    ["🌷 HeyMaa с радостью отмечает этот важный этап вашего пути.",
     "🌟 Еще один шаг в вашей беременности — HeyMaa здесь для любых вопросов."],
    ["💛 Хороший прогресс. Каждая неделя имеет значение.",
     "🌸 Ваша беременность протекает хорошо — стоит это отметить.",
     "❤️ Важный момент. HeyMaa доступен, когда вам нужно."],
    ["🎯 Вы приближаетесь к концу этого этапа — всего наилучшего.",
     "🏆 Этап, который стоит отметить. HeyMaa желает вам крепкого здоровья."],
  ],
  de: [
    ["🌷 HeyMaa freut sich, diesen wichtigen Schritt in deinem Verlauf festzuhalten.",
     "🌟 Ein weiterer Schritt in deiner Schwangerschaft — HeyMaa steht für Fragen zur Verfügung."],
    ["💛 Guter Fortschritt. Jede Woche zählt auf diesem Weg.",
     "🌸 Deine Schwangerschaft verläuft gut — das ist erwähnenswert.",
     "❤️ Ein wichtiger Moment. HeyMaa steht bei Bedarf zur Verfügung."],
    ["🎯 Du näherst dich dem Ende dieser Phase — alles Gute weiterhin.",
     "🏆 Ein bemerkenswerter Meilenstein. HeyMaa wünscht dir weiterhin Gesundheit."],
  ],
  pt: [
    ["🌷 A HeyMaa tem o prazer de assinalar esta etapa importante do teu percurso.",
     "🌟 Mais uma etapa na tua gravidez — a HeyMaa está disponível para qualquer questão."],
    ["💛 Bom progresso. Cada semana conta neste percurso.",
     "🌸 A tua gravidez está a evoluir bem — vale a pena registar.",
     "❤️ Um momento importante. A HeyMaa está disponível sempre que precisares."],
    ["🎯 Estás a aproximar-te do fim desta etapa — tudo de bom.",
     "🏆 Uma etapa que vale a pena registar. A HeyMaa deseja-te continuação de saúde."],
  ],
  it: [
    ["🌷 HeyMaa è lieta di segnalare questa importante fase del tuo percorso.",
     "🌟 Un altro passo nella tua gravidanza — HeyMaa è disponibile per qualsiasi domanda."],
    ["💛 Buon progresso. Ogni settimana conta in questo percorso.",
     "🌸 La tua gravidanza procede bene — vale la pena annotarlo.",
     "❤️ Un momento importante. HeyMaa è disponibile quando ne hai bisogno."],
    ["🎯 Ti stai avvicinando alla fine di questa fase — buon proseguimento.",
     "🏆 Una tappa da segnalare. HeyMaa ti augura buona salute."],
  ],
  nl: [
    ["🌷 HeyMaa noteert met plezier deze belangrijke stap in jouw traject.",
     "🌟 Weer een stap in je zwangerschap — HeyMaa staat klaar voor vragen."],
    ["💛 Goede voortgang. Elke week telt in dit traject.",
     "🌸 Je zwangerschap verloopt goed — het loont om dit te noteren.",
     "❤️ Een belangrijk moment. HeyMaa is beschikbaar wanneer je het nodig hebt."],
    ["🎯 Je nadert het einde van deze fase — veel succes verder.",
     "🏆 Een mijlpaal om te noteren. HeyMaa wenst je veel gezondheid."],
  ],
  bn: [
    ["🌷 HeyMaa আপনার যাত্রার এই গুরুত্বপূর্ণ পর্যায়টি নোট করতে পেরে আনন্দিত।",
     "🌟 আপনার গর্ভাবস্থার আরেকটি পর্যায় — কোনো প্রশ্ন থাকলে HeyMaa এখানে আছে।"],
    ["💛 ভালো অগ্রগতি। এই যাত্রায় প্রতিটি সপ্তাহ গুরুত্বপূর্ণ।",
     "🌸 আপনার গর্ভাবস্থা ভালোভাবে এগিয়ে চলছে — নোট করার মতো।",
     "❤️ একটি গুরুত্বপূর্ণ মুহূর্ত। প্রয়োজনে HeyMaa উপলব্ধ।"],
    ["🎯 আপনি এই পর্যায়ের সমাপ্তির কাছাকাছি — শুভকামনা।",
     "🏆 নোট করার মতো একটি মাইলফলক। HeyMaa আপনার সুস্বাস্থ্য কামনা করে।"],
  ],
  id: [
    ["🌷 HeyMaa dengan senang hati mencatat tahap penting dalam perjalanan Anda ini.",
     "🌟 Satu langkah lagi dalam kehamilan Anda — HeyMaa siap untuk pertanyaan apa pun."],
    ["💛 Kemajuan yang baik. Setiap minggu penting dalam perjalanan ini.",
     "🌸 Kehamilan Anda berjalan dengan baik — patut dicatat.",
     "❤️ Momen penting. HeyMaa tersedia kapan pun Anda membutuhkan."],
    ["🎯 Anda mendekati akhir tahap ini — semoga semuanya lancar.",
     "🏆 Tonggak yang patut dicatat. HeyMaa mendoakan kesehatan Anda."],
  ],
  sw: [
    ["🌷 HeyMaa inafurahi kuandika hatua hii muhimu ya safari yako.",
     "🌟 Hatua nyingine katika ujauzito wako — HeyMaa ipo kwa swali lolote."],
    ["💛 Maendeleo mazuri. Kila wiki ina maana katika safari hii.",
     "🌸 Ujauzito wako unaendelea vizuri — inafaa kuandikwa.",
     "❤️ Wakati muhimu. HeyMaa inapatikana wakati wowote unapohitaji."],
    ["🎯 Unakaribia mwisho wa hatua hii — kila la heri.",
     "🏆 Hatua inayofaa kuandikwa. HeyMaa inakutakia afya njema."],
  ],
  fil: [
    ["🌷 Natutuwa ang HeyMaa na maitala ang mahalagang yugto ng iyong paglalakbay.",
     "🌟 Isa pang hakbang sa iyong pagbubuntis — narito ang HeyMaa para sa anumang tanong."],
    ["💛 Magandang pag-unlad. Mahalaga ang bawat linggo sa paglalakbay na ito.",
     "🌸 Mahusay ang pag-unlad ng iyong pagbubuntis — sulit na itala.",
     "❤️ Isang mahalagang sandali. Available ang HeyMaa kapag kailangan mo."],
    ["🎯 Malapit ka na sa katapusan ng yugtong ito — patuloy na maging mabuti.",
     "🏆 Isang yugto na sulit na itala. Nais sa iyo ng HeyMaa ng tuloy-tuloy na kalusugan."],
  ],
  mr: [
    ["🌷 तुमच्या प्रवासातील हा महत्त्वाचा टप्पा नोंदवताना HeyMaa ला आनंद होतो.",
     "🌟 तुमच्या गर्भधारणेतील आणखी एक टप्पा — कोणत्याही प्रश्नासाठी HeyMaa येथे आहे."],
    ["💛 चांगली प्रगती. या प्रवासात प्रत्येक आठवडा महत्त्वाचा आहे.",
     "🌸 तुमची गर्भधारणा चांगली प्रगती करत आहे — नोंद करण्यासारखे आहे.",
     "❤️ एक महत्त्वाचा क्षण. आवश्यकता असेल तेव्हा HeyMaa उपलब्ध आहे."],
    ["🎯 तुम्ही या टप्प्याच्या अखेरीकडे जात आहात — पुढील वाटचालीसाठी शुभेच्छा.",
     "🏆 नोंद करण्यासारखा टप्पा. HeyMaa तुमच्या उत्तम आरोग्याची इच्छा करते."],
  ],
  te: [
    ["🌷 మీ ప్రయాణంలో ఈ ముఖ్యమైన దశను గుర్తించడంలో HeyMaa సంతోషంగా ఉంది.",
     "🌟 మీ గర్భధారణలో మరో దశ — ఏ ప్రశ్నకైనా HeyMaa ఇక్కడ ఉంది."],
    ["💛 మంచి పురోగతి. ఈ ప్రయాణంలో ప్రతి వారం ముఖ్యమైనది.",
     "🌸 మీ గర్భధారణ బాగా పురోగమిస్తోంది — గుర్తించదగినది.",
     "❤️ ఒక ముఖ్యమైన క్షణం. అవసరమైనప్పుడు HeyMaa అందుబాటులో ఉంది."],
    ["🎯 మీరు ఈ దశ ముగింపుకు చేరువగా ఉన్నారు — శుభాకాంక్షలు.",
     "🏆 గుర్తించదగిన మైలురాయి. HeyMaa మీ ఆరోగ్యాన్ని కోరుకుంటుంది."],
  ],
};

function getPregnancyMilestones(week: number, lang: string): string[] {
  const translations = PREGNANCY_MILESTONE_TRANSLATIONS[lang] || PREGNANCY_MILESTONE_TRANSLATIONS["en"];
  for (let i = 0; i < PREGNANCY_MILESTONE_RANGES.length; i++) {
    const [min, max] = PREGNANCY_MILESTONE_RANGES[i];
    if (week >= min && week < max) {
      return translations[i] || PREGNANCY_MILESTONE_TRANSLATIONS["en"][i];
    }
  }
  if (week < 0) return translations[0];
  return translations[translations.length - 1];
}

function getPregnancyMilestoneMsg(idx: number, total: number, lang: string): string {
  const msgs = PREGNANCY_MILESTONE_MSGS_TRANSLATIONS[lang] || PREGNANCY_MILESTONE_MSGS_TRANSLATIONS["en"];
  const ratio = total > 1 ? idx / (total - 1) : 0;
  if (ratio <= 0.25) return msgs[0][idx % 2];
  if (ratio <= 0.65) return msgs[1][(idx - 2 + 3) % 3];
  return msgs[2][idx % 2];
}




const TR: Record<string,Record<string,string>> = {
  welcome:{el:"Καλώς ήρθες στη HeyMaa!",en:"Welcome to HeyMaa!",ar:"مرحباً بك في HeyMaa!",es:"¡Bienvenida a HeyMaa!",fr:"Bienvenue sur HeyMaa!",de:"Willkommen bei HeyMaa!",pt:"Bem-vinda ao HeyMaa!",it:"Benvenuta su HeyMaa!",ru:"Добро пожаловать в HeyMaa!",tr:"HeyMaa'ya Hoş Geldiniz!",hi:"HeyMaa में स्वागत है!",ur:"HeyMaa میں خوش آمدید!",zh:"欢迎使用HeyMaa！",ja:"HeyMaaへようこそ！",nl:"Welkom bij HeyMaa!",pl:"Witaj w HeyMaa!",ro:"Bun venit la HeyMaa!",bn:"HeyMaa-তে স্বাগতম!",id:"Selamat Datang di HeyMaa!",sw:"Karibu HeyMaa!",fil:"HeyMaa에 오신 걸 환영해요!",mr:"HeyMaa मध्ये स्वागत आहे!",te:"Chào mừng đến HeyMaa!"},
  setup:{el:"Ας στήσουμε τον λογαριασμό σου σε 2 λεπτά.",en:"Let's set up your account in 2 minutes.",ar:"لنقم بإعداد حسابك في دقيقتين.",es:"Configuremos tu cuenta en 2 minutos.",fr:"Configurons votre compte en 2 minutes.",de:"Lass uns dein Konto in 2 Minuten einrichten.",pt:"Vamos configurar a tua conta em 2 minutos.",it:"Configuriamo il tuo account in 2 minuti.",ru:"Настроим ваш аккаунт за 2 минуты.",tr:"Hesabını 2 dakikada ayarlayalım.",hi:"2 मिनट में खाता सेट करते हैं।",ur:"آئیں 2 منٹ میں آپ کا اکاؤنٹ ترتیب دیتے ہیں۔",zh:"2分钟设置账户。",ja:"2分で設定しましょう。",nl:"Account instellen in 2 minuten.",pl:"Konto w 2 minuty.",ro:"Cont în 2 minute.",bn:"২ মিনিটে সেটআপ।",id:"Siapkan akun 2 menit.",sw:"Dakika 2 kuanzisha.",fil:"2분 안에 설정.",mr:"2 मिनिटांत.",te:"2 నిమిషాల్లో."},
  yourname:{el:"Το όνομά σου",en:"Your name",ar:"اسمك",es:"Tu nombre",fr:"Ton prénom",de:"Dein Name",pt:"O teu nome",it:"Il tuo nome",ru:"Ваше имя",tr:"Adın",hi:"आपका नाम",ur:"آپ کا نام",zh:"你的名字",ja:"お名前",nl:"Jouw naam",pl:"Twoje imię",ro:"Numele tău",bn:"আপনার নাম",id:"Nama Anda",sw:"Jina lako",fil:"이름",mr:"तुमचे नाव",te:"మీ పేరు"},
  letsgo:{el:"Ξεκινάμε →",en:"Let's go →",ar:"هيا نبدأ ←",es:"Empezamos →",fr:"C'est parti →",de:"Los geht's →",pt:"Vamos lá →",it:"Iniziamo →",ru:"Начнём →",tr:"Başlayalım →",hi:"चलते हैं →",ur:"شروع کریں →",zh:"开始 →",ja:"はじめましょう →",nl:"Laten we gaan →",pl:"Zaczynamy →",ro:"Să începem →",bn:"শুরু করি →",id:"Ayo mulai →",sw:"Tuanze →",fil:"시작해요 →",mr:"चला सुरू करूया →",te:"ప్రారంభిద్దాం →"},
  profile2:{el:"Ας ενημερώσουμε το προφίλ σου",en:"Tell us about your little one",ar:"أخبرينا عن طفلك",es:"Cuéntanos sobre tu bebé",fr:"Parlez-nous de votre bébé",de:"Erzähl uns von deinem Baby",pt:"Fala-nos do teu bebé",it:"Parlaci del tuo bambino",ru:"Расскажите о малыше",tr:"Bebeğin hakkında anlat",hi:"अपने बच्चे के बारे में बताएं",ur:"اپنے بچے کے بارے میں",zh:"告诉我们宝宝",ja:"赤ちゃんについて",nl:"Vertel over je baby",pl:"Opowiedz o dziecku",ro:"Spune-ne despre bebeluș",bn:"শিশু সম্পর্কে বলুন",id:"Ceritakan bayi Anda",sw:"Tuambie kuhusu mtoto",fil:"아기에 대해 알려주세요",mr:"Малюка розкажіть",te:"మీ బాబు గురించి"},
  childname:{el:"Όνομα παιδιού",en:"Child's name",ar:"اسم الطفل",es:"Nombre del niño",fr:"Prénom de l'enfant",de:"Name des Kindes",pt:"Nome do filho",it:"Nome del bambino",ru:"Имя ребёнка",tr:"Çocuğun adı",hi:"बच्चे का नाम",ur:"بچے کا نام",zh:"孩子的名字",ja:"お子さんの名前",nl:"Naam kind",pl:"Imię dziecka",ro:"Numele copilului",bn:"শিশুর নাম",id:"Nama anak",sw:"Jina la mtoto",fil:"아이 이름",mr:"मुलाचे नाव",te:"పిల్లల పేరు"},
  childage:{el:"Ηλικία (π.χ. 4 μήνες)",en:"Age (e.g. 4 months)",ar:"العمر (مثل: 4 أشهر)",es:"Edad (ej. 4 meses)",fr:"Âge (ex. 4 mois)",de:"Alter (z.B. 4 Monate)",pt:"Idade (ex. 4 meses)",it:"Età (es. 4 mesi)",ru:"Возраст (4 месяца)",tr:"Yaş (örn. 4 ay)",hi:"उम्र (4 महीने)",ur:"عمر (4 ماہ)",zh:"年龄（4个月）",ja:"年齢（4ヶ月）",nl:"Leeftijd (4 maanden)",pl:"Wiek (4 miesiące)",ro:"Vârsta (4 luni)",bn:"বয়স (৪ মাস)",id:"Usia (4 bulan)",sw:"Umri (miezi 4)",fil:"나이 (4개월)",mr:"वय (4 महिने)",te:"వయస్సు (4 నెలలు)"},
  continue:{el:"Συνέχεια →",en:"Continue →",ar:"متابعة ←",es:"Continuar →",fr:"Continuer →",de:"Weiter →",pt:"Continuar →",it:"Continua →",ru:"Продолжить →",tr:"Devam et →",hi:"जारी रखें →",ur:"جاری رکھیں →",zh:"继续 →",ja:"続ける →",nl:"Doorgaan →",pl:"Dalej →",ro:"Continuă →",bn:"চালিয়ে যান →",id:"Lanjutkan →",sw:"Endelea →",fil:"계속 →",mr:"पुढे →",te:"కొనసాగించు →"},
  duedatelabel:{el:"Πιθανότερη ημερομηνία τοκετού",en:"Expected due date",ar:"تاريخ الولادة المتوقع",zh:"预产期",es:"Fecha probable de parto",fr:"Date d'accouchement prévue",ro:"Data probabilă a naşterii",pl:"Przewidywana data porodu",tr:"Tahmini doğum tarihi",hi:"संभावित प्रसव तिथि",ur:"متوقع تاریخ پیدائش",ja:"出産予定日",ru:"Предполагаемая дата родов",de:"Voraussichtlicher Geburtstermin",pt:"Data prevista do parto",it:"Data presunta del parto",nl:"Verwachte bevallingsdatum",bn:"প্রত্যাশিত প্রসবের তারিখ",id:"Tanggal perkiraan persalinan",sw:"Tarehe inayotarajiwa ya kujifungua",fil:"Inaasahang petsa ng panganganak",mr:"अपेक्षित प्रसूती तारीख",te:"ఆశించిన ప్రసవ తేదీ"},
  childbirthdate:{el:"Ημερομηνία γέννησης παιδιού",en:"Child's birth date",ar:"تاريخ ميلاد الطفل",zh:"孩子的出生日期",es:"Fecha de nacimiento del niño",fr:"Date de naissance de l'enfant",ro:"Data naşterii copilului",pl:"Data urodzenia dziecka",tr:"Çocuğun doğum tarihi",hi:"बच्चे की जन्म तिथि",ur:"بچے کی تاریخ پیدائش",ja:"お子さんの生年月日",ru:"Дата рождения ребёнка",de:"Geburtsdatum des Kindes",pt:"Data de nascimento do filho",it:"Data di nascita del bambino",nl:"Geboortedatum kind",bn:"শিশুর জন্ম তারিখ",id:"Tanggal lahir anak",sw:"Tarehe ya kuzaliwa ya mtoto",fil:"Petsa ng kapanganakan ng anak",mr:"मुलाची जन्म तारीख",te:"పిల్లల పుట్టిన తేదీ"},
  unit_days:{el:"ημέρες",en:"days",ar:"أيام",zh:"天",es:"días",fr:"jours",ro:"zile",pl:"dni",tr:"gün",hi:"दिन",ur:"دن",ja:"日",ru:"дней",de:"Tage",pt:"dias",it:"giorni",nl:"dagen",bn:"দিন",id:"hari",sw:"siku",fil:"araw",mr:"दिवस",te:"రోజులు"},
  unit_months:{el:"μήνες",en:"months",ar:"أشهر",zh:"个月",es:"meses",fr:"mois",ro:"luni",pl:"miesięcy",tr:"ay",hi:"महीने",ur:"ماہ",ja:"ヶ月",ru:"месяцев",de:"Monate",pt:"meses",it:"mesi",nl:"maanden",bn:"মাস",id:"bulan",sw:"miezi",fil:"buwan",mr:"महिने",te:"నెలలు"},
  unit_years:{el:"χρόνια",en:"years",ar:"سنوات",zh:"岁",es:"años",fr:"ans",ro:"ani",pl:"lat",tr:"yıl",hi:"साल",ur:"سال",ja:"歳",ru:"лет",de:"Jahre",pt:"anos",it:"anni",nl:"jaar",bn:"বছর",id:"tahun",sw:"miaka",fil:"taon",mr:"वर्षे",te:"సంవత్సరాలు"},
  pregnancycard_title:{el:"Η εγκυμοσύνη σου",en:"Your pregnancy",ar:"حملك",zh:"你的孕期",es:"Tu embarazo",fr:"Votre grossesse",ro:"Sarcina ta",pl:"Twoja ciąża",tr:"Hamileliğin",hi:"आपकी गर्भावस्था",ur:"آپ کا حمل",ja:"あなたの妊娠",ru:"Ваша беременность",de:"Deine Schwangerschaft",pt:"A tua gravidez",it:"La tua gravidanza",nl:"Jouw zwangerschap",bn:"আপনার গর্ভাবস্থা",id:"Kehamilan Anda",sw:"Ujauzito wako",fil:"Ang iyong pagbubuntis",mr:"तुमची गर्भधारणा",te:"మీ గర్భధారణ"},
  pregnancycard_body:{el:"Είσαι περίπου στην {week}η εβδομάδα. Αναμενόμενη ημερομηνία τοκετού: {date}. Ρώτησέ με ό,τι θες για την εξέλιξη της εγκυμοσύνης!",en:"You're approximately in week {week}. Expected due date: {date}. Ask me anything about your pregnancy progress!",ar:"أنت في الأسبوع {week} تقريباً. تاريخ الولادة المتوقع: {date}. اسأليني أي شيء عن تقدم حملك!",zh:"你大约在第{week}周。预产期：{date}。关于孕期进展，随时问我！",es:"Estás aproximadamente en la semana {week}. Fecha probable de parto: {date}. ¡Pregúntame lo que quieras sobre tu embarazo!",fr:"Vous êtes environ à la semaine {week}. Date d'accouchement prévue: {date}. Posez-moi toutes vos questions sur votre grossesse !",ro:"Ești aproximativ în săptămâna {week}. Data probabilă a naşterii: {date}. Întreabă-mă orice despre sarcina ta!",pl:"Jesteś w około {week}. tygodniu. Przewidywana data porodu: {date}. Pytaj mnie o wszystko dotyczące ciąży!",tr:"Yaklaşık {week}. haftadasın. Tahmini doğum tarihi: {date}. Hamilelik sürecinle ilgili her şeyi sorabilirsin!",hi:"आप लगभग {week}वें सप्ताह में हैं। संभावित प्रसव तिथि: {date}। अपनी गर्भावस्था के बारे में कुछ भी पूछें!",ur:"آپ تقریباً {week} ہفتے میں ہیں۔ متوقع تاریخ پیدائش: {date}۔ اپنے حمل کے بارے میں کچھ بھی پوچھیں!",ja:"現在およそ妊娠{week}週目です。出産予定日：{date}。妊娠の経過について何でも聞いてください！",ru:"Вы примерно на {week}-й неделе. Предполагаемая дата родов: {date}. Спрашивайте меня о течении беременности!",de:"Du bist etwa in der {week}. Woche. Voraussichtlicher Geburtstermin: {date}. Frag mich alles über deine Schwangerschaft!",pt:"Estás aproximadamente na semana {week}. Data prevista do parto: {date}. Pergunta-me o que quiseres sobre a tua gravidez!",it:"Sei circa alla settimana {week}. Data presunta del parto: {date}. Chiedimi tutto sulla tua gravidanza!",nl:"Je bent ongeveer in week {week}. Verwachte bevallingsdatum: {date}. Vraag me alles over je zwangerschap!",bn:"আপনি প্রায় {week} সপ্তাহে আছেন। প্রত্যাশিত প্রসবের তারিখ: {date}। আপনার গর্ভাবস্থা সম্পর্কে যা চান জিজ্ঞাসা করুন!",id:"Anda kira-kira di minggu ke-{week}. Tanggal perkiraan persalinan: {date}. Tanyakan apa saja tentang perkembangan kehamilan Anda!",sw:"Uko takriban wiki ya {week}. Tarehe inayotarajiwa ya kujifungua: {date}. Niulize chochote kuhusu maendeleo ya ujauzito wako!",fil:"Humigit-kumulang sa ika-{week} linggo ka. Inaasahang petsa ng panganganak: {date}. Magtanong ka kung ano man tungkol sa iyong pagbubuntis!",mr:"तुम्ही अंदाजे {week} व्या आठवड्यात आहात. अपेक्षित प्रसूती तारीख: {date}. तुमच्या गर्भधारणेबद्दल काहीही विचारा!",te:"మీరు సుమారు {week}వ వారంలో ఉన్నారు. ఆశించిన ప్రసవ తేదీ: {date}. మీ గర్భధారణ గురించి ఏదైనా అడగండి!"},
  pregnancymilestones_title:{el:"Ορόσημα εγκυμοσύνης",en:"Pregnancy milestones",ar:"إنجازات الحمل",zh:"孕期里程碑",es:"Hitos del embarazo",fr:"Étapes de la grossesse",ro:"Repere ale sarcinii",pl:"Etapy ciąży",tr:"Hamilelik aşamaları",hi:"गर्भावस्था के माइलस्टोन",ur:"حمل کے سنگ میل",ja:"妊娠のマイルストーン",ru:"Вехи беременности",de:"Schwangerschaftsmeilensteine",pt:"Marcos da gravidez",it:"Traguardi della gravidanza",nl:"Mijlpalen van de zwangerschap",bn:"গর্ভাবস্থার মাইলফলক",id:"Tonggak kehamilan",sw:"Hatua za ujauzito",fil:"Mga milestone ng pagbubuntis",mr:"गर्भधारणेचे टप्पे",te:"గర్భధారణ మైలురాళ్ళు"},
  pregnancymilestones_sub:{el:"Τικάρετε τα ορόσημα που έχουν συμβεί στην εξέλιξη της εγκυμοσύνης σας!",en:"Tick the milestones that have happened in your pregnancy progress!",ar:"ضعي علامة على الإنجازات التي حدثت في مسار حملك!",zh:"勾选孕期中已经达到的里程碑！",es:"¡Marca los hitos que ya han ocurrido en tu embarazo!",fr:"Cochez les étapes déjà atteintes dans votre grossesse !",ro:"Bifează reperele care s-au întâmplat deja în sarcina ta!",pl:"Zaznacz etapy, które już wystąpiły w Twojej ciąży!",tr:"Hamileliğinde gerçekleşen aşamaları işaretle!",hi:"अपनी गर्भावस्था में हो चुके माइलस्टोन चुनें!",ur:"اپنے حمل میں ہونے والے سنگ میل نشان لگائیں!",ja:"妊娠の経過で達成したマイルストーンをチェック！",ru:"Отметьте вехи, которые уже произошли в вашей беременности!",de:"Hake die Meilensteine ab, die in deiner Schwangerschaft bereits eingetreten sind!",pt:"Assinala os marcos que já aconteceram na tua gravidez!",it:"Spunta i traguardi già raggiunti nella tua gravidanza!",nl:"Vink de mijlpalen aan die al zijn bereikt in je zwangerschap!",bn:"আপনার গর্ভাবস্থায় ঘটে যাওয়া মাইলফলকগুলো টিক করুন!",id:"Centang tonggak yang telah terjadi dalam kehamilan Anda!",sw:"Weka alama kwa hatua zilizotokea katika ujauzito wako!",fil:"I-tick ang mga milestone na naganap na sa iyong pagbubuntis!",mr:"तुमच्या गर्भधारणेत झालेले टप्पे निवडा!",te:"మీ గర్భధారణలో జరిగిన మైలురాళ్ళను టిక్ చేయండి!"},
  week_label:{el:"Εβδομάδα",en:"Week",ar:"الأسبوع",zh:"第",es:"Semana",fr:"Semaine",ro:"Săptămâna",pl:"Tydzień",tr:"Hafta",hi:"सप्ताह",ur:"ہفتہ",ja:"妊娠週",ru:"Неделя",de:"Woche",pt:"Semana",it:"Settimana",nl:"Week",bn:"সপ্তাহ",id:"Minggu",sw:"Wiki",fil:"Linggo",mr:"आठवडा",te:"వారం"},
  askmile_preg_q:{el:"Ποια είναι τα επόμενα στάδια της εγκυμοσύνης στην {week}η εβδομάδα;",en:"What are the next stages of pregnancy at week {week}?",ar:"ما هي المراحل القادمة للحمل في الأسبوع {week}؟",zh:"第{week}周后孕期的下一阶段是什么？",es:"¿Cuáles son las próximas etapas del embarazo en la semana {week}?",fr:"Quelles sont les prochaines étapes de la grossesse à la semaine {week}?",ro:"Care sunt următoarele etape ale sarcinii în săptămâna {week}?",pl:"Jakie są kolejne etapy ciąży w {week}. tygodniu?",tr:"{week}. haftada hamileliğin sonraki aşamaları nelerdir?",hi:"{week}वें सप्ताह में गर्भावस्था के अगले चरण क्या हैं?",ur:"{week} ہفتے میں حمل کے اگلے مراحل کیا ہیں؟",ja:"{week}週目以降の妊娠の次の段階は何ですか？",ru:"Какие следующие этапы беременности на {week}-й неделе?",de:"Was sind die nächsten Schwangerschaftsphasen in Woche {week}?",pt:"Quais são as próximas etapas da gravidez na semana {week}?",it:"Quali sono le prossime fasi della gravidanza alla settimana {week}?",nl:"Wat zijn de volgende fasen van de zwangerschap in week {week}?",bn:"{week} সপ্তাহে গর্ভাবস্থার পরবর্তী পর্যায়গুলো কী?",id:"Apa tahap kehamilan selanjutnya di minggu ke-{week}?",sw:"Ni hatua gani zinazofuata za ujauzito katika wiki ya {week}?",fil:"Ano ang mga susunod na yugto ng pagbubuntis sa linggo {week}?",mr:"आठवडा {week} मध्ये गर्भधारणेचे पुढील टप्पे काय आहेत?",te:"వారం {week}లో గర్భధారణ తదుపరి దశలు ఏమిటి?"},
  pregnancy_short:{el:"Εγκυμοσύνη",en:"Pregnancy",ar:"الحمل",zh:"孕期",es:"Embarazo",fr:"Grossesse",ro:"Sarcină",pl:"Ciąża",tr:"Hamilelik",hi:"गर्भावस्था",ur:"حمل",ja:"妊娠",ru:"Беременность",de:"Schwangerschaft",pt:"Gravidez",it:"Gravidanza",nl:"Zwangerschap",bn:"গর্ভাবস্থা",id:"Kehamilan",sw:"Ujauzito",fil:"Pagbubuntis",mr:"गर्भधारणा",te:"గర్భధారణ"},
  duelabel:{el:"Τοκετός: ",en:"Due: ",ar:"الولادة: ",zh:"预产期：",es:"Parto: ",fr:"Accouchement : ",ro:"Naștere: ",pl:"Poród: ",tr:"Doğum: ",hi:"प्रसव: ",ur:"پیدائش: ",ja:"出産予定：",ru:"Роды: ",de:"Termin: ",pt:"Parto: ",it:"Parto: ",nl:"Bevalling: ",bn:"প্রসব: ",id:"Persalinan: ",sw:"Kujifungua: ",fil:"Panganganak: ",mr:"प्रसूती: ",te:"ప్రసవం: "},
  selectlanguage_login:{el:"Επιλέξτε γλώσσα",en:"Select language",ar:"اختر اللغة",zh:"选择语言",es:"Selecciona el idioma",fr:"Choisissez la langue",ro:"Selectează limba",pl:"Wybierz język",tr:"Dil seçin",hi:"भाषा चुनें",ur:"زبان منتخب کریں",ja:"言語を選択",ru:"Выберите язык",de:"Sprache wählen",pt:"Seleciona o idioma",it:"Seleziona la lingua",nl:"Selecteer taal",bn:"ভাষা নির্বাচন করুন",id:"Pilih bahasa",sw:"Chagua lugha",fil:"Pumili ng wika",mr:"भाषा निवडा",te:"భాషను ఎంచుకోండి"},
  pregnant_or_baby_q:{el:"Είσαι έγκυος ή έχεις ήδη μωρό;",en:"Are you pregnant or do you already have a baby?",ar:"هل أنت حامل أم لديك طفل بالفعل؟",zh:"您是怀孕了还是已经有宝宝了？",es:"¿Estás embarazada o ya tienes un bebé?",fr:"Êtes-vous enceinte ou avez-vous déjà un bébé ?",ro:"Ești gravidă sau ai deja un copil?",pl:"Jesteś w ciąży czy masz już dziecko?",tr:"Hamile misin yoksa zaten bir bebeğin var mı?",hi:"क्या आप गर्भवती हैं या आपके पास पहले से बच्चा है?",ur:"کیا آپ حاملہ ہیں یا آپ کے پاس پہلے سے بچہ ہے؟",ja:"妊娠中ですか、それともすでに赤ちゃんがいますか？",ru:"Вы беременны или у вас уже есть малыш?",de:"Bist du schwanger oder hast du schon ein Baby?",pt:"Estás grávida ou já tens um bebé?",it:"Sei incinta o hai già un bambino?",nl:"Ben je zwanger of heb je al een baby?",bn:"আপনি গর্ভবতী নাকি আপনার ইতিমধ্যে একটি শিশু আছে?",id:"Apakah Anda sedang hamil atau sudah memiliki bayi?",sw:"Je, una mimba au una mtoto tayari?",fil:"Buntis ka ba o may bata na ka?",mr:"तुम्ही गर्भवती आहात की तुमचे आधीच बाळ आहे?",te:"మీరు గర్భవతిగా ఉన్నారా లేదా మీకు ఇప్పటికే శిశువు ఉందా?"},
  im_pregnant:{el:"Είμαι έγκυος",en:"I'm pregnant",ar:"أنا حامل",zh:"我怀孕了",es:"Estoy embarazada",fr:"Je suis enceinte",ro:"Sunt gravidă",pl:"Jestem w ciąży",tr:"Hamileyim",hi:"मैं गर्भवती हूं",ur:"میں حاملہ ہوں",ja:"妊娠しています",ru:"Я беременна",de:"Ich bin schwanger",pt:"Estou grávida",it:"Sono incinta",nl:"Ik ben zwanger",bn:"আমি গর্ভবতী",id:"Saya sedang hamil",sw:"Nina mimba",fil:"Buntis ako",mr:"मी गर्भवती आहे",te:"నేను గర్భవతి"},
  have_baby:{el:"Έχω μωρό",en:"I have a baby",ar:"لدي طفل",zh:"我有宝宝",es:"Tengo un bebé",fr:"J'ai un bébé",ro:"Am un copil",pl:"Mam dziecko",tr:"Bebeğim var",hi:"मेरे पास बच्चा है",ur:"میرے پاس بچہ ہے",ja:"赤ちゃんがいます",ru:"У меня малыш",de:"Ich habe ein Baby",pt:"Tenho um bebé",it:"Ho un bambino",nl:"Ik heb een baby",bn:"আমার একটি শিশু আছে",id:"Saya sudah punya bayi",sw:"Nina mtoto",fil:"May bata na ako",mr:"माझे बाळ आहे",te:"నాకు శిశువు ఉంది"},
  babyinfo_q:{el:"Πες μας για το παιδί σου.",en:"Tell us about your child.",ar:"أخبرينا عن طفلك.",zh:"告诉我们关于您孩子的信息。",es:"Cuéntanos sobre tu hijo/a.",fr:"Parlez-nous de votre enfant.",ro:"Spune-ne despre copilul tău.",pl:"Opowiedz nam o swoim dziecku.",tr:"Çocuğun hakkında anlat.",hi:"अपने बच्चे के बारे में बताएं।",ur:"اپنے بچے کے بارے میں بتائیں۔",ja:"お子さんについて教えてください。",ru:"Расскажите о своём ребёнке.",de:"Erzähl uns von deinem Kind.",pt:"Fala-nos do teu filho/a.",it:"Parlaci del tuo bambino.",nl:"Vertel ons over je kind.",bn:"আপনার শিশু সম্পর্কে বলুন।",id:"Ceritakan tentang anak Anda.",sw:"Tuambie kuhusu mtoto wako.",fil:"Sabihin mo sa amin ang tungkol sa iyong anak.",mr:"तुमच्या मुलाबद्दल सांगा.",te:"మీ పిల్లల గురించి చెప్పండి."},
  subexpiredtitle:{el:"Η συνδρομή σου έχει λήξει",en:"Your subscription has expired",ar:"انتهت صلاحية اشتراكك",es:"Tu suscripción ha caducado",fr:"Votre abonnement a expiré",de:"Dein Abo ist abgelaufen",pt:"A tua subscrição expirou",it:"Il tuo abbonamento è scaduto",ru:"Ваша подписка истекла",tr:"Aboneliğinizin süresi doldu",hi:"आपकी सदस्यता समाप्त हो गई है",ur:"آپ کی سبسکرپشن ختم ہو گئی ہے",zh:"您的订阅已过期",ja:"サブスクリプションの期限が切れました",nl:"Je abonnement is verlopen",pl:"Twoja subskrypcja wygasła",ro:"Abonamentul tău a expirat",bn:"আপনার সাবস্ক্রিপশন শেষ হয়ে গেছে",id:"Langganan Anda telah berakhir",sw:"Usajili wako umeisha muda",fil:"Nag-expire na ang subscription mo",mr:"तुमची सदस्यता संपली आहे",te:"మీ సభ్యత్వం గడువు ముగిసింది"},
  subexpiredbody:{el:"Για να συνεχίσεις να χρησιμοποιείς την HeyMaa, ανανέωσε τη συνδρομή σου.",en:"To keep using HeyMaa, please renew your subscription.",ar:"لمواصلة استخدام HeyMaa، يرجى تجديد اشتراكك.",es:"Para seguir usando HeyMaa, renueva tu suscripción.",fr:"Pour continuer à utiliser HeyMaa, renouvelez votre abonnement.",de:"Um HeyMaa weiterhin zu nutzen, erneuere bitte dein Abo.",pt:"Para continuar a usar a HeyMaa, renova a tua subscrição.",it:"Per continuare a usare HeyMaa, rinnova il tuo abbonamento.",ru:"Чтобы продолжить использовать HeyMaa, продлите подписку.",tr:"HeyMaa'yı kullanmaya devam etmek için aboneliğini yenile.",hi:"HeyMaa का उपयोग जारी रखने के लिए, कृपया अपनी सदस्यता रिन्यू करें।",ur:"HeyMaa کا استعمال جاری رکھنے کے لیے، اپنی سبسکرپشن کی تجدید کریں۔",zh:"要继续使用HeyMaa，请续订您的订阅。",ja:"HeyMaaを使い続けるには、サブスクリプションを更新してください。",nl:"Om HeyMaa te blijven gebruiken, vernieuw je abonnement.",pl:"Aby dalej korzystać z HeyMaa, odnów subskrypcję.",ro:"Pentru a continua să folosești HeyMaa, reînnoiește abonamentul.",bn:"HeyMaa ব্যবহার চালিয়ে যেতে, আপনার সাবস্ক্রিপশন রিনিউ করুন।",id:"Untuk terus menggunakan HeyMaa, perpanjang langganan Anda.",sw:"Kuendelea kutumia HeyMaa, tafadhali sasisha usajili wako.",fil:"이용을 계속하려면 구독을 갱신해 주세요.",mr:"HeyMaa वापरणे सुरू ठेवण्यासाठी, तुमची सदस्यता रिन्यू करा.",te:"HeyMaa ఉపయోగించడం కొనసాగించడానికి, మీ సభ్యత్వాన్ని పునరుద్ధరించండి."},
  renewbtn:{el:"Ανανέωση συνδρομής →",en:"Renew subscription →",ar:"تجديد الاشتراك ←",es:"Renovar suscripción →",fr:"Renouveler l'abonnement →",de:"Abo erneuern →",pt:"Renovar subscrição →",it:"Rinnova abbonamento →",ru:"Продлить подписку →",tr:"Aboneliği yenile →",hi:"सदस्यता रिन्यू करें →",ur:"سبسکرپشن کی تجدید کریں →",zh:"续订订阅 →",ja:"サブスクリプションを更新 →",nl:"Abonnement vernieuwen →",pl:"Odnów subskrypcję →",ro:"Reînnoiește abonamentul →",bn:"সাবস্ক্রিপশন রিনিউ করুন →",id:"Perpanjang langganan →",sw:"Sasisha usajili →",fil:"갱신하기 →",mr:"सदस्यता रिन्यू करा →",te:"సభ్యత్వాన్ని పునరుద్ధరించండి →"},
  back:{el:"← Πίσω",en:"← Back",ar:"→ رجوع",es:"← Atrás",fr:"← Retour",de:"← Zurück",pt:"← Voltar",it:"← Indietro",ru:"← Назад",tr:"← Geri",hi:"← वापस",ur:"← پیچھے",zh:"← 返回",ja:"← 戻る",nl:"← Terug",pl:"← Wstecz",ro:"← Înapoi",bn:"← ফিরে",id:"← Kembali",sw:"← Rudi",fil:"← 뒤로",mr:"← मागे",te:"← వెనక్కి"},
  ready:{el:"Είσαι έτοιμη!",en:"You're all set!",ar:"أنت جاهزة!",es:"¡Ya estás lista!",fr:"Vous êtes prête!",de:"Du bist bereit!",pt:"Estás pronta!",it:"Sei pronta!",ru:"Вы готовы!",tr:"Hazırsın!",hi:"आप तैयार हैं!",ur:"آپ تیار ہیں!",zh:"你准备好了！",ja:"準備完了！",nl:"Je bent er klaar voor!",pl:"Jesteś gotowa!",ro:"Ești gata!",bn:"আপনি প্রস্তুত!",id:"Kamu siap!",sw:"Uko tayari!",fil:"준비됐어요!",mr:"तुम्ही तयार आहात!",te:"మీరు సిద్ధంగా ఉన్నారు!"},
  readysub:{el:"Ο λογαριασμός σου στήθηκε.",en:"Your account is ready.",ar:"حسابك جاهز.",es:"Cuenta lista.",fr:"Compte prêt.",de:"Konto bereit.",pt:"Conta pronta.",it:"Account pronto.",ru:"Аккаунт готов.",tr:"Hesabın hazır.",hi:"खाता तैयार है।",ur:"اکاؤنٹ تیار ہے۔",zh:"账户已准备好。",ja:"準備完了。",nl:"Account klaar.",pl:"Konto gotowe.",ro:"Cont gata.",bn:"অ্যাকাউন্ট প্রস্তুত।",id:"Akun siap.",sw:"Akaunti iko tayari.",fil:"계정 준비됐어요.",mr:"Акаунт готовий.",te:"ఖాతా సిద్ధంగా ఉంది."},
  country_label:{el:"Χώρα",en:"Country",ar:"البلد",zh:"国家",es:"País",fr:"Pays",ro:"Țara",pl:"Kraj",tr:"Ülke",hi:"देश",ur:"ملک",ja:"国",ru:"Страна",de:"Land",pt:"País",it:"Paese",nl:"Land",bn:"দেশ",id:"Negara",sw:"Nchi",fil:"Bansa",mr:"देश",te:"దేశం"},
  country_ph:{el:"Επίλεξε χώρα...",en:"Select your country...",ar:"اختر بلدك...",zh:"选择国家...",es:"Selecciona tu país...",fr:"Sélectionnez votre pays...",ro:"Selectează țara...",pl:"Wybierz kraj...",tr:"Ülkeni seç...",hi:"देश चुनें...",ur:"ملک منتخب کریں...",ja:"国を選択...",ru:"Выберите страну...",de:"Land wählen...",pt:"Seleciona o teu país...",it:"Seleziona il tuo paese...",nl:"Selecteer land...",bn:"দেশ নির্বাচন করুন...",id:"Pilih negara...",sw:"Chagua nchi...",fil:"Pumili ng bansa...",mr:"देश निवडा...",te:"దేశం ఎంచుకోండి..."},
  consent_gdpr:{el:"Συναινώ σε εξατομικευμένες προσφορές από την Care Direct (GDPR)",en:"I agree to receive personalised offers from Care Direct (GDPR)",ar:"أوافق على العروض المخصصة من Care Direct (GDPR)",zh:"同意接收Care Direct个性化优惠 (GDPR)",es:"Acepto recibir ofertas personalizadas de Care Direct (GDPR)",fr:"Accepter les offres personnalisées Care Direct (RGPD)",ro:"Accept oferte personalizate de la Care Direct (GDPR)",pl:"Zgadzam się na oferty spersonalizowane od Care Direct (RODO)",tr:"Care Direct kişisel teklifler onayı (GDPR)",hi:"Care Direct से व्यक्तिगत ऑफ़र पाने की सहमति (GDPR)",ur:"Care Direct سے ذاتی آفرز قبول کرتا/کرتی ہوں (GDPR)",ja:"Care Directからのパーソナライズ特典に同意 (GDPR)",ru:"Согласен/а на предложения Care Direct (GDPR)",de:"Personalisierte Angebote von Care Direct zustimmen (DSGVO)",pt:"Aceito ofertas personalizadas da Care Direct (RGPD)",it:"Acconsento alle offerte di Care Direct (GDPR)",nl:"Akkoord met aanbiedingen van Care Direct (AVG)",bn:"Care Direct থেকে অফার পেতে সম্মতি (GDPR)",id:"Setuju menerima penawaran dari Care Direct (GDPR)",sw:"Nakubali ofa kutoka Care Direct (GDPR)",fil:"Sumasang-ayon sa alok mula sa Care Direct (GDPR)",mr:"Care Direct कडून ऑफर मिळवण्यास संमती (GDPR)",te:"Care Direct నుండి ఆఫర్‌లకు అంగీకరిస్తున్నాను (GDPR)"},
  enterbtn:{el:"Μπες στην εφαρμογή →",en:"Enter the app →",ar:"← ادخل التطبيق",es:"Entrar →",fr:"Entrer →",de:"App öffnen →",pt:"Entrar →",it:"Entra →",ru:"Войти →",tr:"Gir →",hi:"प्रवेश करें →",ur:"داخل ہوں →",zh:"进入 →",ja:"入る →",nl:"Ga naar de app →",pl:"Wejdź →",ro:"Intră →",bn:"প্রবেশ করুন →",id:"Masuk →",sw:"Ingia →",fil:"앱으로 →",mr:"Увійти →",te:"ప్రవేశించు →"},
  greeting:{el:"Καλημέρα,",en:"Good morning,",ar:"صباح الخير،",es:"Buenos días,",fr:"Bonjour,",de:"Guten Morgen,",pt:"Bom dia,",it:"Buongiorno,",ru:"Доброе утро,",tr:"Günaydın,",hi:"शुभ प्रभात,",ur:"صبح بخیر،",zh:"早上好，",ja:"おはようございます、",nl:"Goedemorgen,",pl:"Dzień dobry,",ro:"Bună dimineața,",bn:"শুভ সকাল,",id:"Selamat pagi,",sw:"Habari,",fil:"좋은 아침이에요,",mr:"शुभ सकाळ,",te:"శుభోదయం,"},
  chat:{el:"Συνομιλία",en:"Chat",ar:"المحادثة",es:"Chat",fr:"Discussion",de:"Chat",pt:"Chat",it:"Chat",ru:"Чат",tr:"Sohbet",hi:"चैट",ur:"چیٹ",zh:"聊天",ja:"チャット",nl:"Chat",pl:"Czat",ro:"Chat",bn:"চ্যাট",id:"Obrolan",sw:"Mazungumzo",fil:"채팅",mr:"संवाद",te:"చాట్"},
  family:{el:"Οικογένεια",en:"Family",ar:"العائلة",es:"Familia",fr:"Famille",de:"Familie",pt:"Família",it:"Famiglia",ru:"Семья",tr:"Aile",hi:"परिवार",ur:"خاندان",zh:"家庭",ja:"家族",nl:"Familie",pl:"Rodzina",ro:"Familie",bn:"পরিবার",id:"Keluarga",sw:"Familia",fil:"가족",mr:"कुटुंब",te:"కుటుంబం"},
  memories:{el:"Αναμνήσεις",en:"Memories",ar:"الذكريات",es:"Recuerdos",fr:"Souvenirs",de:"Erinnerungen",pt:"Memórias",it:"Ricordi",ru:"Воспоминания",tr:"Anılar",hi:"यादें",ur:"یادیں",zh:"回忆",ja:"思い出",nl:"Herinneringen",pl:"Wspomnienia",ro:"Amintiri",bn:"স্মৃতি",id:"Kenangan",sw:"Kumbukumbu",fil:"추억",mr:"आठवणी",te:"జ్ఞాపకాలు"},
  milestones:{el:"Milestones",en:"Milestones",ar:"الإنجازات",es:"Hitos",fr:"Étapes",de:"Meilensteine",pt:"Marcos",it:"Tappe",ru:"Вехи",tr:"Aşamalar",hi:"माइलस्टोन",ur:"سنگ میل",zh:"里程碑",ja:"マイルストーン",nl:"Mijlpalen",pl:"Etapy",ro:"Etape",bn:"মাইলফলক",id:"Tonggak",sw:"Hatua",fil:"이정표",mr:"टप्पे",te:"మైలురాళ్ళు"},
  shopping:{el:"Shopping",en:"Shopping",ar:"التسوق",es:"Compras",fr:"Achats",de:"Einkaufen",pt:"Compras",it:"Shopping",ru:"Покупки",tr:"Alışveriş",hi:"शॉपिंग",ur:"شاپنگ",zh:"购物",ja:"ショッピング",nl:"Winkelen",pl:"Zakupy",ro:"Cumpărături",bn:"কেনাকাটা",id:"Belanja",sw:"Ununuzi",fil:"쇼핑",mr:"खरेदी",te:"షాపింగ్"},
  offers:{el:"Προσφορές",en:"Offers",ar:"العروض",zh:"优惠",es:"Ofertas",fr:"Offres",ro:"Oferte",pl:"Oferty",tr:"Teklifler",hi:"ऑफर्स",ur:"پیشکشیں",ja:"お得情報",ru:"Предложения",de:"Angebote",pt:"Ofertas",it:"Offerte",nl:"Aanbiedingen",bn:"অফার",id:"Penawaran",sw:"Matoleo",fil:"Mga Alok",mr:"ऑफर्स",te:"ఆఫర్‌లు"},
  offers_sub:{el:"Ενημερώσεις, νέα και προσφορές από την ομάδα της HeyMaa.",en:"Updates, news and offers from the HeyMaa team.",ar:"تحديثات وأخبار وعروض من فريق HeyMaa.",zh:"来自HeyMaa团队的更新、新闻和优惠。",es:"Novedades, noticias y ofertas del equipo de HeyMaa.",fr:"Mises à jour, actualités et offres de l'équipe HeyMaa.",ro:"Actualizări, știri și oferte de la echipa HeyMaa.",pl:"Aktualizacje, wiadomości i oferty od zespołu HeyMaa.",tr:"HeyMaa ekibinden güncellemeler, haberler ve teklifler.",hi:"HeyMaa टीम से अपडेट, समाचार और ऑफर।",ur:"HeyMaa ٹیم سے اپڈیٹس، خبریں اور پیشکشیں۔",ja:"HeyMaaチームからの最新情報、ニュース、お得情報。",ru:"Обновления, новости и предложения от команды HeyMaa.",de:"Updates, Neuigkeiten und Angebote vom HeyMaa-Team.",pt:"Atualizações, novidades e ofertas da equipa HeyMaa.",it:"Aggiornamenti, novità e offerte dal team HeyMaa.",nl:"Updates, nieuws en aanbiedingen van het HeyMaa-team.",bn:"HeyMaa টিমের আপডেট, খবর এবং অফার।",id:"Pembaruan, berita, dan penawaran dari tim HeyMaa.",sw:"Habari, masasisho na matoleo kutoka timu ya HeyMaa.",fil:"Mga update, balita, at alok mula sa HeyMaa team.",mr:"HeyMaa टीमकडून अपडेट्स, बातम्या आणि ऑफर्स.",te:"HeyMaa టీమ్ నుండి అప్‌డేట్‌లు, వార్తలు మరియు ఆఫర్‌లు."},
  offers_empty:{el:"Δεν υπάρχουν νέες ενημερώσεις προς το παρόν.",en:"No new updates at the moment.",ar:"لا توجد تحديثات جديدة في الوقت الحالي.",zh:"目前没有新的更新。",es:"No hay novedades por el momento.",fr:"Aucune nouvelle mise à jour pour le moment.",ro:"Nu există actualizări noi momentan.",pl:"Brak nowych aktualizacji w tej chwili.",tr:"Şu anda yeni güncelleme yok.",hi:"फिलहाल कोई नया अपडेट नहीं है।",ur:"اس وقت کوئی نئی اپڈیٹ نہیں ہے۔",ja:"現在、新しいお知らせはありません。",ru:"Сейчас нет новых обновлений.",de:"Derzeit keine neuen Updates.",pt:"Sem novidades por agora.",it:"Nessun aggiornamento al momento.",nl:"Momenteel geen nieuwe updates.",bn:"এই মুহূর্তে নতুন কোনো আপডেট নেই।",id:"Belum ada pembaruan baru saat ini.",sw:"Hakuna masasisho mapya kwa sasa.",fil:"Walang bagong update sa ngayon.",mr:"सध्या कोणतेही नवीन अपडेट्स नाहीत.",te:"ఇప్పుడు కొత్త అప్‌డేట్‌లు లేవు."},
  loading:{el:"Φόρτωση...",en:"Loading...",ar:"جار التحميل...",zh:"加载中...",es:"Cargando...",fr:"Chargement...",ro:"Se încarcă...",pl:"Wczytywanie...",tr:"Yükleniyor...",hi:"लोड हो रहा है...",ur:"لوڈ ہو رہا ہے...",ja:"読み込み中...",ru:"Загрузка...",de:"Lädt...",pt:"A carregar...",it:"Caricamento...",nl:"Laden...",bn:"লোড হচ্ছে...",id:"Memuat...",sw:"Inapakia...",fil:"Naglo-load...",mr:"लोड होत आहे...",te:"లోడ్ అవుతోంది..."},
  learnmore:{el:"Μάθε περισσότερα",en:"Learn more",ar:"معرفة المزيد",zh:"了解更多",es:"Saber más",fr:"En savoir plus",ro:"Află mai multe",pl:"Dowiedz się więcej",tr:"Daha fazla bilgi",hi:"अधिक जानें",ur:"مزید جانیں",ja:"もっと見る",ru:"Подробнее",de:"Mehr erfahren",pt:"Saber mais",it:"Scopri di più",nl:"Meer informatie",bn:"আরও জানুন",id:"Pelajari lebih lanjut",sw:"Jifunze zaidi",fil:"Alamin pa",mr:"अधिक जाणून घ्या",te:"మరింత తెలుసుకోండి"},
  typehere:{el:"Γράψε κάτι...",en:"Type something...",ar:"اكتبي شيئاً...",es:"Escribe algo...",fr:"Écris quelque chose...",de:"Schreib etwas...",pt:"Escreve algo...",it:"Scrivi qualcosa...",ru:"Напишите что-нибудь...",tr:"Bir şey yaz...",hi:"कुछ लिखें...",ur:"کچھ لکھیں...",zh:"输入点什么...",ja:"何か入力...",nl:"Typ iets...",pl:"Napisz coś...",ro:"Scrie ceva...",bn:"কিছু লিখুন...",id:"Tulis sesuatu...",sw:"Andika kitu...",fil:"입력하세요...",mr:"काहीतरी लिहा...",te:"ఏదైనా టైప్ చేయండి..."},
  recentmem:{el:"Αναμνήσεις",en:"Memories",ar:"الذكريات",es:"Recuerdos",fr:"Souvenirs",de:"Erinnerungen",pt:"Memórias",it:"Ricordi",ru:"Воспоминания",tr:"Anılar",hi:"यादें",ur:"یادیں",zh:"回忆",ja:"思い出",nl:"Herinneringen",pl:"Wspomnienia",ro:"Amintiri",bn:"স্মৃতি",id:"Kenangan",sw:"Kumbukumbu",fil:"추억",mr:"आठवणी",te:"జ్ఞాపకాలు"},
  addmemory:{el:"Γράψε μια ανάμνηση...",en:"Write a memory...",ar:"أضيفي ذكرى...",es:"Escribe un recuerdo...",fr:"Ajouter un souvenir...",de:"Erinnerung hinzufügen...",pt:"Adicionar memória...",it:"Aggiungi ricordo...",ru:"Добавить воспоминание...",tr:"Anı ekle...",hi:"याद लिखें...",ur:"یاد لکھیں...",zh:"写下回忆...",ja:"思い出を書く...",nl:"Herinnering schrijven...",pl:"Napisz wspomnienie...",ro:"Scrie amintire...",bn:"স্মৃতি লিখুন...",id:"Tulis kenangan...",sw:"Andika kumbukumbu...",fil:"추억 쓰기...",mr:"आठवण लिहा...",te:"జ్ఞాపకం రాయండి..."},
  nomemories:{el:"Δεν υπάρχουν αναμνήσεις ακόμα.",en:"No memories yet. Add your first!",ar:"لا توجد ذكريات بعد.",es:"Aún no hay recuerdos.",fr:"Pas encore de souvenirs.",de:"Noch keine Erinnerungen.",pt:"Ainda sem memórias.",it:"Ancora nessun ricordo.",ru:"Пока нет воспоминаний.",tr:"Henüz anı yok.",hi:"अभी यादें नहीं।",ur:"ابھی یادیں نہیں۔",zh:"还没有回忆。",ja:"まだ思い出がありません。",nl:"Nog geen herinneringen.",pl:"Brak wspomnień.",ro:"Nu există amintiri.",bn:"এখনও স্মৃতি নেই।",id:"Belum ada kenangan.",sw:"Bado hakuna kumbukumbu.",fil:"아직 추억 없어요.",mr:"अजून आठवणी नाहीत.",te:"ఇంకా జ్ఞాపకాలు లేవు."},
  myfamily:{el:"Η Οικογένειά μου",en:"My Family",ar:"عائلتي",es:"Mi Familia",fr:"Ma Famille",de:"Meine Familie",pt:"Minha Família",it:"La Mia Famiglia",ru:"Моя Семья",tr:"Ailem",hi:"मेरा परिवार",ur:"میرا خاندان",zh:"我的家庭",ja:"私の家族",nl:"Mijn Familie",pl:"Moja Rodzina",ro:"Familia Mea",bn:"আমার পরিবার",id:"Keluargaku",sw:"Familia Yangu",fil:"나의 가족",mr:"माझे कुटुंब",te:"నా కుటుంబం"},
  addmember:{el:"＋ Πρόσθεσε μέλος",en:"＋ Add family member",ar:"＋ إضافة فرد",es:"＋ Agregar miembro",fr:"＋ Ajouter un membre",de:"＋ Mitglied hinzufügen",pt:"＋ Adicionar membro",it:"＋ Aggiungi membro",ru:"＋ Добавить члена",tr:"＋ Üye ekle",hi:"＋ सदस्य जोड़ें",ur:"＋ رکن شامل کریں",zh:"＋ 添加成员",ja:"＋ 家族を追加",nl:"＋ Lid toevoegen",pl:"＋ Dodaj członka",ro:"＋ Adaugă un membru",bn:"＋ সদস্য যোগ করুন",id:"＋ Tambah anggota",sw:"＋ Ongeza mwanafamilia",fil:"＋ 가족 추가",mr:"＋ सदस्य जोडा",te:"＋ సభ్యుని జోడించు"},
  products:{el:"Προϊόντα",en:"Products",ar:"المنتجات",es:"Productos",fr:"Produits",de:"Produkte",pt:"Produtos",it:"Prodotti",ru:"Товары",tr:"Ürünler",hi:"उत्पाद",ur:"مصنوعات",zh:"产品",ja:"製品",nl:"Producten",pl:"Produkty",ro:"Produse",bn:"পণ্য",id:"Produk",sw:"Bidhaa",fil:"제품",mr:"उत्पादने",te:"ఉత్పత్తులు"},
  supermarket:{el:"Σούπερ Μάρκετ",en:"Supermarket",ar:"سوبرماركت",es:"Supermercado",fr:"Supermarché",de:"Supermarkt",pt:"Supermercado",it:"Supermercato",ru:"Супермаркет",tr:"Süpermarket",hi:"सुपरमार्केट",ur:"سپر مارکیٹ",zh:"超市",ja:"スーパー",nl:"Supermarkt",pl:"Supermarket",ro:"Supermarket",bn:"সুপারমার্কেট",id:"Supermarket",sw:"Madukani",fil:"슈퍼마켓",mr:"सुपरमार्केट",te:"సూపర్‌మార్కెట్"},
  additem:{el:"Πρόσθεσε προϊόν...",en:"Add product...",ar:"أضيفي منتجاً...",es:"Agregar producto...",fr:"Ajouter produit...",de:"Produkt hinzufügen...",pt:"Adicionar produto...",it:"Aggiungi prodotto...",ru:"Добавить товар...",tr:"Ürün ekle...",hi:"उत्पाद जोड़ें...",ur:"مصنوع شامل کریں...",zh:"添加产品...",ja:"商品を追加...",nl:"Product toevoegen...",pl:"Dodaj produkt...",ro:"Adaugă produs...",bn:"পণ্য যোগ করুন...",id:"Tambah produk...",sw:"Ongeza bidhaa...",fil:"제품 추가...",mr:"उत्पादन जोडा...",te:"ఉత్పత్తి జోడించు..."},
  addtolist:{el:"Πρόσθεσε στη λίστα...",en:"Add to list...",ar:"أضيفي إلى القائمة...",es:"Agregar a lista...",fr:"Ajouter à la liste...",de:"Zur Liste hinzufügen...",pt:"Adicionar à lista...",it:"Aggiungi alla lista...",ru:"Добавить в список...",tr:"Listeye ekle...",hi:"सूची में जोड़ें...",ur:"فہرست میں شامل کریں...",zh:"添加到清单...",ja:"リストに追加...",nl:"Toevoegen aan lijst...",pl:"Dodaj do listy...",ro:"Adaugă la listă...",bn:"তালিকায় যোগ করুন...",id:"Tambah ke daftar...",sw:"Ongeza kwenye orodha...",fil:"목록에 추가...",mr:"यादीत जोडा...",te:"జాబితాకు జోడించు..."},
  sendlist:{el:"Αποστολή:",en:"Send via:",ar:"إرسال:",es:"Enviar:",fr:"Envoyer:",de:"Senden:",pt:"Enviar:",it:"Invia:",ru:"Отправить:",tr:"Gönder:",hi:"भेजें:",ur:"بھیجیں:",zh:"发送：",ja:"送る：",nl:"Versturen:",pl:"Wyślij:",ro:"Trimite:",bn:"পাঠান:",id:"Kirim:",sw:"Tuma:",fil:"전송:",mr:"Надіслати:",te:"పంపు:"},
  selectlang:{el:"Επέλεξε γλώσσα",en:"Select language",ar:"اختر اللغة",es:"Seleccionar idioma",fr:"Choisir la langue",de:"Sprache wählen",pt:"Selecionar idioma",it:"Seleziona lingua",ru:"Выбрать язык",tr:"Dil seç",hi:"भाषा चुनें",ur:"زبان منتخب کریں",zh:"选择语言",ja:"言語を選択",nl:"Taal kiezen",pl:"Wybierz język",ro:"Selectați limba",bn:"ভাষা নির্বাচন",id:"Pilih bahasa",sw:"Chagua lugha",fil:"언어 선택",mr:"भाषा निवडा",te:"భాష ఎంచుకోండి"},
  chatgreet:{el:"Γεια σου",en:"Hi",ar:"مرحباً",es:"Hola",fr:"Bonjour",de:"Hallo",pt:"Olá",it:"Ciao",ru:"Привет",tr:"Merhaba",hi:"नमस्ते",ur:"ہائے",zh:"你好",ja:"こんにちは",nl:"Hallo",pl:"Cześć",ro:"Bună",bn:"হ্যালো",id:"Halo",sw:"Habari",fil:"안녕하세요",mr:"नमस्कार",te:"హలో"},
  chatgreet2:{el:"χαίρομαι που βρίσκεσαι εδώ. Πώς μπορώ να σε βοηθήσω;",en:"glad you're here. How can I help you today?",ar:"يسعدني وجودك. كيف أساعدك؟",es:"alegría tenerte. ¿En qué te ayudo?",fr:"content que tu sois là. Comment t'aider?",de:"schön, dass du hier bist. Wie helfe ich dir?",pt:"fico feliz. Como posso ajudar?",it:"felice che tu sia qui. Come aiutarti?",ru:"рад что ты здесь. Как помочь?",tr:"burada olduğuna sevindim. Nasıl yardım edebilirim?",hi:"खुशी है। कैसे मदद करूँ?",ur:"خوشی ہے۔ کیسے مدد کروں؟",zh:"很高兴你来了。今天我能帮什么？",ja:"来てくれて嬉しい。どう手伝えますか？",nl:"blij dat je er bent. Hoe kan ik helpen?",pl:"cieszę się. Jak pomóc?",ro:"mă bucur că ești. Cum te ajut?",bn:"আনন্দিত। কীভাবে সাহায্য করব?",id:"senang kamu ada. Bagaimana aku membantumu?",sw:"nafurahi uko. Ninakusaidiaje?",fil:"반가워요. 어떻게 도와드릴까요?",mr:"радий що ти тут. Як допомогти?",te:"మీరు ఇక్కడ ఉన్నందుకు సంతోషం. నేను ఎలా సహాయపడను?"},
  listen:{el:"🔊 Άκουσε",en:"🔊 Listen",ar:"🔊 استمع",es:"🔊 Escuchar",fr:"🔊 Écouter",de:"🔊 Anhören",pt:"🔊 Ouvir",it:"🔊 Ascolta",ru:"🔊 Слушать",tr:"🔊 Dinle",hi:"🔊 सुनें",ur:"🔊 سنیں",zh:"🔊 收听",ja:"🔊 聞く",nl:"🔊 Luisteren",pl:"🔊 Słuchaj",ro:"🔊 Ascultă",bn:"🔊 শুনুন",id:"🔊 Dengar",sw:"🔊 Sikiliza",fil:"🔊 듣기",mr:"🔊 ऐका",te:"🔊 వినండి"},
  playing:{el:"⏸ Παίζει...",en:"⏸ Playing...",ar:"⏸ يعزف...",es:"⏸ Reproduciendo...",fr:"⏸ Lecture...",de:"⏸ Spielt...",pt:"⏸ A reproduzir...",it:"⏸ In riproduzione...",ru:"⏸ Воспроизводится...",tr:"⏸ Oynatılıyor...",hi:"⏸ चल रहा है...",ur:"⏸ چل رہا ہے...",zh:"⏸ 播放中...",ja:"⏸ 再生中...",nl:"⏸ Afspelen...",pl:"⏸ Gra...",ro:"⏸ Se redă...",bn:"⏸ বাজছে...",id:"⏸ Memutar...",sw:"⏸ Inacheza...",fil:"⏸ 재생 중...",mr:"⏸ वाजत आहे...",te:"⏸ ప్లేయవుతోంది..."},
  voicequota:{el:"Φωνητικά μηνύματα",en:"Voice messages",ar:"الرسائل الصوتية",zh:"语音消息",es:"Mensajes de voz",fr:"Messages vocaux",ro:"Mesaje vocale",pl:"Wiadomości głosowe",tr:"Sesli mesajlar",hi:"वॉइस मैसेज",ur:"وائس میسجز",ja:"音声メッセージ",ru:"Голосовые сообщения",de:"Sprachnachrichten",pt:"Mensagens de voz",it:"Messaggi vocali",nl:"Spraakberichten",bn:"ভয়েস মেসেজ",id:"Pesan suara",sw:"Ujumbe wa sauti",fil:"Mga voice message",mr:"व्हॉइस मेसेज",te:"వాయిస్ సందేశాలు"},
  askmaa:{el:"Ρώτα τη Maa →",en:"Ask Maa →",ar:"اسأل Maa →",es:"Preguntar a Maa →",fr:"Demander à Maa →",de:"Maa fragen →",pt:"Perguntar à Maa →",it:"Chiedi a Maa →",ru:"Спросить Maa →",tr:"Maa'ya sor →",hi:"Maa से पूछें →",ur:"Maa سے پوچھیں →",zh:"问Maa →",ja:"Maaに聞く →",nl:"Vraag Maa →",pl:"Zapytaj Maa →",ro:"Întreabă Maa →",bn:"Maa-কে জিজ্ঞেস করুন →",id:"Tanya Maa →",sw:"Uliza Maa →",fil:"Maa에게 물어보기 →",mr:"Maa ला विचारा →",te:"Maa ని అడగండి →"},
  tickall:{el:"Τίκαρε τα milestones που έχει πετύχει!",en:"Tick the milestones your baby has reached!",ar:"ضعي علامة على الإنجازات!",es:"¡Marca los hitos logrados!",fr:"Cochez les étapes atteintes!",de:"Meilensteine abhaken!",pt:"Assinala os marcos alcançados!",it:"Spunta i traguardi raggiunti!",ru:"Отметьте достигнутые вехи!",tr:"Ulaşılan aşamaları işaretle!",hi:"पूरे माइलस्टोन चुनें!",ur:"سنگ میل نشان لگائیں!",zh:"勾选宝宝达到的里程碑！",ja:"達成したマイルストーンをチェック！",nl:"Vink de behaalde mijlpalen aan!",pl:"Zaznacz osiągnięte etapy!",ro:"Bifează etapele atinse!",bn:"মাইলফলক টিক করুন!",id:"Centang tonggak yang dicapai!",sw:"Weka alama kwa hatua!",fil:"이정표 체크해요!",mr:"पूर्ण झालेले टप्पे निवडा!",te:"మైలురాళ్ళను టిక్ చేయండి!"},
  askaboutmile:{el:"Θέλεις να μάθεις περισσότερα για τα επόμενα milestones;",en:"Want to know more about upcoming milestones?",ar:"تريدين معرفة المزيد عن الإنجازات القادمة؟",es:"¿Quieres saber más sobre los próximos hitos?",fr:"Vous voulez en savoir plus sur les prochaines étapes?",de:"Mehr über kommende Meilensteine erfahren?",pt:"Quer saber mais sobre os próximos marcos?",it:"Vuoi sapere di più sui prossimi traguardi?",ru:"Хочешь узнать больше о следующих вехах?",tr:"Yaklaşan dönüm noktaları hakkında daha fazla bilgi ister misin?",hi:"अगले माइलस्टोन के बारे में जानना चाहती हैं?",ur:"آنے والے سنگ میلوں کے بارے میں جاننا چاہتی ہیں؟",zh:"想了解即将到来的里程碑吗？",ja:"次のマイルストーンについて知りたいですか？",nl:"Meer weten over aankomende mijlpalen?",pl:"Chcesz wiedzieć więcej o nadchodzących etapach?",ro:"Vrei să afli mai multe despre etapele viitoare?",bn:"পরবর্তী মাইলফলক সম্পর্কে জানতে চান?",id:"Ingin tahu lebih tentang tonggak berikutnya?",sw:"Unataka kujua zaidi kuhusu hatua zinazokuja?",fil:"다음 이정표에 대해 더 알고 싶으세요?",mr:"पुढील टप्प्यांबद्दल अधिक जाणून घ्यायचे आहे?",te:"రాబోయే మైలురాళ్ళ గురించి తెలుసుకోవాలా?"},
  save:{el:"Αποθήκευση",en:"Save",ar:"حفظ",es:"Guardar",fr:"Enregistrer",de:"Speichern",pt:"Guardar",it:"Salva",ru:"Сохранить",tr:"Kaydet",hi:"सहेजें",ur:"محفوظ",zh:"保存",ja:"保存",nl:"Opslaan",pl:"Zapisz",ro:"Salvează",bn:"সংরক্ষণ",id:"Simpan",sw:"Hifadhi",fil:"저장",mr:"जतन करा",te:"సేవ్ చేయి"},
  cancel:{el:"Ακύρωση",en:"Cancel",ar:"إلغاء",es:"Cancelar",fr:"Annuler",de:"Abbrechen",pt:"Cancelar",it:"Annulla",ru:"Отмена",tr:"İptal",hi:"रद्द करें",ur:"منسوخ",zh:"取消",ja:"キャンセル",nl:"Annuleren",pl:"Anuluj",ro:"Anulează",bn:"বাতিল",id:"Batal",sw:"Ghairi",fil:"취소",mr:"रद्द करा",te:"రద్దు చేయి"},
  newthread:{el:"Νέα συνομιλία",en:"New conversation",ar:"محادثة جديدة",es:"Nueva conversación",fr:"Nouvelle conversation",de:"Neues Gespräch",pt:"Nova conversa",it:"Nuova conversazione",ru:"Новый разговор",tr:"Yeni konuşma",hi:"नई बातचीत",ur:"نئی بات",zh:"新对话",ja:"新しい会話",nl:"Nieuw gesprek",pl:"Nowa rozmowa",ro:"Conversație nouă",bn:"নতুন কথোপকথন",id:"Percakapan baru",sw:"Mazungumzo mapya",fil:"새 대화",mr:"नवीन संवाद",te:"కొత్త సంభాషణ"},
  archivethread:{el:"Αρχειοθέτηση",en:"Archive",ar:"أرشفة",es:"Archivar",fr:"Archiver",de:"Archivieren",pt:"Arquivar",it:"Archivia",ru:"Архивировать",tr:"Arşivle",hi:"संग्रहीत करें",ur:"آرکائیو",zh:"归档",ja:"アーカイブ",nl:"Archiveren",pl:"Archiwizuj",ro:"Arhivează",bn:"আর্কাইভ করুন",id:"Arsipkan",sw:"Hifadhi",fil:"보관",mr:"संग्रहित करा",te:"ఆర్కైవ్ చేయి"},
  pastthreads:{el:"Παλαιές συνομιλίες",en:"Past conversations",ar:"المحادثات السابقة",es:"Conversaciones anteriores",fr:"Conversations passées",de:"Vergangene Gespräche",pt:"Conversas anteriores",it:"Conversazioni passate",ru:"Прошлые разговоры",tr:"Geçmiş konuşmalar",hi:"पुरानी बातचीत",ur:"پرانی باتیں",zh:"过去的对话",ja:"過去の会話",nl:"Eerdere gesprekken",pl:"Poprzednie rozmowy",ro:"Conversații vechi",bn:"পুরানো কথোপকথন",id:"Percakapan lama",sw:"Mazungumzo ya zamani",fil:"이전 대화",mr:"जुने संवाद",te:"పాత సంభాషణలు"},
  nameyourthread:{el:"Δώσε τίτλο στη συνομιλία",en:"Name this conversation",ar:"سمّي هذه المحادثة",es:"Nombra esta conversación",fr:"Nommez cette conversation",de:"Gespräch benennen",pt:"Nomeia esta conversa",it:"Dai un nome alla conversazione",ru:"Назовите разговор",tr:"Konuşmayı adlandır",hi:"बातचीत का नाम दें",ur:"بات کا نام دیں",zh:"为对话命名",ja:"会話に名前をつけて",nl:"Gesprek een naam geven",pl:"Nazwij rozmowę",ro:"Denumește conversația",bn:"কথোপকথনের নাম দিন",id:"Beri nama percakapan",sw:"Ipe jina mazungumzo",fil:"대화 이름 지정",mr:"संवादाला नाव द्या",te:"సంభాషణకు పేరు పెట్టండి"},
  membername:{el:"Όνομα",en:"Name",ar:"الاسم",es:"Nombre",fr:"Prénom",de:"Name",pt:"Nome",it:"Nome",ru:"Имя",tr:"Ad",hi:"नाम",ur:"نام",zh:"姓名",ja:"名前",nl:"Naam",pl:"Imię",ro:"Nume",bn:"নাম",id:"Nama",sw:"Jina",fil:"이름",mr:"नाव",te:"పేరు"},
  memberrole:{el:"Σχέση (π.χ. Μπαμπάς)",en:"Relationship (e.g. Dad)",ar:"الصلة (مثل: أب)",es:"Relación (ej. Papá)",fr:"Lien (ex. Papa)",de:"Beziehung (z.B. Papa)",pt:"Relação (ex. Pai)",it:"Relazione (es. Papà)",ru:"Отношение (напр. Папа)",tr:"İlişki (örn. Baba)",hi:"रिश्ता (जैसे पापा)",ur:"رشتہ (مثلاً ابو)",zh:"关系（如爸爸）",ja:"関係（例：パパ）",nl:"Relatie (bijv. Papa)",pl:"Relacja (np. Tata)",ro:"Relație (ex. Tată)",bn:"সম্পর্ক",id:"Hubungan",sw:"Uhusiano",fil:"관계",mr:"नाते (उदा. बाबा)",te:"సంబంధం"},
  addchild:{el:"＋ Πρόσθεσε παιδί",en:"＋ Add child",ar:"＋ إضافة طفل",es:"＋ Agregar hijo/a",fr:"＋ Ajouter un enfant",de:"＋ Kind hinzufügen",pt:"＋ Adicionar filho/a",it:"＋ Aggiungi bambino",ru:"＋ Добавить ребёнка",tr:"＋ Çocuk ekle",hi:"＋ बच्चा जोड़ें",ur:"＋ بچہ شامل کریں",zh:"＋ 添加孩子",ja:"＋ 子どもを追加",nl:"＋ Kind toevoegen",pl:"＋ Dodaj dziecko",ro:"＋ Adaugă copil",bn:"＋ শিশু যুক্ত করুন",id:"＋ Tambah anak",sw:"＋ Ongeza mtoto",fil:"＋ Magdagdag ng anak",mr:"＋ मूल जोडा",te:"＋ పిల్లలను జోడించండి"},
  memberemail:{el:"Email (προαιρετικό)",en:"Email (optional)",ar:"البريد الإلكتروني (اختياري)",es:"Correo (opcional)",fr:"E-mail (facultatif)",de:"E-Mail (optional)",pt:"E-mail (opcional)",it:"Email (opzionale)",ru:"Email (необязательно)",tr:"E-posta (isteğe bağlı)",hi:"ईमेल (वैकल्पिक)",ur:"ای میل (اختیاری)",zh:"电子邮箱（选填）",ja:"メール（任意）",nl:"E-mail (optioneel)",pl:"E-mail (opcjonalnie)",ro:"E-mail (opțional)",bn:"ইমেল (ঐচ্ছিক)",id:"Email (opsional)",sw:"Barua pepe (si lazima)",fil:"Email (opsyonal)",mr:"ईमेल (पर्यायी)",te:"ఇమెయిల్ (ఐచ్ఛికం)"},
  memberphone:{el:"Κινητό τηλέφωνο (προαιρετικό)",en:"Phone number (optional)",ar:"رقم الهاتف (اختياري)",es:"Teléfono (opcional)",fr:"Téléphone (facultatif)",de:"Telefonnummer (optional)",pt:"Telefone (opcional)",it:"Telefono (opzionale)",ru:"Телефон (необязательно)",tr:"Telefon numarası (isteğe bağlı)",hi:"फ़ोन नंबर (वैकल्पिक)",ur:"فون نمبر (اختیاری)",zh:"电话号码（选填）",ja:"電話番号（任意）",nl:"Telefoonnummer (optioneel)",pl:"Numer telefonu (opcjonalnie)",ro:"Număr de telefon (opțional)",bn:"ফোন নম্বর (ঐচ্ছিক)",id:"Nomor telepon (opsional)",sw:"Nambari ya simu (si lazima)",fil:"Numero ng telepono (opsyonal)",mr:"फोन नंबर (पर्यायी)",te:"ఫోన్ నంబర్ (ఐచ్ఛికం)"},
  nochildyet:{el:"Δεν έχεις προσθέσει ακόμα παιδί. Πρόσθεσέ το από την καρτέλα Οικογένεια για να δεις τα ορόσημά του.",en:"You haven't added a child yet. Add one from the Family tab to see their milestones.",ar:"لم تضيفي طفلاً بعد. أضيفيه من تبويب العائلة لعرض إنجازاته التطورية.",es:"Aún no has añadido un hijo/a. Añádelo en la pestaña Familia para ver sus hitos.",fr:"Vous n'avez pas encore ajouté d'enfant. Ajoutez-le dans l'onglet Famille pour voir ses étapes.",de:"Du hast noch kein Kind hinzugefügt. Füge es im Tab Familie hinzu, um die Meilensteine zu sehen.",pt:"Ainda não adicionaste um filho/a. Adiciona-o no separador Família para ver os marcos.",it:"Non hai ancora aggiunto un bambino. Aggiungilo nella scheda Famiglia per vedere le tappe.",ru:"Вы ещё не добавили ребёнка. Добавьте его на вкладке Семья, чтобы увидеть этапы развития.",tr:"Henüz çocuk eklemediniz. Gelişim aşamalarını görmek için Aile sekmesinden ekleyin.",hi:"आपने अभी तक बच्चा नहीं जोड़ा है। मील के पत्थर देखने के लिए परिवार टैब से जोड़ें।",ur:"آپ نے ابھی تک بچہ شامل نہیں کیا۔ سنگ میل دیکھنے کے لیے فیملی ٹیب سے شامل کریں۔",zh:"您还没有添加孩子。请在家庭标签中添加以查看发育里程碑。",ja:"まだお子さんが登録されていません。家族タブから追加するとマイルストーンが表示されます。",nl:"Je hebt nog geen kind toegevoegd. Voeg het toe via het tabblad Familie om mijlpalen te zien.",pl:"Nie dodałaś jeszcze dziecka. Dodaj je w zakładce Rodzina, aby zobaczyć kamienie milowe.",ro:"Nu ai adăugat încă un copil. Adaugă-l din fila Familie pentru a vedea reperele.",bn:"আপনি এখনও কোনো শিশু যুক্ত করেননি। মাইলফলক দেখতে পরিবার ট্যাব থেকে যুক্ত করুন।",id:"Anda belum menambahkan anak. Tambahkan dari tab Keluarga untuk melihat tonggak perkembangannya.",sw:"Bado hujamuongeza mtoto. Mwongeze kwenye kichupo cha Familia kuona hatua zake za maendeleo.",fil:"Wala ka pang naidagdag na anak. Idagdag sa tab ng Pamilya para makita ang mga milestone.",mr:"तुम्ही अजून मूल जोडलेले नाही. टप्पे पाहण्यासाठी कुटुंब टॅबमधून जोडा.",te:"మీరు ఇంకా పిల్లలను జోడించలేదు. మైలురాళ్లను చూడటానికి ఫ్యామిలీ టాబ్ నుండి జోడించండి."},

  docs_title:{el:"Αρχείο Εγγράφων",en:"Document Archive",ar:"أرشيف المستندات",zh:"文件档案",es:"Archivo de Documentos",fr:"Archive de Documents",de:"Dokumentenarchiv",pt:"Arquivo de Documentos",it:"Archivio Documenti",ru:"Архив Документов",tr:"Belge Arşivi",hi:"दस्तावेज़ संग्रह",ur:"دستاویز آرکائیو",ja:"書類アーカイブ",nl:"Documentenarchief",pl:"Archiwum Dokumentów",ro:"Arhivă Documente",bn:"ডকুমেন্ট আর্কাইভ",id:"Arsip Dokumen",sw:"Kumbukumbu ya Hati",fil:"Archibo ng Dokumento",mr:"दस्तऐवज संग्रह",te:"పత్రాల సంగ్రహం"},
  docs_hint:{el:"Κράτα εδώ σημείωση για τα έγγραφα που έχεις — ποιον αφορά, τι είναι, πότε. Δεν χρειάζεται να ανεβάσεις αρχεία — απλώς κράτα μια λίστα για να ξέρεις τι έχεις.",en:"Note your documents here — who they concern, what they are, when. No need to upload files — just a list so you always know what you have.",ar:"سجّلي مستنداتك هنا — من تخص، ماذا تعني، ومتى. لا داعي لرفع ملفات — فقط قائمة سريعة.",zh:"在此记录您的文件——涉及谁、是什么、何时。无需上传文件——只需快速列表。",es:"Anota aquí tus documentos — a quién conciernen, qué son, cuándo. Sin subir archivos — solo una lista rápida.",fr:"Notez ici vos documents — qui ils concernent, ce qu'ils sont, quand. Sans téléchargement — juste une liste rapide.",de:"Notiere hier deine Dokumente — wen sie betreffen, was sie sind, wann. Kein Upload — nur eine schnelle Liste.",pt:"Regista os teus documentos aqui — a quem dizem respeito, o que são, quando. Sem uploads — só uma lista rápida.",it:"Annota qui i tuoi documenti — chi riguardano, cosa sono, quando. Senza caricare file — solo un elenco.",ru:"Записывайте свои документы здесь — кого касаются, что это, когда. Без загрузок — просто быстрый список.",tr:"Belgelerini burada not et — kimi ilgilendiriyor, ne, ne zaman. Dosya yüklemene gerek yok — sadece hızlı bir liste.",hi:"यहाँ अपने दस्तावेज़ नोट करें — किससे संबंधित, क्या है, कब। अपलोड की ज़रूरत नहीं — बस एक सूची।",ur:"یہاں اپنی دستاویزات نوٹ کریں — کس سے متعلق، کیا ہے، کب۔ اپلوڈ کی ضرورت نہیں — بس ایک فہرست۔",ja:"ここに書類をメモしましょう — 誰に関係するか、何か、いつか。アップロード不要 — 何があるかわかるリストだけ。",nl:"Noteer hier je documenten — wie ze betreffen, wat ze zijn, wanneer. Geen uploads — alleen een snelle lijst.",pl:"Notuj tu swoje dokumenty — kogo dotyczą, co to jest, kiedy. Bez przesyłania — tylko szybka lista.",ro:"Notează-ți documentele aici — pe cine privesc, ce sunt, când. Fără încărcări — doar o listă rapidă.",bn:"এখানে আপনার নথি নোট করুন — কার সংক্রান্ত, কী, কখন। আপলোড দরকার নেই — শুধু একটি তালিকা।",id:"Catat dokumenmu di sini — siapa yang terkait, apa, kapan. Tidak perlu upload — cukup daftar cepat.",sw:"Andika hati zako hapa — zinamhusu nani, ni nini, lini. Hakuna haja ya kupakia — orodha tu ya haraka.",fil:"Itala ang iyong mga dokumento dito — sino ang may kaugnayan, ano, kailan. Hindi kailangang mag-upload — listahan lang.",mr:"इथे तुमचे दस्तऐवज नोंदवा — कुणाचे, काय, केव्हा। अपलोडची गरज नाही — फक्त एक यादी.",te:"ఇక్కడ మీ పత్రాలను నమోదు చేయండి — ఎవరికి సంబంధించినది, ఏమిటి, ఎప్పుడు. అప్‌లోడ్ అవసరం లేదు — కేవలం ఒక జాబితా."},
  docs_empty:{el:"Δεν υπάρχουν καταχωρίσεις ακόμα.",en:"No entries yet.",ar:"لا توجد إدخالات بعد.",zh:"暂无条目。",es:"Aún no hay entradas.",fr:"Aucune entrée pour l'instant.",de:"Noch keine Einträge.",pt:"Ainda sem entradas.",it:"Ancora nessun inserimento.",ru:"Записей пока нет.",tr:"Henüz giriş yok.",hi:"अभी कोई एंट्री नहीं।",ur:"ابھی کوئی اندراج نہیں۔",ja:"まだエントリがありません。",nl:"Nog geen invoer.",pl:"Brak wpisów.",ro:"Nicio înregistrare încă.",bn:"এখনো কোনো এন্ট্রি নেই।",id:"Belum ada entri.",sw:"Bado hakuna maingizo.",fil:"Wala pang mga entry.",mr:"अजून कोणतीही नोंद नाही.",te:"ఇంకా ఎంట్రీలు లేవు."},
  docs_add_title_ph:{el:"Τίτλος εγγράφου...",en:"Document title...",ar:"عنوان المستند...",zh:"文件标题...",es:"Título del documento...",fr:"Titre du document...",de:"Dokumenttitel...",pt:"Título do documento...",it:"Titolo documento...",ru:"Название документа...",tr:"Belge başlığı...",hi:"दस्तावेज़ शीर्षक...",ur:"دستاویز کا عنوان...",ja:"書類タイトル...",nl:"Documenttitel...",pl:"Tytuł dokumentu...",ro:"Titlul documentului...",bn:"নথির শিরোনাম...",id:"Judul dokumen...",sw:"Kichwa cha hati...",fil:"Pamagat ng dokumento...",mr:"दस्तऐवज शीर्षक...",te:"పత్రం శీర్షిక..."},
  docs_add_date_ph:{el:"Ημερομηνία (π.χ. Ιαν 2025)",en:"Date (e.g. Jan 2025)",ar:"التاريخ",zh:"日期",es:"Fecha",fr:"Date",de:"Datum",pt:"Data",it:"Data",ru:"Дата",tr:"Tarih",hi:"तारीख",ur:"تاریخ",ja:"日付",nl:"Datum",pl:"Data",ro:"Dată",bn:"তারিখ",id:"Tanggal",sw:"Tarehe",fil:"Petsa",mr:"तारीख",te:"తేదీ"},
  docs_add_cat_ph:{el:"Κατηγορία (π.χ. Εξετάσεις αίματος)",en:"Category (e.g. Blood tests)",ar:"الفئة (مثل: فحص الدم)",zh:"类别（如：血液检查）",es:"Categoría (ej. Análisis de sangre)",fr:"Catégorie (ex. Analyses de sang)",de:"Kategorie (z.B. Blutuntersuchung)",pt:"Categoria (ex. Análises ao sangue)",it:"Categoria (es. Analisi del sangue)",ru:"Категория (напр. Анализ крови)",tr:"Kategori (örn. Kan tahlili)",hi:"श्रेणी (जैसे रक्त परीक्षण)",ur:"زمرہ (مثلاً خون کی جانچ)",ja:"カテゴリ（例：血液検査）",nl:"Categorie (bijv. Bloedonderzoek)",pl:"Kategoria (np. Badania krwi)",ro:"Categorie (ex. Analize de sânge)",bn:"বিভাগ (যেমন রক্ত পরীক্ষা)",id:"Kategori (mis. Tes darah)",sw:"Aina (mf. Vipimo vya damu)",fil:"Kategorya (hal. Pagsusuri ng dugo)",mr:"श्रेणी (उदा. रक्त तपासणी)",te:"వర్గం (ఉదా. రక్త పరీక్షలు)"},
  add_to_products:{el:"＋ Στα Προϊόντα",en:"＋ To Products",ar:"＋ للمنتجات",zh:"＋ 加入商品",es:"＋ A Productos",fr:"＋ Aux Produits",de:"＋ Zu Produkten",pt:"＋ Para Produtos",it:"＋ Ai Prodotti",ru:"＋ В Товары",tr:"＋ Ürünlere",hi:"＋ उत्पादों में",ur:"＋ مصنوعات میں",ja:"＋ 商品へ",nl:"＋ Naar Producten",pl:"＋ Do Produktów",ro:"＋ La Produse",bn:"＋ পণ্যে যোগ",id:"＋ Ke Produk",sw:"＋ Kwenye Bidhaa",fil:"＋ Sa Produkto",mr:"＋ उत्पादनात",te:"＋ ఉత్పత్తులకు"},
  add_to_super:{el:"＋ Στο Σούπερ",en:"＋ To Supermarket",ar:"＋ للسوبرماركت",zh:"＋ 加入超市",es:"＋ Al Supermercado",fr:"＋ Au Supermarché",de:"＋ Zum Supermarkt",pt:"＋ Para Supermercado",it:"＋ Al Supermercato",ru:"＋ В Супермаркет",tr:"＋ Süpermarkete",hi:"＋ सुपरमार्केट में",ur:"＋ سپر مارکیٹ میں",ja:"＋ スーパーへ",nl:"＋ Naar Supermarkt",pl:"＋ Do Supermarketu",ro:"＋ La Supermarket",bn:"＋ সুপারমার্কেটে",id:"＋ Ke Supermarket",sw:"＋ Madukani",fil:"＋ Sa Supermarket",mr:"＋ सुपरमार्केटमध्ये",te:"＋ సూపర్‌మార్కెట్‌కు"},
  lang_mismatch:{el:"Γράφεις σε άλλη γλώσσα. Η φωνητική ανάγνωση χρησιμοποιεί τη γλώσσα της σημαίας ({flag}). Άλλαξε τη σημαία πάνω δεξιά για ανάγνωση σε αυτή τη γλώσσα.",en:"You're typing in another language. Voice playback uses your selected language ({flag}). Change the flag top-right to listen in this language.",ar:"أنتِ تكتبين بلغة أخرى. تستخدم القراءة الصوتية لغتك المختارة ({flag}). غيّري العلم في الأعلى للاستماع بهذه اللغة.",zh:"您正在用另一种语言输入。语音朗读使用您所选的语言（{flag}）。更改右上角的旗帜以用此语言收听。",es:"Estás escribiendo en otro idioma. La lectura de voz usa tu idioma seleccionado ({flag}). Cambia la bandera arriba a la derecha para escuchar en este idioma.",fr:"Vous écrivez dans une autre langue. La lecture vocale utilise votre langue sélectionnée ({flag}). Changez le drapeau en haut à droite pour écouter dans cette langue.",de:"Du schreibst in einer anderen Sprache. Die Sprachausgabe verwendet deine gewählte Sprache ({flag}). Ändere die Flagge oben rechts, um in dieser Sprache zu hören.",pt:"Estás a escrever noutro idioma. A leitura por voz usa o teu idioma selecionado ({flag}). Muda a bandeira no canto superior direito para ouvir neste idioma.",it:"Stai scrivendo in un'altra lingua. La lettura vocale usa la lingua selezionata ({flag}). Cambia la bandiera in alto a destra per ascoltare in questa lingua.",ru:"Вы пишете на другом языке. Озвучивание использует выбранный вами язык ({flag}). Измените флаг вверху справа, чтобы слушать на этом языке.",tr:"Başka bir dilde yazıyorsun. Sesli okuma seçtiğin dili kullanır ({flag}). Bu dilde dinlemek için sağ üstteki bayrağı değiştir.",hi:"आप दूसरी भाषा में लिख रही हैं। आवाज़ आपकी चुनी हुई भाषा ({flag}) का उपयोग करती है। इस भाषा में सुनने के लिए ऊपर दाईं ओर का झंडा बदलें।",ur:"آپ دوسری زبان میں لکھ رہی ہیں۔ آواز آپ کی منتخب زبان ({flag}) استعمال کرتی ہے۔ اس زبان میں سننے کے لیے اوپر دائیں طرف کا جھنڈا تبدیل کریں۔",ja:"別の言語で入力しています。音声読み上げは選択中の言語（{flag}）を使用します。この言語で聞くには右上の旗を変更してください。",nl:"Je typt in een andere taal. Spraakweergave gebruikt je geselecteerde taal ({flag}). Wijzig de vlag rechtsboven om in deze taal te luisteren.",pl:"Piszesz w innym języku. Odczyt głosowy używa wybranego języka ({flag}). Zmień flagę w prawym górnym rogu, aby słuchać w tym języku.",ro:"Scrii în altă limbă. Redarea vocală folosește limba selectată ({flag}). Schimbă steagul din dreapta sus pentru a asculta în această limbă.",bn:"আপনি অন্য ভাষায় লিখছেন। ভয়েস প্লেব্যাক আপনার নির্বাচিত ভাষা ({flag}) ব্যবহার করে। এই ভাষায় শুনতে উপরে ডানদিকের পতাকা পরিবর্তন করুন।",id:"Anda mengetik dalam bahasa lain. Pemutaran suara menggunakan bahasa pilihan Anda ({flag}). Ubah bendera di kanan atas untuk mendengarkan dalam bahasa ini.",sw:"Unaandika kwa lugha nyingine. Usomaji wa sauti hutumia lugha uliyochagua ({flag}). Badilisha bendera juu kulia kusikiliza kwa lugha hii.",fil:"Nagta-type ka sa ibang wika. Ginagamit ng voice playback ang napili mong wika ({flag}). Palitan ang watawat sa kanang itaas para makinig sa wikang ito.",mr:"तुम्ही दुसऱ्या भाषेत लिहित आहात. आवाज वाचन तुमची निवडलेली भाषा ({flag}) वापरते. या भाषेत ऐकण्यासाठी वरच्या उजव्या बाजूचा ध्वज बदला.",te:"మీరు మరో భాషలో టైప్ చేస్తున్నారు. వాయిస్ ప్లేబ్యాక్ మీరు ఎంచుకున్న భాష ({flag})ని ఉపయోగిస్తుంది. ఈ భాషలో వినడానికి కుడి ఎగువన ఉన్న జెండాను మార్చండి."},
};

function detectLang(text: string): string {
  // Script-based only — reliable, used for INPUT HINT, never for TTS
  if(/[\u0600-\u06FF]/.test(text)) return /[\u067E\u0679\u0688\u0691]/.test(text)?"ur":"ar";
  if(/[\u3040-\u30FF]/.test(text)) return "ja";
  if(/[\u4E00-\u9FFF]/.test(text)) return "zh";
  if(/[\u0980-\u09FF]/.test(text)) return "bn";
  if(/[\u0C00-\u0C7F]/.test(text)) return "te";
  if(/[\u0900-\u097F]/.test(text)) return "hi";
  if(/[\u0400-\u04FF]/.test(text)) return "ru";
  if(/[\u0370-\u03FF\u1F00-\u1FFF]/.test(text)) return "el";
  return ""; // Latin script — cannot reliably distinguish, no hint shown
}
function t(key: string, lang: string): string { return TR[key]?.[lang] || TR[key]?.["el"] || TR[key]?.["en"] || key; }
function getLang(code: string) { return LANGS.find(l => l.c === code) || LANGS[0]; }
function sk(token: string, suffix: string) { return `hm_${suffix}_${token}`; }
const COLORS = ["#E07B54","#4ABEAA","#7C5CBF","#2B3A67","#2D9E6B","#E0845B","#5B7FE8"];

// ── Invite Screen ─────────────────────────────────────────────
function InviteScreen({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [code, setCode] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem("hm_pre_lang") || "el");
  const [showLang, setShowLang] = useState(false);
  const L = getLang(lang);
  const setAndPersistLang = (c: string) => { setLang(c); localStorage.setItem("hm_pre_lang", c); setShowLang(false); };
  const submit = async () => {
    const tr = code.trim(); if (!tr) return;
    setLoading(true); setError("");
    try { const res = await axios.post(`${API}/auth/invite`, { code: tr }); if (res.data.ok) { localStorage.setItem(TOKEN_KEY, res.data.token); onSuccess(res.data.token); } }
    catch { setError("Invalid invite code. Please check and try again."); } finally { setLoading(false); }
  };
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2B3A67 0%,#4ABEAA 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      {showLang&&<div onClick={e=>{if(e.target===e.currentTarget)setShowLang(false)}} style={{position:"fixed",inset:0,background:"rgba(43,58,103,.5)",zIndex:500,display:"flex",alignItems:"flex-end"}}>
        <div style={{background:"#fff",borderRadius:"18px 18px 0 0",padding:16,width:"100%",maxHeight:"65vh",overflowY:"auto"}}>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:16,color:"#2B3A67",fontWeight:600,textAlign:"center",paddingBottom:12,borderBottom:"1px solid #F0EBE6",marginBottom:4}}>🌐 {t("selectlanguage_login",lang)}</div>
          {LANGS.map(l=><div key={l.c} onClick={()=>setAndPersistLang(l.c)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderRadius:8,cursor:"pointer",background:l.c===lang?"#F0EBE6":"transparent",margin:"0 8px"}}><span style={{fontSize:19}}>{l.f}</span><span style={{fontSize:13.5,fontWeight:500,flex:1,color:"#2B3A67"}}>{l.n}</span>{l.c===lang&&<span style={{color:"#4ABEAA",fontWeight:700}}>✓</span>}</div>)}
        </div>
      </div>}
      <div style={{background:"#fff",borderRadius:24,padding:"40px 36px",maxWidth:400,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,.15)"}}>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
          <button onClick={()=>setShowLang(true)} style={{background:"rgba(43,58,103,0.08)",border:"none",borderRadius:999,padding:"6px 12px",cursor:"pointer",fontSize:13,color:"#2B3A67",fontFamily:"inherit"}}>{L.f} {L.s}</button>
        </div>
        <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:28,fontWeight:700,color:"#2B3A67",marginBottom:16}}>Hey<span style={{color:"#4ABEAA"}}>Maa</span></div>
        <div style={{fontSize:48,marginBottom:16}}>🔑</div>
        <h2 style={{fontSize:20,color:"#2B3A67",margin:"0 0 10px"}}>Enter your invite code</h2>
        <p style={{fontSize:14,color:"#666",lineHeight:1.6,margin:"0 0 24px"}}>HeyMaa is in closed beta. Enter the code we sent you.</p>
        <input style={{width:"100%",padding:"14px 16px",border:`2px solid ${error?"#E07B54":"#e0e0e0"}`,borderRadius:12,fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box" as any,textAlign:"center"}} placeholder="HeyMaa_CD_Test_XX" value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} disabled={loading} autoFocus/>
        {error && <div style={{color:"#E07B54",fontSize:13,marginTop:10}}>{error}</div>}
        <button onClick={submit} disabled={loading||!code.trim()} style={{width:"100%",marginTop:16,padding:14,background:"#2B3A67",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:600,cursor:"pointer",opacity:(loading||!code.trim())?0.5:1}}>{loading?"Checking...":"Enter HeyMaa →"}</button>
        <div style={{marginTop:20,fontSize:13,color:"#999"}}>No code? <a href="https://heymaa.ai" target="_blank" rel="noreferrer" style={{color:"#4ABEAA",textDecoration:"none",fontWeight:600}}>Join the waitlist</a></div>
      </div>
    </div>
  );
}

// ── Subscription Expired ────────────────────────────────────
function SubscriptionExpired({ lang, onLogout }: { lang: string; onLogout: () => void }) {
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2B3A67 0%,#4ABEAA 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{background:"#fff",borderRadius:24,padding:"40px 36px",maxWidth:400,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,.15)"}}>
        <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:28,fontWeight:700,color:"#2B3A67",marginBottom:16}}>Hey<span style={{color:"#4ABEAA"}}>Maa</span></div>
        <div style={{fontSize:48,marginBottom:16}}>⏳</div>
        <h2 style={{fontSize:20,color:"#2B3A67",margin:"0 0 10px"}}>{t("subexpiredtitle",lang)}</h2>
        <p style={{fontSize:14,color:"#666",lineHeight:1.6,margin:"0 0 24px"}}>{t("subexpiredbody",lang)}</p>
        <a href="https://heymaa.vdarpp.com" target="_blank" rel="noreferrer" style={{display:"block",width:"100%",padding:14,background:"#2B3A67",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:600,textDecoration:"none",boxSizing:"border-box" as any}}>{t("renewbtn",lang)}</a>
        <button onClick={onLogout} style={{background:"none",border:"none",color:"rgba(43,58,103,.4)",fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer",marginTop:16,padding:6,width:"100%",textAlign:"center"}}>{lang==="el"?"Αποσύνδεση":"Log out"}</button>
      </div>
    </div>
  );
}


function Onboarding({ token, onDone }: { token: string; onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0); const [name, setName] = useState(""); const [childName, setChildName] = useState(""); const [childAge, setChildAge] = useState(""); const [childBirthDate, setChildBirthDate] = useState(""); const [lang, setLang] = useState(() => localStorage.getItem("hm_pre_lang") || "el"); const [showLang, setShowLang] = useState(false); const [isPregnant, setIsPregnant] = useState<boolean|null>(null); const [dueDate, setDueDate] = useState(""); const [country, setCountry] = useState(""); const [consentMarketing, setConsentMarketing] = useState(false);
  const L = getLang(lang);
  const save = () => { localStorage.setItem("hm_pre_lang", lang); const p: Profile = {name:name||"Mama",childName:isPregnant?"":(childName||""),childAge:isPregnant?"":(childAge||""),childBirthDate:isPregnant?undefined:(childBirthDate||undefined),lang,dueDate:isPregnant?dueDate:undefined,country:country||undefined,consentMarketing,consentDate:consentMarketing?new Date().toISOString():undefined}; localStorage.setItem(sk(token,"profile"),JSON.stringify(p)); void syncProfileToSupabase(token,p); onDone(p); };
  const s: React.CSSProperties = {minHeight:"100vh",background:"#F5F0EB",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'DM Sans',sans-serif"};
  const inp: React.CSSProperties = {width:"100%",padding:"13px 16px",borderRadius:12,border:"1.5px solid rgba(43,58,103,0.18)",fontFamily:"'DM Sans',sans-serif",fontSize:15,color:"#2B3A67",background:"#fff",outline:"none",boxSizing:"border-box" as any,marginBottom:10};
  const btn: React.CSSProperties = {width:"100%",padding:14,borderRadius:12,background:"#2B3A67",color:"#fff",border:"none",fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:500,cursor:"pointer",marginTop:8};
  return (
    <div style={s}>
      {showLang&&<div onClick={e=>{if(e.target===e.currentTarget)setShowLang(false)}} style={{position:"fixed",inset:0,background:"rgba(43,58,103,.5)",zIndex:500,display:"flex",alignItems:"flex-end"}}>
        <div style={{background:"#fff",borderRadius:"18px 18px 0 0",padding:16,width:"100%",maxHeight:"65vh",overflowY:"auto"}}>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:16,color:"#2B3A67",fontWeight:600,textAlign:"center",paddingBottom:12,borderBottom:"1px solid #F0EBE6",marginBottom:4}}>🌐 {t("selectlang",lang)}</div>
          {LANGS.map(l=><div key={l.c} onClick={()=>{setLang(l.c);setShowLang(false);}} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderRadius:8,cursor:"pointer",background:l.c===lang?"#F0EBE6":"transparent",margin:"0 8px"}}><span style={{fontSize:19}}>{l.f}</span><span style={{fontSize:13.5,fontWeight:500,flex:1,color:"#2B3A67"}}>{l.n}</span>{l.c===lang&&<span style={{color:"#4ABEAA",fontWeight:700}}>✓</span>}</div>)}
        </div>
      </div>}
      <div style={{maxWidth:420,width:"100%"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div style={{display:"flex",gap:6,flex:1}}>{[0,1,2,3].map(i=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<step?"#4ABEAA":i===step?"#2B3A67":"rgba(43,58,103,0.15)",maxWidth:40}}/>)}</div>
          <button onClick={()=>setShowLang(true)} style={{background:"rgba(43,58,103,0.08)",border:"none",borderRadius:999,padding:"6px 12px",cursor:"pointer",fontSize:13,color:"#2B3A67",marginLeft:12,fontFamily:"inherit"}}>{L.f} {L.s}</button>
        </div>
        {step===0&&<><div style={{fontSize:52,marginBottom:16,textAlign:"center"}}>👋</div><h1 style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:24,color:"#2B3A67",textAlign:"center",marginBottom:8}}>{t("welcome",lang)}</h1><p style={{fontSize:14,color:"rgba(43,58,103,.6)",textAlign:"center",marginBottom:28,lineHeight:1.65}}>{t("setup",lang)}</p><input style={inp} placeholder={t("yourname",lang)} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&setStep(1)} autoFocus/><button style={btn} onClick={()=>setStep(1)}>{t("letsgo",lang)}</button></>}
        {step===1&&<>
          <div style={{fontSize:52,marginBottom:16,textAlign:"center"}}>{isPregnant?"🤰":"👶"}</div>
          <h1 style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:24,color:"#2B3A67",textAlign:"center",marginBottom:8}}>{t("profile2",lang)}</h1>
          <p style={{fontSize:14,color:"rgba(43,58,103,.6)",textAlign:"center",marginBottom:20,lineHeight:1.65}}>{isPregnant===null?t("pregnant_or_baby_q",lang):isPregnant?t("duedatelabel",lang):t("babyinfo_q",lang)}</p>
          {isPregnant===null&&<div style={{display:"flex",gap:10,marginBottom:10}}>
            <button style={{...btn,marginTop:0,background:"#fff",color:"#2B3A67",border:"1.5px solid rgba(43,58,103,0.18)"}} onClick={()=>setIsPregnant(true)}>🤰 {t("im_pregnant",lang)}</button>
            <button style={{...btn,marginTop:0,background:"#fff",color:"#2B3A67",border:"1.5px solid rgba(43,58,103,0.18)"}} onClick={()=>setIsPregnant(false)}>👶 {t("have_baby",lang)}</button>
          </div>}
          {isPregnant===true&&<>
            <input style={inp} type="date" placeholder={t("duedatelabel",lang)} value={dueDate} onChange={e=>setDueDate(e.target.value)} onKeyDown={e=>e.key==="Enter"&&setStep(2)}/>
            <button style={btn} onClick={()=>setStep(2)}>{t("continue",lang)}</button>
            <button onClick={()=>setIsPregnant(null)} style={{background:"none",border:"none",color:"rgba(43,58,103,.4)",fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer",marginTop:10,padding:6,width:"100%",textAlign:"center"}}>{t("back",lang)}</button>
          </>}
          {isPregnant===false&&<>
            <input style={inp} placeholder={t("childname",lang)} value={childName} onChange={e=>setChildName(e.target.value)}/>
            <input style={inp} type="date" placeholder={t("childbirthdate",lang)} value={childBirthDate} onChange={e=>setChildBirthDate(e.target.value)} onKeyDown={e=>e.key==="Enter"&&setStep(2)}/>
            <button style={btn} onClick={()=>setStep(2)}>{t("continue",lang)}</button>
            <button onClick={()=>setIsPregnant(null)} style={{background:"none",border:"none",color:"rgba(43,58,103,.4)",fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer",marginTop:10,padding:6,width:"100%",textAlign:"center"}}>{t("back",lang)}</button>
          </>}
          {isPregnant===null&&<button onClick={()=>setStep(0)} style={{background:"none",border:"none",color:"rgba(43,58,103,.4)",fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer",marginTop:10,padding:6,width:"100%",textAlign:"center"}}>{t("back",lang)}</button>}
        </>}
        {step===2&&<><div style={{fontSize:52,marginBottom:16,textAlign:"center"}}>🌍</div><h1 style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:24,color:"#2B3A67",textAlign:"center",marginBottom:8}}>{t("selectlang",lang)}</h1><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>{LANGS.slice(0,8).map(l=><div key={l.c} onClick={()=>setLang(l.c)} style={{padding:"10px 4px",borderRadius:10,border:`2px solid ${l.c===lang?"#2B3A67":"transparent"}`,background:l.c===lang?"#fff":"#F0EBE6",cursor:"pointer",textAlign:"center",fontSize:22}}>{l.f}<div style={{fontSize:10,color:"#2B3A67",marginTop:2,fontWeight:500}}>{l.s}</div></div>)}</div><button onClick={()=>setShowLang(true)} style={{width:"100%",padding:10,background:"#F0EBE6",border:"none",borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer",color:"#2B3A67",marginBottom:8}}>🌐 {t("selectlang",lang)}</button><p style={{fontSize:12,fontWeight:500,color:"rgba(43,58,103,.5)",margin:"12px 0 4px",textAlign:"left"}}>{t("country_label",lang)}</p><select style={{width:"100%",padding:"13px 16px",borderRadius:12,border:"1.5px solid rgba(43,58,103,0.18)",fontFamily:"'DM Sans',sans-serif",fontSize:15,color:country?"#2B3A67":"rgba(43,58,103,.4)",background:"#fff",outline:"none",boxSizing:"border-box" as any,marginBottom:10}} value={country} onChange={e=>setCountry(e.target.value)}><option value="" disabled>{t("country_ph",lang)}</option>{COUNTRIES.map(cc=><option key={cc.code} value={cc.code}>{cc.name}</option>)}</select><button style={btn} onClick={()=>setStep(3)}>{t("continue",lang)}</button><button onClick={()=>setStep(1)} style={{background:"none",border:"none",color:"rgba(43,58,103,.4)",fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer",marginTop:10,padding:6,width:"100%",textAlign:"center"}}>{t("back",lang)}</button></>}
        {step===3&&<><div style={{fontSize:52,marginBottom:16,textAlign:"center"}}>🎉</div><h1 style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:24,color:"#2B3A67",textAlign:"center",marginBottom:8}}>{t("ready",lang)}, {name||"Mama"}!</h1><p style={{fontSize:14,color:"rgba(43,58,103,.6)",textAlign:"center",marginBottom:28,lineHeight:1.65}}>{t("readysub",lang)}</p><label style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:16,cursor:"pointer",fontSize:13,color:"rgba(43,58,103,.7)",lineHeight:1.5}}><input type="checkbox" checked={consentMarketing} onChange={e=>setConsentMarketing(e.target.checked)} style={{marginTop:2,accentColor:"#4ABEAA",width:16,height:16,flexShrink:0}}/><span>{t("consent_gdpr",lang)}</span></label><button style={{...btn,background:"#4ABEAA"}} onClick={save}>{t("enterbtn",lang)}</button></>}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
function MainApp({ token, profile, onLogout, onExpired, onProfileUpdate }: { token: string; profile: Profile; onLogout: () => void; onExpired: () => void; onProfileUpdate: (p: Profile) => void }) {
  const lang = profile.lang; const L = getLang(lang);
  const navy="#2B3A67",coral="#E07B54",teal="#4ABEAA",cream="#F5F0EB",gl="#F0EBE6";

  // Threads state
  const [threads, setThreads] = useState<Thread[]>(() => { try{return JSON.parse(localStorage.getItem(sk(token,"threads"))||"[]");}catch{return[];} });
  const [messages, setMessages] = useState<Message[]>(() => { try{return JSON.parse(localStorage.getItem(sk(token,"chat"))||"[]");}catch{return[];} });
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveTitle, setArchiveTitle] = useState("");
  const [showThreads, setShowThreads] = useState(false);

  const [memories, setMemories] = useState<Memory[]>(() => { try{return JSON.parse(localStorage.getItem(sk(token,"memories"))||"[]");}catch{return[];} });
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => { try{return JSON.parse(localStorage.getItem(sk(token,"family"))||"[]");}catch{return[];} });
  const [milestoneChecksMap, setMilestoneChecksMap] = useState<Record<string,boolean[]>>(() => { try{return JSON.parse(localStorage.getItem(sk(token,"milestones_map"))||"{}");}catch{return {};} });
  const [lastCheckedMap, setLastCheckedMap] = useState<Record<string,number|null>>({});
  const [activeMilestoneRef, setActiveMilestoneRef] = useState<string|undefined>(undefined);
  const [docs, setDocs] = useState<DocEntry[]>(() => { try{return JSON.parse(localStorage.getItem(sk(token,"docs"))||"[]");}catch{return[];} });
  const [activeDocRef, setActiveDocRef] = useState<string>("");
  const [docTitle, setDocTitle] = useState("");
  const [docDate, setDocDate] = useState("");
  const [docCategory, setDocCategory] = useState("");
  const [shopItems, setShopItems] = useState<string[]>(() => { try{const s=localStorage.getItem(sk(token,"shopitems")); return s?JSON.parse(s):["Silicone teether","Travel crib","High contrast books","Floor gym"];}catch{return[];} });
  const [superItems, setSuperItems] = useState<string[]>(() => { try{const s=localStorage.getItem(sk(token,"superitems")); return s?JSON.parse(s):["Aptamil Stage 2 €18.90","Johnson Baby Shampoo €4.50","Pampers No3 €14.99","WaterWipes €9.99"];}catch{return[];} });

  const [tab, setTab] = useState<"chat"|"family"|"memories"|"milestones"|"shopping"|"offers">("chat");
  const [input, setInput] = useState("");
  const [memInput, setMemInput] = useState(""); const [shopInput, setShopInput] = useState(""); const [superInput, setSuperInput] = useState("");
  const [loading, setLoading] = useState(false); const [playingIndex, setPlayingIndex] = useState<number|null>(null); const [recording, setRecording] = useState(false);
  const [showLang, setShowLang] = useState(false); const [shopTab, setShopTab] = useState<"p"|"s"|"o">("p"); const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false); const [newMemberName, setNewMemberName] = useState(""); const [newMemberRole, setNewMemberRole] = useState(""); const [newMemberEmail, setNewMemberEmail] = useState(""); const [newMemberPhone, setNewMemberPhone] = useState("");
  const [showAddChild, setShowAddChild] = useState(false); const [newChildName, setNewChildName] = useState(""); const [newChildBirthDate, setNewChildBirthDate] = useState("");
  const [activeMemRef, setActiveMemRef] = useState(undefined);
  // Which person are we adding a memory for? undefined = general/user

  const bottomRef = useRef<HTMLDivElement>(null); const recRef = useRef<any>(null); const fileRef = useRef<HTMLInputElement>(null); const inputRef = useRef<HTMLInputElement>(null); const audioRef = useRef<HTMLAudioElement|null>(null);
  const authH = { "x-token": token };
  const allChildren = getAllChildren(profile);
  const primaryChild = allChildren[0];
  const milestoneList = getMilestones(ageMonthsFromBirthDate(primaryChild?.birthDate) ?? parseAgeMonths(profile.childAge), lang);
  const displayAge = primaryChild ? formatChildAge(primaryChild.birthDate, lang) : profile.childAge;
  const primaryChildName = primaryChild?.name || "Baby";
  const pregnancyActive = !!profile.dueDate && !isDueDatePassed(profile.dueDate) && profile.pregnancyStatus !== "completed";
  const isPregnantProfile = pregnancyActive && allChildren.length===0;
  const pregWeek = pregnancyWeekFromDueDate(profile.dueDate) ?? 1;
  const pregMilestoneList = getPregnancyMilestones(pregWeek, lang);

  const [offers, setOffers] = useState<any[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  useEffect(()=>{
    let cancelled=false;
    setOffersLoading(true);
    axios.get(`${API}/offers`,{params:{lang},headers:authH})
      .then(res=>{if(!cancelled)setOffers(res.data.offers||[]);})
      .catch(()=>{if(!cancelled)setOffers([]);})
      .finally(()=>{if(!cancelled)setOffersLoading(false);});
    return ()=>{cancelled=true;};
  },[lang]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,loading]);
  useEffect(()=>{localStorage.setItem(sk(token,"chat"),JSON.stringify(messages));},[messages]);
  useEffect(()=>{localStorage.setItem(sk(token,"threads"),JSON.stringify(threads));},[threads]);
  useEffect(()=>{localStorage.setItem(sk(token,"memories"),JSON.stringify(memories));},[memories]);
  useEffect(()=>{localStorage.setItem(sk(token,"family"),JSON.stringify(familyMembers));},[familyMembers]);
  useEffect(()=>{localStorage.setItem(sk(token,"milestones_map"),JSON.stringify(milestoneChecksMap));},[milestoneChecksMap]);
  useEffect(()=>{localStorage.setItem(sk(token,"docs"),JSON.stringify(docs));},[docs]);
  useEffect(()=>{localStorage.setItem(sk(token,"docs"),JSON.stringify(docs));},[docs]);
  useEffect(()=>{localStorage.setItem(sk(token,"shopitems"),JSON.stringify(shopItems));},[shopItems]);
  useEffect(()=>{localStorage.setItem(sk(token,"superitems"),JSON.stringify(superItems));},[superItems]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = {role:"user",content:text};
    const next = [...messages, userMsg]; setMessages(next); setInput(""); setLoading(true);
    // Last 15 memories (text only, no images) for context
    const recentMemories = memories.slice(0,15).filter(m=>m.text&&m.text!=="📷").map(m=>({text:m.text,date:m.date,ref:m.ref}));
    const recentDocs = docs.slice(0,30).map(d=>({title:d.title,category:d.category,date:d.date,ref:d.ref}));
    try { const res = await axios.post(`${API}/chat`,{message:text,history:messages,profile:{childName:profile.childName,childAge:profile.childAge,childBirthDate:profile.childBirthDate||null,dueDate:profile.dueDate||null,lang:lang,children:getAllChildren(profile).map(c=>({name:c.name,birthDate:c.birthDate||null})),pregnancyStatus:profile.pregnancyStatus||(profile.dueDate?(isDueDatePassed(profile.dueDate)?"awaiting_update":"active"):undefined)},recentMemories,recentDocs},{headers:authH}); setMessages([...next,{role:"assistant",content:res.data.reply}]); }
    catch(err:any) { if(err.response?.status===401)onLogout(); else if(err.response?.status===402)onExpired(); else setMessages([...next,{role:"assistant",content:"..."}]); }
    finally { setLoading(false); }
  };

  // Prefill input and switch to chat without sending
  const prefillChat = (text: string) => {
    setTab("chat");
    setTimeout(()=>{ setInput(text); inputRef.current?.focus(); }, 80);
  };

  // Archive current thread
  const doArchive = () => {
    if (!messages.length) return;
    const title = archiveTitle.trim() || messages[0].content.slice(0,40) + (messages[0].content.length>40?"…":"");
    const thread: Thread = { id: Date.now().toString(), title, date: new Date().toLocaleDateString(lang,{day:"numeric",month:"short",year:"numeric"}), messages: [...messages] };
    setThreads(prev=>[thread,...prev]); setMessages([]); setShowArchiveModal(false); setArchiveTitle("");
  };

  const TTS_QUOTA_BY_TIER: Record<string, number> = { starter: 30, premium: 100, annual: 100 };
  const ttsQuotaTotal = TTS_QUOTA_BY_TIER["starter"]; // test users default to Starter tier
  const [ttsUsed, setTtsUsed] = useState<number>(() => { try{return parseInt(localStorage.getItem(sk(token,"ttsused"))||"0");}catch{return 0;} });
  useEffect(()=>{localStorage.setItem(sk(token,"ttsused"),String(ttsUsed));},[ttsUsed]);
  const ttsRemaining = Math.max(0, ttsQuotaTotal - ttsUsed);

  const stripMd = (s: string) => s.replace(/\*\*(.+?)\*\*/g,"$1").replace(/\*(.+?)\*/g,"$1").replace(/#{1,6} /g,"").replace(/`(.+?)`/g,"$1").replace(/\[(.+?)\]\(.+?\)/g,"$1").trim();
  const stopAudio = () => { if(audioRef.current){audioRef.current.pause();audioRef.current=null;} setPlayingIndex(null); };
  const speak = async (text: string, idx: number) => {
    if(audioRef.current){audioRef.current.pause();audioRef.current=null;}
    if(playingIndex===idx){setPlayingIndex(null);return;}
    if(ttsRemaining<=0)return;
    setPlayingIndex(idx);
    try { const ttsLang=lang; const clean=stripMd(text); const res=await axios.post(`${API}/tts`,{text:clean,lang:ttsLang},{headers:authH}); const audio=new Audio(`data:audio/mp3;base64,${res.data.audio}`); audioRef.current=audio; audio.onended=()=>{setPlayingIndex(null);audioRef.current=null;}; audio.play(); setTtsUsed(u=>u+1); }
    catch{setPlayingIndex(null);}
  };

  const startRec = () => {
    const SR = (window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SR){alert("Για το μικρόφωνο άνοιξε το app στο http://127.0.0.1:3000");return;}
    const r=new SR(); r.lang=lang; r.continuous=false; r.interimResults=false;
    r.onresult=(e:any)=>{setRecording(false);sendMessage(e.results[0][0].transcript);};
    r.onerror=(e:any)=>{console.error("SpeechRecognition error",e.error);setRecording(false);};
    r.onend=()=>setRecording(false);
    recRef.current=r; r.start(); setRecording(true);
  };

  const addMemory = (imgData?: string) => {
    if(!memInput.trim()&&!imgData)return;
    const emojis=["😊","🍼","😎","🛁","❤️","🌟","🎉","🌸","🏆","✨"];
    setMemories([{emoji:emojis[memories.length%emojis.length],text:memInput.trim()||"📷",date:new Date().toLocaleDateString(lang,{day:"numeric",month:"short"}),img:imgData,ref:activeMemRef},...memories]);
    setMemInput("");
  };

  const toggleMilestone = (ref: string, idx: number) => {
    const current = !!(milestoneChecksMap[ref]||[])[idx];
    setMilestoneChecksMap(prev => { const arr=[...(prev[ref]||[])]; arr[idx]=!arr[idx]; return {...prev,[ref]:arr}; });
    setLastCheckedMap(prev=>({...prev,[ref]:current?null:idx}));
  };
  const getChecksForRef = (ref: string): boolean[] => milestoneChecksMap[ref]||[];

  const addFamilyMember = () => {
    if(!newMemberName.trim())return;
    setFamilyMembers([...familyMembers,{name:newMemberName.trim(),role:newMemberRole.trim()||"Family",color:COLORS[familyMembers.length%COLORS.length],email:newMemberEmail.trim()||undefined,phone:newMemberPhone.trim()||undefined}]);
    setNewMemberName(""); setNewMemberRole(""); setNewMemberEmail(""); setNewMemberPhone(""); setShowAddMember(false);
  };

  const addChild = () => {
    if(!newChildName.trim()||!newChildBirthDate)return;
    const existing = getAllChildren(profile);
    const updatedChildren = [...existing, {name:newChildName.trim(),birthDate:newChildBirthDate}];
    const updatedProfile: Profile = {...profile, children: updatedChildren, pregnancyStatus: profile.dueDate ? "completed" : profile.pregnancyStatus};
    onProfileUpdate(updatedProfile);
    setNewChildName(""); setNewChildBirthDate(""); setShowAddChild(false);
  };

  const buildShoppingList = () => {
    return `🛍️ Shopping:\n${shopItems.map(i=>`• ${i}`).join("\n")}\n\n🛒 Supermarket:\n${superItems.map(i=>`• ${i}`).join("\n")}`;
  };

  const dir=L.d as "ltr"|"rtl";
  const card:React.CSSProperties={background:"#fff",borderRadius:14,padding:16,marginBottom:12,border:".5px solid rgba(43,58,103,.08)"};
  const tabs=[
    {id:"chat" as const,icon:"💬",label:t("chat",lang)},
    {id:"family" as const,icon:"👨‍👩‍👧",label:t("family",lang)},
    {id:"memories" as const,icon:"🤍",label:t("memories",lang)},
    {id:"milestones" as const,icon:"🏆",label:t("milestones",lang)},
    {id:"shopping" as const,icon:"🛍️",label:t("shopping",lang)},
  ];

  return (
    <div dir={dir} style={{fontFamily:"'DM Sans',sans-serif",height:"100vh",display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto",background:cream}}>

      {/* LANG MODAL */}
      {showLang&&<div onClick={e=>{if(e.target===e.currentTarget)setShowLang(false)}} style={{position:"fixed",inset:0,background:"rgba(43,58,103,.5)",zIndex:500,display:"flex",alignItems:"flex-end"}}>
        <div style={{background:"#fff",borderRadius:"18px 18px 0 0",padding:16,width:"100%",maxHeight:"65vh",overflowY:"auto"}}>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:16,color:navy,fontWeight:600,textAlign:"center",paddingBottom:12,borderBottom:`1px solid ${gl}`,marginBottom:4}}>🌐 {t("selectlang",lang)}</div>
          {LANGS.map(l=><div key={l.c} onClick={()=>{const u={...profile,lang:l.c};localStorage.setItem(sk(token,"profile"),JSON.stringify(u));window.location.reload();}} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderRadius:8,cursor:"pointer",background:l.c===lang?gl:"transparent",margin:"0 8px"}}><span style={{fontSize:19}}>{l.f}</span><span style={{fontSize:13.5,fontWeight:500,flex:1,color:navy}}>{l.n}</span>{l.c===lang&&<span style={{color:teal,fontWeight:700}}>✓</span>}</div>)}
        </div>
      </div>}

      {/* ARCHIVE MODAL */}
      {showArchiveModal&&<div style={{position:"fixed",inset:0,background:"rgba(43,58,103,.5)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"#fff",borderRadius:18,padding:24,width:"100%",maxWidth:380}}>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:17,color:navy,marginBottom:6,fontWeight:600}}>📁 {t("nameyourthread",lang)}</div>
          <p style={{fontSize:13,color:"#7A7068",marginBottom:16,lineHeight:1.5}}>Δώσε τίτλο στη συνομιλία ή άφησε κενό για αυτόματο τίτλο από την πρώτη ερώτηση.</p>
          <input value={archiveTitle} onChange={e=>setArchiveTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doArchive()} placeholder={messages[0]?.content.slice(0,40)||"Τίτλος..."} style={{width:"100%",padding:"11px 13px",border:`1.5px solid ${gl}`,borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",boxSizing:"border-box" as any,marginBottom:12}} autoFocus/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={doArchive} style={{flex:1,padding:11,background:navy,color:"#fff",border:"none",borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600,cursor:"pointer"}}>{t("archivethread",lang)} ✓</button>
            <button onClick={()=>setShowArchiveModal(false)} style={{flex:1,padding:11,background:gl,color:navy,border:"none",borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontSize:14,cursor:"pointer"}}>{t("cancel",lang)}</button>
          </div>
        </div>
      </div>}

      {/* PAST THREADS PANEL */}
      {showThreads&&<div onClick={e=>{if(e.target===e.currentTarget)setShowThreads(false)}} style={{position:"fixed",inset:0,background:"rgba(43,58,103,.5)",zIndex:500,display:"flex",alignItems:"flex-end"}}>
        <div style={{background:"#fff",borderRadius:"18px 18px 0 0",padding:16,width:"100%",maxHeight:"70vh",overflowY:"auto"}}>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:16,color:navy,fontWeight:600,textAlign:"center",paddingBottom:12,borderBottom:`1px solid ${gl}`,marginBottom:8}}>📁 {t("pastthreads",lang)}</div>
          {threads.length===0&&<div style={{textAlign:"center",color:"#7A7068",fontSize:13,padding:"20px 0"}}>Δεν υπάρχουν αρχειοθετημένες συνομιλίες.</div>}
          {threads.map(th=>(
            <div key={th.id} style={{padding:"11px 12px",borderRadius:10,background:gl,marginBottom:8,cursor:"pointer"}} onClick={()=>{setMessages(th.messages);setShowThreads(false);}}>
              <div style={{fontSize:13,fontWeight:600,color:navy,marginBottom:2}}>{th.title}</div>
              <div style={{fontSize:11,color:"#7A7068"}}>{th.date} · {th.messages.length} messages</div>
            </div>
          ))}
        </div>
      </div>}

      {/* FILE INPUT */}
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>addMemory(ev.target?.result as string);r.readAsDataURL(f);e.target.value="";}}/>

      {showAccountMenu&&<div onClick={()=>setShowAccountMenu(false)} style={{position:"fixed",inset:0,zIndex:550}}/>}
      {/* HEADER */}
      <div style={{background:navy,padding:"14px 18px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{color:"#fff",fontFamily:"'Fraunces',Georgia,serif",fontSize:16}}>{t("greeting",lang)} <span style={{color:"#F5C5A3"}}>{profile.name}</span> 👋</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setShowLang(true)} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:999,padding:"5px 10px",cursor:"pointer",color:"#fff",fontSize:12,fontFamily:"inherit"}}>{L.f} {L.s}</button>
          <div onClick={()=>setShowAccountMenu(v=>!v)} style={{width:34,height:34,borderRadius:"50%",background:coral,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"'Fraunces',Georgia,serif",fontSize:14,fontWeight:600,cursor:"pointer",position:"relative"}}>
            {profile.name[0]?.toUpperCase()||"M"}
            {showAccountMenu&&<div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:42,right:0,background:"#fff",borderRadius:10,boxShadow:"0 4px 16px rgba(0,0,0,.15)",padding:6,minWidth:140,zIndex:600}}>
              <button onClick={onLogout} style={{width:"100%",textAlign:"left",padding:"8px 10px",background:"none",border:"none",borderRadius:7,color:"#E07B54",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,cursor:"pointer"}}>🚪 {lang==="el"?"Αποσύνδεση":"Log out"}</button>
            </div>}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{flex:1,overflowY:"auto",padding:16}}>

        {/* ── CHAT ── */}
        {tab==="chat"&&(
          <div style={{display:"flex",flexDirection:"column"}}>
            {/* Voice quota bar */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10.5,color:"#7A7068",marginBottom:4}}>
                <span>🔊 {t("voicequota",lang)}</span>
                <span>{ttsRemaining}/{ttsQuotaTotal}</span>
              </div>
              <div style={{height:6,borderRadius:99,background:gl,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${Math.round((ttsRemaining/ttsQuotaTotal)*100)}%`,background:ttsRemaining>0?teal:"#E07B54",borderRadius:99,transition:"width .3s"}}/>
              </div>
            </div>

            {/* Chat toolbar */}
            <div style={{display:"flex",gap:6,marginBottom:10}}>
              <button onClick={()=>{if(messages.length>0)setShowArchiveModal(true);}} disabled={messages.length===0} style={{flex:1,padding:"7px 10px",background:messages.length>0?gl:"rgba(240,235,230,.4)",border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:600,cursor:messages.length>0?"pointer":"default",color:messages.length>0?navy:"#C8BFB8",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                📁 {t("archivethread",lang)}
              </button>
              <button onClick={()=>{if(messages.length>0){setMessages([]);localStorage.setItem(sk(token,"chat"),"[]");}}} disabled={messages.length===0} style={{flex:1,padding:"7px 10px",background:messages.length>0?gl:"rgba(240,235,230,.4)",border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:600,cursor:messages.length>0?"pointer":"default",color:messages.length>0?navy:"#C8BFB8",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                ✏️ {t("newthread",lang)}
              </button>
              {threads.length>0&&<button onClick={()=>setShowThreads(true)} style={{flex:1,padding:"7px 10px",background:gl,border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:600,cursor:"pointer",color:navy,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                🗂️ {t("pastthreads",lang)}
              </button>}
            </div>

            {messages.length===0&&<div style={{...card,textAlign:"center",padding:"20px 16px"}}>
              <div style={{width:52,height:52,borderRadius:"50%",background:navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 12px"}}>🐾</div>
              <div style={{fontSize:13,color:navy,lineHeight:1.6}}>{t("chatgreet",lang)} {profile.name}, {t("chatgreet2",lang)}</div>
            </div>}

            {messages.map((msg,i)=>(
              <div key={i}>
                {msg.role==="assistant"?(<div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🐾</div>
                  <div><div style={{background:gl,borderRadius:"0 11px 11px 11px",padding:"10px 12px",fontSize:12.5,lineHeight:1.5,color:navy,maxWidth:"85%"}}>{msg.content}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}><button onClick={()=>speak(msg.content,i)} disabled={ttsRemaining<=0} style={{background:"none",border:"none",fontSize:11,color:ttsRemaining<=0?"#C8BFB8":playingIndex===i?coral:teal,cursor:ttsRemaining<=0?"default":"pointer",padding:"4px 0",fontFamily:"inherit"}}>{playingIndex===i?"⏸ Stop":t("listen",lang)}</button></div></div>
                </div>):(<div style={{background:navy,color:"#fff",borderRadius:"11px 11px 0 11px",padding:"10px 13px",fontSize:12.5,margin:"8px 0 8px 40px",lineHeight:1.5}}>{msg.content}</div>)}
              </div>
            ))}
            {loading&&<div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🐾</div>
              <div style={{background:gl,borderRadius:"0 11px 11px 11px",padding:"12px 16px",fontSize:18}}>···</div>
            </div>}
            <div ref={bottomRef}/>
          </div>
        )}

        {/* ── FAMILY ── */}
        {tab==="family"&&(<>
          <div style={card}>
            <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,color:navy,marginBottom:11,fontWeight:600}}>{t("myfamily",lang)}</div>
            {profile.dueDate&&<div style={{display:"flex",alignItems:"center",gap:9,padding:"10px 11px",borderRadius:9,background:gl,marginBottom:6}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:coral,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18,color:"#fff",flexShrink:0}}>🤰</div>
              <div><div style={{fontWeight:600,fontSize:13,color:navy}}>{t("pregnancy_short",lang)}</div><div style={{fontSize:11,color:"#7A7068",marginTop:1}}>{t("duelabel",lang)}{profile.dueDate}</div></div>
            </div>}
            {getAllChildren(profile).map((child,i)=>{
              const age = formatChildAge(child.birthDate, lang);
              return (<div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 11px",borderRadius:9,background:gl,marginBottom:6}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:coral,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"#fff",flexShrink:0}}>{child.name[0]?.toUpperCase()}</div>
                <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:navy}}>{child.name}</div><div style={{fontSize:11,color:"#7A7068",marginTop:1}}>{age}</div></div>
                <button onClick={()=>{setActiveMemRef(child.name);setTab("memories");}} style={{background:"none",border:`1px solid ${teal}`,borderRadius:7,color:teal,fontSize:11,cursor:"pointer",padding:"4px 8px",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>📝</button>
                <button onClick={()=>{setActiveMilestoneRef(child.name);setTab("milestones");}} style={{background:"none",border:"1px solid "+coral,borderRadius:7,color:coral,fontSize:11,cursor:"pointer",padding:"4px 8px",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>🏆</button>
              </div>);
            })}
            {showAddChild&&<div style={{background:"#F8F5F2",borderRadius:10,padding:12,marginBottom:8}}>
              <input value={newChildName} onChange={e=>setNewChildName(e.target.value)} placeholder={t("childname",lang)} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <input value={newChildBirthDate} onChange={e=>setNewChildBirthDate(e.target.value)} type="date" placeholder={t("childbirthdate",lang)} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={addChild} disabled={!newChildName.trim()||!newChildBirthDate} style={{flex:1,padding:9,background:(!newChildName.trim()||!newChildBirthDate)?"#C8BFB8":navy,color:"#fff",border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,cursor:(!newChildName.trim()||!newChildBirthDate)?"default":"pointer"}}>{t("save",lang)}</button>
                <button onClick={()=>{setShowAddChild(false);setNewChildName("");setNewChildBirthDate("");}} style={{flex:1,padding:9,background:gl,color:navy,border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer"}}>{t("cancel",lang)}</button>
              </div>
            </div>}
            <div onClick={()=>setShowAddChild(!showAddChild)} style={{border:"2px dashed #C8BFB8",borderRadius:9,padding:14,textAlign:"center",cursor:"pointer",color:"#7A7068",fontSize:13,marginBottom:8}}>{t("addchild",lang)}</div>
            {familyMembers.map((m,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 11px",borderRadius:9,background:gl,marginBottom:6}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"#fff",flexShrink:0}}>{m.name[0]?.toUpperCase()}</div>
                <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:navy}}>{m.name}</div><div style={{fontSize:11,color:"#7A7068",marginTop:1}}>{m.role}</div></div>
                <button onClick={()=>{setActiveMemRef(m.name);setTab("memories");}} style={{background:"none",border:`1px solid ${teal}`,borderRadius:7,color:teal,fontSize:11,cursor:"pointer",padding:"4px 8px",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>📝</button>
                <button onClick={()=>setFamilyMembers(familyMembers.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#C8BFB8",cursor:"pointer",fontSize:18,padding:4}}>×</button>
              </div>
            ))}
            {showAddMember&&<div style={{background:"#F8F5F2",borderRadius:10,padding:12,marginBottom:8}}>
              <input value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder={t("membername",lang)} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <input value={newMemberRole} onChange={e=>setNewMemberRole(e.target.value)} placeholder={t("memberrole",lang)} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <input value={newMemberEmail} onChange={e=>setNewMemberEmail(e.target.value)} type="email" placeholder={t("memberemail",lang)} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <input value={newMemberPhone} onChange={e=>setNewMemberPhone(e.target.value)} type="tel" placeholder={t("memberphone",lang)} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={addFamilyMember} style={{flex:1,padding:9,background:navy,color:"#fff",border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,cursor:"pointer"}}>{t("save",lang)}</button>
                <button onClick={()=>setShowAddMember(false)} style={{flex:1,padding:9,background:gl,color:navy,border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer"}}>{t("cancel",lang)}</button>
              </div>
            </div>}
            <div onClick={()=>setShowAddMember(!showAddMember)} style={{border:"2px dashed #C8BFB8",borderRadius:9,padding:14,textAlign:"center",cursor:"pointer",color:"#7A7068",fontSize:13}}>{t("addmember",lang)}</div>
          </div>
          <div style={card}>
            <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🐾</div>
              <div>
                <div style={{background:gl,borderRadius:"0 11px 11px 11px",padding:"10px 12px",fontSize:12.5,lineHeight:1.5,color:navy}}>{t("chatgreet",lang)} {profile.name}! {t("chatgreet2",lang)}</div>
                <button onClick={()=>prefillChat(lang === "el" ? `Πες μου για την ανάπτυξη μωρού ηλικίας ${displayAge}` : lang === "ar" ? `أخبريني عن تطور الطفل في عمر ${displayAge}` : lang === "zh" ? `告诉我${displayAge}宝宝的发育情况` : lang === "es" ? `Cuéntame sobre el desarrollo del bebé de ${displayAge}` : lang === "fr" ? `Parle-moi du développement de bébé à ${displayAge}` : lang === "de" ? `Erzähl mir über die Entwicklung eines Babys im Alter von ${displayAge}` : lang === "pt" ? `Fala-me sobre o desenvolvimento do bebé com ${displayAge}` : lang === "it" ? `Parlami dello sviluppo del bambino di ${displayAge}` : lang === "ru" ? `Расскажи мне о развитии ребёнка в возрасте ${displayAge}` : lang === "tr" ? `${displayAge} yaşındaki bebek gelişimi hakkında anlat` : lang === "hi" ? `${displayAge} के बच्चे के विकास के बारे में बताएं` : lang === "ur" ? `${displayAge} کے بچے کی نشوونما کے بارے میں بتائیں` : lang === "ja" ? `${displayAge}の赤ちゃんの発達について教えて` : `Tell me about baby development for ${displayAge}`)} style={{background:"none",border:`1px solid ${teal}`,borderRadius:8,color:teal,fontSize:11,cursor:"pointer",padding:"5px 10px",marginTop:6,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{t("askmaa",lang)}</button>
              </div>
            </div>
          </div>
        </>)}

        {/* ── MEMORIES ── */}
        {tab==="memories"&&<div style={card}>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,color:navy,marginBottom:11,fontWeight:600}}>{t("recentmem",lang)}</div>
          {/* Person selector pills */}
          {(()=>{
            const memRefs: {label:string,value:string|undefined}[] = [{label:"🌸 "+ (lang==="el"?"Γενικά":"General"),value:undefined}];
            if(pregnancyActive) memRefs.push({label:"🤰 "+t("pregnancy_short",lang),value:"pregnancy"});
            getAllChildren(profile).forEach(c=>memRefs.push({label:"👶 "+c.name,value:c.name}));
            familyMembers.forEach(m=>memRefs.push({label:"👤 "+m.name,value:m.name}));
            if(memRefs.length>1) return (
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {memRefs.map((r,i)=>(
                  <button key={i} onClick={()=>setActiveMemRef(r.value)} style={{padding:"5px 11px",borderRadius:999,border:"none",background:activeMemRef===r.value?navy:gl,color:activeMemRef===r.value?"#fff":"#7A7068",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>{r.label}</button>
                ))}
              </div>
            );
            return null;
          })()}
          {/* Filtered memory list */}
          {(()=>{
            const filtered = memories.filter(m=>m.ref===activeMemRef);
            if(filtered.length===0) return <div style={{fontSize:13,color:"#7A7068",textAlign:"center",padding:"20px 0"}}>{t("nomemories",lang)}</div>;
            return filtered.map((m,i)=>{
              const origIdx = memories.indexOf(m);
              return (
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:9,padding:"10px 0",borderBottom:i<filtered.length-1?`1px solid ${gl}`:"none"}}>
                  {m.img?<img src={m.img} alt="" style={{width:48,height:48,borderRadius:8,objectFit:"cover",flexShrink:0}}/>:<span style={{fontSize:20,flexShrink:0,lineHeight:1.3}}>{m.emoji}</span>}
                  <div style={{flex:1}}><div style={{fontSize:12.5,color:"#2B2420",lineHeight:1.45,fontWeight:500}}>{m.text!=="📷"?m.text:""}</div><div style={{fontSize:10,color:"#C8BFB8",marginTop:2}}>{m.date}</div></div>
                  <button onClick={()=>setMemories(memories.filter((_,j)=>j!==origIdx))} style={{background:"none",border:"none",color:"#C8BFB8",cursor:"pointer",fontSize:18,padding:4,flexShrink:0}}>×</button>
                </div>
              );
            });
          })()}
          <div style={{display:"flex",gap:7,marginTop:10,paddingTop:10,borderTop:`1px solid ${gl}`}}>
            <input value={memInput} onChange={e=>setMemInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMemory()} placeholder={t("addmemory",lang)} style={{flex:1,padding:"8px 11px",border:"1.5px solid #DDD7D0",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:12.5,color:"#2B2420",background:"#fff",outline:"none"}}/>
            <button onClick={()=>fileRef.current?.click()} style={{padding:"8px 11px",background:gl,color:navy,border:"none",borderRadius:9,fontSize:15,cursor:"pointer"}}>📷</button>
            <button onClick={()=>addMemory()} style={{padding:"8px 13px",background:navy,color:"#fff",border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,cursor:"pointer"}}>＋</button>
          </div>
        </div>}

        {/* ── MILESTONES ── */}
        {tab==="milestones"&&(()=>{
          const msRefs: {label:string,value:string}[] = [];
          if(profile.dueDate) msRefs.push({label:"🤰 "+t("pregnancy_short",lang),value:"pregnancy"});
          getAllChildren(profile).forEach(ch=>msRefs.push({label:"👶 "+ch.name,value:ch.name}));
          const effectiveRef = (activeMilestoneRef&&msRefs.some(r=>r.value===activeMilestoneRef))?activeMilestoneRef:msRefs[0]?.value;
          const isPreg = effectiveRef==="pregnancy";
          const currentChild = isPreg?null:getAllChildren(profile).find(ch=>ch.name===effectiveRef);
          const currentChecks = getChecksForRef(effectiveRef||"");
          const currentLastIdx = lastCheckedMap[effectiveRef||""]??null;
          const currentMilestoneList = isPreg?pregMilestoneList:(currentChild?getMilestones(ageMonthsFromBirthDate(currentChild.birthDate)??parseAgeMonths(profile.childAge),lang):milestoneList);
          const currentDisplayAge = currentChild?formatChildAge(currentChild.birthDate,lang):displayAge;
          const currentChildName = currentChild?.name||primaryChildName;
          const currentCheckedCount = currentChecks.filter(Boolean).length;
          return (<>
            {msRefs.length>1&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {msRefs.map((r,i)=>(
                <button key={i} onClick={()=>setActiveMilestoneRef(r.value)} style={{padding:"5px 11px",borderRadius:999,border:"none",background:effectiveRef===r.value?navy:gl,color:effectiveRef===r.value?"#fff":"#7A7068",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>{r.label}</button>
              ))}
            </div>}
            {isPreg&&profile.dueDate&&(<>
            <div style={card}>
              <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,color:navy,marginBottom:8,fontWeight:600}}>🤰 {t("pregnancycard_title",lang)}</div>
              <div style={{fontSize:12.5,color:"#7A7068",lineHeight:1.6}}>{t("pregnancycard_body",lang).replace("{week}",String(pregWeek)).replace("{date}",profile.dueDate||"")}</div>
            </div>
            <div style={card}>
              <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,color:navy,marginBottom:4,fontWeight:600}}>{t("pregnancymilestones_title",lang)} · {t("week_label",lang)} {pregWeek}</div>
              <div style={{fontSize:12,color:"#7A7068",marginBottom:12}}>{t("pregnancymilestones_sub",lang)}</div>
              {currentMilestoneList.map((m,i)=>(
                <div key={i}>
                  <div onClick={()=>toggleMilestone("pregnancy",i)} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 0",borderBottom:"1px solid "+gl,cursor:"pointer"}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:currentChecks[i]?teal:gl,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:currentChecks[i]?"#fff":"#C8BFB8",flexShrink:0,border:currentChecks[i]?"none":"2px solid #C8BFB8",transition:"all .2s"}}>{currentChecks[i]?"✓":"○"}</div>
                    <div style={{fontSize:13,fontWeight:500,color:currentChecks[i]?"#2B2420":"#7A7068",flex:1}}>{m}</div>
                  </div>
                  {currentChecks[i]&&currentLastIdx===i&&(
                    <div style={{background:"linear-gradient(135deg,rgba(74,190,170,.12),rgba(43,58,103,.06))",border:"1px solid "+teal,borderRadius:10,padding:"10px 12px",margin:"4px 0 8px 30px",fontSize:12,color:navy,lineHeight:1.55,fontStyle:"italic"}}>
                      {getPregnancyMilestoneMsg(i,currentMilestoneList.length,lang)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {currentCheckedCount>0&&<div style={{background:"rgba(74,190,170,.12)",border:"1.5px solid "+teal,borderRadius:10,padding:"12px 14px",marginBottom:12,fontSize:13,color:teal,fontWeight:600}}>
              🎉 {t("week_label",lang)} {pregWeek} — {currentCheckedCount}/{currentMilestoneList.length} {t("pregnancymilestones_title",lang)}
            </div>}
            <div style={card}>
              <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🐾</div>
                <div>
                  <div style={{background:gl,borderRadius:"0 11px 11px 11px",padding:"10px 12px",fontSize:12.5,lineHeight:1.5,color:navy}}>{t("askaboutmile",lang)}</div>
                  <button onClick={()=>prefillChat(t("askmile_preg_q",lang).replace("{week}",String(pregWeek)))} style={{background:"none",border:"1px solid "+teal,borderRadius:8,color:teal,fontSize:11,cursor:"pointer",padding:"5px 10px",marginTop:6,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{t("askmaa",lang)}</button>
                </div>
              </div>
            </div>
            </>)}
            {currentChild&&(<>
            <div style={card}>
              <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,color:navy,marginBottom:4,fontWeight:600}}>{t("milestones",lang)} · {currentChildName} · {currentDisplayAge}</div>
              <div style={{fontSize:12,color:"#7A7068",marginBottom:12}}>{t("tickall",lang)}</div>
              {currentMilestoneList.map((m,i)=>(
                <div key={i}>
                  <div onClick={()=>toggleMilestone(effectiveRef!,i)} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 0",borderBottom:"1px solid "+gl,cursor:"pointer"}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:currentChecks[i]?teal:gl,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:currentChecks[i]?"#fff":"#C8BFB8",flexShrink:0,border:currentChecks[i]?"none":"2px solid #C8BFB8",transition:"all .2s"}}>{currentChecks[i]?"✓":"○"}</div>
                    <div style={{fontSize:13,fontWeight:500,color:currentChecks[i]?"#2B2420":"#7A7068",flex:1}}>{m}</div>
                  </div>
                  {currentChecks[i]&&currentLastIdx===i&&(
                    <div style={{background:"linear-gradient(135deg,rgba(74,190,170,.12),rgba(43,58,103,.06))",border:"1px solid "+teal,borderRadius:10,padding:"10px 12px",margin:"4px 0 8px 30px",fontSize:12,color:navy,lineHeight:1.55,fontStyle:"italic"}}>
                      {getMilestoneMsg(i,currentMilestoneList.length,lang)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {currentCheckedCount>0&&<div style={{background:"rgba(74,190,170,.12)",border:"1.5px solid "+teal,borderRadius:10,padding:"12px 14px",marginBottom:12,fontSize:13,color:teal,fontWeight:600}}>
              🎉 {currentChildName} — {currentCheckedCount}/{currentMilestoneList.length} milestones!
            </div>}
            <div style={card}>
              <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🐾</div>
                <div>
                  <div style={{background:gl,borderRadius:"0 11px 11px 11px",padding:"10px 12px",fontSize:12.5,lineHeight:1.5,color:navy}}>{t("askaboutmile",lang)}</div>
                  <button onClick={()=>prefillChat(lang==="el"?"Ποια είναι τα επόμενα milestones για παιδί "+currentDisplayAge+";":lang==="ar"?"ما هي الإنجازات التطورية القادمة لطفل بعمر "+currentDisplayAge+"؟":lang==="zh"?currentDisplayAge+"宝宝接下来的发育里程碑是什么？":lang==="es"?"¿Cuáles son los próximos hitos del desarrollo para un bebé de "+currentDisplayAge+"?":lang==="fr"?"Quelles sont les prochaines étapes du développement pour un bébé de "+currentDisplayAge+"?":lang==="de"?"Was sind die nächsten Entwicklungsmeilensteine für ein Baby im Alter von "+currentDisplayAge+"?":lang==="ru"?"Каковы следующие вехи развития для ребёнка в возрасте "+currentDisplayAge+"?":lang==="tr"?currentDisplayAge+" yaşındaki bebek için sıradaki gelişim aşamaları neler?":lang==="hi"?currentDisplayAge+" के बच्चे के लिए अगले विकास के मील के पत्थर क्या हैं?":lang==="ja"?currentDisplayAge+"の赤ちゃんの次の発達マイルストーンは何ですか？":"What are the next developmental milestones for a baby aged "+currentDisplayAge+"?")} style={{background:"none",border:"1px solid "+teal,borderRadius:8,color:teal,fontSize:11,cursor:"pointer",padding:"5px 10px",marginTop:6,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{t("askmaa",lang)}</button>
                </div>
              </div>
            </div>
            </>)}
            {!effectiveRef&&<div style={card}><div style={{fontSize:13,color:"#7A7068",textAlign:"center",padding:"20px 0"}}>{t("nochildyet",lang)}</div></div>}
            {/* ── DOCUMENTS ── */}
            <div style={{marginTop:8,background:"#fff",borderRadius:14,padding:16,border:".5px solid rgba(43,58,103,.08)"}}>
              <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,color:navy,marginBottom:4,fontWeight:600}}>📁 {t("docs_title",lang)}</div>
              <div style={{fontSize:11.5,color:"#7A7068",lineHeight:1.6,marginBottom:12,background:"rgba(43,58,103,.04)",borderRadius:8,padding:"8px 10px"}}>{t("docs_hint",lang)}</div>
              {(()=>{
                const docRefs: {label:string,value:string}[] = [{label:"🌸 "+(lang==="el"?"Γενικά":lang==="ar"?"عام":lang==="zh"?"通用":lang==="es"?"General":lang==="fr"?"Général":lang==="de"?"Allgemein":lang==="ru"?"Общее":lang==="tr"?"Genel":lang==="hi"?"सामान्य":lang==="ja"?"一般":"General"),value:""}];
                if(profile.dueDate) docRefs.push({label:"🤰 "+t("pregnancy_short",lang),value:"pregnancy"});
                getAllChildren(profile).forEach(ch=>docRefs.push({label:"👶 "+ch.name,value:ch.name}));
                familyMembers.forEach(fm=>docRefs.push({label:"👤 "+fm.name,value:fm.name}));
                const effDocRef = activeDocRef;
                const filteredDocs = docs.filter(d=>d.ref===effDocRef);
                return (<>
                  {docRefs.length>1&&<div style={{display:"flex",gap:6,flexWrap:"wrap" as any,marginBottom:12}}>
                    {docRefs.map((r,i)=>(<button key={i} onClick={()=>setActiveDocRef(r.value)} style={{padding:"5px 11px",borderRadius:999,border:"none",background:effDocRef===r.value?navy:gl,color:effDocRef===r.value?"#fff":"#7A7068",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>{r.label}</button>))}
                  </div>}
                  {filteredDocs.length===0?<div style={{fontSize:12.5,color:"#7A7068",textAlign:"center",padding:"12px 0"}}>{t("docs_empty",lang)}</div>:filteredDocs.map((d,i)=>{
                    const origIdx=docs.indexOf(d);
                    return(<div key={i} style={{display:"flex",alignItems:"flex-start",gap:9,padding:"10px 0",borderBottom:"1px solid "+gl}}>
                      <span style={{fontSize:20,flexShrink:0}}>📄</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:navy}}>{d.title}</div>
                        {d.category&&<div style={{fontSize:11,color:teal,marginTop:1}}>{d.category}</div>}
                        {d.date&&<div style={{fontSize:10.5,color:"#C8BFB8",marginTop:1}}>{d.date}</div>}
                        <div style={{fontSize:10,color:"#C8BFB8",marginTop:1}}>{d.addedDate}</div>
                      </div>
                      <button onClick={()=>setDocs(docs.filter((_,j)=>j!==origIdx))} style={{background:"none",border:"none",color:"#C8BFB8",cursor:"pointer",fontSize:18,padding:4,flexShrink:0}}>×</button>
                    </div>);
                  })}
                  <div style={{borderTop:"1px solid "+gl,paddingTop:10,marginTop:10,display:"flex",flexDirection:"column" as any,gap:7}}>
                    <input value={docTitle} onChange={e=>setDocTitle(e.target.value)} placeholder={t("docs_add_title_ph",lang)} style={{width:"100%",padding:"8px 11px",border:"1.5px solid #DDD7D0",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:12.5,outline:"none",boxSizing:"border-box" as any}}/>
                    <div style={{display:"flex",gap:7}}>
                      <input value={docDate} onChange={e=>setDocDate(e.target.value)} placeholder={t("docs_add_date_ph",lang)} style={{flex:1,padding:"8px 11px",border:"1.5px solid #DDD7D0",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:12.5,outline:"none"}}/>
                      <input value={docCategory} onChange={e=>setDocCategory(e.target.value)} placeholder={t("docs_add_cat_ph",lang)} style={{flex:1,padding:"8px 11px",border:"1.5px solid #DDD7D0",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:12.5,outline:"none"}}/>
                    </div>
                    <button onClick={()=>{if(!docTitle.trim())return; setDocs([{title:docTitle.trim(),date:docDate.trim(),category:docCategory.trim(),ref:effDocRef,addedDate:new Date().toLocaleDateString(lang,{day:"numeric",month:"short",year:"numeric"})},...docs]); setDocTitle(""); setDocDate(""); setDocCategory("");}} style={{padding:"9px 14px",background:navy,color:"#fff",border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,cursor:"pointer"}}>＋</button>
                  </div>
                </>);
              })()}
            </div>
          </>);
        })()}
        {/* ── SHOPPING ── */}
        {tab==="shopping"&&<div style={card}>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,color:navy,marginBottom:11,fontWeight:600}}>Shopping · {displayAge}</div>
          <div style={{display:"flex",marginBottom:12,borderRadius:9,overflow:"hidden",border:"1.5px solid #E6E0D8"}}>
            <button onClick={()=>setShopTab("p")} style={{flex:1,padding:"8px 3px",fontSize:11,fontWeight:600,cursor:"pointer",background:shopTab==="p"?navy:"#fff",color:shopTab==="p"?"#fff":"#7A7068",border:"none",fontFamily:"'DM Sans',sans-serif"}}>🛍️ {t("products",lang)}</button>
            <button onClick={()=>setShopTab("s")} style={{flex:1,padding:"8px 3px",fontSize:11,fontWeight:600,cursor:"pointer",background:shopTab==="s"?navy:"#fff",color:shopTab==="s"?"#fff":"#7A7068",border:"none",fontFamily:"'DM Sans',sans-serif"}}>🛒 {t("supermarket",lang)}</button>
            <button onClick={()=>setShopTab("o")} style={{flex:1,padding:"8px 3px",fontSize:11,fontWeight:600,cursor:"pointer",background:shopTab==="o"?navy:"#fff",color:shopTab==="o"?"#fff":"#7A7068",border:"none",fontFamily:"'DM Sans',sans-serif",position:"relative" as any}}>🔔 {t("offers",lang)}{offers.length>0&&shopTab!=="o"&&<span style={{position:"absolute",top:4,right:4,width:7,height:7,borderRadius:"50%",background:coral}}/>}</button>
          </div>
          {shopTab==="p"&&(<>
            {shopItems.map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid "+gl}}>
                <div style={{width:36,height:36,borderRadius:8,background:gl,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📦</div>
                <div style={{fontSize:12.5,fontWeight:600,color:"#2B2420",flex:1}}>{item}</div>
                <button onClick={()=>setShopItems(shopItems.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#C8BFB8",cursor:"pointer",fontSize:18,padding:4}}>×</button>
              </div>
            ))}
            <div style={{display:"flex",gap:7,marginTop:10,paddingTop:10,borderTop:"1px solid "+gl}}>
              <input value={shopInput} onChange={e=>setShopInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&shopInput.trim()){setShopItems([...shopItems,shopInput.trim()]);setShopInput("");}}} placeholder={t("additem",lang)} style={{flex:1,padding:"8px 11px",border:"1.5px solid #DDD7D0",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:12.5,outline:"none"}}/>
              <button onClick={()=>{if(shopInput.trim()){setShopItems([...shopItems,shopInput.trim()]);setShopInput("");}}} style={{padding:"8px 13px",background:navy,color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>＋</button>
            </div>
            <div style={{background:navy,borderRadius:10,padding:"10px 12px",marginTop:10,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap" as any,gap:6}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,.75)",fontWeight:500}}>{t("sendlist",lang)}</span>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>window.open("https://wa.me/?text="+encodeURIComponent("🛍️ "+t("products",lang)+":\n"+shopItems.map(i=>"• "+i).join("\n")),"_blank")} style={{background:"#25D366",border:"none",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>WhatsApp</button>
                <button onClick={()=>window.open("viber://forward?text="+encodeURIComponent("🛍️ "+t("products",lang)+":\n"+shopItems.map(i=>"• "+i).join("\n")),"_blank")} style={{background:"#7360F2",border:"none",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Viber</button>
                <button onClick={()=>window.open("mailto:?subject="+t("products",lang)+"&body="+encodeURIComponent("🛍️ "+t("products",lang)+":\n"+shopItems.map(i=>"• "+i).join("\n")))} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Email</button>
                <button onClick={()=>navigator.share?navigator.share({text:"🛍️ "+t("products",lang)+":\n"+shopItems.map(i=>"• "+i).join("\n")}):window.open("sms:?body="+encodeURIComponent("🛍️ "+t("products",lang)+":\n"+shopItems.map(i=>"• "+i).join("\n")))} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>SMS</button>
              </div>
            </div>
          </>)}
          {shopTab==="s"&&(<>
            {superItems.map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 0",borderBottom:"1px solid "+gl}}>
                <div style={{width:34,height:34,borderRadius:7,background:gl,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>🛒</div>
                <div style={{fontSize:12.5,fontWeight:600,color:"#2B2420",flex:1}}>{item}</div>
                <button onClick={()=>setSuperItems(superItems.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#C8BFB8",cursor:"pointer",fontSize:18,padding:4}}>×</button>
              </div>
            ))}
            <div style={{display:"flex",gap:7,marginTop:10,paddingTop:10,borderTop:"1px solid "+gl}}>
              <input value={superInput} onChange={e=>setSuperInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&superInput.trim()){setSuperItems([...superItems,superInput.trim()]);setSuperInput("");}}} placeholder={t("addtolist",lang)} style={{flex:1,padding:"8px 11px",border:"1.5px solid #DDD7D0",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:12.5,outline:"none"}}/>
              <button onClick={()=>{if(superInput.trim()){setSuperItems([...superItems,superInput.trim()]);setSuperInput("");}}} style={{padding:"8px 13px",background:navy,color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>＋</button>
            </div>
            <div style={{background:navy,borderRadius:10,padding:"10px 12px",marginTop:10,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap" as any,gap:6}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,.75)",fontWeight:500}}>{t("sendlist",lang)}</span>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>window.open("https://wa.me/?text="+encodeURIComponent(buildShoppingList()),"_blank")} style={{background:"#25D366",border:"none",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>WhatsApp</button>
                <button onClick={()=>window.open("viber://forward?text="+encodeURIComponent(buildShoppingList()),"_blank")} style={{background:"#7360F2",border:"none",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Viber</button>
                <button onClick={()=>window.open("mailto:?subject=Shopping List&body="+encodeURIComponent(buildShoppingList()))} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Email</button>
                <button onClick={()=>navigator.share?navigator.share({text:buildShoppingList()}):window.open("sms:?body="+encodeURIComponent(buildShoppingList()))} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>SMS</button>
              </div>
            </div>
          </>)}
          {shopTab==="o"&&<div>
            <div style={{fontSize:12,color:"#7A7068",marginBottom:12}}>{t("offers_sub",lang)}</div>
            {offersLoading&&<div style={{textAlign:"center",fontSize:12,color:"#7A7068"}}>{t("loading",lang)}</div>}
            {!offersLoading&&offers.length===0&&<div style={{textAlign:"center",fontSize:12,color:"#7A7068"}}>{t("offers_empty",lang)}</div>}
            {offers.map((o:any)=>(
              <div key={o.id} style={{background:gl,borderRadius:12,padding:12,marginBottom:10}}>
                {o.badge&&<div style={{display:"inline-block",fontSize:10,fontWeight:700,padding:"2px 9px",borderRadius:999,background:o.badge==="promo"?"#E07B54":o.badge==="sponsored"?"#7C5CBF":teal,color:"#fff",marginBottom:6}}>{o.badge.toUpperCase()}</div>}
                <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:14,color:navy,marginBottom:4,fontWeight:600}}>{o.title}</div>
                <div style={{fontSize:12.5,color:"#7A7068",lineHeight:1.55,marginBottom:8}}>{o.body}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap" as any}}>
                  {o.link&&<a href={o.link} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",fontSize:11,fontWeight:600,color:teal,textDecoration:"none",border:"1px solid "+teal,borderRadius:8,padding:"5px 12px"}}>{t("learnmore",lang)} →</a>}
                  <button onClick={()=>setShopItems(prev=>[...prev,o.title])} style={{fontSize:11,fontWeight:600,color:navy,background:"#fff",border:"1px solid "+gl,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{t("add_to_products",lang)}</button>
                  <button onClick={()=>setSuperItems(prev=>[...prev,o.title])} style={{fontSize:11,fontWeight:600,color:navy,background:"#fff",border:"1px solid "+gl,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{t("add_to_super",lang)}</button>
                </div>
              </div>
            ))}
          </div>}
        </div>}
      </div>{/* end body */}

      {/* LANG MISMATCH HINT */}
      {tab==="chat"&&input.trim().length>3&&(()=>{const d=detectLang(input); if(d&&d!==lang){return (<div style={{padding:"8px 16px",background:"rgba(224,123,84,.1)",borderTop:"1px solid rgba(224,123,84,.2)",fontSize:11,color:"#B5562F",lineHeight:1.4,flexShrink:0}}>💬 {t("lang_mismatch",lang).replace("{flag}",L.f+" "+L.n)}</div>);} return null;})()}
      {/* CHAT INPUT */}
      {tab==="chat"&&<div style={{display:"flex",gap:8,padding:"10px 16px",background:"#fff",borderTop:".5px solid rgba(43,58,103,.08)",flexShrink:0}}>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage(input)} placeholder={t("typehere",lang)} disabled={loading} style={{flex:1,padding:"9px 13px",borderRadius:999,border:"1.5px solid rgba(43,58,103,.15)",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
        <button onClick={recording?()=>{recRef.current?.stop();setRecording(false);}:startRec} style={{width:36,height:36,borderRadius:"50%",background:recording?coral:gl,border:"none",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{recording?"🔴":"🎙️"}</button>
        <button onClick={()=>sendMessage(input)} disabled={loading||!input.trim()} style={{width:36,height:36,borderRadius:"50%",background:navy,border:"none",color:"#fff",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:(loading||!input.trim())?0.5:1}}>➤</button>
      </div>}

      {/* TAB BAR */}
      <div style={{display:"flex",background:"#fff",borderTop:"1px solid rgba(43,58,103,.1)",flexShrink:0}}>
        {tabs.map(tb=>(
          <button key={tb.id} onClick={()=>setTab(tb.id)} style={{flex:1,display:"flex",flexDirection:"column" as any,alignItems:"center",padding:"9px 4px 7px",cursor:"pointer",border:"none",background:"none",borderTop:tab===tb.id?`2px solid ${navy}`:"2px solid transparent",fontFamily:"'DM Sans',sans-serif"}}>
            <span style={{fontSize:20,opacity:tab===tb.id?1:0.3,position:"relative" as any}}>{tb.icon}{tb.id==="shopping"&&offers.length>0&&tab!=="shopping"&&<span style={{position:"absolute",top:-1,right:-2,width:7,height:7,borderRadius:"50%",background:coral,border:"1.5px solid #fff"}}/>}</span>
            <span style={{fontSize:9,color:tab===tb.id?navy:"rgba(43,58,103,.3)",marginTop:2,fontWeight:tab===tb.id?600:400}}>{tb.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState<string|null>(localStorage.getItem(TOKEN_KEY));
  const [profile, setProfile] = useState<Profile|null>(()=>{
    const tk=localStorage.getItem(TOKEN_KEY); if(!tk)return null;
    try{return JSON.parse(localStorage.getItem(`hm_profile_${tk}`)||"null");}catch{return null;}
  });
  const [subActive, setSubActive] = useState<boolean|null>(null);
  const handleLogout=()=>{localStorage.removeItem(TOKEN_KEY);setToken(null);setProfile(null);setSubActive(null);};

  useEffect(() => {
    if (!token) { setProfile(null); return; }
    try { setProfile(JSON.parse(localStorage.getItem(`hm_profile_${token}`) || "null")); }
    catch { setProfile(null); }
  }, [token]);

  useEffect(() => {
    if (!token) { setSubActive(null); return; }
    let cancelled = false;
    axios.get(`${API}/auth/status`, { headers: { "x-token": token } })
      .then(res => { if (!cancelled) setSubActive(res.data.subscription_active !== false); })
      .catch(err => {
        if (cancelled) return;
        if (err.response?.status === 401) { handleLogout(); }
        else setSubActive(true); // fail open on network/server errors
      });
    return () => { cancelled = true; };
  }, [token]);

  if(!token)return <InviteScreen onSuccess={tk=>setToken(tk)}/>;
  if(subActive===false)return <SubscriptionExpired lang={profile?.lang||"en"} onLogout={handleLogout}/>;
  if(!profile)return <Onboarding token={token} onDone={p=>setProfile(p)}/>;
  return <MainApp token={token} profile={profile} onLogout={handleLogout} onExpired={()=>setSubActive(false)} onProfileUpdate={p=>{setProfile(p);localStorage.setItem(`hm_profile_${token}`,JSON.stringify(p));}}/>;
}
