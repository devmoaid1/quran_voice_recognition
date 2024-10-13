import frame from '../../../../assets/img/frame.svg'
import hero from '../../../../assets/img/hero.svg'


function InfoSection() {
    return (
        <section class="grid grid-cols-2 h-min">
        <div class="flex flex-col justify-center gap-12 px-16 py-28">
          <h1 class="text-4xl font-bold">
            YOUR AI QURAN COMPANION
          </h1>
          <p class="relative pl-6">
            <span class="text-xl">
              The Prophet (may Allah’s peace and blessings be upon him) said:
            </span><br />
            <span class="font-bold text-2xl mt-20">  
              <span class="absolute left-0 top-5 transform translate-x-[0px] text-4xl">“</span>
              It will be said to the one devoted to the Qur’an: Read, ascend, and recite with deliberation as you used to recite in the world. Your rank will be at the last verse you recite.
              <span class="absolute right-90 bottom-0 transform translate-x-[0px] text-4xl">”</span>
            </span>
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