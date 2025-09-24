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
	let channelElement = document.querySelector('#primary #top-row ytd-channel-name#channel-name a');
	if (!channelElement) {
		channelElement = document.querySelector('ytd-video-owner-renderer #upload-info a#text');
	}
	return channelElement ? channelElement.textContent.trim() : null;
}

function getLikeButton() {
	const likeButton = document.querySelector('div#top-level-buttons-computed like-button-view-model toggle-button-view-model button-view-model button.yt-spec-button-shape-next') || document.querySelector('div#top-level-buttons-computed button[aria-label*="Gostei"]');
	return likeButton;
}

function likeVideo(likeButton) {
	likeButton ??= getLikeButton();
	console.log('Liking video...');
	if (likeButton && likeButton.getAttribute('aria-pressed') !== 'true') {
		channelName = getChannelName();
		likeButton.click();
		showToast(chrome.i18n.getMessage("toastLiked", channelName));
		console.log('Video liked');
	} else if (!likeButton) {
		showToast(chrome.i18n.getMessage("toastNotFound"));
	}
}

function checkAndLike() {
	if (!window.location.href.includes('youtube.com/watch')) return;

	console.log('Checking and liking...');

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
					setTimeout(checkAndLike, 5000); // Tenta novamente em 5 segundos
					return;
				}
				if (response && Array.isArray(response.channels) && response.channels.includes(channelName)) {
					console.log('Channel include in checkAndLike list')
					const checkLikeButton = setInterval(() => {
						const likeButton = getLikeButton();
						if (likeButton) {
							console.log('Like button found')
							clearInterval(checkLikeButton);
							clearTimeout(t2);
							setTimeout(likeVideo, 1000, likeButton);
						}
					}, 500);
					const t2 = setTimeout(() => {
						console.log('Terminate liking')
						clearInterval(checkLikeButton);
					}, 20000);
				}
			});
		}
	}, 500);
	const t1 = setTimeout(() => {
		console.log('Terminate Checking')
		clearInterval(checkDOM);
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
			chrome.runtime.sendMessage({ type: "keepAlive" }, (response) => {
				if (chrome.runtime.lastError || !response) {
					console.error('Erro ao enviar keepAlive ou service worker suspenso:', chrome.runtime.lastError);
					setTimeout(checkAndLike, 5000); // Reinicia a lógica
				}
			});
		}
	}, 10000);
	chrome.runtime.onMessage.addListener((message) => {
		if (message.type === "added_checkAndLike") {
			const channel = message.channel;
			if (channel === getChannelName()) {
				likeVideo();
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