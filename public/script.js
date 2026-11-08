// TrustLens: local heuristic checks + optional Gemini AI explanation.
const BRANDS = [
  { name: "sbi", realDomains: ["sbi.co.in", "onlinesbi.sbi", "onlinesbi.com"] },
  { name: "hdfc", realDomains: ["hdfcbank.com"] },
  { name: "icici", realDomains: ["icicibank.com"] },
  { name: "irctc", realDomains: ["irctc.co.in"] },
  { name: "paytm", realDomains: ["paytm.com"] },
  { name: "phonepe", realDomains: ["phonepe.com"] },
  { name: "google", realDomains: ["google.com", "google.co.in"] },
  { name: "microsoft", realDomains: ["microsoft.com"] },
  { name: "amazon", realDomains: ["amazon.com", "amazon.in"] },
  { name: "adamas", realDomains: ["adamasuniversity.ac.in"] }
];
const RISKY_WORDS = ["login", "verify", "secure", "update", "account", "wallet", "kyc", "otp"];
const RISKY_ENDINGS = ["xyz", "top", "click", "tk", "gq", "ml", "cf", "ga", "icu", "buzz"];

const form = document.getElementById("check-form");
const input = document.getElementById("link-input");
const resultBox = document.getElementById("result");
const checkButton = document.getElementById("check-button");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

function getHostname(text) {
  if (!text || /\s/.test(text)) return null;
  let toRead = text;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) toRead = "https://" + text;
  try {
    const url = new URL(toRead);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    return host.includes(".") || host.startsWith("[") ? host : null;
  } catch { return null; }
}

function isRealDomain(hostname, realDomains) {
  return realDomains.some(domain => hostname === domain || hostname.endsWith("." + domain));
}

function analyzeLink(link, hostname) {
  let score = 0;
  const reasons = [];
  const addReason = (points, text) => { score += points; reasons.push({ text, points }); };
  const lowerLink = link.toLowerCase();

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith("[")) {
    addReason(30, "The link uses an IP address instead of a normal website name.");
  }
  if (link.includes("@")) addReason(25, "The link contains an @ symbol, which can obscure the actual host.");
  if (lowerLink.startsWith("http://")) addReason(15, "The link uses HTTP rather than encrypted HTTPS.");
  if (hostname.includes("xn--")) addReason(25, "The domain uses punycode, which can represent lookalike characters.");
  const dotCount = hostname.split(".").length - 1;
  if (dotCount >= 4) addReason(15, `The hostname contains ${dotCount} dots, which is unusually many.`);
  if (link.length > 75) addReason(10, `The URL is unusually long (${link.length} characters).`);
  const foundWords = RISKY_WORDS.filter(word => hostname.includes(word));
  if (foundWords.length) addReason(Math.min(foundWords.length * 10, 30), `The hostname contains potentially deceptive words: ${foundWords.join(", ")}.`);
  const ending = hostname.split(".").pop();
  if (RISKY_ENDINGS.includes(ending)) addReason(10, `The domain ends in .${ending}, an extension sometimes seen in disposable domains.`);
  const fakeBrands = BRANDS.filter(brand => hostname.includes(brand.name) && !isRealDomain(hostname, brand.realDomains)).map(brand => brand.name);
  if (fakeBrands.length) addReason(40, `The hostname mentions ${fakeBrands.join(", ")} but is not on the configured official-domain list.`);
  return { score: Math.min(score, 100), reasons };
}

function getVerdict(score) {
  if (score >= 60) return { label: "High risk", cssClass: "high" };
  if (score >= 30) return { label: "Suspicious", cssClass: "mid" };
  return { label: "Low risk", cssClass: "low" };
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function showError(message) {
  resultBox.replaceChildren(el("p", "error-message", message));
  resultBox.className = "result-card";
  resultBox.hidden = false;
}
function addSectionTitle(parent, title) {
  parent.appendChild(el("h3", "result-section-title", title));
}
function renderResult(score, reasons, ai) {
  const verdict = getVerdict(score);
  resultBox.replaceChildren();
  resultBox.className = `result-card ${verdict.cssClass}`;

  const top = el("div", "result-top");
  top.appendChild(el("h2", "verdict", verdict.label));
  top.appendChild(el("span", "risk-score", `RULE SCORE ${score}/100`));
  resultBox.appendChild(top);

  const bar = el("div", "risk-bar");
  const fill = el("div", "risk-fill");
  fill.style.width = `${score}%`;
  bar.appendChild(fill);
  resultBox.appendChild(bar);

  addSectionTitle(resultBox, "Rule-based findings");
  if (!reasons.length) {
    resultBox.appendChild(el("p", "status-line", "No configured warning signs were detected. This does not prove the site is legitimate."));
  } else {
    const list = el("ul", "reason-list");
    reasons.forEach(reason => {
      const item = el("li", "", `${reason.text} `);
      item.appendChild(el("span", "points", `(+${reason.points})`));
      list.appendChild(item);
    });
    resultBox.appendChild(list);
  }

  const aiBox = el("div", "ai-insight");
  aiBox.appendChild(el("h3", "", ai ? "✳ AI security analysis" : "✳ AI security analysis unavailable"));
  aiBox.appendChild(el("p", "", ai?.analysis || "The local URL checks are shown above. Add a Gemini API key and start the backend to enable AI explanations."));
  if (ai?.recommendation) aiBox.appendChild(el("p", "recommendation", `Recommended action: ${ai.recommendation}`));
  if (ai?.caveat) aiBox.appendChild(el("p", "recommendation", ai.caveat));
  resultBox.appendChild(aiBox);
  resultBox.hidden = false;
}

async function requestAI(url, hostname, localResult) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, hostname, score: localResult.score, reasons: localResult.reasons })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "AI service request failed.");
  return data;
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const link = input.value.trim();
  if (!link) return showError("Please enter a URL first.");
  const hostname = getHostname(link);
  if (!hostname) return showError("That doesn't look like a valid HTTP or HTTPS URL. Try https://example.com");

  const localResult = analyzeLink(link, hostname);
  renderResult(localResult.score, localResult.reasons, null);
  checkButton.disabled = true;
  checkButton.querySelector("span").textContent = "Analysing…";
  const loading = el("p", "status-line", "Gemini AI is preparing an additional explanation…");
  resultBox.appendChild(loading);

  try {
    const ai = await requestAI(link, hostname, localResult);
    loading.remove();
    renderResult(localResult.score, localResult.reasons, ai);
  } catch (error) {
    loading.remove();
    renderResult(localResult.score, localResult.reasons, {
      analysis: `AI analysis could not be completed: ${error.message}`,
      recommendation: "Use the local findings cautiously. Do not enter sensitive information until you independently verify the domain.",
      caveat: "AI is an assistant, not a source of ground truth."
    });
  } finally {
    checkButton.disabled = false;
    checkButton.querySelector("span").textContent = "Analyze link";
  }
});

function addChatMessage(message, who) {
  const bubble = el("div", `chat-bubble ${who}`, message);
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
chatForm.addEventListener("submit", async event => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  addChatMessage(message, "user");
  chatInput.value = "";
  const sendButton = chatForm.querySelector("button");
  sendButton.disabled = true;
  const waiting = el("div", "chat-bubble assistant", "Thinking…");
  chatMessages.appendChild(waiting);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Assistant request failed.");
    waiting.textContent = data.answer;
  } catch (error) {
    waiting.textContent = `I couldn't reach the AI service: ${error.message}`;
  } finally {
    sendButton.disabled = false;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});
