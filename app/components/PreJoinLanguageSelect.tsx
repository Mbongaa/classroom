'use client';

import { useId } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Language options organized by region
const LANGUAGES_BY_REGION = [
  {
    region: 'Americas',
    items: [
      { value: 'en', label: 'English', flag: '🇺🇸' },
      { value: 'es', label: 'Español', flag: '🇪🇸' },
    ],
  },
  {
    region: 'Europe',
    items: [
      { value: 'fr', label: 'Français', flag: '🇫🇷' },
      { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
      { value: 'nl', label: 'Nederlands', flag: '🇳🇱' },
    ],
  },
  {
    region: 'Asia',
    items: [
      { value: 'ja', label: '日本語', flag: '🇯🇵' },
      { value: 'zh-CN', label: '中文', flag: '🇨🇳' },
    ],
  },
  {
    region: 'Middle East',
    items: [
      { value: 'ar', label: 'العربية الفصحى (Arabic Fusha)', flag: '🇸🇦' },
      { value: 'ar-mixed', label: 'عربي مختلط (Arabic Mixed)', flag: '🇸🇦' },
      { value: 'ar-darija', label: 'الدارجة (Moroccan Arabic)', flag: '🇲🇦' },
    ],
  },
];

interface PreJoinLanguageSelectProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  disabled?: boolean;
  isTeacher?: boolean;
}

const PreJoinLanguageSelect: React.FC<PreJoinLanguageSelectProps> = ({
  selectedLanguage,
  onLanguageChange,
  disabled = false,
  isTeacher = false,
}) => {
  const id = useId();

  return (
    <Select value={selectedLanguage} onValueChange={onLanguageChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue
          placeholder={isTeacher ? 'Select transcription language' : 'Select translation language'}
        />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES_BY_REGION.map((region) => (
          <SelectGroup key={region.region}>
            <SelectLabel>{region.region}</SelectLabel>
            {region.items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                <span className="flex items-center gap-2">
                  <span className="text-lg leading-none">{item.flag}</span>
                  <span className="truncate">{item.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
};

export default PreJoinLanguageSelect;
