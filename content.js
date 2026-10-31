// Função para injetar estilos CSS na página
function injectToastStyles() {
	const styleId = 'custom-toast-styles';
	if (!document.getElementById(styleId)) {
		const style = document.createElement('style');
		style.id = styleId;
		style.textContent = `
			.custom-toast {
				min-width: 250px;
				color: white;
				background-color: #5c6bc0;
				border-radius: 5px;
				padding: 10px 15px;
				box-shadow: 0 0 10px rgba(0, 0, 0, 1);
				opacity: 0;
				transition: opacity 0.3s ease-in-out;
				position: fixed;
				bottom: 20px;
				left: 20px;
				z-index: 10000;
				display: flex;
				align-items: center;
				justify-content: space-between;
			}
			.custom-toast.show {
				opacity: 1;
			}
			.custom-toast span {
				font-size: 14px;
				font-weight: 500;
			}
			.custom-toast .toast-close {
				background: none;
				border: none;
				color: white;
				font-size: 16px;
				margin-left: 10px;
				margin-bottom: 2px;
				cursor: pointer;
			}
		`;
		document.head.appendChild(style);
	}
}

// Função para mostrar um toast
function showToast(message) {
	injectToastStyles();
	const toast = document.createElement('div');
	toast.className = 'custom-toast';
	toast.innerHTML = `
		<span>${message}</span>
		<button class="toast-close">✕</button>
	`;
	document.body.appendChild(toast);
	setTimeout(() => toast.classList.add('show'), 100);
	const timeout = setTimeout(() => {
		toast.classList.remove('show');
		setTimeout(() => toast.remove(), 300);
	}, 10000);
	toast.querySelector('.toast-close').addEventListener('click', () => {
		clearTimeout(timeout);
		toast.classList.remove('show');
		setTimeout(() => toast.remove(), 300);
	});
}

function getChannelName() {
	// Try multiple selectors for different YouTube layouts
	// More specific selectors first — avoid broad ones that could match comments/recommended
	const selectors = [
		'#primary #top-row ytd-channel-name#channel-name a',
		'ytd-watch-metadata ytd-channel-name a',
		'ytd-video-owner-renderer #upload-info a#text',
		'#owner #channel-name a',
	];
	for (const selector of selectors) {
		const el = document.querySelector(selector);
		if (el && el.textContent.trim()) return el.textContent.trim();
	}
	return null;
}

function getLikeButton() {
	// Try multiple selectors for the like button across YouTube layouts
	const selectors = [
		// Current YouTube (2024-2025) segmented like button
		'like-button-view-model button.yt-spec-button-shape-next',
		// Older structure
		'div#top-level-buttons-computed like-button-view-model button',
		'div#top-level-buttons-computed button[aria-label*="Like"]',
		'div#top-level-buttons-computed button[aria-label*="Gostei"]',
		'div#top-level-buttons-computed button[aria-label*="喜欢"]',
		`div#top-level-buttons-computed button[aria-label*="J'aime"]`,
		`div#top-level-buttons-computed button[aria-label*="Мне нравится"]`,
		'div#top-level-buttons-computed button[aria-label*="Gefällt mir"]',
		'div#top-level-buttons-computed button[aria-label*="いいね"]',
		'div#top-level-buttons-computed button[aria-label*="좋아요"]',
		// Segment button structure
		'ytd-segmented-like-dislike-button-renderer #like-button button',
		// Fallback: first button in like/dislike area
		'#top-level-buttons-computed ytd-toggle-button-renderer:first-child button',
	];
	for (const selector of selectors) {
		const el = document.querySelector(selector);
		if (el) return el;
	}
	return null;
}

