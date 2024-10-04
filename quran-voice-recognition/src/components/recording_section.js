function RecordingSection() {
    return (
        <section class="flex flex-col items-center gap-20 py-20 mb-24">
        <h2 class="text-2xl font-bold">Try it out!</h2>
        <div class="relative" id="audio-form">
          <input
            class="p-3 pr-16 border rounded-full box-border border-black text-right text-2xl w-[38rem]"
            type="text"
            value="قل هو الله أحد"
          />
          <button
            id="record-button"
            type="button"
            
            class="btn absolute right-0 h-full aspect-square scale-[102%]"
          >
            <svg
              id="recording-icon"
              class="translate-x-[0.08rem] w-8 h-8"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 256 256"
            >
              <path
                id="recording-path"
                fill="currentColor"
                d="M80 128V64a48 48 0 0 1 96 0v64a48 48 0 0 1-96 0m128 0a8 8 0 0 0-16 0a64 64 0 0 1-128 0a8 8 0 0 0-16 0a80.11 80.11 0 0 0 72 79.6V240a8 8 0 0 0 16 0v-32.4a80.11 80.11 0 0 0 72-79.6"
              />
            </svg>
          </button>
        </div>
        <p id="transcription">Transcription will appear here...</p>
      </section>
    
    );
  }
  
  export default RecordingSection;