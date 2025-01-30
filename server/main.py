from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
import torch
import torchaudio

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

@app.post("/transcribe/")
async def transcribe(file: UploadFile = File(...)):
    try:
        with open("temp_audio.wav", "wb") as buffer:
            buffer.write(await file.read())

        waveform, sr = torchaudio.load("temp_audio.wav")
        if sr != 16000:
            waveform = torchaudio.transforms.Resample(orig_freq=sr, new_freq=16000)(waveform)
        audio = waveform.squeeze().numpy()

        inputs = processor(audio, sampling_rate=16000, return_tensors="pt").to(device)

        with torch.no_grad():
            logits = model(inputs.input_values).logits

        predicted_ids = torch.argmax(logits, dim=-1)
        transcription = processor.decode(predicted_ids[0])

        return JSONResponse(content={"transcription": transcription})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

