
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

console.log("Vite environment diagnostic:", {
    mode: import.meta.env.MODE,
    urlPresent: Boolean(supabaseUrl),
    publishableKeyPresent: Boolean(supabasePublishableKey),
    availableViteVariables: Object.keys(import.meta.env).filter(
        (key) => key.startsWith("VITE_")
    ),
});

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
        'Supabase environment variables are missing. Check .env.local.'
    )
}

export const supabase = createClient(
    supabaseUrl,
    supabasePublishableKey
)