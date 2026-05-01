import { ParentConfig, ParentSummary, SessionAnswers, themeLabels } from "./types";

export const childPrompts: Array<{ key: keyof SessionAnswers; text: string }> = [
  {
    key: "childAgeAnswer",
    text: "Bonjour, moi je vais t'aider a inventer une histoire. Tu as quel age ?",
  },
  {
    key: "mood",
    text: "Et aujourd'hui, tu te sens plutot joyeux, fatigue, curieux ou un peu grognon ?",
  },
  {
    key: "genre",
    text: "Tu veux une histoire drole, magique, calme ou aventureuse ?",
  },
  {
    key: "hero",
    text: "Qui est le heros de ton histoire aujourd'hui ? Tu peux inventer n'importe qui.",
  },
];

export function extractAge(input: string) {
  const match = input.match(/\b(\d{1,2})\b/);
  return match ? Number(match[1]) : null;
}

export function buildAgeReply(childAnswer: string, parentAge: number) {
  const childAge = extractAge(childAnswer);

  if (!childAge) {
    return "Mystere d'age detecte, tres pratique pour les aventuriers.";
  }

  if (childAge === parentAge) {
    return "Parfait, merci. Tu as l'age ideal pour une grande aventure.";
  }

  if (childAge > parentAge + 10) {
    return `Ah oui, ${childAge} ans ? Alors tu es surement un mini-grand sage. Moi je vais quand meme te raconter une histoire parfaite pour toi.`;
  }

  return "Tres bien, je note ton age d'aventurier. Je garde une histoire parfaite pour toi.";
}

export function buildPoliteBridge(input: string, config: ParentConfig) {
  const normalized = input.toLowerCase();

  if (normalized.includes("merci") || normalized.includes("s'il te plait") || normalized.includes("stp")) {
    return "Quelle belle politesse, merci a toi.";
  }

  if (config.lessons.includes("politeness")) {
    return "Super idee. Et si on le disait avec un petit s'il te plait magique, ce serait encore plus fort.";
  }

  return "Super idee.";
}

export function buildStory(config: ParentConfig, answers: SessionAnswers) {
  const name = config.childName || "mon petit aventurier";
  const genre = answers.genre || "magique";
  const hero = answers.hero || name;
  const mood = answers.mood || "curieux";
  const themes = config.allowedThemes.map((theme) => themeLabels[theme]).join(", ") || "Amitie";
  const vocabulary = config.childAge <= 5 ? "avec des mots simples" : "avec des mots un peu plus riches";
  const durationCue =
    config.duration === 5
      ? "une petite histoire calme"
      : config.duration === 10
        ? "une belle histoire avec quelques rebondissements"
        : "une grande aventure douce et detaillee";

  return [
    `Installe-toi bien, ${name}. Je te raconte ${durationCue}.`,
    `Il etait une fois ${hero}, qui se sentait ${mood} et voulait vivre une aventure ${genre}.`,
    `Sur son chemin, ${hero} trouva une porte minuscule qui ne s'ouvrait qu'avec trois mots magiques : s'il te plait, merci et pardon.`,
    `Comme cette histoire est faite pour toi, je la raconte ${vocabulary}, autour de ${themes}.`,
    `${hero} rencontra un petit probleme, respira doucement, demanda de l'aide poliment, puis essaya encore avec patience.`,
    `A la fin, tout le monde comprit que le vrai courage, c'est d'avoir un coeur gentil et de reparer quand on s'est trompe.`,
    "Si tu veux m'interrompre, ajoute une idee et je reprendrai l'histoire avec toi.",
  ].join(" ");
}

export function buildParentSummary(
  config: ParentConfig,
  answers: SessionAnswers,
  alerts: string[],
): ParentSummary {
  const parts = [
    answers.mood ? `humeur : ${answers.mood}` : null,
    answers.genre ? `style : ${answers.genre}` : null,
    answers.hero ? `heros : ${answers.hero}` : null,
  ].filter(Boolean);

  return {
    scenario: parts.length > 0 ? parts.join(" | ") : "Discussion en cours",
    themes: config.allowedThemes.map((theme) => themeLabels[theme]),
    alerts,
  };
}
