/* eslint-disable jsx-a11y/anchor-is-valid */
import titleLogo from '../../../../assets/img/file.png';


import React from 'react';


function Footer() {
  return (
    <footer className="bg-[#51AC82] text-white px-4 md:px-8 py-3 flex flex-col w-full">
      <div className="flex flex-col md:flex-row justify-between py-10 w-full">
        <div className="flex gap-3 items-center">
          <img src={titleLogo} alt="Title's logo" className="w-[60px] h-[60px] md:w-[80px] md:h-[80px]" />
          {/* <h1 className="font-semibold text-xl">Title</h1> */}
        </div>
        <nav>
          <ul className="flex flex-col md:flex-row gap-5 md:gap-10 font-bold">
            <li><a href="#">About Us</a></li>
            <li><a href="#">Contact Us</a></li>
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms & Conditions</a></li>
          </ul>
        </nav>
      </div>
      <p className="text-xs py-2 border-t border-dashed text-center">
        © Title - All copyrights reserved.
      </p>
    </footer>
  );
}

export default Footer;
