/* eslint-disable jsx-a11y/anchor-is-valid */
import titleLogo from "../../../../assets/img/Muqri_Logo_no_background_white.png";
import React from 'react';

function Footer() {
  return (
    <footer className="px-6 md:px-8 py-16 bg-primary text-white dark:bg-gray-900 transition-colors duration-500 w-full">
      <div className="max-w-6xl mx-auto">

        {/* Top Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          
          {/* Logo & Description */}
          <div>
            <div className="flex gap-3 items-center mb-4">
              <img src={titleLogo} alt="Muqri Logo" className="w-[60px] h-auto" />
              <h1 className="text-color-custom dark:text-white font-bold text-xl">Muqri' - مُقْرِئ</h1>
            </div>
            <p className="text-gray-400">
              Empowering Quran learning through interactive transcription.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-color-custom dark:text-white text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-gray-400">
              <li>
                <a 
                  href="#home" 
                  onClick={(e) => {
                      e.preventDefault();
                      document.getElementById("home")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  className="hover:text-white transition">Home</a></li>
              <li>
                <a 
                  href="#quran" 
                  onClick={(e) => {
                      e.preventDefault();
                      document.getElementById("quran")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  className="hover:text-white transition">Qur’an</a></li>
              {/* <li><a href="#" className="hover:text-white transition">About Us</a></li> */}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-color-custom dark:text-white text-lg font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#contact" className="hover:text-white transition">Get in Touch</a></li>
            </ul>
          </div>

          {/* Social Media */}
          <div>
            <h3 className="text-color-custom dark:text-white text-lg font-semibold mb-4">Follow Us</h3>
            <div className="flex gap-4">
              {[
                { href: "#", title: "Facebook" },
                { href: "#", title: "Twitter" },
                { href: "#", title: "YouTube" },
                { href: "#", title: "LinkedIn" },
              ].map((social, idx) => (
                <a
                  key={idx}
                  href={social.href}
                  className="bg-primary-hover hover:bg-social-media-hover dark:bg-gray-800 dark:hover:bg-gray-600 p-2 rounded-full transition"
                  aria-label={social.title}
                >
                  <svg fill="currentColor" className="w-5 h-5" viewBox="0 0 24 24">
                    <use href={`#icon-${social.title.toLowerCase()}`} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-300 mt-12 pt-6 text-center text-sm text-gray-400">
          © 2025 Muqri' - مُقْرِئ. All rights reserved.
        </div>
      </div>

      {/* SVG Icons Definition (can move to index.html or separate component) */}
      <svg className="hidden">
        <symbol id="icon-facebook" viewBox="0 0 24 24">
          <path d="M22.675 0h-21.35A1.325 1.325 0 000 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116A1.323 1.323 0 0024 22.676V1.325A1.325 1.325 0 0022.675 0z" />
        </symbol>
        <symbol id="icon-twitter" viewBox="0 0 24 24">
          <path d="M24 4.557a9.837 9.837 0 01-2.828.775 4.932 4.932 0 002.165-2.724 9.865 9.865 0 01-3.127 1.195 4.916 4.916 0 00-8.384 4.482C7.691 8.094 4.066 6.13 1.64 3.161a4.822 4.822 0 00-.666 2.475c0 1.708.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.919 4.919 0 003.946 4.827 4.996 4.996 0 01-2.224.084 4.928 4.928 0 004.604 3.417A9.867 9.867 0 010 19.54a13.94 13.94 0 007.548 2.212c9.056 0 14.01-7.504 14.01-14.009 0-.213-.005-.425-.014-.636A10.025 10.025 0 0024 4.557z" />
        </symbol>
        <symbol id="icon-youtube" viewBox="0 0 24 24">
          <path d="M19.615 3.184C16.011 2.938 7.984 2.939 4.385 3.184 0.488 3.45 0.029 5.805 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zM9 15.999v-8l8 3.993-8 4.007z" />
        </symbol>
        <symbol id="icon-linkedin" viewBox="0 0 24 24">
          <path d="M19 0H5C2.239 0 0 2.239 0 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5V5c0-2.761-2.238-5-5-5zM8 19H5v-11h3v11zM6.5 6.732a1.764 1.764 0 110-3.528 1.764 1.764 0 010 3.528zM19 19h-3v-5.604c0-3.368-4-3.113-4 0V19h-3v-11h3v1.765C13.396 7.179 19 6.988 19 12.241V19z" />
        </symbol>
      </svg>
    </footer>
  );
}

export default Footer;
