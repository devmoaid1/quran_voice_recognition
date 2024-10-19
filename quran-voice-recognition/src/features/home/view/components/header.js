import titleLogo from '../../../../assets/img/Title_logo.png';

function Header() {
  return (
      <header
          className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white sticky top-0 z-50 "
      >
          <div className="flex gap-3 items-center">
              <img src={titleLogo} alt="Title's logo" className="w-20 sm:w-20 md:w-28 lg:w-32 h-20 sm:h-20 md:h-28 lg:h-32" />
              {/* <h1 className="font-semibold text-2xl">Mahfouz</h1> */}
          </div>
          {/* <a href="" className="btn">Try it out!</a> */}
      </header>
  );
}

export default Header;
