// =====================================================
//  TrustLens – checks if a link has phishing warning signs
//  Everything runs in your browser. The link is never
//  opened and never sent anywhere.
// =====================================================


// ---------- EDIT THESE LISTS ----------

// Famous brands. "realDomains" are the REAL websites of that brand.
// If a link mentions the brand but is not one of its real domains, it is suspicious.
const BRANDS = [
  { name: "sbi",       realDomains: ["sbi.co.in", "onlinesbi.sbi", "onlinesbi.com"] },
  { name: "hdfc",      realDomains: ["hdfcbank.com"] },
  { name: "icici",     realDomains: ["icicibank.com"] },
  { name: "irctc",     realDomains: ["irctc.co.in"] },
  { name: "paytm",     realDomains: ["paytm.com"] },
  { name: "phonepe",   realDomains: ["phonepe.com"] },
  { name: "google",    realDomains: ["google.com", "google.co.in"] },
  { name: "microsoft", realDomains: ["microsoft.com"] },
  { name: "amazon",    realDomains: ["amazon.com", "amazon.in"] },
  { name: "adamas",    realDomains: ["adamasuniversity.ac.in"] }
];

// Words scammers love to put in fake website names
const RISKY_WORDS = ["login", "verify", "secure", "update", "account", "wallet", "kyc", "otp"];

// Website endings that are often used for throwaway sites
const RISKY_ENDINGS = ["xyz", "top", "click", "tk", "gq", "ml", "cf", "ga", "icu", "buzz"];

// ---------- END OF LISTS ----------


// Step 1: get only the hostname from the text.
// Returns the hostname (like "sbi-login.xyz") or null if it's not a valid link.
function getHostname(text) {
  if (text === "" || /\s/.test(text)) {
    return null; // empty, or has spaces inside
  }

  // If the user forgot "https://", add it just for reading the link
  let toRead = text;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    toRead = "https://" + text;
  }

  try {
    const url = new URL(toRead); // only reads the text, never visits it
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    const host = url.hostname.toLowerCase();
    // A real link needs a dot (like example.com) or be an IPv6 address
    if (!host.includes(".") && !host.startsWith("[")) {
      return null;
    }
    return host;
  } catch (error) {
    return null;
  }
}

// Is this hostname exactly a real domain, or a subdomain of it?
// (mail.google.com counts as google.com, but google.com.evil.xyz does not)
function isRealDomain(hostname, realDomains) {
  return realDomains.some(function (domain) {
    return hostname === domain || hostname.endsWith("." + domain);
  });
}

// Step 2 and 3: run all checks, return the score and the reasons.
function analyzeLink(link, hostname) {
  let score = 0;
  const reasons = []; // each item: { text, points }

  function addReason(points, text) {
    score += points;
    reasons.push({ text: text, points: points });
  }

  const lowerLink = link.toLowerCase();

  // IP address instead of a website name
  const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const isIPv6 = hostname.startsWith("[");
  if (isIPv4 || isIPv6) {
    addReason(30, "The link uses a number address (IP address) instead of a normal website name.");
  }

  // @ symbol
  if (link.includes("@")) {
    addReason(25, "The link contains an @ symbol, which can hide the real website.");
  }

  // http:// instead of https://
  if (lowerLink.startsWith("http://")) {
    addReason(15, "The link starts with http:// so the connection is not encrypted.");
  }

  // xn-- (lookalike letters)
  if (hostname.includes("xn--")) {
    addReason(25, "The website name uses lookalike letters (xn--) that can imitate a real name.");
  }

  // Too many dots
  const dotCount = hostname.split(".").length - 1;
  if (dotCount >= 4) {
    addReason(15, "The website name has " + dotCount + " dots, which is unusually many.");
  }

  // Very long link
  if (link.length > 75) {
    addReason(10, "The link is very long (" + link.length + " characters).");
  }

  // Risky words (+10 each, max +30)
  const foundWords = RISKY_WORDS.filter(function (word) {
    return hostname.includes(word);
  });
  if (foundWords.length > 0) {
    const wordPoints = Math.min(foundWords.length * 10, 30);
    addReason(wordPoints, "The website name contains pushy words: " + foundWords.join(", ") + ".");
  }

  // Uncommon ending like .xyz
  const ending = hostname.split(".").pop();
  if (RISKY_ENDINGS.includes(ending)) {
    addReason(10, "The website ends in ." + ending + ", which is often used for throwaway sites.");
  }

  // Famous brand name, but not the real domain
  const fakeBrands = BRANDS.filter(function (brand) {
    return hostname.includes(brand.name) && !isRealDomain(hostname, brand.realDomains);
  }).map(function (brand) {
    return brand.name;
  });
  if (fakeBrands.length > 0) {
    addReason(40, "The website name uses the brand name (" + fakeBrands.join(", ") +
      ") but is not that brand's real website.");
  }

  // Max score is 100
  if (score > 100) {
    score = 100;
  }

  return { score: score, reasons: reasons };
}

// Step 3: turn the score into a verdict. We never say a site is "safe".
function getVerdict(score) {
  if (score >= 60) {
    return { label: "High risk", cssClass: "high" };
  }
  if (score >= 30) {
    return { label: "Suspicious", cssClass: "mid" };
  }
  return { label: "Low risk", cssClass: "low" };
}


// ---------- Showing things on the page (textContent only) ----------

const form = document.getElementById("check-form");
const input = document.getElementById("link-input");
const resultBox = document.getElementById("result");

function makeElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== undefined) {
    el.textContent = text; // textContent keeps everything as plain text
  }
  return el;
}

function showError(message) {
  resultBox.textContent = ""; // clears the old result
  resultBox.className = "error";
  resultBox.appendChild(makeElement("p", "error-message", message));
  resultBox.hidden = false;
}

function showResult(score, reasons) {
  const verdict = getVerdict(score);

  resultBox.textContent = "";
  resultBox.className = verdict.cssClass;

  resultBox.appendChild(makeElement("h2", "verdict", verdict.label));
  resultBox.appendChild(makeElement("p", "score", "Risk score: " + score + " / 100"));

  const bar = makeElement("div", "bar");
  const fill = makeElement("div", "bar-fill");
  fill.style.width = score + "%";
  bar.appendChild(fill);
  resultBox.appendChild(bar);

  if (reasons.length === 0) {
    resultBox.appendChild(makeElement("p", "reasons-title",
      "No warning signs found in this link. This is not a guarantee, so stay careful."));
  } else {
    resultBox.appendChild(makeElement("p", "reasons-title", "Why:"));
    const list = makeElement("ul", "reasons");
    reasons.forEach(function (reason) {
      const item = makeElement("li", "", reason.text + " ");
      item.appendChild(makeElement("span", "points", "(+" + reason.points + ")"));
      list.appendChild(item);
    });
    resultBox.appendChild(list);
  }

  resultBox.hidden = false;
}

// Hides the result box and wipes anything inside it
function hideResult() {
  resultBox.hidden = true;
  resultBox.textContent = "";
  resultBox.className = "";
}

// The page starts with no result at all. The box only appears after Check is clicked.
hideResult();

// When "Check" is clicked (or Enter is pressed)
form.addEventListener("submit", function (event) {
  event.preventDefault(); // stop the page from reloading

  const link = input.value.trim();

  // Nothing typed (or only spaces): ask for a link and show no verdict
  if (link === "") {
    showError("Please type a link first");
    return;
  }

  const hostname = getHostname(link);

  if (hostname === null) {
    showError("Hmm, that doesn't look like a link. Try something like https://example.com");
    return;
  }

  const result = analyzeLink(link, hostname);
  showResult(result.score, result.reasons);
});
