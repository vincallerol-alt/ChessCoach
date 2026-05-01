const state = {
  config: null,
  phase: "idle",
  answers: {
    childAge: null,
    mood: null,
    genre: null,
    hero: null,
  },
  scenario: [],
  alerts: [],
  currentPromptIndex: 0,
};

const prompts = [
  {
    key: "childAge",
    text: "Bonjour, moi je vais t'aider à inventer une histoire. Tu as quel âge ?",
  },
  {
    key: "mood",
    text: "Et aujourd'hui, tu te sens plutôt joyeux, fatigué, curieux ou un peu grognon ?",
  },
  {
    key: "genre",
    text: "Tu veux une histoire drôle, magique, calme ou aventureuse ?",
  },
  {
    key: "hero",
    text: "Qui est le héros de ton histoire aujourd'hui ? Tu peux inventer n'importe qui.",
  },
];

const unsafeWords = [
  "sang",
  "tuer",
  "mourir",
  "arme",
  "cauchemar",
  "kidnapper",
  "horreur",
  "violence",
];

const form = document.querySelector("#parent-form");
const childAnswer = document.querySelector("#child-answer");
const listenButton = document.querySelector("#listen-button");
const storyButton = document.querySelector("#story-button");
const stopButton = document.querySelector("#stop-button");
const agentLine = document.querySelector("#agent-line");
const sessionStatus = document.querySelector("#session-status");
const summaryScenario = document.querySelector("#summary-scenario");
const summaryThemes = document.querySelector("#summary-themes");
const summaryAlerts = document.querySelector("#summary-alerts");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    childAnswer.value = transcript;
    handleChildInput(transcript);
  });

  recognition.addEventListener("end", () => {
    if (state.phase !== "idle" && state.phase !== "stopped") {
      listenButton.textContent = "Répondre / interrompre";
    }
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  state.config = readParentConfig();
  state.phase = "introduction";
  state.currentPromptIndex = 0;
  state.answers = { childAge: null, mood: null, genre: null, hero: null };
  state.scenario = [];
  state.alerts = [];

  listenButton.disabled = false;
  storyButton.disabled = true;
  stopButton.disabled = false;
  sessionStatus.textContent = "Discussion";
  summaryScenario.textContent = "Discussion en cours";
  summaryThemes.textContent = state.config.themes.join(", ") || "Aucun";
  summaryAlerts.textContent = "Aucune";

  speak(prompts[0].text);
});

listenButton.addEventListener("click", () => {
  window.speechSynthesis.cancel();

  if (recognition) {
    listenButton.textContent = "J'écoute...";
    recognition.start();
    return;
  }

  const value = childAnswer.value.trim();
  if (value) {
    handleChildInput(value);
  }
});

childAnswer.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && childAnswer.value.trim()) {
    event.preventDefault();
    handleChildInput(childAnswer.value.trim());
  }
});

storyButton.addEventListener("click", () => {
  startStory();
});

stopButton.addEventListener("click", () => {
  state.phase = "stopped";
  window.speechSynthesis.cancel();
  agentLine.textContent = "D'accord, pause immédiate. Le parent reprend la main.";
  sessionStatus.textContent = "Arrêté";
});

function readParentConfig() {
  return {
    name: document.querySelector("#child-name").value.trim(),
    age: Number(document.querySelector("#parent-age").value),
    duration: Number(document.querySelector("#story-duration").value),
    voiceStyle: document.querySelector("#voice-style").value,
    themes: checkedValues("theme"),
    lessons: checkedValues("lesson"),
    blockedTopics: document
      .querySelector("#blocked-topics")
      .value.split(",")
      .map((topic) => topic.trim().toLowerCase())
      .filter(Boolean),
  };
}

function checkedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(
    (input) => input.value,
  );
}

function handleChildInput(rawInput) {
  if (!state.config || state.phase === "stopped") return;

  const input = sanitizeInput(rawInput);
  const prompt = prompts[state.currentPromptIndex];
  const safety = checkSafety(input);

  if (!safety.safe) {
    state.alerts.push(`Demande transformée : ${safety.reason}`);
    speak("Cette idée est un peu trop forte pour notre histoire. On va la transformer en mystère rigolo, d'accord ?");
    updateSummary();
    return;
  }

  state.answers[prompt.key] = input;
  state.scenario.push(input);

  if (prompt.key === "childAge") {
    const childAge = extractAge(input);
    const reply = ageReply(childAge);
    state.currentPromptIndex += 1;
    speak(`${reply} ${prompts[state.currentPromptIndex].text}`);
    updateSummary();
    childAnswer.value = "";
    return;
  }

  state.currentPromptIndex += 1;

  if (state.currentPromptIndex < prompts.length) {
    const bridge = politeBridge(input);
    speak(`${bridge} ${prompts[state.currentPromptIndex].text}`);
  } else {
    state.phase = "ready";
    storyButton.disabled = false;
    speak("Merci pour toutes tes idées. J'ai préparé ton histoire. Quand tu veux, on la lance.");
  }

  updateSummary();
  childAnswer.value = "";
}

