let mediaRecorder;
let isRecording = false; // Flag to track if recording is active
let audioChunks = [];

// Function to update the SVG path for start/stop recording
function updateButtonIcon(isRecording) {
    const recordingPath = document.getElementById('recording-path');
    if (isRecording) {
        // Change to stop icon
        recordingPath.setAttribute("d", "M32 32h192a16 16 0 0 1 16 16v192a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16");
    } else {
        // Change to microphone icon
        recordingPath.setAttribute("d", "M80 128V64a48 48 0 0 1 96 0v64a48 48 0 0 1-96 0m128 0a8 8 0 0 0-16 0a64 64 0 0 1-128 0a8 8 0 0 0-16 0a80.11 80.11 0 0 0 72 79.6V240a8 8 0 0 0 16 0v-32.4a80.11 80.11 0 0 0 72-79.6");
    }
}

// Function to send audio data to the server for transcription
const sendAudioToServer = async (audioBlob) => {
    console.log("Sending audio to server...");

    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');

    // Log the contents of FormData
    for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
    }
    
    try {
        // Make the POST request to the server
        const response = await fetch('http://127.0.0.1:5000/transcribe', {
            method: 'POST',
            body: formData,
            // Removed 'Accept' header to allow the browser to set the correct Content-Type
        });
        console.log(response)
        // Check if the response is okay (status code 200-299)
        if (!response.ok) {
            const errorText = await response.text(); // Get the error text from the response
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
      
        // Parse the response as JSON
        const data = await response.json();
console.log(data)
        // Append the transcribed text to the client page
        document.getElementById('transcription').innerText += data['text'];
    } catch (error) {
        console.error('Error sending audio to server:', error);
        alert('Failed to send audio to server. Please try again.');
    }
};


const handleRecord =async (event)=>  {
    event.preventDefault();
    if (!isRecording) {
        // Request microphone access
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Start recording
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();

            audioChunks = [];
            isRecording = true;
            updateButtonIcon(isRecording); // Change to stop icon

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data); // Store audio chunks
            };

        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Microphone access denied. Please enable microphone access.');
        }

    } else {
        // Stop recording
        mediaRecorder.stop();
        isRecording = false;
        updateButtonIcon(isRecording); // Change to microphone icon

        // Once recording is stopped, send the audio to the server
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await sendAudioToServer(audioBlob); // Send the audio for transcription
        };
    }
};
