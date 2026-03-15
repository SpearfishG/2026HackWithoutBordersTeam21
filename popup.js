document.addEventListener("DOMContentLoaded", () => {
  const countrySelect = document.getElementById("countrySelect");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  // Load saved country when popup opens
  chrome.storage.sync.get(["selectedCountry"], (result) => {
    countrySelect.value = result.selectedCountry || "Any";
  });

  // Save selected country
  saveBtn.addEventListener("click", () => {
    const selectedCountry = countrySelect.value;

    chrome.storage.sync.set({ selectedCountry }, () => {
      status.textContent = `Saved country: ${selectedCountry}`;
    });
  });
});