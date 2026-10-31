// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensão instalada ou atualizada, configurando alarms.");
  chrome.alarms.create("keepAlive", { periodInMinutes: 0.5 }); // A cada 30 segundos
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    console.log("Service worker mantido vivo:", new Date());
    // Envia ping às abas do YouTube
    chrome.tabs.query({ url: "*://*.youtube.com/watch*" }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: "ping" }, () => {
          // Suppress errors for tabs that don't have content script
          void chrome.runtime.lastError;
        });
      });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Mensagem recebida no background:', message);
  if (message.type === "checkAndLike") {
    chrome.storage.sync.get(['likedChannels'], (result) => {
      const likedChannels = result.likedChannels || [];
      sendResponse({ channels: likedChannels });
    });
    return true; // Necessário para mensagens assíncronas
  } else if (message.type === "keepAlive" || message.type === "ping") {
    sendResponse({ status: "alive" });
  }
});