// Waste categories available in the citizen reporting form.

export const CATEGORIES = [
    { value: "household", label: "Household waste" },
    { value: "construction", label: "Construction debris" },
    { value: "plastic", label: "Plastic / packaging" },
    { value: "organic", label: "Organic / leaf litter" },
    { value: "e_waste", label: "E-waste" },
    { value: "mixed", label: "Mixed / other" },
];

export function getCategoryLabel(value) {
    return (
        CATEGORIES.find((category) => category.value === value)?.label ||
        value ||
        "Uncategorised"
    );
}