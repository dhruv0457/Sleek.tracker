// ============================================================
// Habit-name → MobileNet-label matcher.
//
// MobileNet (ImageNet-trained) produces labels like "barbell", "dumbbell",
// "treadmill", "notebook", "laptop", "book jacket" — none of which literally
// contain the string "Gym". A naive substring match would fail almost every
// habit. Instead, we map each habit to one of seven "categories" based on
// the words in its name, and each category has a curated bucket of
// MobileNet-likely label substrings. A photo passes the verifier if ANY
// of its top-5 MobileNet labels overlaps with the category's bucket.
//
// Examples:
//   habit "Gym"      → category "fitness" → matches "barbell", "dumbbell", "treadmill", "weight bench", "ski", …
//   habit "Read 10 pages" → category "reading" → matches "book", "notebook", " Kindle", …
//   habit "Math practice" → category "study" → matches "desk", "notebook", "laptop", "book jacket", "computer keyboard", …
//   habit "Meditation"    → category "calm" → matches "yoga", "rocking chair", "studio couch", "quinine", …
// ============================================================

export type HabitCategory =
  | "fitness"
  | "reading"
  | "study"
  | "calm"
  | "food"
  | "music"
  | "art"
  | "screen"
  | "outdoor"
  | "creative"
  | "sleep"
  | "anything";

interface CategorySpec {
  // Keyword substrings that, if present in the habit name, suggest this category.
  trigger: string[];
  // ImageNet/MobileNet label substrings (lowercased) that a photo of this
  // category is likely to contain.
  labels: string[];
}

// Curated MobileNet label buckets. These are substrings of common ImageNet
// class labels — MobileNet's `model.classify()` returns className strings
// like "barbell", "dumbbell", "ski", "book jacket", etc.
const CATEGORIES: Record<HabitCategory, CategorySpec> = {
  fitness: {
    trigger: ["gym", "workout", "exercise", "run", "running", "jog", "push", "pushup", "cardio", "treadmill", "yoga", "weights", "dumbbell", "barbell", "lift", "plank", "squats", "ct5k", "stretch", "abs", "pullup", "crunch", "burpee", "swim", "cycle", "bike ride", "marathon", "step"],
    labels: ["barbell", "dumbbell", "weight bench", "treadmill", "ski", "horizontal bar", "parallel bar", "punching bag", "rugby ball", "soccer ball", "football helmet", "basketball", "swimming", "snorkel", "scuba", "racket", "boxing glove", "mat", "gym", "fitness", "balance beam", "volleyball"],
  },
  reading: {
    trigger: ["read", "book", "novel", "pages", "kindle", "magazine", "reading"],
    labels: ["book", "book jacket", "notebook", "binder", "envelope", "magazine", "kindle", "comic", "menu", "paper"],
  },
  study: {
    trigger: ["study", "math", "physics", "chemistry", "biology", "exam", "homework", "assignment", "essay", "code", "coding", "program", "english", "history", "geography", "dcet", "jee", "neet", "test", "learn", "lecture"],
    labels: ["desk", "notebook", "laptop", "book jacket", "computer keyboard", "monitor", "screen", "mouse", "binder", "envelope", "book", "-pencil", "pencil", "rule", "abacus", "web site", "website", "digital clock", "analog clock", "desk", "writing"],
  },
  calm: {
    trigger: ["meditat", "breath", "calm", "mindful", "relax", "yoga", "zen", "spa"],
    labels: ["yoga", "rocking chair", "studio couch", "hammock", "pillow", "quilt", "candle", "fountain", "lotus", "incense"],
  },
  food: {
    trigger: ["cook", "eat", "fruit", "breakfast", "lunch", "dinner", "snack", "nutrit", "vegan", "keto", "diet", "drink", "water", "recipe", "kitchen", "protein", "salad", "smoothie"],
    labels: ["plate", "bowl", "cup", "mug", "tray", "fork", "knife", "spoon", "wineglass", "lemon", "orange", "banana", "pineapple", "strawberry", "apple", "fig", "ice cream", "guacamole", "soup bowl", "espresso", "carbonara", "trifle", "consomme", "hot pot", "cheeseburger", "french loaf", "bagel", "pretzel", "pizza", "burrito", "eggnog", "red wine"],
  },
  music: {
    trigger: ["guitar", "piano", "drum", "sing", "song", "violin", "flute", "music", "play the", "ukelele", "banjo", "keyboard", "trumpet", "sax", "cello", "clarinet"],
    labels: ["guitar", "acoustic guitar", "electric guitar", "banjo", "drum", "maraca", "steel drum", "grand piano", "upright piano", "organ", "harp", "violin", "cello", "flute", "oboe", "trumpet", "trombone", "saxophone", "harmonica", "mic", "microphone", "stage", "music"],
  },
  art: {
    trigger: ["draw", "paint", "sketch", "art", "doodle", "coloring", "illustration", "sculpture", "watercolor", "sketchbook"],
    labels: ["paintbrush", "palette", "easel", "pencil", "sketchpad", "book jacket", "book", "notebook", "binder", "painting"],
  },
  screen: {
    trigger: ["computer", "laptop", "phone", "tablet", "screen", "mobile", "code", "programming", "develop", "work", "office", "mail", "email", "writer", "writ", "blog", "youtube"],
    labels: ["laptop", "notebook", "computer", "monitor", "screen", "keyboard", "mouse", "modem", "mouse", "printer", "desk", "cellular telephone", "iphone", "blackberry", "handheld computer", "web site", "website", "digital clock", "analog clock", "cd player", "cassette player", "iptv", "tv", "television", "desktop"],
  },
  outdoor: {
    trigger: ["walk", "hike", "hiking", "outdoor", "garden", "gardening", "run", "jog", "sunrise", "sunlight", "fresh air", "explore", "beach"],
    labels: ["valley", "mountain", "alp", "cliff", "lakeside", "seashore", "sandbar", "promontory", "ski resort", "park", "park bench", "fountain", "greenhouse", "parking", "garden", "wild", "trail", "shore", "forest"],
  },
  creative: {
    trigger: ["write", "journal", "diary", "blog", "creative", "design", "photo", "craft", "knit", "sew", "embroidery", "origami"],
    labels: ["notebook", "binder", "book", "book jacket", "envelope", "letter", "magazine", "ballpoint", "pencil", "writing", "ink", "fountain pen", "quill", "scissors", "sewing machine", "knitting", "spool", "ribbon", "web site", "modem"],
  },
  sleep: {
    trigger: ["sleep", "bed", "rest", "nap", "go to bed", "early"],
    labels: ["bed", "quilt", "pillow", "mattress", "crib", "sleeping", "sleeping bag", "hammock", "lamp", "blanket"],
  },
  anything: {
    trigger: [],
    labels: [],
  },
};

