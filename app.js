// script.js
let mediaRecorder;
let audioChunks = [];
const recordButton = document.getElementById("record-button");
const audioPlayback = document.getElementById("audioPlayback");
const recordingPath = document.getElementById("recording-path");

recordButton.addEventListener("click", async (event) => { 

    
    
    event.preventDefault()
    // Check for microphone access
    
    socket=io('http://127.0.0.1:5000')

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    if (!mediaRecorder) {
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayback.src = audioUrl;
            audioPlayback.style.display = "block"; // Show audio playback controls
            audioChunks = []; // Clear the chunks for the next recording
        };
    }

    // Start or stop recording based on button text
    if (mediaRecorder.state === "inactive") {
        mediaRecorder.start();
        // Change the icon to indicate recording
        recordingPath.setAttribute("d", "M32 32h192a16 16 0 0 1 16 16v192a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16");
    } else {
        mediaRecorder.stop();
        // Revert the icon back to the original
        recordingPath.setAttribute("d", "M80 128V64a48 48 0 0 1 96 0v64a48 48 0 0 1-96 0m128 0a8 8 0 0 0-16 0a64 64 0 0 1-128 0a8 8 0 0 0-16 0a80.11 80.11 0 0 0 72 79.6V240a8 8 0 0 0 16 0v-32.4a80.11 80.11 0 0 0 72-79.6");
    }
});
