/**
 * Demo data for the marketing hero. Synchronized to public/marketing/camera-preview.mp4.
 * Timings ported from bayaan-landing/components/preview/demoData.ts.
 */

export interface TimedSegment {
  id: number;
  startTime: number;
  endTime: number;
  arabic: string;
  translation: { en: string; nl: string };
}

export const timedTranscript: TimedSegment[] = [
  {
    id: 1,
    startTime: 0,
    endTime: 9,
    arabic: 'الله سبحانه وتعالى',
    translation: {
      en: 'Allah ﷻ',
      nl: 'Allah ﷻ',
    },
  },
  {
    id: 2,
    startTime: 9,
    endTime: 17,
    arabic:
      'خلق السماوات والارض بالحق ، وانزل سبحانه وتعالى الكتاب والميزان ليقوم الناس بالقسط',
    translation: {
      en: 'He ﷻ created the heavens and the earth with truth, and sent down the Book and the balance so that people may uphold justice.',
      nl: 'Hij heeft de hemelen en de aarde met de waarheid geschapen, en het Boek en de weegschaal neergezonden opdat de mensen rechtvaardig zijn.',
    },
  },
  {
    id: 3,
    startTime: 17,
    endTime: 25,
    arabic: 'لقد ارسلنا رسلنا بالبينات وأنزلنا معهم الكتاب والميزان بالقسط',
    translation: {
      en: 'Indeed, We sent Our messengers with clear proofs, and with them the Book and the balance of justice.',
      nl: 'Voorwaar, Wij zonden Onze boodschappers met duidelijke bewijzen, en met hen het Boek en de weegschaal van rechtvaardigheid.',
    },
  },
  {
    id: 4,
    startTime: 25,
    endTime: 34,
    arabic: 'فسمى الله سبحانه وتعالى العدل ميزانا',
    translation: {
      en: 'Allah ﷻ called justice a balance, because it is the instrument of fairness.',
      nl: 'Allah ﷻ noemde gerechtigheid een weegschaal, want zij is het instrument van rechtvaardigheid.',
    },
  },
  {
    id: 5,
    startTime: 34,
    endTime: 44,
    arabic: 'فينبغي على المسلم ان يستحضر هذا المعنى',
    translation: {
      en: 'A Muslim should keep this meaning in mind. It is among the greatness of Islam that it calls for justice, even toward those who differ from us in belief.',
      nl: 'Een moslim dient deze betekenis in gedachten te houden. Het is een grootsheid van de islam dat zij oproept tot gerechtigheid, zelfs tegenover wie van ons verschilt in geloof.',
    },
  },
  {
    id: 6,
    startTime: 44,
    endTime: 51,
    arabic: 'يا عباد الله',
    translation: {
      en: 'O servants of Allah.',
      nl: 'O dienaren van Allah.',
    },
  },
  {
    id: 7,
    startTime: 51,
    endTime: 60,
    arabic: 'اعدلوا هو اقرب للتقوى',
    translation: {
      en: '"Be just; that is nearer to piety."',
      nl: '"Wees rechtvaardig; dat is dichter bij godsvrucht."',
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
