const flowerDB = {
  // The eight Primary Garden Mood pools draw from these species (see
  // PRIMARY_GARDEN_MOOD_CONFIG). Each has Garden art and a planting size in mobile.
  // Listed first so their meanings win when a species also appears below.
  // Legacy moods (happy … stressed) keep their own lists unchanged.
  canonical: [
    { name: "Sunflower", meaning: "Happiness", img: "🌻" },
    { name: "Gerbera Daisy", meaning: "Cheerfulness", img: "🌼" },
    { name: "Coreopsis", meaning: "Bright days", img: "🌼" },
    { name: "Daisy", meaning: "Simple joy", img: "🌼" },
    { name: "Hydrangea", meaning: "Heartfelt thanks", img: "💐" },
    { name: "Bluebell", meaning: "Gentle solitude", img: "🪻" },
    { name: "Anemone", meaning: "Quiet longing", img: "🌸" },
    { name: "Heather", meaning: "Holding on", img: "🪻" },
    { name: "Chamomile", meaning: "Strength in hard times", img: "🌼" },
    { name: "Snowdrop", meaning: "Hope", img: "🤍" },
    { name: "Poppy", meaning: "Burning heart", img: "🌺" },
    { name: "Petunia", meaning: "Restless energy", img: "🌺" },
    { name: "Gentian", meaning: "Standing firm", img: "🪻" },
    { name: "Tulip", meaning: "Fresh wonder", img: "🌷" },
    { name: "Bird of Paradise", meaning: "Wonder", img: "🌺" },
    { name: "Yellow Daffodil", meaning: "New beginnings", img: "🌼" },
    { name: "White Rose", meaning: "An open heart", img: "🤍" },
    { name: "Dandelion", meaning: "Wishes on the wind", img: "🌼" },
    { name: "Aster", meaning: "Patience", img: "🪻" },
    { name: "Yellow Rapeseed Flower", meaning: "Gentle drift", img: "🌼" },
    { name: "Lavender", meaning: "Serenity", img: "🪻" },
    { name: "Chinese Violet Cress", meaning: "Quiet companionship", img: "🪻" },
    { name: "Olive", meaning: "Peace", img: "🫒" }
  ],

  happy: [
    { name: "Sunflower", meaning: "Happiness", img: "🌻" },
    { name: "Tulip", meaning: "Joy", img: "🌷" }
  ],

  sad: [
    { name: "Blue Rose", meaning: "Melancholy", img: "🥀" },
    { name: "Lavender", meaning: "Quiet comfort", img: "🪻" }
  ],

  calm: [
    { name: "Lotus", meaning: "Peace", img: "🪷" },
    { name: "Cherry Blossom", meaning: "Gentleness", img: "🌸" }
  ],

  tired: [
    { name: "Lavender", meaning: "Rest", img: "🪻" },
    { name: "Daisy", meaning: "Soft recovery", img: "🌼" }
  ],

  stressed: [
    { name: "Chamomile", meaning: "Relaxation", img: "🌼" },
    { name: "Lotus", meaning: "Breathe and reset", img: "🪷" }
  ]
};

export default flowerDB;