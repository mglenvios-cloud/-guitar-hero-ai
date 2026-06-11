import Link from "next/link";
import { Music, Mic2, Sparkles, Activity } from "lucide-react";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[128px] -z-10" />

      <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight text-balance">
        The Future of <br/>
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
          Music Creation & Play
        </span>
      </h1>
      
      <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-12 text-balance">
        Experience the ultimate blend of rhythm gaming and professional audio production, powered by advanced AI.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        <Link href="/hero" className="group relative glass p-8 rounded-2xl border border-border hover:border-primary/50 transition-all hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
          <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-6">
            <Activity className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Music Hero</h2>
          <p className="text-gray-400 text-sm">
            Play your favorite tracks in an immersive rhythm game. Connect your MIDI keyboard, guitar, or just use your PC.
          </p>
        </Link>

        <Link href="/studio" className="group relative glass p-8 rounded-2xl border border-border hover:border-secondary/50 transition-all hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
          <div className="w-14 h-14 rounded-xl bg-secondary/20 flex items-center justify-center mb-6">
            <Mic2 className="w-7 h-7 text-secondary" />
          </div>
          <h2 className="text-2xl font-bold mb-3">AI Recording Studio</h2>
          <p className="text-gray-400 text-sm">
            Produce, mix, and master your own tracks with a fully-featured DAW and AI-assisted generation tools.
          </p>
        </Link>
      </div>
    </div>
  );
}
