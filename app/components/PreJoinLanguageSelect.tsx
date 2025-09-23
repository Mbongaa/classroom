"use client";

import React from "react";

// Hardcoded language options for PreJoin
// These match the SUPPORTED_LANGUAGES in the Python agent
const PREJOIN_LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
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
  return (
    <div className="flex flex-col gap-2 w-full">
      <label
        htmlFor="prejoin-language-select"
        className="text-sm font-medium text-gray-300"
      >
        {isTeacher ? "Speaking Language" : "Caption Language (for translations)"}
      </label>
      <select
        id="prejoin-language-select"
        value={selectedLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm border border-gray-600 rounded-md
                 bg-gray-800 text-white focus:outline-none focus:ring-2
                 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {PREJOIN_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-400">
        {isTeacher
          ? "Select the language you'll be speaking in for accurate transcription"
          : "Teacher's speech will be translated to this language"}
      </p>
    </div>
  );
};

export default PreJoinLanguageSelect;