function likeVideo(likeButton, expectedChannel) {
	likeButton ??= getLikeButton();
	console.log('Liking video...');
	if (likeButton && likeButton.getAttribute('aria-pressed') !== 'true') {
		const currentChannel = getChannelName();
		if (expectedChannel && currentChannel !== expectedChannel) {
			console.log('Channel mismatch, aborting like. Expected:', expectedChannel, 'Got:', currentChannel);
			return;
		}
		likeButton.click();
		showToast(chrome.i18n.getMessage("toastLiked", currentChannel));
		console.log('Video liked');
	} else if (!likeButton) {
		showToast(chrome.i18n.getMessage("toastNotFound"));
	}
}

let checkInProgress = false;

function checkAndLike(retryCount = 0) {
	if (!window.location.href.includes('youtube.com/watch')) return;
	if (retryCount > 3) {
		console.log('Max retries reached, giving up');
		return;
	}
	if (checkInProgress) {
		console.log('Check already in progress, skipping');
		return;
	}

	console.log('Checking and liking...');
	checkInProgress = true;
	const startUrl = window.location.href;

	const checkDOM = setInterval(() => {
		const channelName = getChannelName();
		if (channelName) {
			console.log('Channel name:', channelName);
			clearInterval(checkDOM);
			clearTimeout(t1);
			chrome.runtime.sendMessage({ type: "checkAndLike" }, (response) => {
				console.log('Response checkAndLike', response)
				if (chrome.runtime.lastError || !response) {
					console.error('Erro na comunicação com background ou service worker suspenso:', chrome.runtime.lastError);
					checkInProgress = false;
					setTimeout(() => checkAndLike(retryCount + 1), 5000); // Tenta novamente em 5 segundos
					return;
				}
				if (response && Array.isArray(response.channels) && response.channels.includes(channelName)) {
					console.log('Channel included in checkAndLike list:', channelName);
					let t2;
					const checkLikeButton = setInterval(() => {
						// Abort if user navigated away
						if (window.location.href !== startUrl) {
							console.log('URL changed during like check, aborting');
							clearInterval(checkLikeButton);
							if (t2) clearTimeout(t2);
							checkInProgress = false;
							return;
						}
						const likeButton = getLikeButton();
						if (likeButton) {
							console.log('Like button found');
							clearInterval(checkLikeButton);
							if (t2) clearTimeout(t2);
							setTimeout(likeVideo, 1000, likeButton, channelName);
							checkInProgress = false;
						}
					}, 500);
					t2 = setTimeout(() => {
						console.log('Terminate liking - button not found in 20s');
						clearInterval(checkLikeButton);
						checkInProgress = false;
					}, 20000);
				} else {
					console.log('Channel not in liked list:', channelName, 'List:', response?.channels);
					checkInProgress = false;
				}
			});
		}
	}, 500);
	const t1 = setTimeout(() => {
		console.log('Terminate Checking')
		clearInterval(checkDOM);
		checkInProgress = false;
	}, 20000);
}

// Monitora mudanças no DOM
function startDomObserver() {
	let lastUrl = window.location.href;
	const observer = new MutationObserver(() => {
		const currentUrl = window.location.href;
		if (currentUrl !== lastUrl) {
			console.log('URL changed:', currentUrl);
			lastUrl = currentUrl;
			setTimeout(checkAndLike, 1000);
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });
}

// Mantém o service worker ativo
function keepServiceWorkerAlive() {
	setInterval(() => {
		if (window.location.href.includes('youtube.com')) {
			chrome.runtime.sendMessage({ type: "keepAlive" }, () => {
				// Ignore errors - background may be sleeping
				void chrome.runtime.lastError;
			});
		}
	}, 30000); // Reduced from 10s to 30s
	chrome.runtime.onMessage.addListener((message) => {
		if (message.type === "added_checkAndLike") {
			const channel = message.channel;
			if (!channel) {
				// No specific channel - trigger full check (e.g., after import)
				checkAndLike();
			} else if (channel === getChannelName()) {
				likeVideo(undefined, channel);
			}
		}
	});
}

// Inicialização
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		checkAndLike();
		startDomObserver();
		keepServiceWorkerAlive();
	});
} else {
	checkAndLike();
	startDomObserver();
	keepServiceWorkerAlive();
}