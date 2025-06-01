import React, { useEffect, useRef, useState, useCallback } from "react";
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
  const [screenSize, setScreenSize] = useState('large');
  const [lineFontSizes, setLineFontSizes] = useState({});
  const lineRefs = useRef({});
  const containerRef = useRef(null);

  // Handle screen size changes for responsive adjustments
  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    if (width <= 360) {
      setScreenSize('extra-small');
    } else if (width <= 480) {
      setScreenSize('small');
    } else if (width <= 640) {
      setScreenSize('medium');
    } else if (width <= 768) {
      setScreenSize('tablet');
    } else {
      setScreenSize('large');
    }
  }, []);

  // Function to calculate optimal font size for a line
  const calculateOptimalFontSize = useCallback((lineElement, containerWidth) => {
    if (!lineElement || !containerWidth) return null;
    
    const textElement = lineElement.querySelector('.line-text');
    if (!textElement) return null;

    // Base font sizes for different screen sizes
    const baseFontSizes = {
      'extra-small': 16,
      'small': 18,
      'medium': 20,
      'tablet': 22,
      'large': 24
    };

    let fontSize = baseFontSizes[screenSize] || 20;
    const minFontSize = screenSize === 'extra-small' ? 12 : 14;
    const maxFontSize = baseFontSizes[screenSize] * 1.2 || 28;

    // Set initial font size
    textElement.style.fontSize = `${fontSize}px`;
    
    // Reduce font size until text fits
    while (textElement.scrollWidth > containerWidth && fontSize > minFontSize) {
      fontSize -= 0.5;
      textElement.style.fontSize = `${fontSize}px`;
    }

    // If text is much smaller than container, increase font size
    while (textElement.scrollWidth < containerWidth * 0.85 && fontSize < maxFontSize) {
      const testSize = fontSize + 0.5;
      textElement.style.fontSize = `${testSize}px`;
      if (textElement.scrollWidth > containerWidth) {
        textElement.style.fontSize = `${fontSize}px`;
        break;
      }
      fontSize = testSize;
    }

    return fontSize;
  }, [screenSize]);

  // Adjust font sizes for all lines
  const adjustLineFontSizes = useCallback(() => {
    if (!containerRef.current || !page?.pageData) return;

    const containerWidth = containerRef.current.offsetWidth - 32; // Account for padding
    const newFontSizes = {};

    page.pageData.forEach((line) => {
      const lineElement = lineRefs.current[line.line_number];
      if (lineElement && !isSpecialLine(line)) {
        const optimalSize = calculateOptimalFontSize(lineElement, containerWidth);
        if (optimalSize) {
          newFontSizes[line.line_number] = optimalSize;
        }
      }
    });

    setLineFontSizes(newFontSizes);
  }, [page, calculateOptimalFontSize]);

  // Move handleWordClick hook to top level (before any early returns)
  const handleWordClick = useCallback((wordNum) => {
    if (!page?.ayahData) return;
    
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
  }, [page?.ayahData, onAyahClick]);

  // Get responsive class names based on screen size
  const getResponsiveClasses = useCallback(() => {
    const baseClasses = "quran-structured-page";
    return baseClasses;
  }, []);

  const isSpecialLine = useCallback((line) => {
    return line.line_type === "basmallah" || line.line_type === "surah_name";
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    if (pageNumber) {
      fetch(`/NEW_fixed_quran_pages/page_${pageNumber}_ayahs_updated.json`)
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

  // Adjust font sizes when page loads or screen size changes
  useEffect(() => {
    if (page && page.pageData) {
      // Use setTimeout to ensure DOM is rendered
      setTimeout(() => {
        adjustLineFontSizes();
      }, 100);
    }
  }, [page, screenSize, adjustLineFontSizes]);

  // Re-adjust on window resize
  useEffect(() => {
    const handleResizeWithDelay = () => {
      setTimeout(() => {
        adjustLineFontSizes();
      }, 150);
    };

    window.addEventListener('resize', handleResizeWithDelay);
    return () => window.removeEventListener('resize', handleResizeWithDelay);
  }, [adjustLineFontSizes]);

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
        const scrollOptions = {
          behavior: "smooth",
          block: screenSize === 'large' ? "center" : "start",
          inline: "nearest"
        };
        
        setTimeout(() => {
          lineRefs.current[lineWithAyah.line_number].scrollIntoView(scrollOptions);
        }, 100);
      }
    }
  }, [highlightedAyah, page, screenSize]);

  // Early return after all hooks have been called
  if (!page || !page.pageData || !page.wordData || !page.ayahData) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-2"></div>
          Loading Quran page...
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={getResponsiveClasses()}
    >
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
          
          lineContent = (
            <div className="surah-svg-wrapper">
              <img
                src="/assets/surah_border_sym4.svg"
                alt="Surah border"
                className="surah-svg-frame"
                loading="lazy"
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
            const wordEntry = page.wordData[id];
            const wordText = wordEntry?.glyph || '';
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
                } cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200`}
                onClick={() => handleWordClick(wordNum)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleWordClick(wordNum);
                  }
                }}
                aria-label={`Quran word ${wordNum}`}
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
                  <span 
                    className="ayah-marker text-yellow-600 dark:text-yellow-400"
                    aria-label={`End of ayah ${matchingAyah.ayahID}`}
                  >
                    {markerSymbol}
                  </span>
                )}
                {" "}
              </React.Fragment>
            );
          });
        }

        // Get the dynamic font size for this line
        const dynamicFontSize = lineFontSizes[line.line_number];

        return (
          <div
            key={line.line_number}
            ref={(el) => (lineRefs.current[line.line_number] = el)}
            className={`line ${isSpecialLine(line) ? "is-centered" : ""}`}
            style={{
              minHeight: 'fit-content',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            <div 
              className="line-text"
              style={{
                width: '100%',
                fontSize: dynamicFontSize ? `${dynamicFontSize}px` : undefined,
                whiteSpace: 'nowrap',
                textAlign: isSpecialLine(line) ? 'center' : 'justify',
                lineHeight: dynamicFontSize ? `${dynamicFontSize * 1.3}px` : undefined,
                transition: 'font-size 0.3s ease'
              }}
            >
              {lineContent}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default QuranPageStructure;