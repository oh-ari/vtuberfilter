// ==UserScript==
// @name         VTuberSchedules Filter!
// @namespace    http://tampermonkey.net/
// @version      0.7
// @description  Filter out specific VTubers from vtuberschedules.com
// @author       Ari
// @match        https://vtuberschedules.com/*
// @grant        GM_addStyle
// @updateURL    https://github.com/oh-ari/vtuberfilter/raw/refs/heads/main/vtuberfilter.user.js
// @downloadURL  https://github.com/oh-ari/vtuberfilter/raw/refs/heads/main/vtuberfilter.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Load saved preferences.
    let blockedVTubers = JSON.parse(localStorage.getItem('blockedVTubers') || '[]');
    let isDarkMode = JSON.parse(localStorage.getItem('vtuberFilterDarkMode') || 'false');

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

        #vtuber-name-input {
            width: calc(100% - 24px);
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
    `);

    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'vtuber-filter-controls';
    controlsDiv.innerHTML = `
        <div class="filter-header">
            <h3 class="filter-title">▶ VTuber Filter</h3>
            <button id="theme-toggle">🌓</button>
        </div>
        <div>
            <input type="text" id="vtuber-name-input" placeholder="Enter VTuber name">
            <button id="add-vtuber">Add to filter</button>
        </div>
        <div id="blocked-vtubers-list"></div>
    `;

    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggle-filter-controls';
    toggleButton.textContent = 'Filter Settings';

    document.body.appendChild(controlsDiv);
    document.body.appendChild(toggleButton);

    function updateTheme() {
        const siteTheme = document.documentElement.getAttribute('data-theme');
        isDarkMode = siteTheme === 'dark' ? true : isDarkMode;
        controlsDiv.className = isDarkMode ? 'dark-mode' : 'light-mode';
        localStorage.setItem('vtuberFilterDarkMode', JSON.stringify(isDarkMode));
    }

    function updateBlockedList() {
        const listDiv = document.getElementById('blocked-vtubers-list');
        listDiv.innerHTML = blockedVTubers.map(name => `
            <div class="blocked-vtuber">
                <span>${name}</span>
                <button class="remove-vtuber" data-name="${name}">Remove</button>
            </div>
        `).join('');
        localStorage.setItem('blockedVTubers', JSON.stringify(blockedVTubers));
    }

    function filterStreams() {
        const streamCards = document.querySelectorAll('.stream-card-container');
        streamCards.forEach(card => {
            const titleElement = card.querySelector('.stream-card-title');
            if (titleElement && blockedVTubers.includes(titleElement.textContent.trim().toLowerCase())) {
                card.style.display = 'none';
            } else {
                card.style.display = '';
            }
        });
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

    // Watch for new streams being added.
    const observer = new MutationObserver(filterStreams);
    observer.observe(document.body, { childList: true, subtree: true });

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
        
        if (!isClickInsideFilter && !isClickOnButton && controlsDiv.classList.contains('visible')) {
            controlsDiv.classList.remove('visible');
        }
    });

    controlsDiv.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Initialize the filter.
    updateTheme();
    updateBlockedList();
    filterStreams();
})(); 
