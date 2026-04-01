const GENERATE_API_URL = "/api/generate";

const notesInput = document.getElementById("notesInput");
const photoInput = document.getElementById("photoInput");
const ocrStatus = document.getElementById("ocrStatus");
const studyOutput = document.getElementById("studyOutput");
const summarizeBtn = document.getElementById("summarizeBtn");
const quizBtn = document.getElementById("quizBtn");
const flashcardsBtn = document.getElementById("flashcardsBtn");

const startOralBtn = document.getElementById("startOralBtn");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");
const oralQuestion = document.getElementById("oralQuestion");
const oralAnswer = document.getElementById("oralAnswer");
const evaluateAnswerBtn = document.getElementById("evaluateAnswerBtn");
const oralFeedback = document.getElementById("oralFeedback");

const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

const oralState = {
  questions: [],
  index: 0
};

function splitSentences(text) {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

function getKeywords(text) {
  const stopwords = new Set([
    "di", "a", "da", "in", "con", "su", "per", "tra", "fra", "il", "lo", "la", "i", "gli", "le", "un",
    "uno", "una", "e", "o", "ma", "che", "del", "della", "dello", "dei", "degli", "delle", "al", "ai",
    "agli", "alle", "nel", "nello", "nei", "negli", "nelle", "non", "si", "come", "piu", "più", "meno"
  ]);
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !stopwords.has(w));

  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

async function askGemini(prompt) {
  const response = await fetch(GENERATE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt
    })
  });

  if (!response.ok) {
    let detail = "Errore sconosciuto";
    try {
      const errJson = await response.json();
      detail = errJson?.error || errJson?.message || JSON.stringify(errJson);
    } catch (_) {
      detail = await response.text();
    }
    throw new Error(`API HTTP ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const text = data?.text;

  if (!text) {
    throw new Error("Risposta Gemini non valida o vuota.");
  }

  return text.trim();
}

function summarizeTextLocal(text) {
  const sentences = splitSentences(text);
  if (!sentences.length) return "Testo troppo corto per creare un riassunto.";

  const keywords = getKeywords(text);
  const scored = sentences.map((s) => {
    const score = keywords.reduce((acc, k) => acc + (s.toLowerCase().includes(k) ? 1 : 0), 0);
    return { sentence: s, score };
  });

  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(6, scored.length))
    .map((x) => `- ${x.sentence}`);

  return `Riassunto locale (fallback):\n\n${top.join("\n")}`;
}

function generateQuizLocal(text) {
  const sentences = splitSentences(text).slice(0, 10);
  if (!sentences.length) return "Aggiungi più testo per generare un quiz.";

  const quiz = sentences.map((s, i) => {
    const words = s.split(/\s+/).filter((w) => w.length > 5);
    const target = words[Math.floor(Math.random() * words.length)] || words[0];
    if (!target) {
      return `${i + 1}) Spiega con parole tue: ${s}`;
    }
    const hidden = s.replace(target, "_____");
    return `${i + 1}) Completa la frase:\n${hidden}\nRisposta: ${target}`;
  });
  return `Quiz locale (fallback):\n\n${quiz.join("\n\n")}`;
}

async function summarizeText(text) {
  if (!text || text.trim().length < 30) {
    return "Testo troppo corto per creare un riassunto.";
  }

  const prompt = `
Sei un tutor scolastico. Crea un riassunto in italiano chiaro e strutturato dei seguenti appunti.
Regole:
- massimo 180 parole
- formato a punti elenco
- evidenzia solo concetti principali

APPUNTI:
${text}
  `.trim();

  return askGemini(prompt);
}

async function generateQuiz(text) {
  if (!text || text.trim().length < 30) {
    return "Aggiungi più testo per generare un quiz.";
  }

  const prompt = `
Genera un quiz in italiano basato sugli appunti qui sotto.
Regole:
- crea 6 domande a scelta multipla
- ogni domanda deve avere 4 opzioni (A, B, C, D)
- indica la risposta corretta dopo ogni domanda
- difficolta media per studenti

APPUNTI:
${text}
  `.trim();

  return askGemini(prompt);
}

function generateFlashcards(text) {
  const keywords = getKeywords(text).slice(0, 12);
  const sentences = splitSentences(text);
  if (!keywords.length || !sentences.length) return "Testo insufficiente per creare flashcards.";

  const cards = keywords.map((k, i) => {
    const related = sentences.find((s) => s.toLowerCase().includes(k)) || "Definizione da completare.";
    return `Card ${i + 1}\nDomanda: Cos'e "${k}"?\nRisposta: ${related}`;
  });

  return `Flashcards generate:\n\n${cards.join("\n\n")}`;
}

function createOralQuestions(text) {
  const keywords = getKeywords(text).slice(0, 8);
  if (!keywords.length) return [];

  return keywords.map((k, i) => {
    if (i % 2 === 0) return `Spiegami in modo semplice il concetto di "${k}".`;
    return `Collega "${k}" a un esempio pratico che hai studiato.`;
  });
}

