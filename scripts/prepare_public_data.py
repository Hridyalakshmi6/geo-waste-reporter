
from pathlib import Path
import pandas as pd

# Project directories
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = PROJECT_ROOT / "data" / "public"
OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Find the CSV in data/public
csv_files = list(PUBLIC_DIR.glob("*.csv"))

if len(csv_files) != 1:
    raise FileNotFoundError(
        f"Expected exactly one CSV in {PUBLIC_DIR}, "
        f"but found {len(csv_files)}."
    )

input_file = csv_files[0]

print(f"Reading: {input_file.name}")

df = pd.read_csv(input_file)

# Required columns
required_columns = [
    "Address/landmark/house number",
    "Ward name/number",
    "Date of recording the image",
    "Time of recording the image",
    "Observations",
    "Latitude",
    "Longitude",
    "Type",
    "Entry Type",
]

missing_columns = [
    column for column in required_columns
    if column not in df.columns
]

if missing_columns:
    raise ValueError(f"Missing columns: {missing_columns}")

original_count = len(df)

# Keep point records for the first version
points = df[
    df["Type"].astype(str).str.strip().str.lower() == "point"
].copy()

# Convert coordinates to numeric values
points["Latitude"] = pd.to_numeric(
    points["Latitude"], errors="coerce"
)

points["Longitude"] = pd.to_numeric(
    points["Longitude"], errors="coerce"
)

# Parse the date and time recorded
points["observation_date"] = pd.to_datetime(
    points["Date of recording the image"],
    format="%d/%m/%Y",
    errors="coerce"
)

points["observation_time"] = pd.to_datetime(
    points["Time of recording the image"],
    format="%H:%M",
    errors="coerce"
).dt.strftime("%H:%M")

# Validate coordinates
valid_coordinates = (
    points["Latitude"].between(-90, 90)
    & points["Longitude"].between(-180, 180)
)

valid_dates = points["observation_date"].notna()

clean = points[valid_coordinates & valid_dates].copy()

# Flag possible duplicates for manual review.
# Do not automatically delete repeated observations.
clean["possible_duplicate"] = clean.duplicated(
    subset=[
        "Latitude",
        "Longitude",
        "observation_date",
        "observation_time",
    ],
    keep=False,
)

# Normalize the output columns
cleaned = pd.DataFrame({
    "source": "public_bengaluru_garbage_dumps",
    "source_record_id": clean.index.astype(str),
    "address": clean["Address/landmark/house number"],
    "ward": clean["Ward name/number"],
    "observed_at": (
        clean["observation_date"].dt.strftime("%Y-%m-%d")
        + " "
        + clean["observation_time"].fillna("00:00")
    ),
    "observation_date": clean["observation_date"].dt.strftime(
        "%Y-%m-%d"
    ),
    "observation_time": clean["observation_time"],
    "latitude": clean["Latitude"],
    "longitude": clean["Longitude"],
    "observations": clean["Observations"],
    "image_url": clean.get(
        "Image of the issue",
        pd.Series(index=clean.index, dtype="object")
    ),
    "entry_type": clean["Entry Type"],
    "geometry_type": "point",
    "possible_duplicate": clean["possible_duplicate"],
})

# Save cleaned records
output_file = (
    OUTPUT_DIR / "public_bengaluru_garbage_dumps_points.csv"
)

cleaned.to_csv(output_file, index=False)

# Save records excluded from the point dataset for review
excluded = df[
    df["Type"].astype(str).str.strip().str.lower() != "point"
].copy()

excluded_file = (
    OUTPUT_DIR / "public_bengaluru_non_point_records.csv"
)

excluded.to_csv(excluded_file, index=False)

# Print preparation report
print("\n--- DATA PREPARATION REPORT ---")
print(f"Original records: {original_count}")
print(f"Point records: {len(points)}")
print(f"Valid point records: {len(cleaned)}")
print(f"Excluded point records: {len(points) - len(cleaned)}")
print(f"Non-point records saved separately: {len(excluded)}")
print(
    "Possible duplicate records flagged: "
    f"{int(cleaned['possible_duplicate'].sum())}"
)

if not cleaned.empty:
    print(
        "Observation date range: "
        f"{cleaned['observation_date'].min()} "
        f"to {cleaned['observation_date'].max()}"
    )

print(f"\nCleaned CSV: {output_file}")
print(f"Excluded geometries: {excluded_file}")
print("\nPreparation completed.")
