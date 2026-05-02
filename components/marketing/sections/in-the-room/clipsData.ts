/**
 * Mosque clips registry for the "In the Room" video sections.
 * Single source of truth — swap `videoSrc` per clip when real footage drops.
 *
 * `drips` are timed translation snippets (seconds-into-video) used by
 * MosqueTranslationDrip to render paper-strip captions in lockstep with playback.
 * Keep the durations short — the drip strip should feel like the listener's
 * phone catching up ~2.5s behind the imam.
 */
export type DripLine = {
  /** Seconds into clip when this caption should appear. */
  at: number;
  /** Source language phrase (Arabic). */
  ar: string;
  /** Translated phrase shown to the listener. */
  translation: string;
  /** Listener's chosen target — pinned per clip. */
  lang: 'NL' | 'EN' | 'DE' | 'FR' | 'TR';
};

export type MosqueClip = {
  id: string;
  city: string;
  country: string;
  /** "AR → NL", etc. — lives on the masking-tape label. */
  pair: string;
  /** Optional speaker attribution shown below the city name. */
  speaker?: string;
  /** Short context line — handwritten chip below the polaroid. */
  context: string;
  videoSrc: string;
  /** Where playback should start (lets one mp4 stand in for many clips). */
  startAt?: number;
  drips: DripLine[];
};

const VISU_5 = '/marketing/visu5.mp4';
const VISU_3 = '/marketing/visu3.mp4';
const VISU_6 = '/marketing/visu6.mp4';
const VISU_7 = '/marketing/visu7.mp4';
const VISU_1_STILL = '/marketing/visu1.jpg';

export const mosqueClips: MosqueClip[] = [
  {
    id: 'rotterdam-friday',
    city: 'Rotterdam',
    country: 'NL',
    pair: 'AR → NL',
    context: 'Friday khutbah · 1,200 listeners',
    videoSrc: VISU_5,
    startAt: 0,
    drips: [
      { at: 2.4, ar: 'الحمد لله رب العالمين', translation: 'Alle lof komt toe aan Allah, Heer der werelden', lang: 'NL' },
      { at: 7.8, ar: 'إن أحسن الحديث كتاب الله', translation: 'Voorzeker, de beste woorden zijn de woorden van Allah', lang: 'NL' },
      { at: 13.4, ar: 'وخير الهدي هدي محمد ﷺ', translation: 'En de beste leiding is de leiding van Mohammed ﷺ', lang: 'NL' },
      { at: 19.2, ar: 'فاتقوا الله حق تقاته', translation: 'Vrees Allah zoals Hij gevreesd dient te worden', lang: 'NL' },
    ],
  },
  {
    id: 'eindhoven-tafsir',
    city: 'Eindhoven',
    country: 'NL',
    pair: 'AR → NL',
    speaker: 'Sheikh Mamdouh',
    context: 'Tafsir halaqa · Surah Al-Kahf',
    videoSrc: VISU_3,
    startAt: 0,
    drips: [
      { at: 2.6, ar: 'سورة الكهف فيها أربع قصص', translation: 'Soera Al-Kahf bevat vier verhalen', lang: 'NL' },
      { at: 9.2, ar: 'أصحاب الكهف، الجنتين، موسى، ذو القرنين', translation: 'De mensen van de grot, de twee tuinen, Moesa, en Dhoel-Qarnayn', lang: 'NL' },
      { at: 16.0, ar: 'فيها فتنة الدين والمال والعلم والملك', translation: 'Hierin liggen de beproevingen van geloof, rijkdom, kennis en macht', lang: 'NL' },
    ],
  },
  {
    id: 'eindhoven-tarawih',
    city: 'Eindhoven',
    country: 'NL',
    pair: 'AR → NL',
    context: 'Ramadan tarawih · Q&A',
    videoSrc: VISU_6,
    startAt: 0,
    drips: [
      { at: 2.4, ar: 'بسم الله الرحمن الرحيم', translation: 'In de naam van Allah, de Erbarmer, de Meest Barmhartige', lang: 'NL' },
      { at: 8.6, ar: 'الصيام جنة من النار', translation: 'Het vasten is een schild tegen het Vuur', lang: 'NL' },
      { at: 15.2, ar: 'إنما الأعمال بالنيات', translation: 'De daden worden slechts beoordeeld naar hun intenties', lang: 'NL' },
    ],
  },
  {
    id: 'maaseik-halaqa',
    city: 'Maaseik',
    country: 'BE',
    pair: 'AR → NL',
    context: 'Youth halaqa · seerah',
    videoSrc: VISU_1_STILL,
    startAt: 0,
    drips: [
      { at: 2.4, ar: 'كان النبي ﷺ خلقه القرآن', translation: 'Het karakter van de Profeet ﷺ was de Koran zelf', lang: 'NL' },
      { at: 8.8, ar: 'ما خير بين أمرين إلا اختار أيسرهما', translation: 'Wanneer hij voor twee zaken stond, koos hij altijd de makkelijkste', lang: 'NL' },
      { at: 15.6, ar: 'ما لم يكن إثما', translation: 'Zolang het maar geen zonde was', lang: 'NL' },
    ],
  },
  {
    id: 'eindhoven-eid',
    city: 'Eindhoven',
    country: 'NL',
    pair: 'AR → NL',
    speaker: 'Sheikh Haitham',
    context: 'Eid khutbah · open prayer',
    videoSrc: VISU_7,
    startAt: 0,
    drips: [
      { at: 2.4, ar: 'تقبل الله منا ومنكم', translation: 'Moge Allah het van ons en van jullie aanvaarden', lang: 'NL' },
      { at: 9.0, ar: 'العيد فرحة وشكر', translation: 'Het feest is vreugde en dankbaarheid', lang: 'NL' },
      { at: 15.6, ar: 'وصلة للأرحام', translation: 'En een verbinding van de familiebanden', lang: 'NL' },
    ],
  },
];

export function getClipById(id: string): MosqueClip {
  return mosqueClips.find((c) => c.id === id) ?? mosqueClips[0];
}
