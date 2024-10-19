/* eslint-disable jsx-a11y/anchor-is-valid */
import frame from '../../../../assets/img/frame.svg'
import hero from '../../../../assets/img/hero.svg'


function InfoSection() {
  return (
      <section className="grid grid-cols-1 lg:grid-cols-2 h-min gap-8 px-6 md:px-12 lg:px-16 py-12 md:py-20 lg:py-28">
          <div className="flex flex-col justify-center gap-6 md:gap-8 lg:gap-12">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center lg:text-left">
                  YOUR AI QURAN COMPANION
              </h1>
              <p className="relative pl-4 md:pl-6 text-center lg:text-left">
                  <span className="text-lg md:text-xl">
                      The Prophet (may Allah’s peace and blessings be upon him) said:
                  </span><br />
                  <span className="font-bold text-xl md:text-2xl lg:text-2xl mt-4">
                      <span className="absolute left-4 md:left-6 lg:left-0 top-5 transform translate-x-[0px] text-3xl md:text-4xl">“</span>
                      It will be said to the one devoted to the Qur’an: Read, ascend, and recite with deliberation as you used to recite in the world. Your rank will be at the last verse you recite.
                      <span className="absolute right-4 md:right-6 lg:right-0 bottom-0 transform translate-x-[0px] text-3xl md:text-4xl">”</span>
                  </span>
              </p>
              <a href="#" className="btn w-full flex justify-center">Try it out!</a>
          </div>
          <div className="relative flex items-center justify-center lg:justify-end px-4 lg:px-0">
              <div className="relative w-full max-w-md lg:max-w-lg">
                  {/* Frame Image */}
                  <img
                      alt="frame"
                      src={frame}
                      className="absolute inset-0 w-3/4 md:w-4/5 lg:w-full h-auto object-contain opacity-80 -z-10"
                  />
                  {/* Hero Image */}
                  <img
                      src={hero}
                      alt="hero"
                      className="relative z-10 w-2/3 md:w-3/4 lg:w-4/5 h-auto mx-auto object-contain drop-shadow-lg"
                  />
              </div>
          </div>
      </section>
  );
}

export default InfoSection;
