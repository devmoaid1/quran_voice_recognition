import React, { useEffect, useRef, useState } from "react";
import { SurahNames } from "../core/constants/surah_name";
import "../Quran.css";

function getSurahName(number) {
  return `سورة ${SurahNames[number]}`;
}

const QuranPageStructure = ({
  pageNumber,
  highlightedAyah,
  onAyahClick,
  wrongWords = [],
  matchedWords = [],
}) => {
  const [page, setPage] = useState(null);
  const [selectedAyah, setSelectedAyah] = useState(null);
  const [ayahMarkerMap, setAyahMarkerMap] = useState({});
  const lineRefs = useRef({});

  useEffect(() => {
    if (pageNumber) {
      fetch(`/updated_quran_pages/page_${pageNumber}_ayahs.json`)
        .then((res) => res.json())
        .then((data) => {
          setPage(data[pageNumber]);
        })
        .catch((err) => {
          console.error(`Failed to load page data for page ${pageNumber}`, err);
        });
    }
  }, [pageNumber]);

  useEffect(() => {
    fetch("/ayah_markers/all_ayah_markers.json")
      .then((res) => res.json())
      .then(setAyahMarkerMap)
      .catch((err) => {
        console.error("Failed to load ayah marker map:", err);
      });
  }, []);

  useEffect(() => {
    if (!highlightedAyah || !page || !page.ayahData) return;

    const match = page.ayahData.find(
      (entry) =>
        parseInt(entry.surahID) === parseInt(highlightedAyah.sura) &&
        parseInt(entry.ayahID) === parseInt(highlightedAyah.ayah)
    );

    if (match) {
      const lineWithAyah = page.pageData.find(
        (line) =>
          line.first_word_id !== null &&
          line.last_word_id !== null &&
          match.ayah_begin >= line.first_word_id &&
          match.ayah_end <= line.last_word_id
      );

      console.log(`🔍 Highlighted Ayah: Surah ${match.surahID}, Ayah ${match.ayahID}, Word Range: ${match.ayah_begin} → ${match.ayah_end}`);

      if (lineWithAyah && lineRefs.current[lineWithAyah.line_number]) {
        lineRefs.current[lineWithAyah.line_number].scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [highlightedAyah, page]);

  if (!page || !page.pageData || !page.wordData || !page.ayahData) {
    return <div>Loading Quran page...</div>;
  }

  const isSpecialLine = (line) => {
    return line.line_type === "basmallah" || line.line_type === "surah_name";
  };

  return (
    <div className="quran-structured-page">
      {page.pageData.map((line) => {
        let lineContent = null;

        if (line.line_type === "basmallah") {
          lineContent = (
            <span className="basmallah text-green-700 dark:text-green-400">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </span>
          );
        } else if (line.line_type === "surah_name") {
          const surahName = Array.isArray(page.surah_number)
            ? getSurahName(
                page.surah_number[
                  page.pageData
                    .slice(0, line.line_number)
                    .filter((l) => l.line_type === "surah_name").length - 1
                ]
              )
            : getSurahName(page.surah_number);
          // lineContent = <span className="surah-name">{surahName}</span>;
          lineContent = (
            <div className="surah-svg-wrapper">
              <img
                src="/assets/surah_border_sym4.svg"
                alt="Surah border"
                className="surah-svg-frame"
              />
              <span className="surah-svg-text">{surahName}</span>
            </div>
          );
        } else if (line.text) {
          lineContent = line.text;
        } else if (
          line.first_word_id !== null &&
          line.last_word_id !== null &&
          page.wordData
        ) {
          const wordIds = Array.from(
            { length: line.last_word_id - line.first_word_id + 1 },
            (_, i) => (line.first_word_id + i).toString()
          );

          lineContent = wordIds.map((id) => {
            const wordNum = parseInt(id);
            const wordText = page.wordData[id];
            if (!wordText) return null;

            let isHighlighted = false;
            let isMatchedWord = matchedWords.includes(id);

            if (highlightedAyah && page.ayahData) {
              const match = page.ayahData.find(
                (entry) =>
                  parseInt(entry.surahID) === parseInt(highlightedAyah.sura) &&
                  parseInt(entry.ayahID) === parseInt(highlightedAyah.ayah)
              );
              if (match) {
                isHighlighted =
                  wordNum >= match.ayah_begin && wordNum <= match.ayah_end;
              }
            }

            let highlightClass = "";
            if (isMatchedWord) {
              highlightClass =
                "text-green-500 dark:text-green-300 font-semibold transition-all duration-500 ease-in-out";
            } else if (isHighlighted) {
              highlightClass =
                "bg-yellow-200 dark:bg-yellow-400/30 transition-all duration-300 ease-in-out";
            }

            const wordSpan = (
              <span
                key={id}
                className={`quran-word ${highlightClass} ${
                  wrongWords.includes(id)
                    ? "text-red-600 dark:text-red-400 font-bold"
                    : ""
                }`}
                onClick={() => {
                  const clickedAyah = page.ayahData.find(
                    (entry) =>
                      wordNum >= entry.ayah_begin &&
                      wordNum <= entry.ayah_end
                  );
                  if (clickedAyah) {
                    setSelectedAyah({
                      sura: clickedAyah.surahID,
                      ayah: clickedAyah.ayahID,
                    });
                    onAyahClick?.({
                      sura: clickedAyah.surahID,
                      ayah: clickedAyah.ayahID,
                    });
                  }
                }}
              >
                {wordText}
              </span>
            );

            const matchingAyah = page.ayahData.find(
              (entry) => entry.ayah_end === wordNum
            );
            const markerSymbol = matchingAyah
              ? ayahMarkerMap?.[matchingAyah.ayahID]
              : null;

            return (
              <React.Fragment key={id}>
                {wordSpan}
                {markerSymbol && (
                  <span className="ayah-marker text-yellow-600 dark:text-yellow-400 text-1xl">
                    {markerSymbol}
                  </span>
                )}
                {" "}
              </React.Fragment>
            );
          });
        }

        return (
          <div
            key={line.line_number}
            ref={(el) => (lineRefs.current[line.line_number] = el)}
            className={`line ${isSpecialLine(line) ? "is-centered" : ""}`}
          >
            <div className="line-text">{lineContent}</div>
          </div>
        );
      })}
    </div>
  );
};

export default QuranPageStructure;
