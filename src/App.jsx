import { useState } from "react";
import ReportPage from "./pages/ReportPage.jsx";

const features = [
  {
    icon: "📸",
    title: "AI Waste Detection",
    description:
      "Analyze uploaded photographs to identify and classify waste.",
  },
  {
    icon: "📍",
    title: "GPS Location Tracking",
    description:
      "Capture the geographical location of reported waste automatically.",
  },
  {
    icon: "🔍",
    title: "Duplicate Detection",
    description:
      "Identify multiple reports referring to the same waste incident.",
  },
  {
    icon: "🗺️",
    title: "GeoAI Hotspot Analysis",
    description:
      "Discover areas experiencing repeated garbage dumping.",
  },
  {
    icon: "🔄",
    title: "Incident Monitoring",
    description:
      "Track reported, verified, assigned and resolved incidents.",
  },
  {
    icon: "👥",
    title: "Human Verification",
    description:
      "Allow authorized personnel to review and verify AI predictions.",
  },
];

const steps = [
  {
    number: "01",
    title: "Report Waste",
    description:
      "Upload a photograph of the garbage location through the citizen portal.",
    icon: "📷",
  },
  {
    number: "02",
    title: "AI & Location Analysis",
    description:
      "Analyze the image and geographical coordinates to process the report.",
    icon: "🧠",
  },
  {
    number: "03",
    title: "Track Resolution",
    description:
      "Monitor the incident as authorities review and resolve the complaint.",
    icon: "✅",
  },
];

function App() {
  const [showReport, setShowReport] = useState(false);

  if (showReport) {
    return (
      <ReportPage
        onBack={() => setShowReport(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-800">

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

          <a href="#" className="flex items-center gap-2">
            <span className="text-3xl">🌿</span>
            <span className="text-xl font-bold text-green-800">
              GeoWaste<span className="text-green-500">.</span>
            </span>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#" className="font-medium text-green-700">Home</a>
            <a href="#about" className="hover:text-green-700">About</a>
            <a href="#features" className="hover:text-green-700">Features</a>
            <a href="#how-it-works" className="hover:text-green-700">
              How It Works
            </a>
          </div>

          <button
            onClick={() => setShowReport(true)}
            className="rounded-xl bg-green-700 px-5 py-3 font-semibold text-white transition hover:bg-green-800"
          >
            Report Waste →
          </button>

        </nav>
      </header>

      {/* HERO SECTION */}
      <section
        id="about"
        className="overflow-hidden bg-gradient-to-br from-green-50 via-white to-emerald-50"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 md:grid-cols-2">

          <div>
            <span className="mb-6 inline-block rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-800">
              🌍 Smart Waste Management Through GeoAI
            </span>

            <h1 className="text-4xl font-extrabold leading-tight text-gray-900 md:text-6xl">
              Together, Let's Build a
              <span className="text-green-700"> Cleaner Tomorrow.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-600">
              Report illegal waste dumping, identify pollution hotspots
              and help authorities create cleaner communities through
              artificial intelligence and geospatial technology.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={() => setShowReport(true)}
                className="rounded-xl bg-green-700 px-7 py-4 font-bold text-white"
              >
                Report Waste Now →
              </button>

              <a
                href="#how-it-works"
                className="rounded-xl border border-green-700 px-7 py-4 font-bold text-green-800 transition hover:bg-green-50"
              >
                Explore Platform
              </a>
            </div>

            <p className="mt-8 text-sm text-gray-500">
              📍 Location-aware reporting · 🤖 AI-assisted analysis
            </p>
          </div>

          <div className="relative">
            <div className="rounded-3xl bg-green-100 p-5 shadow-xl md:p-8">
              <img
                src="/images/waste-hero.jpg"
                alt="Waste collection and recycling"
                className="h-80 w-full rounded-2xl object-cover md:h-105"
              />

              <div className="absolute bottom-0 left-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl md:-left-5">
                <p className="text-sm text-gray-500">Our mission</p>
                <p className="font-bold text-green-800">
                  Cleaner Cities, Smarter Solutions 🌱
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* IMPACT SECTION */}
      <section className="border-y border-gray-100 bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">

          <div className="mb-10 text-center">
            <p className="font-semibold text-green-700">OUR IMPACT</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              Creating Measurable Change
            </h2>
            <p className="mt-3 text-gray-500">
              Track community waste management progress through verified data.
            </p>
          </div>

          <div className="grid gap-6 text-center sm:grid-cols-3">

            {[
              ["📋", "Total Reports", "Live data coming soon"],
              ["📍", "Locations Monitored", "Live data coming soon"],
              ["✅", "Incidents Resolved", "Live data coming soon"],
            ].map(([icon, title, value]) => (
              <div
                key={title}
                className="rounded-2xl border border-gray-100 bg-green-50/60 p-8"
              >
                <div className="text-4xl">{icon}</div>
                <h3 className="mt-4 text-xl font-bold text-gray-800">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-gray-500">{value}</p>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-6">

          <div className="mb-14 text-center">
            <p className="font-semibold text-green-700">OUR TECHNOLOGY</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
              Intelligent Features for Cleaner Cities
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-500">
              Combining artificial intelligence and geospatial
              technologies to improve waste reporting and monitoring.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-5 text-4xl">{feature.icon}</div>

                <h3 className="mb-3 text-xl font-bold text-gray-900">
                  {feature.title}
                </h3>

                <p className="leading-7 text-gray-500">
                  {feature.description}
                </p>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">

          <div className="mb-14 text-center">
            <p className="font-semibold text-green-700">SIMPLE PROCESS</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900">
              How Geo-Waste Reporter Works
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">

            {steps.map((step) => (
              <div key={step.number} className="relative text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
                  {step.icon}
                </div>

                <p className="mt-5 font-bold text-green-700">
                  STEP {step.number}
                </p>

                <h3 className="mt-2 text-xl font-bold text-gray-900">
                  {step.title}
                </h3>

                <p className="mx-auto mt-3 max-w-sm leading-7 text-gray-500">
                  {step.description}
                </p>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* REPORT CTA */}
      <section id="report" className="bg-green-800 px-6 py-20 text-center text-white">
        <h2 className="text-3xl font-bold md:text-4xl">
          See Waste? Report It. Make a Difference.
        </h2>

        <p className="mx-auto mt-5 max-w-2xl leading-7 text-green-100">
          Be part of a smarter waste management system.
          Your report can help make your community cleaner.
        </p>

        <button
          onClick={() => setShowReport(true)}
          className="mt-8 rounded-xl bg-white px-8 py-4 font-bold text-green-800"
        >
          Start Reporting →
        </button>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-950 px-6 py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 md:flex-row">

          <div>
            <h3 className="text-xl font-bold text-green-400">
              🌿 GeoWaste.
            </h3>
            <p className="mt-2 text-sm text-gray-400">
              Building cleaner communities through GeoAI.
            </p>
          </div>

          <p className="text-sm text-gray-500">
            © 2026 Geo-Waste Reporter. All rights reserved.
          </p>

        </div>
      </footer>

    </div>
  );
}

export default App;