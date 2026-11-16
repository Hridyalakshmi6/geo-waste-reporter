
from pathlib import Path
import numpy as np
import pandas as pd

# -----------------------------------------
# Configuration
# -----------------------------------------

SEED = 42
TOTAL_RECORDS = 3000

START_DATE = "2017-01-01"
END_DATE = "2026-11-15"

# Approximate simulated hotspot spread in metres
HOTSPOT_SPREAD_METRES = 120

# -----------------------------------------
# Project directories
# -----------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent

PUBLIC_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "public_bengaluru_garbage_dumps_points.csv"
)

OUTPUT_DIR = PROJECT_ROOT / "data" / "synthetic"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_FILE = (
    OUTPUT_DIR / "synthetic_bengaluru_historical_reports.csv"
)

# -----------------------------------------
# Load public coordinates as reference points
# -----------------------------------------

if not PUBLIC_FILE.exists():
    raise FileNotFoundError(
        f"Public reference file not found: {PUBLIC_FILE}"
    )

public_df = pd.read_csv(PUBLIC_FILE)

public_df["latitude"] = pd.to_numeric(
    public_df["latitude"], errors="coerce"
)

public_df["longitude"] = pd.to_numeric(
    public_df["longitude"], errors="coerce"
)

reference_points = public_df[
    public_df["latitude"].between(-90, 90)
    & public_df["longitude"].between(-180, 180)
][["latitude", "longitude"]].drop_duplicates()

if len(reference_points) < 5:
    raise ValueError(
        "Not enough valid reference coordinates to generate data."
    )

# -----------------------------------------
# Initialize reproducible random generator
# -----------------------------------------

rng = np.random.default_rng(SEED)

# Select five reference locations to act as
# simulated recurring hotspot centres.
selected_indices = rng.choice(
    len(reference_points),
    size=5,
    replace=False,
)

hotspot_centres = reference_points.iloc[
    selected_indices
].reset_index(drop=True)

# -----------------------------------------
# Generate dates and times
# -----------------------------------------

start = pd.Timestamp(START_DATE)
end = pd.Timestamp(END_DATE)

date_range_days = (end - start).days

random_day_offsets = rng.integers(
    0,
    date_range_days + 1,
    size=TOTAL_RECORDS,
)

observation_dates = [
    start + pd.Timedelta(days=int(offset))
    for offset in random_day_offsets
]

random_minutes = rng.integers(
    0,
    24 * 60,
    size=TOTAL_RECORDS,
)

observation_times = [
    f"{int(minutes // 60):02d}:{int(minutes % 60):02d}:00"
    for minutes in random_minutes
]

# -----------------------------------------
# Generate simulated locations
# -----------------------------------------

latitudes = []
longitudes = []
cluster_ids = []

for _ in range(TOTAL_RECORDS):

    # 75% of observations occur around one of
    # five recurring simulated hotspot centres.
    if rng.random() < 0.75:
        cluster_index = int(rng.integers(0, 5))

        centre = hotspot_centres.iloc[cluster_index]

        latitude_offset = (
            rng.normal(0, HOTSPOT_SPREAD_METRES)
            / 111320
        )

        longitude_scale = max(
            abs(np.cos(np.radians(centre["latitude"]))),
            0.01,
        )

        longitude_offset = (
            rng.normal(0, HOTSPOT_SPREAD_METRES)
            / (111320 * longitude_scale)
        )

        latitude = centre["latitude"] + latitude_offset
        longitude = centre["longitude"] + longitude_offset

        cluster_id = f"simulated_hotspot_{cluster_index + 1}"

    else:
        # Remaining observations are distributed
        # around other reference locations.
        reference_index = int(
            rng.integers(0, len(reference_points))
        )

        reference = reference_points.iloc[reference_index]

        latitude = float(reference["latitude"])
        longitude = float(reference["longitude"])

        cluster_id = "dispersed"

    latitudes.append(latitude)
    longitudes.append(longitude)
    cluster_ids.append(cluster_id)

# -----------------------------------------
# Build synthetic records
# -----------------------------------------

categories = [
    "household_waste",
    "plastic_waste",
    "construction_waste",
    "mixed_waste",
    "organic_waste",
]

category_choices = rng.choice(
    categories,
    size=TOTAL_RECORDS,
)

synthetic_df = pd.DataFrame({
    "source": "synthetic_bengaluru_simulation",
    "source_record_id": [
        f"SYN-{i:05d}"
        for i in range(1, TOTAL_RECORDS + 1)
    ],
    "is_synthetic": True,
    "synthetic_cluster_id": cluster_ids,
    "observation_date": [
        date.strftime("%Y-%m-%d")
        for date in observation_dates
    ],
    "observation_time": observation_times,
    "observed_at": [
        f"{date.strftime('%Y-%m-%d')} {time}"
        for date, time in zip(
            observation_dates,
            observation_times,
        )
    ],
    "latitude": latitudes,
    "longitude": longitudes,
    "category": category_choices,
    "description": [
        "SIMULATED TEST RECORD - NOT A REAL INCIDENT"
        for _ in range(TOTAL_RECORDS)
    ],
})

# -----------------------------------------
# Validate generated data
# -----------------------------------------

assert len(synthetic_df) == TOTAL_RECORDS
assert synthetic_df["is_synthetic"].all()
assert synthetic_df["source_record_id"].is_unique
assert synthetic_df["latitude"].between(-90, 90).all()
assert synthetic_df["longitude"].between(-180, 180).all()

# -----------------------------------------
# Save CSV
# -----------------------------------------

synthetic_df.to_csv(OUTPUT_FILE, index=False)

# -----------------------------------------
# Print generation report
# -----------------------------------------

print("\n--- SYNTHETIC DATA GENERATION REPORT ---")

print("Total records:", len(synthetic_df))
print("Synthetic records:", int(synthetic_df["is_synthetic"].sum()))
print("Unique IDs:", synthetic_df["source_record_id"].nunique())

print(
    "Date range:",
    synthetic_df["observation_date"].min(),
    "to",
    synthetic_df["observation_date"].max(),
)

print("\nSimulated cluster distribution:")
print(synthetic_df["synthetic_cluster_id"].value_counts())

print("\nCategory distribution:")
print(synthetic_df["category"].value_counts())

print("\nMissing values:")
print(synthetic_df.isnull().sum())

print("\nSaved file:")
print(OUTPUT_FILE)

print("\nSynthetic data generation completed.")
