import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

const QuranPageViewer = ({ selectedPage, setSelectedPage, highlightedAyah }) => {
  const totalPages = 604;
  const [pageAyahs, setPageAyahs] = useState([]);

  const getFormattedPageNumber = (page) => page.toString().padStart(3, '0');

  // Load ayahs for selected page
  useEffect(() => {
    const fetchAyahs = async () => {
      try {
        const res = await fetch(`/quran_pages_json/page_${selectedPage}.json`);
        const data = await res.json();
        setPageAyahs(data.ayahs);
      } catch (error) {
        console.error("Failed to load ayahs:", error);
      }
    };

    fetchAyahs();
  }, [selectedPage]);

  const nextPage = () => {
    if (selectedPage < totalPages) setSelectedPage(selectedPage + 1);
  };

  const prevPage = () => {
    if (selectedPage > 1) setSelectedPage(selectedPage - 1);
  };

  const goToPage = (event) => {
    const page = parseInt(event.target.value);
    if (page >= 1 && page <= totalPages) {
      setSelectedPage(page);
    }
  };

  const isAyahHighlighted = (ayah) =>
    highlightedAyah?.sura === ayah.sura && highlightedAyah?.ayah === ayah.ayah;

  return (
    <div className="quran-page-container">
      <h2 className="page-title">Page {selectedPage} / {totalPages}</h2>

      {/* Page Image */}
      <img
        src={`/quran_pages/${getFormattedPageNumber(selectedPage)}.png`}
        alt={`Quran Page ${selectedPage}`}
        className="quran-page-image"
        onError={(e) => e.target.src = "/placeholder.png"}
      />

      {/* Navigation */}
      <div className="navigation">
        <button onClick={prevPage} disabled={selectedPage === 1}>Previous</button>
        <input
          type="number"
          min="1"
          max={totalPages}
          value={selectedPage}
          onChange={goToPage}
          className="page-input"
        />
        <button onClick={nextPage} disabled={selectedPage === totalPages}>Next</button>
      </div>

      {/* Optional Debug Display for Ayahs */}
      <div className="ayah-list">
        {pageAyahs.map((ayah, idx) => (
          <div
            key={idx}
            className={`ayah-line ${isAyahHighlighted(ayah) ? "bg-purple-300" : ""}`}
          >
            {ayah.sura}:{ayah.ayah}
          </div>
        ))}
      </div>
    </div>
  );
};

QuranPageViewer.propTypes = {
  selectedPage: PropTypes.number.isRequired,
  setSelectedPage: PropTypes.func.isRequired,
  highlightedAyah: PropTypes.object
};

export default QuranPageViewer;
