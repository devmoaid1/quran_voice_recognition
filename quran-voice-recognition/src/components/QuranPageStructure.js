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
  

  return (
    <div className="quran-structured-page text-right p-4 border rounded bg-white dark:bg-gray-800 dark:border-gray-700 mt-0 text-2xl leading-loose transition-colors duration-300">
      {page.pageData.map((line) => {
        let lineContent = null;

        if (line.line_type === "basmallah") {
          lineContent = (
            <span className="text-2xl basmallah text-green-700 dark:text-white">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </span>
          );
        } else if (line.line_type === "surah_name") {
          const surahName = Array.isArray(page.surah_number)
            ? getSurahName(page.surah_number[
                page.pageData
                  .slice(0, line.line_number)
                  .filter((l) => l.line_type === "surah_name").length - 1
              ])
            : getSurahName(page.surah_number);
          lineContent = (
            <span className="surah-name text-2xl font-bold text-gray-800 dark:text-white">
              {surahName}
            </span>
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
                className={`quran-word px-2 cursor-pointer dark:text-white ${highlightClass} ${
                  wrongWords.includes(id) ? "text-red-600 dark:text-red-400 font-bold" : ""
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
                {wordText + " "}
              </span>
            );

            const isAyahEnd = page.ayahData?.some(
              (entry) => entry.ayah_end === wordNum
            );

            return (
              <React.Fragment key={id}>
                {wordSpan}
                {isAyahEnd && (
                  <span className="ayah-marker px-2 text-yellow-600 dark:text-yellow-400 text-3xl">
                    ۝
                  </span>
                )}
              </React.Fragment>
            );
          });
        }

        return (
          <div
            key={line.line_number}
            ref={(el) => (lineRefs.current[line.line_number] = el)}
            className={`line mb-2 px-2 py-1 rounded ${
              line.is_centered ? "text-center" : ""
            }`}
          >
            <div className="line-text">{lineContent}</div>
          </div>
        );
      })}
    </div>
  );

};

export default QuranPageStructure;
