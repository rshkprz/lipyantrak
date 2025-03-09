from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
import torch
import torchaudio
import os
import soundfile as sf
import uuid
import subprocess

app = FastAPI()

origins = [
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_path = "./model"
device = "cuda" if torch.cuda.is_available() else "cpu"
model = Wav2Vec2ForCTC.from_pretrained(model_path, use_safetensors=True).to(device)
processor = Wav2Vec2Processor.from_pretrained(model_path)

@app.get("/")
def greet():
    return {"message":"hello"}

# Temporary directory to store uploaded and converted files
TEMP_DIR = "temp_files"
os.makedirs(TEMP_DIR, exist_ok=True)

def convert_to_wav(input_filename: str, output_filename: str):
    """
    Convert an audio file to WAV format using FFmpeg.
    """
    try:
        # Run FFmpeg command to convert to WAV
        command = [
            "ffmpeg",
            "-i", input_filename,  # Input file
            "-vn",                 # Disable video recording
            "-acodec", "pcm_s16le",  # Set audio codec to PCM 16-bit
            output_filename        # Output file
        ]
        subprocess.run(command, check=True)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"FFmpeg conversion failed: {e}")

@app.post("/transcribe/")
async def transcribe(file: UploadFile = File(...)):
    try:
        # Generate unique filenames for input and output files
        input_filename = f"{TEMP_DIR}/{uuid.uuid4()}.{file.filename.split('.')[-1]}"
        wav_filename = f"{TEMP_DIR}/{uuid.uuid4()}.wav"

        # Save the uploaded file
        with open(input_filename, "wb") as buffer:
            buffer.write(await file.read())

        # Check if the file is already in WAV format
        if not file.filename.lower().endswith(".wav"):
            # Convert to WAV if the file is not in WAV format
            convert_to_wav(input_filename, wav_filename)
        else:
            # If the file is already in WAV format, use it directly
            wav_filename = input_filename

        # Debugging: Check if file exists and its size
        if not os.path.exists(wav_filename) or os.path.getsize(wav_filename) == 0:
            return JSONResponse(content={"error": "File was not saved or converted correctly."}, status_code=500)

        # Try loading with torchaudio
        try:
            waveform, sr = torchaudio.load(wav_filename)
        except RuntimeError:
            # Fallback to soundfile
            audio, sr = sf.read(wav_filename)
            waveform = torch.tensor(audio).unsqueeze(0)

        # Resample if needed
        if sr != 16000:
            waveform = torchaudio.transforms.Resample(orig_freq=sr, new_freq=16000)(waveform)

        # Prepare audio for the model
        audio = waveform.squeeze().numpy()
        inputs = processor(audio, sampling_rate=16000, return_tensors="pt").to(device)

        # Perform transcription
        with torch.no_grad():
            logits = model(inputs.input_values).logits

        predicted_ids = torch.argmax(logits, dim=-1)
        transcription = processor.decode(predicted_ids[0])

        # Return the transcription
        return JSONResponse(content={"transcription": transcription})

    except Exception as e:
        import traceback
        print("Error occurred:", traceback.format_exc())
        return JSONResponse(content={"error": str(e)}, status_code=500)
    finally:
        # Clean up temporary files
        if os.path.exists(input_filename):
            os.remove(input_filename)
        if os.path.exists(wav_filename) and wav_filename != input_filename:
            os.remove(wav_filename)