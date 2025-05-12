/* eslint-disable jsx-a11y/anchor-is-valid */
import { useEffect, useState } from 'react';
import frame from '../../../../assets/img/frame.svg';
import hero from '../../../../assets/img/hero.svg';
import slide1 from '../../../../assets/img/slide_1.png';

function InfoSection() {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  const quotes = [
    `It will be said to the one devoted to the Qur’an: Read, ascend, and recite with deliberation as you used to recite in the world. Your rank will be at the last verse you recite.`,
    `Whoever recites a letter from the Book of Allah, he will be credited with a good deed... Alif is a letter, Lam is a letter and Mim is a letter.`
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prevIndex) => (prevIndex + 1) % quotes.length);
    }, 7000); // flip every 7 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="home"
      className="relative bg-cover bg-center bg-no-repeat px-6 md:px-12 lg:px-20 py-20 md:py-28 lg:py-32 transition-colors duration-500"
      style={{ backgroundImage: `url(${slide1})` }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black bg-opacity-60 z-0"></div>

      {/* Text Content */}
      <div className="relative z-10 max-w-2xl flex flex-col justify-center gap-8 text-left text-white">
        <h1 className="text-3xl text-color-custom md:text-4xl lg:text-5xl font-extrabold leading-tight">
          YOUR AI QURAN COMPANION
        </h1>

        <p className="relative text-lg md:text-xl">
          The Prophet <span className="italic">(ﷺ)</span> said:
        </p>

        <blockquote className="relative text-xl md:text-2xl font-semibold pl-6 transition-opacity duration-1000 ease-in-out">
          <span className="absolute left-0 -top-2 text-4xl text-color-custom">“</span>
          <span key={currentQuoteIndex} className="inline-block animate-fadeInSlide">
            {quotes[currentQuoteIndex]}
          </span>
          <span className="absolute right-0 -bottom-2 text-4xl text-color-custom">”</span>
        </blockquote>

        <a
          href="#"
          className="mt-20 inline-block bg-primary hover:bg-primary-hover text-white font-medium py-3 px-6 rounded-lg shadow-md transition"
        >
          Try it out!
        </a>
      </div>
    </section>
  );
}

export default InfoSection;
