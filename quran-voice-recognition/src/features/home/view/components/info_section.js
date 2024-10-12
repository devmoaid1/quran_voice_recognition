import frame from '../../../../assets/img/frame.svg'
import hero from '../../../../assets/img/hero.svg'


function InfoSection() {
    return (
        <section class="grid grid-cols-2 h-min">
        <div class="flex flex-col justify-center gap-12 px-16 py-28">
          <h1 class="text-4xl font-bold">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit
          </h1>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat.
          </p>
          <a href="" class="btn w-full flex justify-center">Try it out!</a>
        </div>
        <div class="relative">
          <div class="absolute w-full h-full flex items-center justify-center">
            <img src={hero} class="drop-shadow-md" />
          </div>
          <div class="flex items-center justify-center w-full h-full">
            <img src={frame} />
          </div>
        </div>
      </section>
    
    );
  }
  
  export default InfoSection;