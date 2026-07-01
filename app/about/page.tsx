import Link from "next/link";
import { Compass, ArrowLeft, MessageCircle } from "lucide-react";

export const metadata = {
  title: "About — Island Layout Studio",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to the studio
        </Link>
        <div className="flex items-center gap-3">
          <Compass className="h-7 w-7 text-cyan-300" />
          <h1 className="text-2xl font-semibold">Island Layout Studio</h1>
        </div>
        <p className="mt-4 text-slate-400 leading-relaxed">
          Island Layout Studio is a frontend-only, browser-based urban planning
          tool for Maldives-style land-use planning. Draw a planning boundary,
          sketch internal parcels and road centerlines, then generate a complete
          rule-based land-use layout with residential and commercial plots,
          industrial areas, schools, mosques, utilities, recreation, and green
          space.
        </p>
        <p className="mt-4 text-slate-400 leading-relaxed">
          Everything runs in your browser. Scenarios are stored in localStorage,
          and maps use free public satellite tiles (Esri World Imagery) with an
          OpenStreetMap fallback — no API keys, no backend, no login.
        </p>

        <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-200">
            <span className="text-lg">🚧</span>
            <span className="font-semibold">This project is a work in progress</span>
          </div>
          <p className="mt-2 text-sm text-amber-100/80 leading-relaxed">
            Features are still evolving and things may change or break. If you
            have any comments or feedback, I’d love to hear them — send them over
            on WhatsApp.
          </p>
          <a
            href="https://wa.me/9609690600"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
          >
            <MessageCircle className="h-4 w-4" /> Feedback on WhatsApp: +960 969 0600
          </a>
        </div>
        <h2 className="mt-8 text-lg font-semibold text-slate-100">
          Known limitations
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-400">
          <li>This MVP uses rule-based geometry.</li>
          <li>Outputs are planning concepts, not survey drawings.</li>
          <li>
            Generation quality depends on road sketch quality and boundary shape.
          </li>
          <li>Advanced CAD and GIS exports are reserved for the next version.</li>
        </ul>
      </div>
    </main>
  );
}
