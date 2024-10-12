import titleLogo from '../../../../assets/img/Title_logo.png';

function Header() {
    return (
        <header
        class="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white sticky top-0 z-10"
      >
        <div class="flex gap-3 items-center">
          <img src={titleLogo} alt="Title's logo" style={{ width: '100px', height: '100px' }} />
          {/* <h1 class="font-semibold text-2xl">Mahfouz</h1> */}
        </div>
        {/* <a href="" class="btn">Try it out!</a> */}
      </header>
    
    );
  }
  
  export default Header;