function evaluateOralAnswer(answer, sourceText) {
  if (!answer || answer.trim().length < 20) {
    return "Valutazione: risposta troppo breve. Prova ad approfondire con definizione, esempio e collegamenti.";
  }
  const keywords = getKeywords(sourceText);
  const hits = keywords.filter((k) => answer.toLowerCase().includes(k)).length;
  const score = Math.min(10, Math.max(4, hits + 4));
  return `Valutazione: ${score}/10\nFeedback: buona base. Migliora aggiungendo esempi concreti e relazioni tra i concetti principali.`;
}

function tutorReply(message, sourceText) {
  const lower = message.toLowerCase();
  if (lower.includes("riassunto")) return summarizeText(sourceText);
  if (lower.includes("quiz")) return generateQuiz(sourceText);
  if (lower.includes("flashcard")) return generateFlashcards(sourceText);
  if (lower.includes("interrog")) return "Per l'interrogazione vai alla sezione 'Interrogazione AI' e premi 'Avvia Interrogazione'.";
  if (!sourceText.trim()) {
    return "Incolla prima degli appunti o carica una foto: cosi posso aiutarti in modo preciso.";
  }
  const keywords = getKeywords(sourceText).slice(0, 5).join(", ");
  return `Tutor 24/7: in base ai tuoi appunti, i temi piu importanti sono: ${keywords}. Se vuoi, ti preparo subito quiz o flashcard.`;
}

function appendMessage(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

photoInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  ocrStatus.textContent = "OCR in corso...";
  try {
    const { data } = await Tesseract.recognize(file, "ita+eng");
    const extracted = (data && data.text) ? data.text.trim() : "";
    if (!extracted) {
      ocrStatus.textContent = "Nessun testo rilevato nella foto.";
      return;
    }
    notesInput.value = `${notesInput.value}\n${extracted}`.trim();
    ocrStatus.textContent = "Testo estratto dalla foto e aggiunto agli appunti.";
  } catch (err) {
    ocrStatus.textContent = "Errore OCR. Prova un'immagine piu nitida.";
    console.error(err);
  }
});

summarizeBtn.addEventListener("click", async () => {
  studyOutput.textContent = "Generazione riassunto con Gemini in corso...";
  summarizeBtn.disabled = true;
  try {
    const result = await summarizeText(notesInput.value);
    studyOutput.textContent = result;
  } catch (err) {
    console.error(err);
    const fallback = summarizeTextLocal(notesInput.value);
    studyOutput.textContent =
      `${fallback}\n\nNota: Gemini non disponibile ora.\nDettaglio errore: ${err.message}`;
  } finally {
    summarizeBtn.disabled = false;
  }
});

quizBtn.addEventListener("click", async () => {
  studyOutput.textContent = "Generazione quiz con Gemini in corso...";
  quizBtn.disabled = true;
  try {
    const result = await generateQuiz(notesInput.value);
    studyOutput.textContent = result;
  } catch (err) {
    console.error(err);
    const fallback = generateQuizLocal(notesInput.value);
    studyOutput.textContent =
      `${fallback}\n\nNota: Gemini non disponibile ora.\nDettaglio errore: ${err.message}`;
  } finally {
    quizBtn.disabled = false;
  }
});

flashcardsBtn.addEventListener("click", () => {
  studyOutput.textContent = generateFlashcards(notesInput.value);
});

startOralBtn.addEventListener("click", () => {
  oralState.questions = createOralQuestions(notesInput.value);
  oralState.index = 0;
  if (!oralState.questions.length) {
    oralQuestion.textContent = "Aggiungi appunti piu ricchi per iniziare l'interrogazione.";
    return;
  }
  oralQuestion.textContent = `Domanda 1: ${oralState.questions[0]}`;
  nextQuestionBtn.disabled = false;
  evaluateAnswerBtn.disabled = false;
  oralFeedback.textContent = "";
});

nextQuestionBtn.addEventListener("click", () => {
  if (!oralState.questions.length) return;
  oralState.index += 1;
  if (oralState.index >= oralState.questions.length) {
    oralQuestion.textContent = "Interrogazione completata. Ottimo lavoro!";
    nextQuestionBtn.disabled = true;
    evaluateAnswerBtn.disabled = true;
    return;
  }
  oralQuestion.textContent = `Domanda ${oralState.index + 1}: ${oralState.questions[oralState.index]}`;
  oralAnswer.value = "";
  oralFeedback.textContent = "";
});

evaluateAnswerBtn.addEventListener("click", () => {
  oralFeedback.textContent = evaluateOralAnswer(oralAnswer.value, notesInput.value);
});

sendChatBtn.addEventListener("click", () => {
  const message = chatInput.value.trim();
  if (!message) return;
  appendMessage(message, "user");
  const response = tutorReply(message, notesInput.value);
  setTimeout(() => appendMessage(response, "ai"), 250);
  chatInput.value = "";
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChatBtn.click();
});

appendMessage(
  "Ciao! Sono il tuo assistente AI 24/7. Incolla appunti o carica una foto e ti aiuto a studiare.",
  "ai"
);
