// ==UserScript==
// @name         VTuberSchedules Filter!
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  Filter out specific VTubers from vtuberschedules.com and get Discord notifications for upcoming streams.
// @author       Ari
// @match        https://vtuberschedules.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @updateURL    https://github.com/oh-ari/vtuberfilter/raw/refs/heads/main/vtuberfilter.user.js
// @downloadURL  https://github.com/oh-ari/vtuberfilter/raw/refs/heads/main/vtuberfilter.user.js
// ==/UserScript==

(function() {
    'use strict';

    const storage = {
        get: (key, defaultValue) => {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;
            try {
                return JSON.parse(value);
            } catch (e) {
                return value;
            }
        },
        set: (key, value) => localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    };

    // Load saved preferences from localStorage.
    let blockedVTubers = storage.get('blockedVTubers', []);
    let isDarkMode = storage.get('vtuberFilterDarkMode', false);
    let notifyVTubers = storage.get('notifyVTubers', []);
    let discordWebhook = storage.get('discordWebhook', '');
    let notifiedStreams = storage.get('notifiedStreams', []);
    let isBackgroundMode = storage.get('vtuberFilterBackgroundMode', false);

    GM_addStyle(`
        #vtuber-filter-controls {
            position: fixed;
            top: 65px;
            right: 60px;
            background: var(--filter-bg);
            color: var(--filter-text);
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            border: 2px solid var(--filter-border);
            z-index: 9999;
            width: 280px;
            transition: all 0.3s ease;
            opacity: 0;
            visibility: hidden;
            transform: translateY(-10px);
            max-height: 80vh;
            overflow-y: auto;
        }

        #toggle-filter-controls {
            position: fixed;
            top: 15px;
            right: 60px;
            z-index: 10000;
            padding: 10px 20px;
            background: var(--mdc-filled-button-container-color, #9146FF);
            color: var(--mdc-filled-button-label-text-color, white);
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 12px rgba(145, 70, 255, 0.3);
        }

        #toggle-filter-controls:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(145, 70, 255, 0.4);
            filter: brightness(1.1);
        }

        #toggle-filter-controls:active {
            transform: translateY(0);
            box-shadow: 0 2px 8px rgba(145, 70, 255, 0.3);
        }

        [data-theme="dark"] #toggle-filter-controls {
            background: var(--mdc-filled-button-container-color, #772ce8);
            box-shadow: 0 2px 12px rgba(119, 44, 232, 0.3);
        }

        [data-theme="dark"] #toggle-filter-controls:hover {
            box-shadow: 0 4px 16px rgba(119, 44, 232, 0.4);
        }

        #vtuber-filter-controls.visible {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }

        #vtuber-filter-controls * {
            transition: all 0.3s ease;
        }

        #vtuber-filter-controls.light-mode {
            --filter-bg: #ffffff;
            --filter-text: #1a1a1a;
            --filter-input-bg: #f0f0f0;
            --filter-input-text: #1a1a1a;
            --filter-button-bg: #9146FF;
            --filter-button-text: #ffffff;
            --filter-item-bg: #f5f5f5;
            --filter-remove-bg: #ff4444;
            --filter-title-color: #9146FF;
            --filter-border: rgba(145, 70, 255, 0.2);
            --filter-title-gradient: linear-gradient(135deg, #9146FF, #784eca);
        }

        #vtuber-filter-controls.dark-mode {
            --filter-bg: #1f1f1f;
            --filter-text: #ffffff;
            --filter-input-bg: #2d2d2d;
            --filter-input-text: #ffffff;
            --filter-button-bg: #9146FF;
            --filter-button-text: #ffffff;
            --filter-item-bg: #2d2d2d;
            --filter-remove-bg: #ff4444;
            --filter-title-color: #bf94ff;
            --filter-border: rgba(145, 70, 255, 0.3);
            --filter-title-gradient: linear-gradient(135deg, #bf94ff, #9146FF);
        }

        .filter-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid var(--filter-border);
        }

        .filter-title {
            font-size: 1.4em;
            font-weight: 700;
            background: var(--filter-title-gradient);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0;
            letter-spacing: 0.5px;
            white-space: nowrap;
        }

        .discord-icon {
            width: 24px;
            height: 20px;
            vertical-align: middle;
            margin-right: 8px;
            margin-top: -3px;
            -webkit-text-fill-color: initial;
        }

        .discord-section h4.filter-title {
            font-size: 1.4em;
            font-weight: 700;
            background: var(--filter-title-gradient);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0 0 15px 0;
            letter-spacing: 0.5px;
            white-space: nowrap;
            display: flex;
            align-items: center;
        }

        .discord-section {
            max-height: 0;
            opacity: 0;
            overflow: hidden;
            margin-top: 0;
            padding-top: 0;
            border-top: 2px solid transparent;
            transition: all 0.3s ease-in-out;
        }

        .discord-section.visible {
            max-height: 1000px;
            opacity: 1;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid var(--filter-border);
        }

        .discord-section > * {
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.3s ease-in-out;
        }

        .discord-section.visible > * {
            transform: translateY(0);
            opacity: 1;
        }

        .discord-section > *:nth-child(1) { transition-delay: 0.1s; }
        .discord-section > *:nth-child(2) { transition-delay: 0.2s; }
        .discord-section > *:nth-child(3) { transition-delay: 0.3s; }
        .discord-section > *:nth-child(4) { transition-delay: 0.4s; }

        #vtuber-name-input {
            width: calc(100% - 70px);
            padding: 10px 12px;
            border: 1px solid var(--filter-input-bg);
            border-radius: 6px;
            background: var(--filter-input-bg);
            color: var(--filter-input-text);
            margin: 15px 0 10px 0;
            font-size: 14px;
            transition: border-color 0.2s ease;
        }

        #vtuber-name-input:focus {
            outline: none;
            border-color: var(--filter-button-bg);
        }

        #pick-vtuber {
            width: 40px;
            padding: 8px;
            background: var(--filter-item-bg);
            color: var(--filter-text);
            border: 1px solid var(--filter-border);
            border-radius: 6px;
            cursor: pointer;
            font-size: 18px;
            transition: all 0.2s ease;
            margin: 15px 0 10px 6px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        #pick-vtuber:hover {
            background: var(--filter-button-bg);
            color: var(--filter-button-text);
        }

        #pick-vtuber.active {
            background: var(--filter-button-bg);
            color: var(--filter-button-text);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }

        .pickable {
            position: relative;
            cursor: pointer !important;
        }

        .pickable::after {
            content: '➕';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 24px;
            color: white;
            background: rgba(145, 70, 255, 0.9);
            padding: 15px;
            border-radius: 50%;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
        }

        /* Smaller size for quick links */
        .quick-link-wrapper.pickable::after {
            font-size: 16px;
            padding: 8px;
        }

        .pickable:hover::after {
            opacity: 1;
        }

        #add-vtuber {
            width: 100%;
            padding: 10px;
            background: var(--filter-button-bg);
            color: var(--filter-button-text);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
            margin-bottom: 15px;
        }

        #add-vtuber:hover {
            background: #7f3ad7;
        }

        #blocked-vtubers-list {
            margin: 10px 0;
            max-height: 200px;
            overflow-y: auto;
            padding-right: 5px;
        }

        #blocked-vtubers-list::-webkit-scrollbar {
            width: 6px;
        }

        #blocked-vtubers-list::-webkit-scrollbar-track {
            background: var(--filter-bg);
        }

        #blocked-vtubers-list::-webkit-scrollbar-thumb {
            background: var(--filter-button-bg);
            border-radius: 3px;
        }

        .blocked-vtuber {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 8px 0;
            padding: 10px 12px;
            background: var(--filter-item-bg);
            border-radius: 6px;
            transition: transform 0.2s ease;
        }

        .blocked-vtuber:hover {
            transform: translateX(-2px);
        }

        .remove-vtuber {
            background: var(--filter-remove-bg);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 10px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        }

        .remove-vtuber:hover {
            background: #ff2020;
        }

        #theme-toggle {
            background: none;
            border: none;
            cursor: pointer;
            color: var(--filter-text);
            padding: 6px;
            font-size: 1.2em;
            transition: transform 0.2s ease;
            opacity: 0.8;
        }

        #theme-toggle:hover {
            transform: rotate(15deg);
            opacity: 1;
        }

        .settings-buttons {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px solid var(--filter-border);
        }

        .settings-button {
            flex: 1;
            padding: 8px;
            background: var(--filter-item-bg);
            color: var(--filter-text);
            border: 1px solid var(--filter-border);
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        }

        .settings-button:hover {
            background: var(--filter-button-bg);
            color: var(--filter-button-text);
        }

        #import-file {
            display: none;
        }

        .notification-section {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid var(--filter-border);
        }

        .notification-section h4 {
            margin: 0 0 10px 0;
            color: var(--filter-text);
            font-size: 1.1em;
        }

        .webhook-group {
            margin-bottom: 10px;
        }

        #webhook-input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--filter-input-bg);
            border-radius: 6px;
            background: var(--filter-input-bg);
            color: var(--filter-input-text);
            margin-bottom: 10px;
            font-size: 14px;
            box-sizing: border-box;
        }

        #webhook-input:focus {
            outline: none;
            border-color: var(--filter-button-bg);
        }

        #save-webhook, #add-notify {
            width: 100%;
            padding: 10px;
            background: var(--filter-button-bg);
            color: var(--filter-button-text);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
            margin-bottom: 10px;
        }

        #save-webhook:hover, #add-notify:hover {
            background: #7f3ad7;
        }

        .discord-input-group {
            display: flex;
            gap: 6px;
            margin-bottom: 15px;
        }

        #discord-name-input {
            width: calc(100% - 46px);
            padding: 10px 12px;
            border: 1px solid var(--filter-input-bg);
            border-radius: 6px;
            background: var(--filter-input-bg);
            color: var(--filter-input-text);
            font-size: 14px;
            transition: border-color 0.2s ease;
        }

        #discord-name-input:focus {
            outline: none;
            border-color: var(--filter-button-bg);
        }

        #pick-notify {
            width: 40px;
            padding: 8px;
            background: var(--filter-item-bg);
            color: var(--filter-text);
            border: 1px solid var(--filter-border);
            border-radius: 6px;
            cursor: pointer;
            font-size: 18px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        #pick-notify:hover {
            background: var(--filter-button-bg);
            color: var(--filter-button-text);
        }

        #pick-notify.active {
            background: var(--filter-button-bg);
            color: var(--filter-button-text);
            animation: pulse 2s infinite;
        }

        #notify-vtubers-list {
            margin: 10px 0;
            max-height: 200px;
            overflow-y: auto;
            padding-right: 5px;
        }

        #notify-vtubers-list::-webkit-scrollbar {
            width: 6px;
        }

        #notify-vtubers-list::-webkit-scrollbar-track {
            background: var(--filter-bg);
        }

        #notify-vtubers-list::-webkit-scrollbar-thumb {
            background: var(--filter-button-bg);
            border-radius: 3px;
        }

        .notify-vtuber {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 8px 0;
            padding: 10px 12px;
            background: var(--filter-item-bg);
            border-radius: 6px;
            transition: transform 0.2s ease;
        }

        .notify-vtuber:hover {
            transform: translateX(-2px);
        }

        .remove-notify {
            background: var(--filter-remove-bg);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 10px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        }

        .remove-notify:hover {
            background: #ff2020;
        }

        .header-buttons {
            display: flex;
            gap: 8px;
        }

        #discord-toggle {
            background: none;
            border: none;
            cursor: pointer;
            color: var(--filter-text);
            padding: 6px;
            font-size: 1.2em;
            transition: transform 0.2s ease;
            opacity: 0.8;
        }

        #discord-toggle:hover {
            transform: rotate(15deg);
            opacity: 1;
        }

        #discord-toggle.active {
            color: var(--filter-button-bg);
            opacity: 1;
        }

        .notify-pickable {
            position: relative;
            cursor: pointer !important;
        }

        .notify-pickable::after {
            content: '🔔';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 24px;
            background: rgba(145, 70, 255, 0.9);
            padding: 15px;
            border-radius: 50%;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
        }

        /* Smaller size for quick links */
        .quick-link-wrapper.notify-pickable::after {
            font-size: 16px;
            padding: 8px;
        }

        .notify-pickable:hover::after {
            opacity: 1;
        }

        .notification-status {
            background: var(--filter-item-bg);
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-size: 13px;
        }

        #next-check {
            color: var(--filter-text);
            margin-bottom: 5px;
        }

        #last-notification {
            color: var(--filter-text);
            opacity: 0.8;
            font-size: 12px;
        }
    `);

    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'vtuber-filter-controls';
    controlsDiv.innerHTML = `
        <div class="filter-header">
            <h3 class="filter-title">▶ VTuber Filter</h3>
            <div class="header-buttons">
                <button id="discord-toggle" title="Toggle Discord Notifications">🎮</button>
                <button id="theme-toggle" title="Toggle Dark Mode">🌓</button>
            </div>
        </div>
        <div style="display: flex;">
            <input type="text" id="vtuber-name-input" placeholder="Enter VTuber name">
            <button id="pick-vtuber" title="Click to enable VTuber selection mode">⊘</button>
        </div>
        <button id="add-vtuber">Add to filter</button>
        <div id="blocked-vtubers-list"></div>
        <div class="settings-buttons">
            <button id="export-settings" class="settings-button">Export Settings</button>
            <input type="file" id="import-file" accept=".json">
            <button id="import-settings" class="settings-button">Import Settings</button>
        </div>
        <div class="discord-section">
            <h4 class="filter-title"><img src="https://i.imgur.com/hBvt8E5.png" class="discord-icon" alt="Discord"> Discord Notifications</h4>
            <div class="webhook-group">
                <input type="text" id="webhook-input" placeholder="Discord Webhook URL" value="${discordWebhook}">
                <button id="save-webhook" class="settings-button">Save Webhook</button>
            </div>
            <div id="notification-status" class="notification-status">
                <div id="next-check">Next check in: --:--</div>
                <div id="last-notification">Last notification: Never</div>
            </div>
            <div class="discord-input-group">
                <input type="text" id="discord-name-input" placeholder="Enter VTuber name">
                <button id="pick-notify" title="Click to enable VTuber selection mode">+</button>
            </div>
            <button id="add-notify" class="settings-button" style="width: 100%;">Add to notifications</button>
            <div id="notify-vtubers-list"></div>
            <button id="background-mode-toggle" class="settings-button" style="width: 100%;">
                ${isBackgroundMode ? 'Disable Background Mode' : 'Enable Background Mode'}
            </button>
        </div>
    `;

    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggle-filter-controls';
    toggleButton.textContent = 'Filter Settings';

    document.body.appendChild(controlsDiv);
    document.body.appendChild(toggleButton);

    function updateTheme() {
        const siteTheme = document.documentElement.getAttribute('data-theme');
        isDarkMode = siteTheme === 'dark' || isDarkMode;
        controlsDiv.className = isDarkMode ? 'dark-mode' : 'light-mode';
        storage.set('vtuberFilterDarkMode', JSON.stringify(isDarkMode));
    }

    function updateBlockedList() {
        const listDiv = document.getElementById('blocked-vtubers-list');
        listDiv.innerHTML = blockedVTubers.map(name => `
            <div class="blocked-vtuber">
                <span>${name}</span>
                <button class="remove-vtuber" data-name="${name}">Remove</button>
            </div>
        `).join('');
        storage.set('blockedVTubers', blockedVTubers);
    }

    function filterStreams() {
        // Filter main stream cards and quick links panel.
        const streamCards = document.querySelectorAll('.stream-card-container');
        streamCards.forEach(card => {
            const titleElement = card.querySelector('.stream-card-title');
            if (titleElement && blockedVTubers.includes(titleElement.textContent.trim().toLowerCase())) {
                card.style.display = 'none';
            } else {
                card.style.display = '';
            }
        });

        const quickLinks = document.querySelectorAll('.quick-link-wrapper');
        quickLinks.forEach(link => {
            const nameElement = link.querySelector('.quick-link-streamer-name');
            if (nameElement) {
                const name = nameElement.getAttribute('title').toLowerCase();
                if (blockedVTubers.includes(name)) {
                    link.closest('.ng-star-inserted').style.display = 'none';
                } else {
                    link.closest('.ng-star-inserted').style.display = '';
                }
            }
        });
    }

    let isPickMode = false;

    function togglePickMode(enable) {
        isPickMode = enable;
        const pickButton = document.getElementById('pick-vtuber');
        pickButton.classList.toggle('active', isPickMode);

        // Toggle pickable class on stream cards and quick links.
        document.querySelectorAll('.stream-card-container, .quick-link-wrapper').forEach(element => {
            if (!blockedVTubers.includes(getVTuberName(element)?.toLowerCase())) {
                element.classList.toggle('pickable', isPickMode);
            }
        });
    }

    function getVTuberName(element) {
        // Extract VTuber name from quick link or stream card.
        const quickLinkName = element.querySelector('.quick-link-streamer-name')?.getAttribute('title');
        if (quickLinkName) return quickLinkName;

        const streamCardName = element.querySelector('.stream-card-title')?.textContent;
        if (streamCardName) return streamCardName.trim();

        return null;
    }

    // Event handlers.
    toggleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        controlsDiv.classList.toggle('visible');
        const currentTheme = isDarkMode ? 'dark-mode' : 'light-mode';
        if (!controlsDiv.classList.contains(currentTheme)) {
            controlsDiv.classList.add(currentTheme);
        }
    });

    document.getElementById('theme-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        isDarkMode = !isDarkMode;
        const wasVisible = controlsDiv.classList.contains('visible');
        updateTheme();
        if (wasVisible) {
            controlsDiv.classList.add('visible');
        }
    });

    document.getElementById('add-vtuber').addEventListener('click', () => {
        const input = document.getElementById('vtuber-name-input');
        const name = input.value.trim().toLowerCase();
        if (name && !blockedVTubers.includes(name)) {
            blockedVTubers.push(name);
            updateBlockedList();
            filterStreams();
            input.value = '';
        }
    });

    document.getElementById('blocked-vtubers-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-vtuber')) {
            const name = e.target.dataset.name;
            blockedVTubers = blockedVTubers.filter(v => v !== name);
            updateBlockedList();
            filterStreams();
        }
    });

    // Export settings handler.
    document.getElementById('export-settings').addEventListener('click', (e) => {
        e.stopPropagation();
        const settings = {
            blockedVTubers,
            isDarkMode,
            notifyVTubers,
            discordWebhook,
            isBackgroundMode,
            notifiedStreams
        };

        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vtuber-filter-settings.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Import settings handler.
    document.getElementById('import-settings').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
        e.stopPropagation();
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const settings = JSON.parse(event.target.result);
                    if (settings.blockedVTubers && Array.isArray(settings.blockedVTubers)) {
                        blockedVTubers = settings.blockedVTubers;
                        storage.set('blockedVTubers', blockedVTubers);
                    }
                    if (typeof settings.isDarkMode === 'boolean') {
                        isDarkMode = settings.isDarkMode;
                        storage.set('vtuberFilterDarkMode', JSON.stringify(isDarkMode));
                    }
                    if (settings.notifyVTubers && Array.isArray(settings.notifyVTubers)) {
                        notifyVTubers = settings.notifyVTubers;
                        storage.set('notifyVTubers', JSON.stringify(notifyVTubers));
                    }
                    if (settings.discordWebhook) {
                        discordWebhook = settings.discordWebhook;
                        storage.set('discordWebhook', discordWebhook);
                        document.getElementById('webhook-input').value = discordWebhook;
                    }
                    if (typeof settings.isBackgroundMode === 'boolean') {
                        isBackgroundMode = settings.isBackgroundMode;
                        storage.set('vtuberFilterBackgroundMode', JSON.stringify(isBackgroundMode));
                        const button = document.getElementById('background-mode-toggle');
                        button.textContent = isBackgroundMode ? 'Disable Background Mode' : 'Enable Background Mode';
                        if (isBackgroundMode) {
                            startBackgroundMode();
                        } else {
                            stopBackgroundMode();
                        }
                    }
                    if (settings.notifiedStreams && Array.isArray(settings.notifiedStreams)) {
                        notifiedStreams = settings.notifiedStreams;
                        storage.set('notifiedStreams', JSON.stringify(notifiedStreams));
                    }
                    updateTheme();
                    updateBlockedList();
                    updateNotifyList();
                    filterStreams();
                } catch (error) {
                    console.error('Failed to import settings:', error);
                }
            };
            reader.readAsText(file);
        }
    });

    // Add pick button handler.
    document.getElementById('pick-vtuber').addEventListener('click', (e) => {
        e.stopPropagation();
        togglePickMode(!isPickMode);
    });

    // Add click handlers for pickable elements.
    document.addEventListener('click', (e) => {
        if (!isPickMode) return;

        const streamCard = e.target.closest('.stream-card-container');
        const quickLink = e.target.closest('.quick-link-wrapper');
        const target = streamCard || quickLink;

        if (target && target.classList.contains('pickable')) {
            const name = getVTuberName(target);
            if (name) {
                const nameLower = name.toLowerCase();
                if (!blockedVTubers.includes(nameLower)) {
                    blockedVTubers.push(nameLower);
                    updateBlockedList();
                    filterStreams();
                    target.classList.remove('pickable');
                }
            }
            e.preventDefault();
            e.stopPropagation();
        }
    });

    // Watch for new streams being added.
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme') {
                updateTheme();
            } else if (mutation.type === 'childList') {
                filterStreams();
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-theme']
    });

    // Watch for site theme changes.
    const themeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme') {
                updateTheme();
            }
        });
    });

    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });

    // Handle clicking outside the filter panel.
    document.addEventListener('click', (e) => {
        const isClickInsideFilter = controlsDiv.contains(e.target);
        const isClickOnButton = toggleButton.contains(e.target);
        const isPickModeClick = isPickMode && (e.target.closest('.stream-card-container') || e.target.closest('.quick-link-wrapper'));
        const isNotifyPickModeClick = isNotifyPickMode && (e.target.closest('.stream-card-container') || e.target.closest('.quick-link-wrapper'));

        if (!isClickInsideFilter && !isClickOnButton && !isPickModeClick && !isNotifyPickModeClick && controlsDiv.classList.contains('visible')) {
            controlsDiv.classList.remove('visible');
            togglePickMode(false);
            toggleNotifyPickMode(false);
        }
    });

    controlsDiv.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    function updateNotifyList() {
        const listDiv = document.getElementById('notify-vtubers-list');
        listDiv.innerHTML = notifyVTubers.map(name => `
            <div class="notify-vtuber">
                <span>${name}</span>
                <button class="remove-notify" data-name="${name}">Remove</button>
            </div>
        `).join('');
        storage.set('notifyVTubers', notifyVTubers);

        listDiv.querySelectorAll('.remove-notify').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = button.dataset.name;
                notifyVTubers = notifyVTubers.filter(v => v !== name);
                updateNotifyList();
            });
        });
    }

    // Add background mode toggle handler.
    document.getElementById('background-mode-toggle').addEventListener('click', () => {
        isBackgroundMode = !isBackgroundMode;
        storage.set('vtuberFilterBackgroundMode', JSON.stringify(isBackgroundMode));
        const button = document.getElementById('background-mode-toggle');
        button.textContent = isBackgroundMode ? 'Disable Background Mode' : 'Enable Background Mode';
        if (isBackgroundMode) {
            startBackgroundMode();
        } else {
            stopBackgroundMode();
        }
    });

    let lastCheckTime = null;
    let nextCheckTimeout = null;

    function updateTimer() {
        if (!isBackgroundMode) {
            document.getElementById('next-check').textContent = 'Background mode disabled';
            return;
        }

        const now = new Date().getTime();
        const nextCheck = lastCheckTime ? lastCheckTime + (5 * 60 * 1000) : now;
        const timeLeft = Math.max(0, nextCheck - now);

        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);

        document.getElementById('next-check').textContent =
            `Next check in: ${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft > 0) {
            requestAnimationFrame(() => {
                updateTimer();
            });
        }
    }

    function getStreamTimestamp(timeStr) {
        // Parse time string and convert to Unix timestamp.
        const [time, period] = timeStr.split(' ');
        const [hours, minutes] = time.split(':').map(Number);

        const date = new Date();

        if (period === 'PM' && hours !== 12) {
            date.setHours(hours + 12);
        }
        else if (period === 'AM' && hours === 12) {
            date.setHours(0);
        }
        else {
            date.setHours(hours);
        }

        date.setMinutes(minutes);
        date.setSeconds(0);
        date.setMilliseconds(0);

        if (date.getTime() < Date.now()) {
            date.setDate(date.getDate() + 1);
        }

        return Math.floor(date.getTime() / 1000);
    }

    async function checkUpcomingStreams() {
        if (!discordWebhook || notifyVTubers.length === 0) return;

        lastCheckTime = new Date().getTime();
        updateTimer();

        try {
            // Fetch streams from page or background.
            const quickLinksSelector = '.quick-link-wrapper';
            let upcomingStreams;

            if (isBackgroundMode && document.hidden) {
                const response = await fetch('https://vtuberschedules.com/');
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                upcomingStreams = doc.querySelectorAll(quickLinksSelector);
            } else {
                upcomingStreams = document.querySelectorAll(quickLinksSelector);
            }

            const now = new Date().getTime();
            let notificationSent = false;

            const seenStreams = new Set();

            for (const stream of upcomingStreams) {
                const nameElement = stream.querySelector('.quick-link-streamer-name');
                const timeElement = stream.querySelector('.quick-link-stream-info-line span b');
                const streamLink = stream.closest('a')?.href;

                if (!nameElement || !timeElement || !streamLink) continue;

                const vtuberName = nameElement.textContent.trim();
                const streamTime = timeElement.textContent.trim();

                if (!notifyVTubers.includes(vtuberName.toLowerCase())) continue;

                const streamKey = `${vtuberName}-${streamTime}-${streamLink}`;

                if (seenStreams.has(streamKey)) continue;
                seenStreams.add(streamKey);

                const timestamp = getStreamTimestamp(streamTime);

                const streamDate = new Date();
                const streamId = JSON.stringify({
                    name: vtuberName,
                    time: streamTime,
                    url: streamLink,
                    date: streamDate.toISOString().split('T')[0]
                });

                if (!notifiedStreams.includes(streamId)) {
                    try {
                        await fetch(discordWebhook, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                content: `${vtuberName} is going live at ${streamTime} (<t:${timestamp}:R>) | ${streamLink}`
                            })
                        });

                        notifiedStreams.push(streamId);

                        const sevenDaysAgo = new Date();
                        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                        notifiedStreams = notifiedStreams.filter(streamJson => {
                            try {
                                const stream = JSON.parse(streamJson);
                                return new Date(stream.date) >= sevenDaysAgo;
                            } catch (e) {
                                return false;
                            }
                        });

                        storage.set('notifiedStreams', notifiedStreams);

                        notificationSent = true;
                        document.getElementById('last-notification').textContent =
                            `Last notification: ${vtuberName} at ${new Date().toLocaleTimeString()}`;
                    } catch (error) {
                        console.error('Failed to send Discord notification:', error);
                    }
                }
            }

            if (!notificationSent) {
                document.getElementById('last-notification').textContent =
                    `Last check: ${new Date().toLocaleTimeString()} (No new streams)`;
            }
        } catch (error) {
            console.error('Failed to check upcoming streams:', error);
        }
    }

    function startBackgroundMode() {
        // Create hidden iframe to keep page active in background.
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = 'https://vtuberschedules.com/';
        document.body.appendChild(iframe);

        window.vtuberFilterIframe = iframe;
        window.vtuberFilterInterval = setInterval(checkUpcomingStreams, 5 * 60 * 1000);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        lastCheckTime = new Date().getTime();
        updateTimer();
        checkUpcomingStreams();
    }

    function stopBackgroundMode() {
        if (window.vtuberFilterIframe) {
            window.vtuberFilterIframe.remove();
            window.vtuberFilterIframe = null;
        }

        if (window.vtuberFilterInterval) {
            clearInterval(window.vtuberFilterInterval);
            window.vtuberFilterInterval = null;
        }

        if (nextCheckTimeout) {
            clearTimeout(nextCheckTimeout);
            nextCheckTimeout = null;
        }

        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.getElementById('next-check').textContent = 'Background mode disabled';
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            if (isBackgroundMode && !window.vtuberFilterInterval) {
                startBackgroundMode();
            }
        } else {
            checkUpcomingStreams();
        }
    }

    document.getElementById('save-webhook').addEventListener('click', () => {
        const webhookInput = document.getElementById('webhook-input');
        discordWebhook = webhookInput.value.trim();
        storage.set('discordWebhook', discordWebhook);
    });

    let isNotifyPickMode = false;

    function toggleNotifyPickMode(enable) {
        isNotifyPickMode = enable;
        const pickButton = document.getElementById('pick-notify');
        pickButton.classList.toggle('active', isNotifyPickMode);
        document.querySelectorAll('.stream-card-container, .quick-link-wrapper').forEach(element => {
            if (!notifyVTubers.includes(getVTuberName(element)?.toLowerCase())) {
                element.classList.toggle('notify-pickable', isNotifyPickMode);
            }
        });
    }

    // Add pick notify button handler.
    document.getElementById('pick-notify').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNotifyPickMode(!isNotifyPickMode);
    });

    document.addEventListener('click', (e) => {
        if (!isNotifyPickMode) return;

        const streamCard = e.target.closest('.stream-card-container');
        const quickLink = e.target.closest('.quick-link-wrapper');
        const target = streamCard || quickLink;

        if (target && target.classList.contains('notify-pickable')) {
            const name = getVTuberName(target);
            if (name) {
                const nameLower = name.toLowerCase();
                if (!notifyVTubers.includes(nameLower)) {
                    notifyVTubers.push(nameLower);
                    updateNotifyList();
                    target.classList.remove('notify-pickable');
                }
            }
            e.preventDefault();
            e.stopPropagation();
        }
    });

    document.getElementById('add-notify').addEventListener('click', () => {
        const input = document.getElementById('discord-name-input');
        const name = input.value.trim().toLowerCase();
        if (name && !notifyVTubers.includes(name)) {
            notifyVTubers.push(name);
            updateNotifyList();
            input.value = '';
        }
    });

    document.getElementById('discord-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        const discordSection = document.querySelector('.discord-section');
        const discordToggle = document.getElementById('discord-toggle');
        discordSection.classList.toggle('visible');
        discordToggle.classList.toggle('active');
    });

    document.getElementById('discord-name-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('pick-notify').click();
        }
    });

    document.getElementById('webhook-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('save-webhook').click();
        }
    });

    // Initialize the filter and notification system.
    updateTheme();
    updateBlockedList();
    filterStreams();
    updateNotifyList();

    if (isBackgroundMode) {
        startBackgroundMode();
        // Check immediately on page load, testing purposes that I'll probably leave here.
        checkUpcomingStreams();
    }
})();