/** Map a free-text habit name to one of our 11 categories. */
export function categorizeHabit(habitName: string): HabitCategory {
  const n = habitName.toLowerCase();
  // Check each category's trigger words in priority order.
  const priority: HabitCategory[] = ["fitness", "screen", "music", "food", "reading", "study", "calm", "creative", "art", "outdoor", "sleep"];
  for (const c of priority) {
    for (const t of CATEGORIES[c].trigger) {
      if (n.includes(t)) return c;
    }
  }
  return "anything";
}

/**
 * Given the habit name and the top-N MobileNet labels (each: {className,
 * probability}), produce a 0-1 confidence score for "this photo matches
 * the habit". Returns 0 if there's no overlap, otherwise returns the
 * highest probability among matching labels.
 *
 * Special case: if the habit's category is "anything" (we couldn't infer
 * anything from the name), the verifier returns the top probability
 * verbatim — i.e. any in-focus photo passes if MobileNet confidence is high.
 */
export function matchHabitToLabels(
  habitName: string,
  predictions: { className: string; probability: number }[]
): { category: HabitCategory; matchedLabels: string[]; score: number } {
  const cat = categorizeHabit(habitName);
  if (cat === "anything") {
    // No category inferred — accept any high-confidence classification.
    const top = predictions[0];
    return { category: cat, matchedLabels: top ? [top.className] : [], score: top?.probability || 0 };
  }
  const bucket = CATEGORIES[cat].labels;
  let best = 0;
  const matched: string[] = [];
  for (const p of predictions) {
    const label = p.className.toLowerCase();
    if (bucket.some((b) => label.includes(b))) {
      if (p.probability > best) best = p.probability;
      matched.push(p.className);
    }
  }
  return { category: cat, matchedLabels: matched, score: best };
}
