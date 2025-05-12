import React, { useState, useEffect } from "react";

const QuranTextView = ({ selectedSurah, transcription, mismatches, highlightedAyah }) => {
  const [ayahs, setAyahs] = useState([]);
  const [surahName, setSurahName] = useState("");

  useEffect(() => {
    if (selectedSurah) {
      fetch(`/quran_data.json`)
        .then((response) => response.json())
        .then((data) => {
          setSurahName(data[selectedSurah].name);
          setAyahs(data[selectedSurah].ayahs);
        })
        .catch((error) => console.error("Error loading Quran text:", error));
    }
  }, [selectedSurah]);

  const getMatchedAyah = () => {
    if (!highlightedAyah) return null;
    return ayahs.find(
      (ayah) =>
        ayah.number === highlightedAyah.ayah || ayah.ayah === highlightedAyah.ayah
    );
  };

  const getMistakeWords = () => {
    if (!mismatches || mismatches === "No mismatches detected") return [];
    return mismatches
      .split(",")
      .map((pair) => pair.split("→")[0].trim())
      .filter(Boolean);
  };

  const matchedAyah = getMatchedAyah();
  const mistakeWords = getMistakeWords();

  const renderHighlightedAyah = () => {
    if (!matchedAyah) return null;
    const words = matchedAyah.text.split(" ");

    return (
      <p className="ayah text-2xl leading-loose">
        {words.map((word, i) => {
          const isMistake = mistakeWords.includes(word);
          return (
            <span
              key={i}
              className={isMistake ? "text-red-600 font-bold" : ""}
            >
              {word + " "}
            </span>
          );
        })}
        <span className="ayah-number font-semibold">﴿{matchedAyah.number}﴾</span>
      </p>
    );
  };

  return (
    <div className="quran-text-container w-full max-w-3xl">
      <h2 className="text-xl font-bold mb-4">{surahName}</h2>

      {/* Only show matched ayah if available */}
      {renderHighlightedAyah()}

      {/* Optional: Show full Surah below */}
      {/* <div className="ayahs text-lg text-gray-700 mt-8">
        {ayahs.map((ayah) => (
          <p key={ayah.number} className="ayah leading-relaxed">
            {ayah.text} <span className="ayah-number">﴿{ayah.number}﴾</span>
          </p>
        ))}
      </div> */}
    </div>
  );
};

export default QuranTextView;
