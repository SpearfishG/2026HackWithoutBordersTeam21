let popupEl = null;
let hoverTimer = null;
let activeWordEl = null;
let detectedTerms = [];

initialize();

async function initialize() {
  const pageText = getPageText();

  chrome.runtime.sendMessage(
    {
      type: "DETECT_CULTURAL_TERMS",
      text: pageText,
    },
    (response) => {
      detectedTerms = response?.terms || [];
      if (detectedTerms.length > 0) {
        highlightTerms(document.body, detectedTerms);
      }
    }
  );
}

function getPageText() {
  return document.body.innerText.slice(0, 5000);
}

function highlightTerms(root, terms) {
  if (!terms || terms.length === 0) return;

  const sortedTerms = [...terms].sort((a, b) => b.length - a.length);
  walkTextNodes(root, (textNode) => {
    const parent = textNode.parentNode;
    if (!parent) return;
    if (
      parent.closest(".culture-popup") ||
      parent.closest("script") ||
      parent.closest("style") ||
      parent.closest("textarea") ||
      parent.closest("input")
    ) {
      return;
    }

    const originalText = textNode.nodeValue;
    if (!originalText.trim()) return;

    let replaced = false;
    let fragment = document.createDocumentFragment();
    let remainingText = originalText;

    while (remainingText.length > 0) {
      let earliestMatch = null;
      let matchedTerm = null;

      for (const term of sortedTerms) {
        const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
        const match = regex.exec(remainingText);
        if (match) {
          if (!earliestMatch || match.index < earliestMatch.index) {
            earliestMatch = match;
            matchedTerm = term;
          }
        }
      }

      if (!earliestMatch) {
        fragment.appendChild(document.createTextNode(remainingText));
        break;
      }

      const start = earliestMatch.index;
      const matchedText = earliestMatch[0];

      if (start > 0) {
        fragment.appendChild(
          document.createTextNode(remainingText.slice(0, start))
        );
      }

      const span = document.createElement("span");
      span.className = "culture-word";
      span.textContent = matchedText;
      span.dataset.word = matchedTerm;
      attachHoverEvents(span);
      fragment.appendChild(span);

      remainingText = remainingText.slice(start + matchedText.length);
      replaced = true;
    }

    if (replaced) {
      parent.replaceChild(fragment, textNode);
    }
  });
}

function walkTextNodes(node, callback) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  for (const textNode of textNodes) {
    callback(textNode);
  }
}

function attachHoverEvents(element) {
  element.addEventListener("mouseenter", () => {
    hoverTimer = setTimeout(() => {
      activeWordEl = element;
      loadPopup(element, element.dataset.word);
    }, 600);
  });

  element.addEventListener("mouseleave", () => {
    clearTimeout(hoverTimer);
  });
}

function loadPopup(targetElement, word) {
  chrome.runtime.sendMessage(
    {
      type: "GET_CULTURAL_INFO",
      word: word,
    },
    (data) => {
      if (!data) return;
      showDataPopup(targetElement, data);
    }
  );
}

function showDataPopup(targetElement, data) {
  removePopup();

  const imageHtml = data.image
    ? `<img class="culture-popup-image" src="${data.image}" alt="${escapeHtml(
        data.title
      )}">`
    : "";

  createPopupShell(
    targetElement,
    `
      <div class="culture-popup-header">${escapeHtml(data.title)}</div>
      ${imageHtml}
      <div class="culture-popup-culture">${escapeHtml(data.culture)}</div>
      <div class="culture-popup-text">${escapeHtml(data.text)}</div>
    `
  );
}

function createPopupShell(targetElement, innerHtml) {
  popupEl = document.createElement("div");
  popupEl.className = "culture-popup";
  popupEl.innerHTML = innerHtml;

  document.body.appendChild(popupEl);

  const rect = targetElement.getBoundingClientRect();
  popupEl.style.top = `${window.scrollY + rect.bottom + 8}px`;
  popupEl.style.left = `${window.scrollX + rect.left}px`;

  popupEl.addEventListener("mouseenter", () => {
    clearTimeout(hoverTimer);
  });

  popupEl.addEventListener("mouseleave", () => {
    removePopup();
  });
}

document.addEventListener("mouseover", (event) => {
  const hoveredInsidePopup = popupEl && popupEl.contains(event.target);
  const hoveredWord =
    event.target.classList && event.target.classList.contains("culture-word");

  if (!hoveredInsidePopup && !hoveredWord) {
    clearTimeout(hoverTimer);
    removePopup();
  }
});

function removePopup() {
  if (popupEl) {
    popupEl.remove();
    popupEl = null;
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}