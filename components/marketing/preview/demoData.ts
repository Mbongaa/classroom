/**
 * Demo data for the marketing hero. Synchronized to public/marketing/camera-preview.mp4.
 * Timings ported from bayaan-landing/components/preview/demoData.ts.
 */

export type SegmentLocale = 'en' | 'nl' | 'de' | 'fr' | 'ar';

export interface TimedSegment {
  id: number;
  startTime: number;
  endTime: number;
  arabic: string;
  translation: Record<SegmentLocale, string>;
}

export const timedTranscript: TimedSegment[] = [
  {
    id: 1,
    startTime: 0,
    endTime: 3,
    arabic: 'الله سبحانه وتعالى',
    translation: {
      en: 'Allah ﷻ',
      nl: 'Allah ﷻ',
      de: 'Allah ﷻ',
      fr: 'Allah ﷻ',
      ar: 'الله ﷻ',
    },
  },
  // Segment 2 was originally one long line (~8s). Split around the comma so
  // each clause appears as its own translation card — cleaner cadence and
  // matches the imam's natural breath in the source video. With the 2s
  // processing delay, startTime: 3 lands the card on screen at video time 5s.
  {
    id: 2,
    startTime: 3,
    endTime: 9,
    arabic: 'خلق السماوات والارض بالحق ،',
    translation: {
      en: 'He ﷻ created the heavens and the earth with truth,',
      nl: 'Hij heeft de hemelen en de aarde met de waarheid geschapen,',
      de: 'Er ﷻ erschuf die Himmel und die Erde mit der Wahrheit,',
      fr: 'Il ﷻ a créé les cieux et la terre avec la vérité,',
      ar: 'خَلَقَ السَّماوَاتِ وَالأرضَ بِالحَقِّ،',
    },
  },
  {
    id: 3,
    startTime: 9,
    endTime: 17,
    arabic: 'وانزل سبحانه وتعالى الكتاب والميزان ليقوم الناس بالقسط',
    translation: {
      en: 'and sent down the Book and the balance so that people may uphold justice.',
      nl: 'en het Boek en de weegschaal neergezonden opdat de mensen rechtvaardig zijn.',
      de: 'und sandte das Buch und die Waage herab, damit die Menschen Gerechtigkeit wahren.',
      fr: 'et a fait descendre le Livre et la balance afin que les gens établissent la justice.',
      ar: 'وَأنزَلَ الكِتَابَ وَالمِيزَانَ لِيَقُومَ النَّاسُ بِالقِسْطِ.',
    },
  },
  // Quranic ayah (Sūrat al-Ḥadīd 57:25). The (Qur'an x:y) citation already
  // marks this as a verse, so the ornament brackets ﴾ ﴿ would be redundant.
  {
    id: 4,
    startTime: 17,
    endTime: 25,
    arabic: 'لَقَدْ أَرْسَلْنَا رُسُلَنَا بِالْبَيِّنَاتِ وَأَنزَلْنَا مَعَهُمُ الْكِتَابَ وَالْمِيزَانَ لِيَقُومَ النَّاسُ بِالْقِسْطِ',
    translation: {
      en: 'Indeed, We sent Our messengers with clear proofs, and sent down with them the Book and the balance, that the people may uphold justice. (Qur’an 57:25)',
      nl: 'Voorzeker, Wij zonden Onze boodschappers met duidelijke bewijzen, en zonden met hen het Boek en de weegschaal neer, opdat de mensen gerechtigheid handhaven. (Qur’an 57:25)',
      de: 'Wahrlich, Wir entsandten Unsere Gesandten mit klaren Beweisen und sandten mit ihnen das Buch und die Waage herab, damit die Menschen Gerechtigkeit wahren. (Qur’an 57:25)',
      fr: 'Certes, Nous avons envoyé Nos messagers avec des preuves évidentes, et fait descendre avec eux le Livre et la balance, afin que les gens établissent la justice. (Qur’an 57:25)',
      ar: 'لَقَدْ أَرْسَلْنَا رُسُلَنَا بِالْبَيِّنَاتِ وَأَنزَلْنَا مَعَهُمُ الْكِتَابَ وَالْمِيزَانَ لِيَقُومَ النَّاسُ بِالْقِسْطِ. (القرآن ٥٧:٢٥)',
    },
  },
  {
    id: 5,
    startTime: 25,
    endTime: 34,
    arabic: 'فسمى الله سبحانه وتعالى العدل ميزانا',
    translation: {
      en: 'Allah ﷻ called justice a balance, because it is the instrument of fairness.',
      nl: 'Allah ﷻ noemde gerechtigheid een weegschaal, want zij is het instrument van rechtvaardigheid.',
      de: 'Allah ﷻ nannte die Gerechtigkeit eine Waage, denn sie ist das Werkzeug der Fairness.',
      fr: 'Allah ﷻ a appelé la justice une balance, car elle est l’instrument de l’équité.',
      ar: 'سَمَّى اللهُ ﷻ العَدْلَ مِيزَاناً، لأنَّهُ أداةُ الإنصافِ.',
    },
  },
  {
    id: 6,
    startTime: 34,
    endTime: 44,
    arabic: 'فينبغي على المسلم ان يستحضر هذا المعنى',
    translation: {
      en: 'A Muslim should keep this meaning in mind. It is among the greatness of Islam that it calls for justice, even toward those who differ from us in belief.',
      nl: 'Een moslim dient deze betekenis in gedachten te houden. Het is een grootsheid van de islam dat zij oproept tot gerechtigheid, zelfs tegenover wie van ons verschilt in geloof.',
      de: 'Ein Muslim sollte diese Bedeutung im Sinn behalten. Es gehört zur Größe des Islam, dass er zur Gerechtigkeit aufruft, selbst gegenüber jenen, die im Glauben von uns abweichen.',
      fr: 'Un musulman devrait garder ce sens à l’esprit. C’est l’une des grandeurs de l’islam qu’il appelle à la justice, même envers ceux qui diffèrent de nous dans la croyance.',
      ar: 'يَنْبَغي على المسلمِ أن يستحضرَ هذا المعنى. ومِنْ عَظَمَةِ الإسلامِ أنَّهُ يَدْعو إلى العَدْلِ حتى مع من خالَفَنا في الاعتقاد.',
    },
  },
  {
    id: 7,
    startTime: 44,
    endTime: 51,
    arabic: 'يا عباد الله',
    translation: {
      en: 'O servants of Allah.',
      nl: 'O dienaren van Allah.',
      de: 'O Diener Allahs.',
      fr: 'Ô serviteurs d’Allah.',
      ar: 'يا عِبادَ الله.',
    },
  },
  // Quranic ayah (Sūrat al-Māʾidah 5:8). Same plain-citation treatment as
  // the earlier verse so the panel reads consistently when ayahs land.
  {
    id: 8,
    startTime: 51,
    endTime: 60,
    arabic: 'اعْدِلُوا هُوَ أَقْرَبُ لِلتَّقْوَى',
    translation: {
      en: 'Be just; that is nearer to piety. (Qur’an 5:8)',
      nl: 'Wees rechtvaardig; dat is dichter bij godsvrucht. (Qur’an 5:8)',
      de: 'Seid gerecht; das ist näher zur Gottesfurcht. (Qur’an 5:8)',
      fr: 'Soyez justes; cela est plus proche de la piété. (Qur’an 5:8)',
      ar: 'اعْدِلُوا هُوَ أَقْرَبُ لِلتَّقْوَى. (القرآن ٥:٨)',
    },
  },
];

