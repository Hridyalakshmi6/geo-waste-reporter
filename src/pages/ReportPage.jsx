
import { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function ReportPage({ onBack }) {
    const fileInputRef = useRef(null);

    const [photo, setPhoto] = useState(null);
    const [preview, setPreview] = useState("");
    const [location, setLocation] = useState(null);
    const [locationStatus, setLocationStatus] = useState("Waiting for photo");
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [description, setDescription] = useState("");
    const [submittedReport, setSubmittedReport] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState("");

    function detectLocation() {
        if (!navigator.geolocation) {
            setLocationStatus("Geolocation is not supported by this browser.");
            return;
        }

        setLoadingLocation(true);
        setLocationStatus("Detecting your location...");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                });

                setLocationStatus("Location captured successfully");
                setLoadingLocation(false);
            },
            (error) => {
                setLocation(null);
                setLoadingLocation(false);

                const messages = {
                    1: "Location permission denied. Please allow location access.",
                    2: "Location information is unavailable. Try again.",
                    3: "Location request timed out. Try again.",
                };

                setLocationStatus(
                    messages[error.code] || "Unable to detect location."
                );
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            }
        );
    }

    function handlePhoto(event) {
        const file = event.target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Please select a valid image.");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            alert("Please choose an image smaller than 10 MB.");
            return;
        }

        setPhoto(file);
        setPreview(URL.createObjectURL(file));
        setLocation(null);

        // Capture GPS when the citizen selects or takes a photograph.
        detectLocation();
    }


    async function submitReport(event) {
        event.preventDefault();

        if (isSubmitting) return;

        if (!photo) {
            setSubmissionError("Please take or upload a photograph.");
            return;
        }

        if (!location) {
            setSubmissionError("GPS location is required.");
            return;
        }

        if (!navigator.onLine) {
            setSubmissionError("Please check your internet connection.");
            return;
        }

        setIsSubmitting(true);
        setSubmissionError("");

        try {
            // 1. Generate a unique report ID

            const randomPart = crypto.randomUUID()
                .slice(0, 8)
                .toUpperCase();

            const datePart = new Date()
                .toISOString()
                .slice(0, 10)
                .replaceAll("-", "");

            const reportCode = `GWR-${datePart}-${randomPart}`;

            // 2. Determine the image extension

            const extensions = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp",
            };

            const extension = extensions[photo.type];

            if (!extension) {
                throw new Error("Only JPEG, PNG and WEBP images are allowed.");
            }

            // 3. Generate a unique Storage path

            const imagePath =
                `reports/${reportCode}/${crypto.randomUUID()}.${extension}`;

            // 4. Upload the actual photograph to Supabase Storage

            console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
            console.log("Bucket name:", "waste-images");
            console.log("Image path:", imagePath);
            console.log("Image type:", photo.type);

            const { error: uploadError } = await supabase.storage
                .from("waste-images")
                .upload(imagePath, photo, {
                    contentType: photo.type,
                    cacheControl: "3600",
                    upsert: false,
                });

            if (uploadError) {
                throw uploadError;
            }

            // 5. Insert report information into PostgreSQL

            const { error: databaseError } = await supabase
                .from("reports")
                .insert({
                    report_code: reportCode,
                    image_path: imagePath,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    accuracy: location.accuracy,
                    description: description.trim() || null,
                });

            if (databaseError) {
                throw databaseError;
            }

            // 6. Display successful submission

            setSubmittedReport({
                id: reportCode,
                description,
                photoName: photo.name,
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                createdAt: new Date().toISOString(),
                status: "Pending Verification",
            });

        } catch (error) {
            console.error("Report submission failed:", error);

            setSubmissionError(
                error.message || "Unable to submit your report. Please try again."
            );

        } finally {
            setIsSubmitting(false);
        }
    }


    if (submittedReport) {
        return (
            <main className="min-h-screen bg-green-50 px-5 py-16">
                <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-lg">
                    <div className="text-6xl">✅</div>

                    <h1 className="mt-5 text-3xl font-bold text-green-800">
                        Report Generated!
                    </h1>

                    <p className="mt-3 text-gray-600">
                        Your waste report has been successfully uploaded
                        and securely stored.
                    </p>

                    <div className="mt-6 rounded-xl bg-green-50 p-5 text-left">
                        <p className="text-sm text-gray-500">Your Report ID</p>
                        <p className="mt-1 text-xl font-bold text-green-800">
                            {submittedReport.id}
                        </p>

                        <p className="mt-4 text-sm text-gray-600">
                            Status: {submittedReport.status}
                        </p>

                        <p className="mt-2 text-sm text-gray-600">
                            Latitude: {submittedReport.latitude}
                        </p>

                        <p className="text-sm text-gray-600">
                            Longitude: {submittedReport.longitude}
                        </p>
                    </div>

                    <button
                        onClick={onBack}
                        className="mt-7 rounded-xl bg-green-700 px-7 py-3 font-semibold text-white hover:bg-green-800"
                    >
                        Back to Homepage
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-green-50 px-5 py-12">

            <div className="mx-auto max-w-3xl">

                <button
                    onClick={onBack}
                    className="mb-7 font-semibold text-green-800 hover:text-green-600"
                >
                    ← Back to Homepage
                </button>

                <div className="rounded-3xl bg-white p-6 shadow-xl md:p-10">

                    <div className="mb-8">
                        <p className="font-semibold text-green-700">
                            CITIZEN REPORTING PORTAL
                        </p>

                        <h1 className="mt-2 text-3xl font-bold text-gray-900">
                            Report Waste
                        </h1>

                        <p className="mt-3 text-gray-500">
                            Help us identify and resolve waste dumping incidents
                            in your community.
                        </p>

                        <p className="mt-3 text-sm text-green-700">
                            No registration or login required.
                        </p>
                    </div>

                    <form onSubmit={submitReport} className="space-y-7">

                        {/* PHOTO UPLOAD */}

                        <section>
                            <h2 className="mb-3 font-bold text-gray-800">
                                1. Capture Waste Photograph *
                            </h2>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handlePhoto}
                                className="hidden"
                            />

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-green-400 bg-green-50 p-8 text-center hover:bg-green-100"
                            >
                                <span className="text-5xl">📸</span>

                                <span className="mt-3 font-bold text-green-800">
                                    Take Photo / Upload Image
                                </span>

                                <span className="mt-2 text-sm text-gray-500">
                                    JPG, PNG or WEBP · Maximum 10 MB
                                </span>
                            </button>

                            {preview && (
                                <div className="mt-5">
                                    <img
                                        src={preview}
                                        alt="Selected waste"
                                        className="max-h-72 w-full rounded-xl object-cover"
                                    />

                                    <p className="mt-2 text-sm text-green-700">
                                        Photograph selected: {photo.name}
                                    </p>
                                </div>
                            )}
                        </section>

                        {/* GPS LOCATION */}

                        <section>
                            <h2 className="mb-3 font-bold text-gray-800">
                                2. GPS Location
                            </h2>

                            <div className="rounded-xl border border-gray-200 p-5">

                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">📍</span>

                                    <div>
                                        <p className="font-semibold text-gray-800">
                                            Automatic Location Detection
                                        </p>

                                        <p className="text-sm text-gray-500">
                                            Location is captured when you select a photograph.
                                        </p>
                                    </div>
                                </div>

                                <p className="mt-4 text-sm text-gray-600">
                                    {loadingLocation ? "⏳ " : location ? "✅ " : "⚠️ "}
                                    {locationStatus}
                                </p>

                                {location && (
                                    <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm">
                                        <p>Latitude: {location.latitude}</p>
                                        <p>Longitude: {location.longitude}</p>
                                        <p>Accuracy: {Math.round(location.accuracy)} metres</p>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={detectLocation}
                                    disabled={loadingLocation}
                                    className="mt-4 rounded-lg border border-green-700 px-4 py-2 font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50"
                                >
                                    {loadingLocation ? "Detecting..." : "Refresh GPS Location"}
                                </button>

                            </div>
                        </section>

                        {/* DESCRIPTION */}

                        <section>
                            <h2 className="mb-3 font-bold text-gray-800">
                                3. Additional Description (Optional)
                            </h2>

                            <textarea
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                rows="4"
                                maxLength={500}
                                placeholder="Describe the garbage or surrounding area..."
                                className="w-full rounded-xl border border-gray-300 p-4 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                            />
                        </section>

                        {/* SUBMIT */}


                        {submissionError && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                {submissionError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={
                                !photo ||
                                !location ||
                                loadingLocation ||
                                isSubmitting
                            }
                            className="w-full rounded-xl bg-green-700 py-4 font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                        >
                            {isSubmitting
                                ? "Uploading Your Report..."
                                : "Submit Waste Report →"}
                        </button>


                        <p className="text-center text-xs text-gray-400">
                            Your location will only be captured with your permission.
                        </p>

                    </form>

                </div>
            </div>
        </main>
    );
}

export default ReportPage;