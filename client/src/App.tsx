import { useState } from 'react'
import './App.css'

interface transcriptionResponse {
  transcription: string
}
function App() {
  const [file, setFile] = useState<File | null>(null)
  const [transcription, setTranscription] = useState('')

  const handleFileChange = (event:React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files){
      setFile(event.target.files[0])
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('http://127.0.0.1:8000/transcribe/', {
      method: 'POST',
      body: formData,
    })

    if (response.ok){
      const result: transcriptionResponse = await response.json()
      setTranscription(result.transcription)
    } else {
      setTranscription('Error transcribing audio')
    }
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="file" accept='audio/*' onChange={handleFileChange} required/>
        <button type='submit'>Transcribe</button>
      </form>
      <textarea value={transcription} rows={10} cols={50} placeholder="transcription will appear here..." readOnly/>
    </div>
  )
}

export default App
