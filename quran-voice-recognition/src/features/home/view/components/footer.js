/* eslint-disable jsx-a11y/anchor-is-valid */
import titleLogo from '../../../../assets/img/file.png';


function Footer() {
    return (
        <footer class="bg-[#51AC82] text-white px-8 py-3 flex flex-col">
        <div class="flex justify-between py-10">
          <div class="flex gap-3 items-center">
          <img src={titleLogo} alt="Title's logo" style={{ width: '80px', height: '80px' }} />
            {/* <h1 class="font-semibold text-xl">Title</h1> */}
          </div>
          <nav>
            <ul class="flex gap-10 font-bold">
              <li><a href="#">About Us</a></li>
              <li><a href="#">Contact Us</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms & Conditions</a></li>
            </ul>
          </nav>
        </div>
        <p class="text-xs py-2 border-t border-dashed">
          © Title - All copyrights reserved.
        </p>
      </footer>
    
    );
  }
  
  export default Footer;