import { useState, useRef } from "react";

interface TranscriptionResponse {
  transcription: string;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState<"file" | "record">("file");
  const [reset, setReset] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      setError(null);
      
        setAudioUrl(URL.createObjectURL(selectedFile));
     
    }
  };

  const handleSubmit = async () => {
    if (!file) return;

    setLoading(true);
    setTranscription("");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/transcribe/", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result: TranscriptionResponse = await response.json();
        setTranscription(result.transcription);
      } else {
        setError("Error: Failed to transcribe audio");
      }
    } catch (err) {
      setError("Network error: Unable to reach server");
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Explicitly set the MIME type to 'audio/webm'
      const mimeType = "audio/webm";
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      chunks.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunks.current, { type: mimeType });

        // Create a File object from the Blob
        const audioFile = new File([audioBlob], "recording.webm", {
          type: mimeType,
        });

        // Set the file for transcription
        setFile(audioFile);
      
          setAudioUrl(URL.createObjectURL(audioBlob));
      
      };

      mediaRecorderRef.current.start();

      setRecording(true);
    } catch (err) {
      setError("Error accessing microphone");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const handleReset = () => {
    setFile(null);
    setTranscription("");
    setError(null);
    setReset(true); // Set reset state to true

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (audioRef.current) {
      setAudioUrl(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-700">
          Lipyantrak: Speech-to-Text Transcription
        </h1>

        <div className="flex justify-center mb-4">
          <button
            onClick={() => {setMode("file"); setAudioUrl(null)}}
            className={`px-4 py-2 mr-2 rounded-lg font-semibold transition ${
              mode === "file" ? "bg-blue-500 text-white" : "bg-gray-300"
            }`}
          >
            Recorded Audio
          </button>
          <button
            onClick={() => {setMode("record"); setAudioUrl(null)}}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              mode === "record" ? "bg-blue-500 text-white" : "bg-gray-300"
            }`}
          >
            Live Record
          </button>
        </div>

        {mode === "file" ? (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              required
              className="w-full p-2 border rounded-lg cursor-pointer bg-gray-50 text-gray-700 focus:ring focus:ring-blue-300"
            />
            {audioUrl && ( // Show audio player if a file is selected
              <audio
                ref={audioRef}
                controls
                src={audioUrl}
                className="w-full"
              />
            )}
            <button
              onClick={handleSubmit}
              disabled={!file || loading}
              className={`w-full p-2 text-white font-semibold rounded-lg transition ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              {loading ? "Transcribing..." : "Transcribe"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`w-full p-2 text-white font-semibold rounded-lg transition ${
                recording
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-green-500 hover:bg-green-600"
              }`}
            >
              {recording ? "Stop Recording" : "Start Recording"}
            </button>
            {audioUrl && ( // Show audio player if a file is selected
              <audio
                ref={audioRef}
                controls
                src={audioUrl}
                className="w-full"
              />
            )}

            <button
              onClick={handleSubmit}
              disabled={!file || loading}
              className={`w-full p-2 text-white font-semibold rounded-lg transition ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              {loading ? "Transcribing..." : "Transcribe"}
            </button>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm text-center mt-2">{error}</p>
        )}

        <textarea
          value={transcription}
          rows={6}
          className="w-full mt-4 p-2 border rounded-lg bg-gray-50 text-gray-700"
          placeholder="Transcription will appear here..."
          readOnly
        />

        <button
          onClick={handleReset}
          disabled={!file && !transcription}
          className="mt-3 w-full p-2 text-white font-semibold rounded-lg bg-red-500 hover:bg-red-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default App;
