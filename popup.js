let channels = [];

function getChannelName() {
    let channelElement = document.querySelector('#primary #top-row ytd-channel-name#channel-name a');
    if (!channelElement) {
        channelElement = document.querySelector('ytd-video-owner-renderer #upload-info a#text');
    }
    return channelElement ? channelElement.textContent.trim() : null;
}

document.addEventListener('DOMContentLoaded', () => {
    const channelInput = document.getElementById('channelInput');
    const addButton = document.getElementById('addButton');
    const exportButton = document.getElementById('exportButton');
    const importButton = document.getElementById('importButton');
    const orText = document.getElementById('orText');

    channelInput.placeholder = chrome.i18n.getMessage("channelPlaceholder");
    addButton.textContent = chrome.i18n.getMessage("addButton");
    exportButton.textContent = chrome.i18n.getMessage("export");
    importButton.textContent = chrome.i18n.getMessage("import");
    orText.textContent = chrome.i18n.getMessage("or") || "ou"; // fallback se não tiver "or"

    function loadChannels() {
        chrome.storage.sync.get(['likedChannels'], (result) => {
            channels = result.likedChannels || [];
            // Ordena alfabeticamente o array channels
            channels = channels.sort((a, b) => a.localeCompare(b));
            channelList.innerHTML = '';
            channels.forEach(channel => {
                const div = document.createElement('div');
                div.className = 'channel-item';
                div.textContent = channel;
                const removeBtn = document.createElement('button');
                removeBtn.textContent = '✕';
                removeBtn.style.marginLeft = '10px';
                removeBtn.onclick = () => removeChannel(channel);
                div.appendChild(removeBtn);
                channelList.appendChild(div);
            });
        });
    }

    function addChannel(channel) {
        if (!channel) return;
        chrome.storage.sync.get(['likedChannels'], (result) => {
            const channels = result.likedChannels || [];
            if (!channels.includes(channel)) {
                channels.push(channel);
                chrome.storage.sync.set({ likedChannels: channels }, () => {
                    loadChannels();
                    channelInput.value = '';
                });
            }
        });
        chrome.tabs.query({ url: '*://*.youtube.com/watch?*' }, (tabs) => {
            tabs.forEach((tab) => {
                chrome.tabs.sendMessage(tab.id, { type: "added_checkAndLike", channel: channel });
            });
        });
    }

    function removeChannel(channel) {
        chrome.storage.sync.get(['likedChannels'], (result) => {
            const channels = result.likedChannels || [];
            const updatedChannels = channels.filter(ch => ch !== channel);
            chrome.storage.sync.set({ likedChannels: updatedChannels }, loadChannels);
        });
    }

    function exportChannels() {
        chrome.storage.sync.get(['likedChannels'], (result) => {
            const channels = result.likedChannels || [];
            const jsonData = JSON.stringify(channels, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'favoritos-do-youtube.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    function importChannels() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedChannels = JSON.parse(e.target.result);
                        if (Array.isArray(importedChannels)) {
                            chrome.storage.sync.set({ likedChannels: importedChannels }, () => {
                                loadChannels();
                                alert(chrome.i18n.getMessage("importSuccess"));
                            });
                        } else {
                            alert(chrome.i18n.getMessage("importErrorFormat"));
                        }
                    } catch (error) {
                        alert(chrome.i18n.getMessage("importErrorInvalid"));
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    function checkAddButton() {
        if (channels.includes(channelInput.value.trim())) {
            addButton.disabled = true;
        } else {
            addButton.disabled = false;
        }
    }

    function fillInput() {
        console.log('Filling input...');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (currentTab.url && currentTab.url.includes('youtube.com/watch')) {
                chrome.scripting.executeScript({
                    target: { tabId: currentTab.id },
                    func: getChannelName
                }, (results) => {
                    console.log('Channel name:', results);
                    const channelName = results[0].result;
                    if (channelName) {
                        channelInput.value = channelName;
                        checkAddButton();
                    }
                });
            }
        });
    }

    addButton.onclick = () => addChannel(channelInput.value.trim());
    channelInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            addChannel(channelInput.value.trim())
        } else {
            checkAddButton();
        }
    };
    channelInput.oninput = checkAddButton;

    exportButton.onclick = exportChannels;
    importButton.onclick = importChannels;

    loadChannels();
    fillInput();
});