export const arabicWordStream: string[] = [
  'الله',
  'سبحانه',
  'وتعالى',
  'خلق',
  'السماوات',
  'والارض',
  'بالحق',
  '،',
  'وانزل',
  'سبحانه',
  'وتعالى',
  'الكتاب',
  'والميزان',
  'ليقوم',
  'الناس',
  'بالقسط',
  '،',
  'كما',
  'بين',
  'سبحانه',
  'وتعالى',
  'لقد',
  'ارسلنا',
  'رسلنا',
  'بالبينات',
  'وأنزلنا',
  'معهم',
  'الكتاب',
  'والميزان',
  'بالقسط',
  'فسمى',
  'الله',
  'سبحانه',
  'وتعالى',
  'العدل',
  'ميزانا',
  'لانها',
  'اله',
  'العدل',
  'والانصاف',
  'فينبغي',
  'على',
  'المسلم',
  'ان',
  'يستحضر',
  'هذا',
  'المعنى',
  'يا',
  'عباد',
  'الله',
  'انظر',
  'الى',
  'قول',
  'الله',
  'سبحانه',
  'وتعالى',
  'اعدلوا',
  'هو',
  'اقرب',
  'للتقوى',
];

export const VENUE_NAME = 'Al Furqaan';
export const SPEAKER_LABEL = 'Imam Camera';