function sanitizeInput(value) {
  return value.replace(/[<>]/g, "").trim().slice(0, 180);
}

function checkSafety(input) {
  const normalized = input.toLowerCase();
  const blocked = [...unsafeWords, ...(state.config?.blockedTopics || [])];
  const hit = blocked.find((word) => word && normalized.includes(word));

  if (hit) {
    return { safe: false, reason: hit };
  }

  return { safe: true };
}

function extractAge(input) {
  const match = input.match(/\b(\d{1,2})\b/);
  return match ? Number(match[1]) : null;
}

function ageReply(childAge) {
  const parentAge = state.config.age;

  if (!childAge) {
    return "Mystère d'âge détecté, c'est très pratique pour les aventuriers.";
  }

  if (childAge === parentAge) {
    return "Parfait, merci. Tu as l'âge idéal pour une grande aventure.";
  }

  if (childAge > parentAge + 10) {
    return `Ah oui, ${childAge} ans ? Alors tu es sûrement un mini-grand sage. Moi je vais quand même te raconter une histoire parfaite pour toi.`;
  }

  return "Très bien, je note ton âge d'aventurier. Je garde une histoire parfaite pour toi.";
}

function politeBridge(input) {
  const normalized = input.toLowerCase();

  if (normalized.includes("merci") || normalized.includes("s'il te plaît") || normalized.includes("stp")) {
    return "Quelle belle politesse, merci à toi.";
  }

  if (state.config.lessons.includes("politesse")) {
    return "Super idée. Et si on le disait avec un petit s'il te plaît magique, ce serait encore plus fort.";
  }

  return "Super idée.";
}

function startStory() {
  state.phase = "story";
  storyButton.disabled = true;
  sessionStatus.textContent = "Histoire";

  const story = buildStory();
  speak(story);
  updateSummary();
}

function buildStory() {
  const name = state.config.name || "mon petit aventurier";
  const genre = state.answers.genre || "magique";
  const hero = state.answers.hero || name;
  const mood = state.answers.mood || "curieux";
  const themes = state.config.themes.join(", ") || "amitié";
  const lesson = state.config.lessons[0] || "gentillesse";
  const vocabulary = state.config.age <= 5 ? "simple" : "un peu plus riche";

  return [
    `Installe-toi bien, ${name}. Notre histoire ${genre} commence.`,
    `Il était une fois ${hero}, qui se sentait ${mood} et voulait découvrir un chemin secret dans un jardin lumineux.`,
    `Sur le chemin, ${hero} rencontra une petite porte qui ne s'ouvrait qu'avec trois mots doux : s'il te plaît, merci et pardon.`,
    `Comme l'histoire est pensée pour ton âge, j'utilise des mots ${vocabulary}, et une aventure autour de ${themes}.`,
    `Quand un petit problème arriva, ${hero} respira doucement, demanda de l'aide poliment, puis trouva une solution avec patience.`,
    `À la fin, tout le monde comprit une chose importante : être courageux, ce n'est pas crier très fort, c'est essayer avec un coeur gentil.`,
    `Et voilà. Si tu veux m'interrompre, tu peux ajouter une idée et je reprendrai l'histoire avec toi.`,
  ].join(" ");
}

function speak(text) {
  agentLine.textContent = text;

  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = state.config?.voiceStyle === "funny" ? 1.08 : 0.9;
  utterance.pitch = state.config?.voiceStyle === "funny" ? 1.35 : 1.05;
  window.speechSynthesis.speak(utterance);
}

function updateSummary() {
  const parts = [];

  if (state.answers.mood) parts.push(`humeur : ${state.answers.mood}`);
  if (state.answers.genre) parts.push(`style : ${state.answers.genre}`);
  if (state.answers.hero) parts.push(`héros : ${state.answers.hero}`);

  summaryScenario.textContent = parts.join(" | ") || "Discussion en cours";
  summaryThemes.textContent = state.config.themes.join(", ") || "Aucun";
  summaryAlerts.textContent = state.alerts.length ? state.alerts.join(" | ") : "Aucune";
}
