// Pesrev Trainer - MVP Web App (React + VexFlow + Mic Input + MusicXML Upload)

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [pitch, setPitch] = useState(null);
  const [listening, setListening] = useState(false);
  const [sheet, setSheet] = useState("");
  const fileInputRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rafId = useRef(null);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafId.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const startListening = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    source.connect(analyser);
    analyser.fftSize = 2048;

    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);

    const detectPitch = () => {
      analyser.getFloatTimeDomainData(dataArray);
      const detected = autoCorrelate(dataArray, audioContext.sampleRate);
      if (detected !== -1) setPitch(Math.round(detected));
      rafId.current = requestAnimationFrame(detectPitch);
    };

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    sourceRef.current = source;

    setListening(true);
    detectPitch();
  };

  const stopListening = () => {
    setListening(false);
    cancelAnimationFrame(rafId.current);
    if (audioContextRef.current) audioContextRef.current.close();
    setPitch(null);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    setSheet(text);
    renderMusicXML(text);
  };

  const renderMusicXML = (xmlString) => {
    if (!window.Vex) return console.warn("VexFlow not loaded");

    const VF = window.Vex.Flow;
    const div = document.getElementById("sheet-container");
    div.innerHTML = "";

    const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
    renderer.resize(600, 200);
    const context = renderer.getContext();

    const stave = new VF.Stave(10, 40, 500);
    stave.addClef("treble").setContext(context).draw();
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 space-y-4">
      <div className="w-full max-w-xl border rounded shadow p-4 space-y-4">
        <h2 className="text-xl font-bold">Pesrev Trainer 🎶</h2>

        <div className="text-lg">Current Pitch: {pitch ? `${pitch} Hz` : "—"}</div>

        <button
          onClick={listening ? stopListening : startListening}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          {listening ? "Stop Listening" : "Start Listening"}
        </button>

        <div>
          <input
            type="file"
            accept=".xml,.musicxml"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="mt-2"
          />
          <div id="sheet-container" className="mt-4"></div>
        </div>
      </div>
    </main>
  );
}

function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0,
    r2 = SIZE - 1;
  while (buffer[r1] < 0.001) r1++;
  while (buffer[r2] < 0.001 && r2 > r1) r2--;

  const range = r2 - r1;
  const c = new Array(range).fill(0);

  for (let i = 0; i < range; i++) {
    for (let j = 0; j < range; j++) {
      c[i] = c[i] + buffer[j] * buffer[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;

  let maxval = -1,
    maxpos = -1;
  for (let i = d; i < range; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;
  return sampleRate / T0;
}
