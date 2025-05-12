import { useEffect, useState } from 'react';
import titleLogo from "../../../../assets/img/Muqri_Logo_no_background_new.png";

function Header() {
  const [showHeader, setShowHeader] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Hide header on scroll down
  useEffect(() => {
    const handleScroll = () => {
      setShowHeader(window.scrollY <= 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Apply dark mode to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 w-full z-50 bg-transparent transition-transform duration-500 ease-in-out ${
          showHeader ? 'translate-y-0' : '-translate-y-full'
        }`}
      >

        <div className="flex items-center justify-between px-4 md:px-8 py-3">
          {/* Logo and Title */}
          <div className="flex gap-2 items-center">
            <img src={titleLogo} alt="Logo" className="w-[70px] h-auto rounded-full shadow" />
            <h1 className="text-2xl font-bold text-color-custom dark:text-white tracking-wide">Muqri' - مُقْرِئ</h1>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <ul className="flex gap-6 text-gray-800 dark:text-white font-medium">
              <li>
                <a href="#home" 
                   onClick={(e) => {
                      e.preventDefault();
                      document.getElementById("home")?.scrollIntoView({ behavior: "smooth" });
                    }} 
                   className="text-color-custom hover:text-primary-hover dark:text-white dark:hover:text-gray-400 transition">Home</a></li>
              <li>
                <a
                  href="#quran"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("quran")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-color-custom hover:text-primary-hover dark:text-white dark:hover:text-gray-400 transition"
                >
                  Qur’an
                </a>
              </li>
              {/* <li><a href="#" className="text-color-custom dark:text-white hover:bg-primary-hover transition">About Us</a></li> */}
            </ul>
            <a href="#" className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-primary-hover transition shadow">
              Contact Us
            </a>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="text-xl ml-4 text-gray-800 dark:text-white hover:text-green-600 transition"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? '🌙' : '☀️'}
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setShowMobileMenu(prev => !prev)}
            className="md:hidden text-gray-800 dark:text-white"
            aria-label="Toggle Mobile Menu"
          >
            {showMobileMenu ? (
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {showMobileMenu && (
        <div className="md:hidden bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-6 py-4 shadow-md transition-all mt-20 z-40 fixed w-full">
          <ul className="flex flex-col gap-4 text-lg">
            <li><a href="#">Home</a></li>
            <li><a href="#">Services</a></li>
            <li><a href="#">About Us</a></li>
            <li>
              <a
                href="#contact"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 block text-center"
              >
                Contact Us
              </a>
            </li>
            <li className="text-center mt-2">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="text-xl hover:text-green-600"
              >
                {isDarkMode ? '🌙 Dark' : '☀️ Light'}
              </button>
            </li>
          </ul>
        </div>
      )}
    </>
  );
}

export default Header;
