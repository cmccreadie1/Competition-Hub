
    const APP_VERSION = "v7.5.0"; // Version update for Embedded Manual
    document.getElementById('vTag').innerText = APP_VERSION;

    const zones = ['RED', 'YELLOW', 'GREEN', 'BLUE'];
    
    const zColors = { 
        'RED': 'var(--red-color)', 
        'YELLOW': 'var(--yellow-color)', 
        'GREEN': 'var(--green-color)', 
        'BLUE': 'var(--blue-color)' 
    };
    
    let isAppReady = false; 
    let appState = []; 
    let scoreState = {}; // SCORECARD DATA BUCKET
    let matchDays = 2;
    let currentZoneSize = 0; 
    let isSwapMode = false;
    let swapObj1 = null; 
    let mobilityMode = 'A'; 
    let accEnabled = false; 
    let trashCan = null;
    let currentScoreDay = 1;
    let sweepstakeOptIns = {}; // Track secret pairs opt in logic

    const genId = () => {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    };

    function showToast(msg) {
        const t = document.getElementById('toastBanner');
        t.innerHTML = msg;
        t.style.top = '25px';
        setTimeout(() => { t.style.top = '-100px'; }, 3000);
    }

    // ====================================================
    // --- POPUP MENU LOGIC ---
    // ====================================================
    function openManageMenu() { document.getElementById('manageMenuModal').style.display = 'flex'; }
    function openOutputMenu() { document.getElementById('outputMenuModal').style.display = 'flex'; }
    function closePopups() {
        document.getElementById('manageMenuModal').style.display = 'none';
        document.getElementById('outputMenuModal').style.display = 'none';
    }

    // ====================================================
    // --- TAB NAVIGATION LOGIC ---
    // ====================================================
    function switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
        
        let activeTabBtn = document.getElementById(`tabBtn-${tabId}`);
        activeTabBtn.classList.add('active');
        document.getElementById(`${tabId}Tab`).style.display = 'block';
        
        if (tabId === 'draw') {
        document.body.className = 'stage-draw';
    } else if (tabId === 'pairs') {
        document.body.className = 'stage-pairs';
        renderOptInList();
        updatePrizeFund();
    } else if (tabId === 'leaderboard') {
        document.body.className = 'stage-leaderboard';
        switchLeaderboardSubTab('lbd1'); // Forces the active pill to calculate and draw Day 1 immediately
    } else {
        document.body.className = 'stage-score';
        const dayTabs = document.getElementById('dayTabsContainer');
        if (dayTabs) dayTabs.style.display = matchDays === 2 ? 'flex' : 'none';
        switchScoreDay(1);
    }
    }

   function switchScoreDay(day) {
        currentScoreDay = day;
        document.body.className = day === 1 ? 'stage-score-d1' : 'stage-score-d2';
        document.getElementById('dayWatermark').innerText = 'DAY ' + day;
        
        document.querySelectorAll('.day-tab-btn').forEach(btn => btn.classList.remove('active'));
        let activeSubBtn = document.getElementById(`subBtn-${day}`);
        if(activeSubBtn) activeSubBtn.classList.add('active');
        
        document.getElementById('scoreSearch').value = ''; 
        renderScorecards();
    }

    // ====================================================
    // --- SCORE PROGRESS TALLY LOGIC ---
    // ====================================================
    function updateScoreProgress() {
        let totalExpected = 0;
        let completelyFilled = 0;

        appState.forEach(e => {
            e.anglers.forEach((a, aIdx) => {
                let targetZ = currentScoreDay === 1 ? a.z1 : a.z2;
                if (a.name && targetZ) {
                    totalExpected++;
                    let key = `${e.id}_${aIdx}_${currentScoreDay}`;
                    let s = scoreState[key] || {};
                    let filled = (s.len ? 1 : 0) + (s.count ? 1 : 0) + (s.big ? 1 : 0) + (s.spec ? 1 : 0);
                    if (filled === 4) { completelyFilled++; }
                }
            });
        });
        
        const progText = document.getElementById('scoreProgressText');
        const progContainer = document.getElementById('scoreBadgeContainer');
        const progBar = document.getElementById('scoreProgressBar');
        
        if (progText && progContainer && progBar) {
            let remaining = totalExpected - completelyFilled;
            progText.innerText = `DAY ${currentScoreDay} SCORES: ${completelyFilled} ENTERED | ${remaining} REMAINING`;
            
            let pct = totalExpected === 0 ? 0 : (completelyFilled / totalExpected) * 100;
            progBar.style.width = pct + '%';
            
            if (completelyFilled === totalExpected && totalExpected > 0) {
                progContainer.style.background = 'var(--green-color)';
                progBar.style.display = 'none'; 
            } else {
                progContainer.style.background = '#1e293b';
                progBar.style.display = 'block';
            }
        }
    }
    
    // ====================================================
    // --- LIVE SEARCH FILTER LOGIC ---
    // ====================================================
    function filterScorecards() {
        let filter = document.getElementById('scoreSearch').value.toUpperCase();
        let rows = document.querySelectorAll('.score-row');
        
        rows.forEach(row => {
            let name = row.querySelector('.s-name').innerText.toUpperCase();
            let team = row.querySelector('.s-team').innerText.toUpperCase();
            
            if (name.includes(filter) || team.includes(filter)) {
                row.style.display = 'grid'; 
            } else {
                row.style.display = 'none';
            }
        });
    }

    // ====================================================
    // --- LINEAR SCORECARD LOGIC ---
    // ====================================================
    function highlightRow(el) { el.closest('.score-row').classList.add('focused-row'); }
    function unhighlightRow(el) { el.closest('.score-row').classList.remove('focused-row'); }

    function enforceLimits(el, maxDigits) {
        if(el.value.length > maxDigits) {
            el.value = el.value.slice(0, maxDigits);
        }
    }

    function renderScorecards() {
        const container = document.getElementById('scoreListContainer');
        container.innerHTML = '';
        
        let hasDrawnData = false;
        
        let headerRow = document.createElement('div');
        headerRow.className = 'score-list-header';
        headerRow.innerHTML = `
            <div>ANGLER</div>
            <div>TEAM</div>
            <div>PEG</div>
            <div style="text-align:center;">LENGTH</div>
            <div style="text-align:center;">FISH CT</div>
            <div style="text-align:center;">BIGGEST</div>
            <div style="text-align:center;">SPECIES</div>
        
        `;
        container.appendChild(headerRow);

        let sortedState = [...appState].sort((a,b) => (a.tName||"").localeCompare(b.tName||""));

        sortedState.forEach(e => {
            e.anglers.forEach((a, aIdx) => {
                let targetZ = currentScoreDay === 1 ? a.z1 : a.z2;
                let targetP = currentScoreDay === 1 ? a.p1 : a.p2;

                if (!a.name || !targetZ) return;
                hasDrawnData = true;

                let tName = (e.isTeam && e.tName && e.tName.trim() !== "") ? e.tName.trim() : "";
                let key = `${e.id}_${aIdx}_${currentScoreDay}`;
                let s = scoreState[key] || {len:'', count:'', big:'', spec:'', witPeg:''};
                let zColor = zColors[targetZ] || 'gray';

                const row = document.createElement('div');
                row.className = 'score-row';
                row.id = 'row_' + key;
                
                let filledCount = (s.len ? 1 : 0) + (s.count ? 1 : 0) + (s.big ? 1 : 0) + (s.spec ? 1 : 0);
                if (filledCount > 0 && filledCount < 4) {
                    row.classList.add('incomplete-row');
                }

                row.innerHTML = `
                    <div class="s-name">${a.name}</div>
                    <div class="s-team">${tName}</div>
                    <div class="s-peg" style="color: ${zColor};">${targetZ} ${targetP}</div>
                    <input type="number" placeholder="LEN" value="${s.len}" 
                        oninput="enforceLimits(this, 4)" 
                        onchange="saveScore('${key}', 'len', this.value)" 
                        onkeydown="handleScoreEnter(event)"
                        onfocus="highlightRow(this)" onblur="unhighlightRow(this)">
                    <input type="number" placeholder="CNT" value="${s.count}" 
                        oninput="enforceLimits(this, 3)" 
                        onchange="saveScore('${key}', 'count', this.value)" 
                        onkeydown="handleScoreEnter(event)"
                        onfocus="highlightRow(this)" onblur="unhighlightRow(this)">
                    <input type="number" placeholder="BIG" value="${s.big}" 
                        oninput="enforceLimits(this, 4)" 
                        onchange="saveScore('${key}', 'big', this.value)" 
                        onkeydown="handleScoreEnter(event)"
                        onfocus="highlightRow(this)" onblur="unhighlightRow(this)">
                    <input type="text" placeholder="SPC" value="${s.spec}" 
                        oninput="enforceLimits(this, 20)" 
                        onchange="saveScore('${key}', 'spec', this.value)" 
                        onkeydown="handleScoreEnter(event)"
                        onfocus="highlightRow(this)" onblur="unhighlightRow(this)">
                   
                `;
                container.appendChild(row);
            });
        });

        if (!hasDrawnData) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; color: #cbd5e1; font-weight: 800;">YOU MUST COMPLETE THE DRAW SETUP FIRST.</div>`;
        }
        
        updateScoreProgress();
    }

    function saveScore(key, field, value) {
        if (!scoreState[key]) scoreState[key] = { len:'', count:'', big:'', spec:'', witPeg:'' };
        scoreState[key][field] = value;
        persistState();
        
        let s = scoreState[key];
        let filledCount = (s.len ? 1 : 0) + (s.count ? 1 : 0) + (s.big ? 1 : 0) + (s.spec ? 1 : 0);
        let rowEl = document.getElementById('row_' + key);
        if (rowEl) {
            if (filledCount > 0 && filledCount < 4) {
                rowEl.classList.add('incomplete-row');
            } else {
                rowEl.classList.remove('incomplete-row');
            }
        }
        updateScoreProgress();
    }

   function exportMasterData() {
        let tsv = "NAME\tTEAM\tDAY\tZONE\tPEG\tLENGTH\tFISH COUNT\tBIGGEST FISH\tSPECIES\tWITNESS PEG\n";
        let dataCount = 0;

        appState.forEach(e => {
            e.anglers.forEach((a, i) => {
                if (!a.name || !a.z1) return;
                
                let tName = (e.isTeam && e.tName && e.tName.trim().toUpperCase() !== "SOLO" && e.tName.trim() !== "") ? e.tName.trim() : "";
                let k1 = `${e.id}_${i}_1`;
                let s1 = scoreState[k1] || {len:'', count:'', big:'', spec:'', witPeg:''};
                tsv += `${a.name}\t${tName}\t1\t${a.z1}\t${a.p1}\t${s1.len}\t${s1.count}\t${s1.big}\t${s1.spec}\t${s1.witPeg}\n`;
                dataCount++;
                if (matchDays === 2 && a.z2) {
                    let k2 = `${e.id}_${i}_2`;
                    let s2 = scoreState[k2] || {len:'', count:'', big:'', spec:'', witPeg:''};
                    tsv += `${a.name}\t${tName}\t2\t${a.z2}\t${a.p2}\t${s2.len}\t${s2.count}\t${s2.big}\t${s2.spec}\t${s2.witPeg}\n`;
                }
            });
        });
        if (dataCount === 0) {
            alert("No draw data exists to export.");
            return;
        }

        navigator.clipboard.writeText(tsv).then(() => {
            showToast("✅ MASTER SCORES COPIED TO CLIPBOARD");
            showExportModal(); 
        });
    }

    // ====================================================
    // --- V7.4.0 SECRET PAIRS ENGINE LOGIC ---
    // ====================================================
    
    function toggleAccordion() {
        const accordion = document.getElementById('roster-accordion');
        accordion.classList.toggle('collapsed');
        document.getElementById('accordion-icon').innerText = accordion.classList.contains('collapsed') ? '▶' : '▼';
    }

    function renderOptInList() {
        const grid = document.getElementById('opt-in-list');
        grid.innerHTML = '';
        
        let pool = [];
        appState.forEach(e => {
            e.anglers.forEach((a, aIdx) => {
                if (a.name && a.name.trim() !== '') {
                    let key = `${e.id}_${aIdx}`;
                    pool.push({ name: a.name, key: key });
                }
            });
        });
        
        if (pool.length === 0) {
            grid.innerHTML = `<div style="padding: 20px; grid-column: 1 / -1; text-align: center; color: var(--text-light); font-weight: 800;">Register Anglers in the Draw Setup first.</div>`;
            return;
        }

        pool.sort((a,b) => a.name.localeCompare(b.name));
        
        pool.forEach(angler => {
            let isOptedIn = sweepstakeOptIns[angler.key] !== false; 
            grid.innerHTML += `
                <div class="opt-in-row">
                    <div class="opt-in-name">${angler.name}</div>
                    <div class="opt-in-status">
                        <label class="switch">
                            <input type="checkbox" ${isOptedIn ? 'checked' : ''} onchange="toggleOptIn('${angler.key}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
            `;
        });
    }

    function toggleOptIn(key, status) {
        sweepstakeOptIns[key] = status;
        updatePrizeFund();
    }

    function updatePrizeFund() {
        const fee = parseInt(document.getElementById('entry-fee').value) || 0;
        let optedInCount = 0;
        appState.forEach(e => {
            e.anglers.forEach((a, aIdx) => {
                if (a.name && a.name.trim() !== '') {
                    let key = `${e.id}_${aIdx}`;
                    if (sweepstakeOptIns[key] !== false) optedInCount++;
                }
            });
        });
        const totalFund = fee * optedInCount;
        const first = Math.round(totalFund * 0.50);
        const second = Math.round(totalFund * 0.30);
        const third = Math.round(totalFund * 0.20);
        
        document.getElementById('prize-fund-display').innerText = totalFund;
        document.getElementById('prize-1st').innerText = first;
        document.getElementById('prize-2nd').innerText = second;
        document.getElementById('prize-3rd').innerText = third;

        const titleSpan = document.getElementById('accordion-title');
        if (titleSpan) titleSpan.innerText = `${optedInCount} ANGLERS OPTED IN - CLICK TO MANAGE`;

        return { first, second, third, totalFund };
    }

    function getAnglerTotals(eId, aI) {
        let len = 0, count = 0;
        let s1 = scoreState[`${eId}_${aI}_1`];
        let s2 = scoreState[`${eId}_${aI}_2`];
        if (s1) { len += (parseInt(s1.len) || 0); count += (parseInt(s1.count) || 0); }
        if (s2 && matchDays === 2) { len += (parseInt(s2.len) || 0); count += (parseInt(s2.count) || 0); }
        return { len, count };
    }

    function runSecretPairsSequence() {
        let activePairsPool = [];
        appState.forEach(e => {
            e.anglers.forEach((a, aI) => {
                if (a.name && a.name.trim() !== '') {
                    let key = `${e.id}_${aI}`;
                    if (sweepstakeOptIns[key] !== false) {
                        let totals = getAnglerTotals(e.id, aI);
                        activePairsPool.push({
                            name: a.name,
                            totalLength: totals.len,
                            fishCount: totals.count
                        });
                    }
                }
            });
        });
        
        if (activePairsPool.length < 2) {
            alert("Minimum of 2 paid anglers required to initialize draw metrics.");
            return;
        }

        // Collapse Roster to save screen space
        const accordion = document.getElementById('roster-accordion');
        if (!accordion.classList.contains('collapsed')) toggleAccordion();

        // Ghost Angler Calculations
        if (activePairsPool.length % 2 !== 0) {
            const sortedLengths = activePairsPool.map(a => a.totalLength).sort((a,b) => a-b);
            const sortedCounts = activePairsPool.map(a => a.fishCount).sort((a,b) => a-b);
            
            const midL = sortedLengths.length;
            const medianLength = midL % 2 !== 0 ? sortedLengths[Math.floor(midL / 2)] : (sortedLengths[Math.floor((midL - 1) / 2)] + sortedLengths[Math.floor(midL / 2)]) / 2;
            const midC = sortedCounts.length;
            const medianCount = midC % 2 !== 0 ? sortedCounts[Math.floor(midC / 2)] : (sortedCounts[Math.floor((midC - 1) / 2)] + sortedCounts[Math.floor(midC / 2)]) / 2;
            
            activePairsPool.push({
                name: "JOE AVERAGE (GHOST)",
                totalLength: Math.round(medianLength),
                fishCount: Math.round(medianCount)
            });
        }

        // Shuffle and Build Random Pairs
        activePairsPool.sort(() => Math.random() - 0.5);
        let secretPairs = [];
        for (let i = 0; i < activePairsPool.length; i += 2) {
            secretPairs.push({
                p1: activePairsPool[i],
                p2: activePairsPool[i+1],
                combinedLength: activePairsPool[i].totalLength + activePairsPool[i+1].totalLength,
                combinedCount: activePairsPool[i].fishCount + activePairsPool[i+1].fishCount
            });
        }

        // Generate Random Target between actual range extremes
        let lengthsArray = secretPairs.map(p => p.combinedLength);
        let minLength = Math.min(...lengthsArray);
        let maxLength = Math.max(...lengthsArray);
        const targetScore = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

        // UI Progression
        document.getElementById('reveal-area').style.display = 'block';
        document.getElementById('winners-podium').style.display = 'none';
        document.getElementById('pairs-results').style.display = 'none';
        document.getElementById('target-score-banner').innerText = `TARGET COMBINED LENGTH: ${targetScore}cm`;
        
        // Suspense Pause (5-Second Countdown)
        let timeLeft = 5;
        const countdownEl = document.getElementById('countdown-display');
        countdownEl.style.display = 'block';
        countdownEl.innerText = timeLeft;

        // Process Rankings with Tie-Breaker Priority (Closest Proximity -> Total Fish Count)
        let rankedPairs = secretPairs.map(pair => {
            pair.diff = Math.abs(pair.combinedLength - targetScore);
            return pair;
        }).sort((a, b) => {
            if (a.diff !== b.diff) return a.diff - b.diff;
            return b.combinedCount - a.combinedCount;
        });

        // Process Absolute Ties (Split the Pot Logic)
        let finalStandings = [];
        let i = 0;
        while (i < rankedPairs.length) {
            let tieGroup = [rankedPairs[i]];
            let j = i + 1;
            while (j < rankedPairs.length && rankedPairs[j].diff === rankedPairs[i].diff && rankedPairs[j].combinedCount === rankedPairs[i].combinedCount) {
                tieGroup.push(rankedPairs[j]);
                j++;
            }
            
            tieGroup.forEach(p => {
                p.isTie = tieGroup.length > 1;
                p.tieSize = tieGroup.length;
                p.startIndex = i;
            });
            finalStandings = finalStandings.concat(tieGroup);
            i = j;
        }

        const timerInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                countdownEl.innerText = timeLeft;
            } else {
                clearInterval(timerInterval);
                countdownEl.style.display = 'none';
                renderPodiumLayout(finalStandings, targetScore);
            }
        }, 1000);
    }

    function renderPodiumLayout(standings, target) {
        const podium = document.getElementById('winners-podium');
        const grid = document.getElementById('pairs-results');
        const funds = updatePrizeFund();
        
        podium.innerHTML = '';
        grid.innerHTML = '';
        
        const basePrizes = [funds.first, funds.second, funds.third];
        let assignedPrizes = [0, 0, 0];

        // Calculate Prize Multipliers for Ties
        let idx = 0;
        while (idx < Math.min(3, standings.length)) {
            let item = standings[idx];
            if (!item.isTie) {
                assignedPrizes[idx] = basePrizes[idx];
                idx++;
            } else {
                let size = item.tieSize;
                let startIndex = item.startIndex;
                let combinedPool = 0;
                
                for (let k = startIndex; k < startIndex + size; k++) {
                    if (k < 3) combinedPool += basePrizes[k];
                }
                
                let splitAward = Math.round(combinedPool / size);
                for (let k = startIndex; k < startIndex + size; k++) {
                    if (k < 3) assignedPrizes[k] = splitAward;
                }
                idx += size;
            }
        }

        // Output Top 3 to Podium
        for (let i = 0; i < Math.min(3, standings.length); i++) {
            const pair = standings[i];
            const tieClass = pair.isTie ? "shared-tie" : "";
            const noteText = pair.isTie ? ` (Split Pot Tie)` : "";
            let prizeAmount = assignedPrizes[i] || 0;
            let rankStr = i === 0 ? "1st Place" : i === 1 ? "2nd Place" : "3rd Place";
            let rankLabel = rankStr + noteText;
            let styleClass = (i === 0) ? "first-place" : "";
            
            podium.innerHTML += `
                <div class="podium-card ${styleClass} ${tieClass}">
                    <div style="text-align: left;">
                        <h4 style="margin: 0 0 4px 0; color: var(--text-dark);">${rankLabel}</h4>
                        <div style="font-weight: 900; font-size: 16px; color: var(--text-dark);">${pair.p1.name} & ${pair.p2.name}</div>
                        <div style="font-size: 12px; font-weight: 600; color: var(--text-light); margin-top: 2px;">
                            Combined Length: ${pair.combinedLength}cm (Off by ${pair.diff}cm) | Volume: ${pair.combinedCount} Fish
                        </div>
                    </div>
                    <div style="font-size: 20px; font-weight: 900; color: var(--green-color);">£${prizeAmount}</div>
                </div>
            `;
        }

        // Output the rest to the High Density Grid
        for (let i = 3; i < standings.length; i++) {
            const pair = standings[i];
            grid.innerHTML += `
                <div class="micro-card">
                    <div class="pair-badge">P${i+1}</div>
                    <div class="angler-names">
                        <span>${pair.p1.name}</span>
                        <span style="border-top: 1px solid var(--border); margin-top: 4px; padding-top: 4px;">${pair.p2.name}</span>
                    </div>
                    <div class="result-text">
                        (Off by ${pair.diff}cm)
                    </div>
                </div>
            `;
        }

        podium.style.display = 'block';
        if(standings.length > 3) grid.style.display = 'grid';
    }

    // ====================================================
    // --- ORIGINAL ZONEDRAW APP ENGINE (UNEDITED) ---
    // ====================================================

    function persistState() {
        if (!isAppReady) return;
        const stateObj = { 
            title: document.getElementById('matchTitle').value || '',
            data: appState, 
            scores: scoreState, 
            days: matchDays, 
            zoneSize: currentZoneSize, 
            mobilityMode: mobilityMode,
            accEnabled: accEnabled,
            safePegs1_a: document.getElementById('accPegs1_a').value,
            safePegs2_a: document.getElementById('accPegs2_a').value,
            anchorZone: document.getElementById('anchorZoneSelect').value,
            anchorZone2: document.getElementById('anchorZoneSelect2').value,
            sweepstakeOptIns: sweepstakeOptIns 
        };
        localStorage.setItem('zonedraw_current_state_v1', JSON.stringify(stateObj));
    }

    function formatPegs(el) {
        let val = el.value;
        let nums = val.match(/\d+/g);
        if (nums) el.value = nums.join(', ');
        else el.value = '';
    }

    function toggleAccPanel() {
        accEnabled = !accEnabled;
        applyAccToggleUI();
    }

    function applyAccToggleUI() {
        const panel = document.getElementById('accPanelWrapper');
        const btn = document.getElementById('accToggleBtn');
        const title = document.getElementById('accToggleTitle');
        const sub = document.getElementById('accToggleSub');
        if (accEnabled) {
            panel.style.display = 'flex';
            title.innerText = 'ACCESSIBLE PEGS: ON';
            sub.innerText = 'Routing enabled. Configure safe nodes below.';
            btn.style.background = 'var(--text-dark)';
            btn.style.color = 'white';
            btn.style.borderColor = 'var(--text-dark)';
        } else {
            panel.style.display = 'none';
            title.innerText = 'ACCESSIBLE PEGS: OFF';
            sub.innerText = 'Tap to enable safe zone and peg assignments.';
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-dark)';
            btn.style.borderColor = 'var(--border)';
        }
    }

    function setMobilityMode(m) {
        mobilityMode = m;
        document.getElementById('mobModeA').classList.toggle('active', m === 'A');
        document.getElementById('mobModeB').classList.toggle('active', m === 'B');
        
        if (m === 'A') {
            document.getElementById('modeASetup').style.display = 'flex';
            document.getElementById('modeBSetup').style.display = 'none';
        } else {
            document.getElementById('modeASetup').style.display = 'none';
            document.getElementById('modeBSetup').style.display = 'flex';
        }
        checkTeamClash();
    }

    function showImportModal() {
        document.getElementById('importRawData').value = '';
        document.getElementById('importModal').style.display = 'flex';
    }

    function closeImportModal() {
        document.getElementById('importModal').style.display = 'none';
    }

    function processExcelImport() {
        let rawData = document.getElementById('importRawData').value;
        if (!rawData.trim()) {
            closeImportModal();
            return;
        }

        let rows = rawData.split('\n');
        let tempTeams = {};
        let tempSolos = [];
        rows.forEach(row => {
            if (!row.trim()) return;
            let cols = row.split('\t'); 
            let rawName = (cols[0] || '').trim().toUpperCase();
            let rawTeam = (cols[1] || '').trim().toUpperCase();
            
            if (!rawName && !rawTeam) return;

            let isMobility = false;

            if (rawName.match(/[\(\[\{]A[\)\]\}]/i)) {
                isMobility = true;
                rawName = rawName.replace(/[\(\[\{]A[\)\]\}]/i, '').trim();
            }

            let anglerObj = { name: rawName, mobility: isMobility ? 1 : 0 };

            if (rawTeam) {
                if (!tempTeams[rawTeam]) tempTeams[rawTeam] = [];
                tempTeams[rawTeam].push(anglerObj);
            } else {
                tempSolos.push(anglerObj);
            }
        });
        appState = [];
        scoreState = {}; 
        trashCan = null;
        document.getElementById('undoBtn').style.display = 'none';
        Object.keys(tempTeams).forEach(tName => {
            let members = tempTeams[tName];
            for (let i = 0; i < members.length; i += 4) {
                let chunk = members.slice(i, i + 4);
                while (chunk.length < 4) { chunk.push({}); }
                appState.push({ id: genId(), isTeam: true, tName: tName, anglers: chunk });
            }
        });
        tempSolos.forEach(solo => {
            appState.push({ id: genId(), isTeam: false, tName: '', anglers: [solo] });
        });
        closeImportModal();
        
        document.getElementById('rosterEntryZone').style.display = 'none';
        document.getElementById('commandBar').style.display = 'flex';
        document.getElementById('masterActionBar').style.display = 'none';
        document.getElementById('amendTools').style.display = 'flex'; 
        document.getElementById('actionBtnArea').style.display = 'flex';
        
        renderStateToScreen();
        showToast("✅ COMPETITORS IMPORTED SUCCESSFULLY");
    }

    function showRedrawModal() { document.getElementById('redrawModal').style.display = 'flex'; }
    function closeRedrawModal() { document.getElementById('redrawModal').style.display = 'none'; }
    function showWipeModal() { document.getElementById('wipeModal').style.display = 'flex'; }
    function closeWipeModal() { document.getElementById('wipeModal').style.display = 'none'; }

    function handleSafeEdit() {
        switchTab('draw'); 
        handleAmend(true);
    }

    function executePegWipe() {
        closeRedrawModal();
        appState.forEach(e => {
            e.anglers.forEach(a => {
                a.z1 = undefined; a.p1 = undefined;
                a.z2 = undefined; a.p2 = undefined;
            });
        });
        currentZoneSize = 0; 
        
        switchTab('draw');
        handleAmend(false);
    }

    function executeNuclearWipe() {
        let title = document.getElementById('matchTitle').value || 'HUB_BACKUP';
        let txt = `REPORT: ${title}\nDATE: ${new Date().toLocaleString()}\n------------------------------\n\n`;
        
        appState.forEach(e => {
            if (e.isTeam) txt += `TEAM: ${e.tName || "UNNAMED"}\n`;
            else txt += `SOLO: ${e.tName || "UNNAMED"}\n`;
            
            e.anglers.forEach((a, i) => { 
                if (a.name) {
                    let accStr = (accEnabled && a.mobility) ? ' [A]' : '';
                    let d1Str = `D1: ${a.z1} ${a.p1}`;
                    let d2Str = `D2: ${a.z2 || '-'} ${a.p2 || '-'}`;
                    
                    let s1 = scoreState[`${e.id}_${i}_1`] || {};
                    let s2 = scoreState[`${e.id}_${i}_2`] || {};
                    let scoreTxt = ` [Scores D1: L:${s1.len||'-'} C:${s1.count||'-'} D2: L:${s2.len||'-'} C:${s2.count||'-'}]`;

                    txt += `  - ${a.name}${accStr} | ${d1Str} | ${d2Str}${scoreTxt}\n`; 
                }
            });
            txt += "\n";
        });
        const blob = new Blob([txt], {type: 'text/plain'});
        const lnk = document.createElement('a'); 
        lnk.href = URL.createObjectURL(blob); 
        lnk.download = `${title.replace(/\s+/g, '_')}_FINAL_REPORT.txt`; 
        lnk.click();
        isAppReady = false; 
        localStorage.removeItem('zonedraw_current_state_v1');
        closeWipeModal();
        startNewDraw();
        isAppReady = true; 
    }

    function setDays(d) {
        matchDays = d;
        document.getElementById('dayOpt1').classList.toggle('active', d === 1);
        document.getElementById('dayOpt2').classList.toggle('active', d === 2);
        
        if (d === 2) {
            document.getElementById('day2PegsContainer').style.display = 'flex';
            if (document.getElementById('day2AnchorContainer')) document.getElementById('day2AnchorContainer').style.display = 'flex';
        } else {
            document.getElementById('day2PegsContainer').style.display = 'none';
            if (document.getElementById('day2AnchorContainer')) document.getElementById('day2AnchorContainer').style.display = 'none';
        }
    }

    function startNewDraw() {
        document.getElementById('matchTitle').value = '';
        document.getElementById('initTeams').value = 0;
        document.getElementById('initIndivs').value = 0;
        document.getElementById('accPegs1_a').value = '';
        document.getElementById('accPegs2_a').value = '';
        
        appState = []; 
        scoreState = {};
        sweepstakeOptIns = {};
        currentZoneSize = 0;
        setMobilityMode('A'); 
        setDays(2);
        accEnabled = false;
        trashCan = null;
        applyAccToggleUI();
        
        document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
        document.getElementById('drawTab').style.display = 'block';
        document.body.className = 'stage-draw';

        document.getElementById('entrySection').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('setupPanel').style.display = 'block';
        document.getElementById('editDrawBanner').style.display = 'none';
        document.getElementById('rosterEntryZone').style.display = 'block';
        document.getElementById('commandBar').style.display = 'none';
        document.getElementById('masterActionBar').style.display = 'none';
        document.getElementById('undoBtn').style.display = 'none';
        
        document.getElementById('accToggleBtn').style.display = 'flex';
        
        updateTicker();
        renderStateToScreen();
    }

    function bulkInit() {
        appState = [];
        scoreState = {};
        sweepstakeOptIns = {};
        trashCan = null;
        document.getElementById('undoBtn').style.display = 'none';
        
        let tVal = document.getElementById('initTeams').value;
        let iVal = document.getElementById('initIndivs').value;
        const t = parseInt(tVal) || 0;
        const i = parseInt(iVal) || 0;
        for(let x = 0; x < t; x++) appState.push({ id: genId(), isTeam: true, tName: '', anglers: [{},{},{},{}] });
        for(let y = 0; y < i; y++) appState.push({ id: genId(), isTeam: false, tName: '', anglers: [{}] });
        document.getElementById('rosterEntryZone').style.display = 'none';
        document.getElementById('commandBar').style.display = 'flex';
        document.getElementById('masterActionBar').style.display = 'none';
        document.getElementById('amendTools').style.display = 'flex'; 
        document.getElementById('actionBtnArea').style.display = 'flex';
        
        renderStateToScreen();
        setTimeout(() => {
            const firstInput = document.querySelector('#entryList input[type="text"]');
            if (firstInput) firstInput.focus(); 
        }, 50);
    }

    function addNewStateItem(isTeam) {
        if (isTeam) appState.push({ id: genId(), isTeam: true, tName: '', anglers: [{},{},{},{}] });
        else appState.push({ id: genId(), isTeam: false, tName: '', anglers: [{}] });
        renderStateToScreen();
    }

    function toggleMobility(eId, aIdx) {
        const entry = appState.find(e => e.id === eId);
        if (entry) { 
            entry.anglers[aIdx].mobility = entry.anglers[aIdx].mobility ? 0 : 1;
            renderStateToScreen(); 
        }
    }

    function updateTeamName(id, val) {
        let entry = appState.find(e => e.id === id);
        if (entry) entry.tName = val.trim().toUpperCase(); 
    }

    function updateAnglerName(id, aIdx, val) {
        let entry = appState.find(e => e.id === id);
        if (entry && entry.anglers[aIdx]) {
            entry.anglers[aIdx].name = val.trim().toUpperCase();
            updateTicker();
        }
    }

    function updateDrawButtons() {
        const hasDraw = appState.some(e => e.anglers.some(a => a.z1));
        const viewCont = document.getElementById('viewDrawContainer');
        const processCont = document.getElementById('processDrawContainer');
        
        if (hasDraw) {
            viewCont.style.display = 'flex';
            processCont.style.display = 'none';
        } else {
            viewCont.style.display = 'none';
            processCont.style.display = 'flex';
        }
    }

    function runEntryValidation() {
        if (document.getElementById('entrySection').style.display !== 'block') return;
        let errors = [];
        let severeErrors = false;
        let anglerNames = {};
        let teamNames = {};

        document.querySelectorAll('.a-name-input, .t-name').forEach(el => el.classList.remove('input-error'));
        appState.forEach((entry) => {
            if (entry.isTeam) {
                let tName = (entry.tName || '').trim();
                let filledAnglers = entry.anglers.filter(a => (a.name || '').trim() !== '').length;

                if (filledAnglers > 0 && tName === '') {
                    errors.push(`MISSING TEAM NAME: A team with anglers has no team name.`);
                    severeErrors = true;
                    let tInputs = document.querySelectorAll(`.zone-card[data-id="${entry.id}"] .t-name`);
                    tInputs.forEach(el => el.classList.add('input-error'));
                }

                if (tName !== '') {
                    if (teamNames[tName]) {
                        errors.push(`DUPLICATE TEAM: '${tName}' is used more than once.`);
                        severeErrors = true;
                        document.querySelectorAll('.t-name').forEach(el => {
                            if(el.value.trim().toUpperCase() === tName) el.classList.add('input-error');
                        });
                    } else {
                        teamNames[tName] = true;
                    }
                }

                if (filledAnglers > 0 && filledAnglers < 4) {
                    let tDisp = tName !== '' ? `'${tName}'` : 'An unnamed team';
                    errors.push(`INCOMPLETE TEAM: ${tDisp} only has ${filledAnglers} out of 4 anglers.`);
                }
            }

            entry.anglers.forEach((a) => {
                let aName = (a.name || '').trim();
                if (aName !== '') {
                    if (anglerNames[aName]) {
                        if (!errors.includes(`DUPLICATE ANGLER: '${aName}' is listed multiple times.`)) {
                            errors.push(`DUPLICATE ANGLER: '${aName}' is listed multiple times.`);
                        }
                        severeErrors = true;
                        document.querySelectorAll('.a-name-input').forEach(el => {
                            if(el.value.trim().toUpperCase() === aName) el.classList.add('input-error');
                        });
                    } else {
                        anglerNames[aName] = true;
                    }
                }
            });
        });

        const banner = document.getElementById('entryAnomalyBanner');
        const list = document.getElementById('entryAnomalyList');
        
        if (errors.length > 0) {
            banner.style.display = 'block';
            list.innerHTML = errors.map(err => `<li>${err}</li>`).join('');
        } else {
            banner.style.display = 'none';
        }

        window.currentSevereErrors = severeErrors;
        checkTeamClash();
    }

    function renderStateToScreen() {
        const tb = document.getElementById('entryTeamsBucket');
        tb.innerHTML = '';
        const sb = document.getElementById('entrySolosBucket'); sb.innerHTML = '';
        appState.forEach(entry => {
            const div = document.createElement('div');
            div.className = !entry.isTeam ? 'zone-card solo-card' : 'zone-card';
            div.dataset.id = entry.id;
            
            let typeStr = entry.isTeam ? 'TEAM' : 'SOLO';
            let h = `<div class="zone-header"><span>${typeStr}</span><div style="display:flex; align-items:center;">`;
            
            if (!entry.isTeam) h += `<input type="checkbox" class="merge-cb" onchange="checkMerge()" tabindex="-1" style="width:18px; height:18px;">`; 
            if (entry.isTeam) h += `<button class="btn-tool" onclick="breakStateTeam('${entry.id}')" tabindex="-1" style="margin-left:12px;">🔗 UNLINK</button>`; 
            else h += `<button onclick="deleteStateEntry('${entry.id}')" tabindex="-1" style="background:none; border:none; color:var(--red-color); font-weight:900; font-size:22px; cursor:pointer; margin-left:12px; transition: 0.2s;">×</button>`; 
            
            h += `</div></div>`;
            if (entry.isTeam) {
                h += `<div style="padding: 0 16px;"><label style="font-size:10px; font-weight:800; color:var(--text-light); letter-spacing:0.5px;">TEAM NAME</label>
                      <input type="text" class="t-name" value="${entry.tName}" oninput="updateTeamName('${entry.id}', this.value)" style="margin-bottom:12px; margin-top:4px;">`;
                for (let i = 0; i < 4; i++) {
                    let mBg = entry.anglers[i].mobility ? 'var(--text-dark)' : '#f1f5f9';
                    let mColor = entry.anglers[i].mobility ? 'white' : 'var(--text-dark)';
                    let aName = entry.anglers[i].name || '';
                    h += `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                            <input type="text" class="a-name-input" value="${aName}" placeholder="ANGLER ${i+1}" oninput="updateAnglerName('${entry.id}', ${i}, this.value)">
                            <button class="btn-tool" onclick="toggleMobility('${entry.id}', ${i})" tabindex="-1" style="padding:10px 14px; background:${mBg}; color:${mColor};">[A]</button>
                          </div>`;
                }
                h += `</div>`;
            } else {
                h += `<div style="padding: 0 16px;"><label style="font-size:10px; font-weight:800; color:var(--text-light); letter-spacing:0.5px;">SOLO NAME</label>`;
                let mBg = entry.anglers[0].mobility ? 'var(--text-dark)' : '#f1f5f9';
                let mColor = entry.anglers[0].mobility ? 'white' : 'var(--text-dark)';
                let aName = entry.anglers[0].name || '';
                
                h += `<div style="display:flex; align-items:center; gap:8px; margin-top:4px; margin-bottom:6px;">
                        <input type="text" class="a-name-input" value="${aName}" oninput="updateAnglerName('${entry.id}', 0, this.value)">
                        <button class="btn-tool" onclick="toggleMobility('${entry.id}', 0)" tabindex="-1" style="padding:10px 14px; background:${mBg}; color:${mColor};">[A]</button>
                      </div></div>`;
            }
            
            div.innerHTML = h;
            if (entry.isTeam) tb.appendChild(div); else sb.appendChild(div);
        });
        
        document.getElementById('entryTeamsContainer').style.display = tb.innerHTML !== '' ? 'block' : 'none';
        document.getElementById('entrySolosContainer').style.display = sb.innerHTML !== '' ? 'block' : 'none';
        
        updateTicker(); checkMerge(); updateDrawButtons(); runEntryValidation(); persistState();
    }

    function deleteStateEntry(id) { 
        const idx = appState.findIndex(e => e.id === id);
        if (idx > -1) { 
            trashCan = { action: 'delete', data: appState[idx], index: idx };
            document.getElementById('undoBtn').style.display = 'inline-block';
            appState.splice(idx, 1); 
            renderStateToScreen(); 
        } 
    }
    
    function breakStateTeam(id) { 
        const idx = appState.findIndex(e => e.id === id);
        if (idx > -1) { 
            const t = appState.splice(idx, 1)[0];
            let nIds = [];
            t.anglers.forEach(a => { 
                let nId = genId(); nIds.push(nId);
                appState.push({ id: nId, isTeam: false, tName: '', anglers: [{...a}] }); 
            });
            trashCan = { action: 'break', originalTeam: t, index: idx, newIds: nIds };
            document.getElementById('undoBtn').style.display = 'inline-block';
            renderStateToScreen();
        } 
    }

    function undoLastAction() {
        if (!trashCan) return;
        if (trashCan.action === 'delete') {
            appState.splice(trashCan.index, 0, trashCan.data);
        } else if (trashCan.action === 'break') {
            appState = appState.filter(e => !trashCan.newIds.includes(e.id));
            appState.splice(trashCan.index, 0, trashCan.originalTeam);
        }
        trashCan = null;
        document.getElementById('undoBtn').style.display = 'none';
        renderStateToScreen();
    }
    
    function mergeSelected() { 
        const sel = document.querySelectorAll('.merge-cb:checked');
        if (sel.length !== 4) return; 
        const ids = Array.from(sel).map(cb => cb.closest('.zone-card').dataset.id); 
        const angs = [];
        ids.forEach(id => { 
            const idx = appState.findIndex(e => e.id === id); 
            if (idx > -1) {
                let removed = appState.splice(idx, 1)[0];
                angs.push(removed.anglers[0]); 
            }
        });
        appState.push({ id: genId(), isTeam: true, tName: '', anglers: angs }); 
        renderStateToScreen();
    }
    
    function checkMerge() { 
        let checkedBoxes = document.querySelectorAll('.merge-cb:checked');
        document.getElementById('mergeBtn').style.display = checkedBoxes.length === 4 ? 'inline-block' : 'none';
    }
    
    function checkTeamClash() {
        let clash = false;
        if (mobilityMode === 'B') {
            appState.forEach(e => { 
                if (e.isTeam) {
                    let mobCount = e.anglers.filter(a => a.mobility).length;
                    if (mobCount > 1) clash = true;
                } 
            });
        }
        document.getElementById('teamClashWarning').style.display = clash ? 'block' : 'none';
        
        let severeErrs = window.currentSevereErrors || false;
        let processBtn = document.getElementById('mainActionBtn');
        
        if (clash || severeErrs) {
            processBtn.disabled = true;
            processBtn.style.opacity = '0.5';
            processBtn.innerText = 'FIX ERRORS';
        } else {
            processBtn.disabled = false;
            processBtn.style.opacity = '1';
            processBtn.innerText = 'PROCESS DRAW';
        }
    }
    
    function updateTicker() { 
        let ent = 0;
        appState.forEach(e => { e.anglers.forEach(a => { if (a.name && a.name.trim() !== '') ent++; }); });
        document.getElementById('tkAnglers').innerText = ent;
    }

    function initiateShuffle() {
        let filteredState = [];
        appState.forEach(e => {
            if (e.isTeam) {
                let hasNames = e.anglers.some(a => (a.name || '').trim() !== '');
                let hasTeamName = (e.tName || '').trim() !== '';
                if (hasNames || hasTeamName) filteredState.push(e);
            } else {
                if ((e.anglers[0].name || '').trim() !== '') filteredState.push(e);
            }
        });
        appState = filteredState;
        appState.forEach(e => { e.anglers.forEach(a => { a.z1 = undefined; a.p1 = undefined; a.z2 = undefined; a.p2 = undefined; }); });
        renderStateToScreen();
        
        const over = document.getElementById('shuffleOverlay'); 
        const pBar = document.getElementById('pBar');
        over.style.display = 'flex'; 
        let p = 0;
        const inv = setInterval(() => { 
            p += 5; pBar.style.width = p + '%'; 
            if (p >= 100) { clearInterval(inv); over.style.display = 'none'; runDraw(); } 
        }, 30);
    }

    function getAlphaPeg(z, day, usedObj) {
        let zIdx = zones.indexOf(z);
        let maxBase = (zIdx + 1) * currentZoneSize;
        let letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < letters.length; i++) {
            let testPeg = maxBase + letters[i];
            if (!usedObj[z].includes(String(testPeg))) {
                usedObj[z].push(String(testPeg));
                return testPeg;
            }
        }
        return maxBase + 'Z';
    }

    function runDraw() {
        appState.sort((a, b) => {
            let getPriority = (entry) => { 
                let hasA = accEnabled && entry.anglers.some(ang => ang.mobility); 
                if (entry.isTeam && hasA) return 4;
                if (!entry.isTeam && hasA) return 3;
                if (entry.isTeam) return 2;
                return 1; 
            };
            return getPriority(b) - getPriority(a);
        });
        let s1A_str = document.getElementById('accPegs1_a').value || '';
        let s2A_str = document.getElementById('accPegs2_a').value || '';
        let s1A = s1A_str.match(/\d+/g) ? s1A_str.match(/\d+/g).map(Number) : [];
        let s2A = s2A_str.match(/\d+/g) ? s2A_str.match(/\d+/g).map(Number) : [];
        const ancZ1 = document.getElementById('anchorZoneSelect').value;
        const ancZ2 = document.getElementById('anchorZoneSelect2').value;
        if (currentZoneSize === 0) {
            let tot = 0;
            appState.forEach(e => { if (e.isTeam) tot += 4; else tot += 1; });
            currentZoneSize = Math.max(Math.ceil(tot / 4), 1);
        }
        let zSize = currentZoneSize;
        let p1 = zones.map((z, idx) => { 
            let p = []; for (let i = 1; i <= zSize; i++) p.push((idx * zSize) + i);
            p.sort(() => Math.random() - 0.5); return {z, p}; 
        });
        let p2 = zones.map((z, idx) => { 
            let p = []; for (let i = 1; i <= zSize; i++) p.push((idx * zSize) + i);
            p.sort(() => Math.random() - 0.5); return {z, p}; 
        });
        let aEntries = [];
        if (accEnabled) {
            appState.forEach(e => { if (e.anglers.some(a => a.mobility)) aEntries.push(e); });
        }

        if (accEnabled && mobilityMode === 'A' && aEntries.length > 0) {
            let availableD1Safe = [];
            let availableD2Safe = [];
            zones.forEach(z => {
                let zI = zones.indexOf(z); let safeCount = 0;
                p1[zI].p.forEach(pegNum => { if (s1A.includes(pegNum)) safeCount++; });
                for (let i = 0; i < safeCount; i++) availableD1Safe.push(z);
            });
            zones.forEach(z => {
                let zI = zones.indexOf(z); let safeCount = 0;
                p2[zI].p.forEach(pegNum => { if (s2A.includes(pegNum)) safeCount++; });
                for (let i = 0; i < safeCount; i++) availableD2Safe.push(z);
            });
            let bestPairing = []; let leastClashes = 999;
            for (let attempt = 0; attempt < 100; attempt++) {
                let tempD1 = [...availableD1Safe].sort(() => Math.random() - 0.5);
                let tempD2 = [...availableD2Safe].sort(() => Math.random() - 0.5);
                let clashes = 0; let currentPairs = [];
                for (let i = 0; i < aEntries.length; i++) {
                    let z1 = null, z2 = null;
                    if (i < tempD1.length) z1 = tempD1[i];
                    if (i < tempD2.length) z2 = tempD2[i];
                    if (z1 !== null && z2 !== null && z1 === z2) clashes++;
                    currentPairs.push({z1: z1, z2: z2});
                }
                if (clashes < leastClashes) {
                    leastClashes = clashes;
                    bestPairing = currentPairs;
                    if (leastClashes === 0) break; 
                }
            }
            aEntries.forEach((e, idx) => {
                let a = e.anglers.find(ang => ang.mobility);
                a.preZ1 = bestPairing[idx].z1; a.preZ2 = bestPairing[idx].z2;
            });
        }
        
        const pull = (z, d2, mob) => {
            const pools = d2 ? p2 : p1; const zI = zones.indexOf(z);
            if (accEnabled && mobilityMode === 'A') {
                const sL = d2 ? s2A : s1A;
                if (mob) { 
                    let sI = pools[zI].p.findIndex(p => sL.includes(p));
                    if (sI > -1) return pools[zI].p.splice(sI, 1)[0]; 
                } else if (sL.length > 0) { 
                    let nI = pools[zI].p.findIndex(p => !sL.includes(p));
                    if (nI > -1) return pools[zI].p.splice(nI, 1)[0]; 
                }
            }
            let popVal = pools[zI].p.pop();
            return popVal !== undefined ? popVal : 9999;
        };
        
        appState.forEach(e => {
            if (e.isTeam) {
                let hasA = false;
                if (accEnabled) { e.anglers.forEach(a => { if (a.mobility) hasA = true; }); }
                
                if (accEnabled && mobilityMode === 'B' && hasA) {
                    let d1Z = [null, null, null, null]; let d2Z = [null, null, null, null]; 
                    e.anglers.forEach((a, i) => { if (a.mobility) { d1Z[i] = ancZ1; d2Z[i] = ancZ2; } });
                    
                    let av1 = []; zones.forEach(z => { if (z !== ancZ1) av1.push(z); });
                    av1.sort(() => Math.random() - 0.5);
                    let sI = []; e.anglers.forEach((a, i) => { if (!a.mobility) sI.push(i); });
                    d1Z[sI[0]] = av1[0]; d1Z[sI[1]] = av1[1]; d1Z[sI[2]] = av1[2];
                    
                    let av2 = []; zones.forEach(z => { if (z !== ancZ2) av2.push(z); });
                    let bestD2Perm = [...av2];
                    for (let attempt = 0; attempt < 20; attempt++) {
                        av2.sort(() => Math.random() - 0.5);
                        let isValid = true;
                        for (let k = 0; k < 3; k++) { if (d1Z[sI[k]] === av2[k]) isValid = false; }
                        if (isValid) { bestD2Perm = [...av2]; break; }
                    }
                    d2Z[sI[0]] = bestD2Perm[0]; d2Z[sI[1]] = bestD2Perm[1]; d2Z[sI[2]] = bestD2Perm[2];
                    
                    e.anglers.forEach((a, i) => { 
                        a.z1 = d1Z[i]; a.p1 = pull(a.z1, 0, a.mobility); 
                        a.z2 = d2Z[i]; a.p2 = pull(a.z2, 1, a.mobility); 
                    });
                } else if (accEnabled && mobilityMode === 'A' && hasA) {
                    let mI = e.anglers.findIndex(a => a.mobility);
                    let a = e.anglers[mI];
                    let targetZ1 = a.preZ1; let targetZ2 = a.preZ2;
                    if (!targetZ1) targetZ1 = [...zones].sort(() => Math.random() - 0.5)[0];
                    if (!targetZ2) {
                        let randZones = [];
                        zones.forEach(z => { if (z !== targetZ1) randZones.push(z); });
                        randZones.sort(() => Math.random() - 0.5);
                        targetZ2 = randZones.length > 0 ? randZones[0] : targetZ1;
                    }
                    let d1Z = [null, null, null, null]; let d2Z = [null, null, null, null];
                    d1Z[mI] = targetZ1; d2Z[mI] = targetZ2;
                    
                    let remainingD1 = [];
                    zones.forEach(z => { if (z !== targetZ1) remainingD1.push(z); });
                    let remainingD2 = [];
                    zones.forEach(z => { if (z !== targetZ2) remainingD2.push(z); });
                    remainingD1.sort(() => Math.random() - 0.5);
                    
                    let bestD2Perm = [...remainingD2];
                    for (let attempt = 0; attempt < 20; attempt++) {
                        remainingD2.sort(() => Math.random() - 0.5);
                        let isValid = true;
                        for (let i = 0; i < 3; i++) { if (remainingD1[i] === remainingD2[i]) isValid = false; }
                        if (isValid) { bestD2Perm = [...remainingD2]; break; }
                    }
                    remainingD2 = bestD2Perm;
                    let rIdx = 0;
                    for (let i = 0; i < 4; i++) {
                        if (i !== mI) { d1Z[i] = remainingD1[rIdx]; d2Z[i] = remainingD2[rIdx]; rIdx++; }
                    }
                    e.anglers.forEach((ang, i) => { 
                        ang.z1 = d1Z[i]; ang.p1 = pull(ang.z1, 0, ang.mobility); 
                        ang.z2 = d2Z[i]; ang.p2 = pull(ang.z2, 1, ang.mobility); 
                    });
                } else {
                    let d1Z = [...zones].sort(() => Math.random() - 0.5);
                    let d2Z = [d1Z[1], d1Z[2], d1Z[3], d1Z[0]];
                    e.anglers.forEach((a, i) => { 
                        a.z1 = d1Z[i]; a.p1 = pull(a.z1, 0, 0); 
                        a.z2 = d2Z[i]; a.p2 = pull(a.z2, 1, 0); 
                    });
                }
            } else {
                let a = e.anglers[0];
                let hasMobility = accEnabled && a.mobility;
                if (accEnabled && mobilityMode === 'B' && hasMobility) { 
                    a.z1 = ancZ1; a.z2 = ancZ2; 
                } else if (accEnabled && mobilityMode === 'A' && hasMobility) {
                    if (a.preZ1) a.z1 = a.preZ1;
                    else a.z1 = zones[Math.floor(Math.random() * zones.length)];
                    if (a.preZ2) a.z2 = a.preZ2;
                    else {
                        let av2 = [];
                        zones.forEach(z => { if (z !== a.z1) av2.push(z); });
                        a.z2 = av2.length > 0 ? av2[0] : a.z1;
                    }
                } else { 
                    let av = [];
                    zones.forEach(z => { 
                        if (p1[zones.indexOf(z)].p.length > 0) av.push({z: z, left: p1[zones.indexOf(z)].p.length}); 
                    });
                    if (av.length > 0) {
                        av.sort((val1, val2) => val2.left - val1.left);
                        let maxLeft = av[0].left;
                        let candidates = av.filter(item => item.left === maxLeft).map(item => item.z);
                        a.z1 = candidates[Math.floor(Math.random() * candidates.length)];
                    } 
                    
                    let av2 = [];
                    zones.forEach(z => { 
                        if (z !== a.z1 && p2[zones.indexOf(z)].p.length > 0) av2.push({z: z, left: p2[zones.indexOf(z)].p.length}); 
                    });
                    if (av2.length === 0) {
                        zones.forEach(z => { if (p2[zones.indexOf(z)].p.length > 0) av2.push({z: z, left: p2[zones.indexOf(z)].p.length}); });
                    }
                    if (av2.length > 0) {
                        av2.sort((val1, val2) => val2.left - val1.left);
                        let maxLeft2 = av2[0].left;
                        let candidates2 = av2.filter(item => item.left === maxLeft2).map(item => item.z);
                        a.z2 = candidates2[Math.floor(Math.random() * candidates2.length)];
                    }
                }
                a.p1 = pull(a.z1, 0, hasMobility);
                a.p2 = pull(a.z2, 1, hasMobility);
            }
        });
        displayDraw();
    }

    function toggleSwapMode() { 
        isSwapMode = !isSwapMode;
        swapObj1 = null; 
        document.getElementById('swapPrompt').style.display = isSwapMode ? 'block' : 'none';
        displayDraw();
    }

    function handleSwapClick(eId, aI, day) { 
        if (!isSwapMode) return;
        if (!swapObj1) { 
            swapObj1 = { eId: eId, aI: aI, day: day };
            displayDraw(); 
        } else { 
            if (swapObj1.day !== day) { 
                alert("Please select another Day " + swapObj1.day + " peg to complete the swap.");
                return; 
            }
            let e1 = null, e2 = null;
            appState.forEach(e => {
                if (e.id === swapObj1.eId) e1 = e;
                if (e.id === eId) e2 = e;
            });
            const a1 = e1.anglers[swapObj1.aI]; const a2 = e2.anglers[aI]; 
            if (day === 1) { 
                let tempZ = a1.z1; a1.z1 = a2.z1; a2.z1 = tempZ;
                let tempP = a1.p1; a1.p1 = a2.p1; a2.p1 = tempP;
            } else { 
                let tempZ = a1.z2; a1.z2 = a2.z2; a2.z2 = tempZ;
                let tempP = a1.p2; a1.p2 = a2.p2; a2.p2 = tempP;
            }
            toggleSwapMode();
        } 
    }

    function runValidator() {
        let errors = [];
        let clashMap = [];
        let pM1 = { RED:[], YELLOW:[], GREEN:[], BLUE:[] };
        let pM2 = { RED:[], YELLOW:[], GREEN:[], BLUE:[] };

        appState.forEach(team => {
            let tN = team.tName || 'SOLO';
            if (team.isTeam) {
                let d1Z = {}, d2Z = {};
                team.anglers.forEach((a, aI) => {
                    if (a.z1) { if (!d1Z[a.z1]) d1Z[a.z1] = []; d1Z[a.z1].push(aI); }
                    if (matchDays === 2 && a.z2) { if (!d2Z[a.z2]) d2Z[a.z2] = []; d2Z[a.z2].push(aI); }
                });
                Object.keys(d1Z).forEach(z => {
                    if (d1Z[z].length > 1) {
                        errors.push(`Team Clash: '${tN}' has multiple anglers in ${z} Zone [DAY 1].`);
                        d1Z[z].forEach(idx => clashMap.push({eId: team.id, aI: idx, day: 1}));
                    }
                });
                Object.keys(d2Z).forEach(z => {
                    if (d2Z[z].length > 1) {
                        errors.push(`Team Clash: '${tN}' has multiple anglers in ${z} Zone [DAY 2].`);
                        d2Z[z].forEach(idx => clashMap.push({eId: team.id, aI: idx, day: 2}));
                    }
                });
            }
            
            team.anglers.forEach((a, aI) => {
                let aN = a.name || 'UNNAMED';
               if (!a.z1 || a.p1 === undefined || a.p1 === 9999) {
                    errors.push(`Missing Peg: '${aN}' invalid allocation [DAY 1].`);
                    clashMap.push({eId: team.id, aI: aI, day: 1});
                }
                if (matchDays === 2 && (!a.z2 || a.p2 === undefined || a.p2 === 9999)) {
                    errors.push(`Missing Peg: '${aN}' invalid allocation [DAY 2].`);
                    clashMap.push({eId: team.id, aI: aI, day: 2});
                }
                
                let allowedDouble = (accEnabled && a.mobility) ? true : false;
                if (matchDays === 2 && a.z1 && a.z2 && a.z1 === a.z2 && !allowedDouble) {
                    errors.push(`Static Zone Clash: '${aN}' stuck in same zone.`);
                    clashMap.push({eId: team.id, aI: aI, day: 1});
                    clashMap.push({eId: team.id, aI: aI, day: 2});
                }
                
                if (a.z1 && a.p1 !== undefined && a.p1 !== 9999) {
                    let dup = pM1[a.z1].find(p => String(p.val) === String(a.p1));
                    if (dup) {
                        errors.push(`Peg Collision: '${a.z1} ${a.p1}' duplicated [DAY 1].`);
                        clashMap.push({eId: team.id, aI: aI, day: 1});
                        clashMap.push({eId: dup.eId, aI: dup.aI, day: 1});
                    } else { pM1[a.z1].push({val: a.p1, eId: team.id, aI: aI}); }
                }
                
                if (matchDays === 2 && a.z2 && a.p2 !== undefined && a.p2 !== 9999) {
                    let dup = pM2[a.z2].find(p => String(p.val) === String(a.p2));
                    if (dup) {
                        errors.push(`Peg Collision: '${a.z2} ${a.p2}' duplicated [DAY 2].`);
                        clashMap.push({eId: team.id, aI: aI, day: 2});
                        clashMap.push({eId: dup.eId, aI: dup.aI, day: 2});
                    } else { pM2[a.z2].push({val: a.p2, eId: team.id, aI: aI}); }
                }
            });
        });
        
        let uniqueErrors = []; errors.forEach(e => { if (!uniqueErrors.includes(e)) uniqueErrors.push(e); });
        return { list: uniqueErrors, markers: clashMap };
    }

    function injectLatecomer(isTeam) {
        let used1 = { 'RED':[], 'YELLOW':[], 'GREEN':[], 'BLUE':[] };
        let used2 = { 'RED':[], 'YELLOW':[], 'GREEN':[], 'BLUE':[] };
        
        appState.forEach(e => {
            e.anglers.forEach(a => {
                if(a.z1 && a.p1 !== undefined && a.p1 !== 9999) used1[a.z1].push(String(a.p1));
                if(matchDays === 2 && a.z2 && a.p2 !== undefined && a.p2 !== 9999) used2[a.z2].push(String(a.p2));
            });
        });
        let avail1 = { 'RED':[], 'YELLOW':[], 'GREEN':[], 'BLUE':[] };
        let avail2 = { 'RED':[], 'YELLOW':[], 'GREEN':[], 'BLUE':[] };
        zones.forEach((z, idx) => {
            for(let i=1; i<=currentZoneSize; i++) {
                let pN = String((idx * currentZoneSize) + i);
                if(!used1[z].includes(pN)) avail1[z].push(pN);
                if(matchDays === 2 && !used2[z].includes(pN)) avail2[z].push(pN);
            }
        });

        let newEntry = { id: genId(), isTeam: isTeam, tName: '', anglers: [] };
        if(isTeam) {
            let d1Z = [...zones].sort(() => Math.random() - 0.5);
            let d2Z = [d1Z[1], d1Z[2], d1Z[3], d1Z[0]];
            
            for(let i=0; i<4; i++) {
                let p1_val;
                if(avail1[d1Z[i]].length > 0) p1_val = avail1[d1Z[i]].splice(Math.floor(Math.random() * avail1[d1Z[i]].length), 1)[0];
                else p1_val = getAlphaPeg(d1Z[i], 1, used1);
                
                let p2_val = undefined;
                if(matchDays === 2) {
                    if(avail2[d2Z[i]].length > 0) p2_val = avail2[d2Z[i]].splice(Math.floor(Math.random() * avail2[d2Z[i]].length), 1)[0];
                    else p2_val = getAlphaPeg(d2Z[i], 2, used2);
                }
                newEntry.anglers.push({ name: '', z1: d1Z[i], p1: p1_val, z2: matchDays === 2 ? d2Z[i] : undefined, p2: p2_val });
            }
        } else {
            let flat1 = [];
            zones.forEach(z => { if(avail1[z].length > 0) flat1.push(z); });
            let picked1Z = flat1.length > 0 ? flat1[Math.floor(Math.random() * flat1.length)] : zones[Math.floor(Math.random() * zones.length)];
            
            let p1_val;
            if(avail1[picked1Z].length > 0) p1_val = avail1[picked1Z].splice(Math.floor(Math.random() * avail1[picked1Z].length), 1)[0];
            else p1_val = getAlphaPeg(picked1Z, 1, used1);
            
            let picked2Z = undefined, p2_val = undefined;
            if(matchDays === 2) {
                let flat2 = [];
                zones.forEach(z => { if(z !== picked1Z && avail2[z].length > 0) flat2.push(z); });
                if(flat2.length === 0) zones.forEach(z => { if(z !== picked1Z) flat2.push(z); });
                picked2Z = flat2.length > 0 ? flat2[Math.floor(Math.random() * flat2.length)] : zones[Math.floor(Math.random() * zones.length)];
                
                if(avail2[picked2Z] && avail2[picked2Z].length > 0) p2_val = avail2[picked2Z].splice(Math.floor(Math.random() * avail2[picked2Z].length), 1)[0];
                else p2_val = getAlphaPeg(picked2Z, 2, used2);
            }
            newEntry.anglers.push({ name: '', z1: picked1Z, p1: p1_val, z2: matchDays === 2 ? picked2Z : undefined, p2: p2_val });
        }
        
        appState.push(newEntry);
        displayDraw();
        showToast("✅ LATECOMER ADDED SUCCESSFULLY");
        setTimeout(() => { handleAmend(true); }, 800);
    }

    function isPegSafe(p, d) { 
        if (!accEnabled) return false;
        if (mobilityMode === 'A') {
            let safeStr = d === 1 ? document.getElementById('accPegs1_a').value : document.getElementById('accPegs2_a').value;
            let safeArr = safeStr.match(/\d+/g) || [];
            return safeArr.includes(String(p).replace(/[a-zA-Z]/g, ''));
        }
        return false;
    }

    function copyExcelData() {
        let tsv = matchDays === 2 ? "NAME\tTEAM\tDAY 1 ZONE\tDAY 2 ZONE\n" : "NAME\tTEAM\tDAY 1 ZONE\n";
        appState.forEach(g => { 
            g.anglers.forEach(a => { 
                let tName = g.isTeam ? (g.tName || '') : '';
                if (matchDays === 2) tsv += `${a.name || ''}\t${tName}\t${a.z1}\t${a.z2}\n`; 
                else tsv += `${a.name || ''}\t${tName}\t${a.z1}\n`;
            }); 
        });
        navigator.clipboard.writeText(tsv).then(() => {
            showToast("📋 SETUP DATA COPIED TO CLIPBOARD");
        });
    }

    function buildBeachMap(day, s) {
        let html = `<div style="display:flex; width:100%; gap:8px; margin-bottom: 6px;">`;
        zones.forEach((z, idx) => {
            let baseMax = (idx + 1) * s;
            let baseMin = (idx * s) + 1;
            let highestAlpha = '';
            
            let assignedPegs = [];
            let aPegs = [];
            
            appState.forEach(e => e.anglers.forEach(a => {
                let zp = day === 1 ? {z: a.z1, p: a.p1} : {z: a.z2, p: a.p2};
                if (zp.z === z && zp.p !== undefined && zp.p !== 9999) {
                    let pStr = String(zp.p);
                    assignedPegs.push(pStr);
                    if (a.mobility) aPegs.push(pStr);
                    
                    if (pStr.startsWith(String(baseMax))) {
                        let alpha = pStr.replace(/[0-9]/g, '');
                        if (alpha > highestAlpha) highestAlpha = alpha;
                    }
                }
            }));
            
            let emptyPegs = [];
            for (let i = baseMin; i <= baseMax; i++) {
                if (!assignedPegs.includes(String(i))) {
                    emptyPegs.push(i);
                }
            }
            
            let bg = zColors[z];
            let label = highestAlpha ? `${baseMin}-${baseMax} + ${baseMax}${highestAlpha}` : `${baseMin}-${baseMax}`;
            
            let extraInfo = '';
            let hasEmpty = emptyPegs.length > 0;
            let hasA = accEnabled && aPegs.length > 0;

            if (hasEmpty) {
                extraInfo += `<span style="font-size:10px; font-weight:900; background:white; color:var(--text-dark); padding:4px 8px; border-radius:50px; white-space:nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">E: ${emptyPegs.join(', ')}</span>`;
            }
            if (hasA) {
                extraInfo += `<span style="font-size:10px; font-weight:900; background:white; color:var(--text-dark); padding:4px 8px; border-radius:50px; white-space:nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">[A]: ${aPegs.join(', ')}</span>`;
            }

            html += `<div style="flex:1; background:${bg}; border-radius:12px; padding:6px 12px; color:white; font-weight:900; display:flex; flex-direction:row; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px; min-height:26px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <span style="font-size:14px; letter-spacing:0.5px;">${label}</span>
                        ${extraInfo}
                    </div>`;
        });
        html += `</div>`;
        return html;
    }

    function displayDraw() {
        document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
        document.getElementById('drawTab').style.display = 'block';

        document.getElementById('entrySection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'block';
        
        let titleVal = document.getElementById('matchTitle').value;
        let titleStr = titleVal ? `LIVE: ${titleVal}` : "LIVE DRAW";
        document.getElementById('resTitle').innerHTML = `<span class="live-dot">🔴</span> ${titleStr}`;
        
        document.getElementById('commandBar').style.display = 'none';
        document.getElementById('masterActionBar').style.display = 'flex';
        if (currentZoneSize === 0) {
            let totAnglers = 0;
            appState.forEach(e => { if (e.isTeam) totAnglers += 4; else totAnglers += 1; });
            currentZoneSize = Math.max(Math.ceil(totAnglers / 4), 1);
        }
        const s = currentZoneSize;

        let mapHtml = '';
        let masterLegend = `E = Empty Peg`;
        if (accEnabled) masterLegend += ` <span style="margin: 0 8px; opacity:0.5;">|</span> [A] = Accesable Pegs`;
        mapHtml += `<div style="font-size:12px; font-weight:900; color:var(--text-light); text-align:center; margin-bottom:15px; letter-spacing: 0.5px;">${masterLegend}</div>`;
        if (matchDays >= 1) {
            mapHtml += `<div style="font-size:14px; font-weight:900; color:var(--text-dark); margin-bottom:6px; letter-spacing: 0.5px; margin-left:5px;">DAY 1</div>`;
            mapHtml += buildBeachMap(1, s);
        }
        if (matchDays === 2) {
            mapHtml += `<div style="font-size:14px; font-weight:900; color:var(--text-dark); margin-bottom:6px; margin-top:10px; letter-spacing: 0.5px; margin-left:5px;">DAY 2</div>`;
            mapHtml += buildBeachMap(2, s);
        }
        
        const beachContainer = document.getElementById('beachMapContainer');
        beachContainer.innerHTML = mapHtml;

        const validation = runValidator(); 
        const banner = document.getElementById('anomalyBanner'); 
        const list = document.getElementById('anomalyList');
        if (validation.list.length > 0) { 
            banner.style.display = 'block';
            list.innerHTML = validation.list.map(err => `<li>${err}</li>`).join('');
        } else { banner.style.display = 'none'; }

        const tb = document.getElementById('teamsBucket'); tb.innerHTML = ''; 
        const sb = document.getElementById('solosBucket');
        sb.innerHTML = '';
        
        appState.forEach(g => {
            const div = document.createElement('div'); div.className = 'zone-card';
            
            let nameStr = g.tName ? g.tName : 'SOLO';
            let h = `<div class="zone-header"><span>${nameStr}</span></div>`;
            h += `<div class="res-row" style="font-size:11px; color:var(--text-light); padding-bottom: 2px;"><span></span><span style="text-align:center;">DAY 1</span><span style="text-align:center;">DAY 2</span></div>`;
            
            g.anglers.forEach((a, aI) => {
                let p1C = isSwapMode ? ' swap-active' : '';
                if (swapObj1 && swapObj1.eId === g.id && swapObj1.aI === aI && swapObj1.day === 1) p1C += ' swap-selected';
                if (validation.markers.find(m => m.eId === g.id && m.aI === aI && m.day === 1)) p1C += ' clash-glow';
                
                let p2C = isSwapMode ? ' swap-active' : '';
                if (swapObj1 && swapObj1.eId === g.id && swapObj1.aI === aI && swapObj1.day === 2) p2C += ' swap-selected';
                if (validation.markers.find(m => m.eId === g.id && m.aI === aI && m.day === 2)) p2C += ' clash-glow';
                let aName = a.name || '';
                let aTag = (accEnabled && a.mobility) ? ' <span class="a-tag">[A]</span>' : '';
                let d1Bg = zColors[a.z1] || 'gray'; let d2Bg = zColors[a.z2] || 'gray';
                let d1SafeTag = isPegSafe(a.p1, 1) ? '<br><small style="font-size:9px;">[A]</small>' : '';
                let d2SafeTag = isPegSafe(a.p2, 2) ? '<br><small style="font-size:9px;">[A]</small>' : '';
                h += `<div class="res-row">
                        <span class="angler-name">${aName}${aTag}</span>
                        <div class="draw-pill${p1C}" style="background:${d1Bg}" onclick="handleSwapClick('${g.id}',${aI},1)">
                            <span>${a.z1 || 'UNDEFINED'}</span> <span class="peg-num">${a.p1 !== undefined ? a.p1 : '-'}</span>${d1SafeTag}
                        </div>
                        <div class="draw-pill${p2C}" style="background:${d2Bg}" onclick="handleSwapClick('${g.id}',${aI},2)">
                            <span>${a.z2 || '-'}</span> <span class="peg-num">${a.p2 !== undefined ? a.p2 : '-'}</span>${d2SafeTag}
                        </div>
                      </div>`;
            });
            div.innerHTML = h; 
            if (g.isTeam) tb.appendChild(div); else sb.appendChild(div);
        });
        
        document.getElementById('teamsBucketContainer').style.display = tb.innerHTML !== '' ? 'block' : 'none';
        document.getElementById('solosBucketContainer').style.display = sb.innerHTML !== '' ? 'block' : 'none';
        
        persistState();
    }

    function handleAmend(isSafe) { 
        switchTab('draw');
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('entrySection').style.display = 'block'; 
        document.getElementById('commandBar').style.display = 'flex'; 
        document.getElementById('masterActionBar').style.display = 'none';
        if (appState.length > 0) { 
            document.getElementById('rosterEntryZone').style.display = 'none';
            document.getElementById('commandBar').style.display = 'flex'; 
            document.getElementById('amendTools').style.display = 'flex'; 
            document.getElementById('actionBtnArea').style.display = 'flex'; 
        }
        
        if (isSafe) {
            document.getElementById('setupPanel').style.display = 'none';
            document.getElementById('editDrawBanner').style.display = 'flex';
            document.getElementById('accToggleBtn').style.display = 'none';
            document.getElementById('accPanelWrapper').style.display = 'none';
            document.getElementById('addAmendTeamBtn').style.display = 'none';
            document.getElementById('addAmendSoloBtn').style.display = 'none';
        } else {
            document.getElementById('setupPanel').style.display = 'block';
            document.getElementById('editDrawBanner').style.display = 'none';
            document.getElementById('accToggleBtn').style.display = 'flex';
            document.getElementById('accPanelWrapper').style.display = accEnabled ? 'flex' : 'none';
            document.getElementById('addAmendTeamBtn').style.display = 'inline-block';
            document.getElementById('addAmendSoloBtn').style.display = 'inline-block';
        }
        renderStateToScreen(); 
    }

    function generateRegistrationSheet() {
        const c = document.getElementById('registrationPrintSection');
        c.innerHTML = '';
        let matchName = document.getElementById('matchTitle').value;
        let h = `<div class="roster-header"><h1>${matchName}</h1><h2>REGISTRATION SHEET</h2></div>
                 <table class="print-table"><thead><tr><th>ANGLER</th><th>TEAM</th><th>PRESENT</th><th>POT (£)</th><th>PAIRS (£)</th></tr></thead><tbody>`;
        let sortedState = [...appState].sort((a,b) => (a.tName || "SOLO").localeCompare(b.tName || "SOLO"));
        sortedState.forEach(e => { 
            e.anglers.forEach(a => { 
                let aName = a.name || ''; let mobStr = (accEnabled && a.mobility) ? ' [A]' : '';
                let tName = e.tName || 'SOLO';
                h += `<tr><td>${aName}${mobStr}</td><td>${tName}</td><td><div class="print-checkbox"></div></td><td><div class="print-checkbox"></div></td><td><div class="print-checkbox"></div></td></tr>`; 
            }); 
        });
        h += `</tbody></table>`;
        c.innerHTML = h;
        document.body.classList.add('printing-registration'); window.print(); document.body.classList.remove('printing-registration');
    }

    function printZoneRosters() {
        const c = document.getElementById('rosterSection');
        c.innerHTML = '';
        let days = matchDays === 2 ? [1, 2] : [1];
        days.forEach(d => { 
            zones.forEach(z => {
                let list = []; 
                appState.forEach(e => { 
                    e.anglers.forEach(a => { 
                        let targetZ = d === 1 ? a.z1 : a.z2;
                        if (targetZ === z) {
                            let targetP = d === 1 ? a.p1 : a.p2;
                            list.push({ n: (a.name || ''), t: e.tName, p: targetP }); 
                        }
                    }); 
                });
                if (list.length === 0) return; 
                list.sort((a, b) => {
                    let numA = parseInt(a.p) || 0; let numB = parseInt(b.p) || 0;
                    if (numA !== numB) return numA - numB;
                    let strA = String(a.p).replace(/[0-9]/g, ''); let strB = String(b.p).replace(/[0-9]/g, '');
                    return strA.localeCompare(strB);
                });
                let h = `<div class="roster-page"><div class="roster-header"><h1>DAY ${d} - ${z} ZONE</h1></div>
                            <table class="print-table"><thead><tr><th>PEG</th><th>ANGLER</th><th>TEAM</th></tr></thead><tbody>`;
                list.forEach(i => { h += `<tr><td>${i.p}</td><td>${i.n}</td><td>${i.t || 'SOLO'}</td></tr>`; });
                h += `</tbody></table></div>`; c.innerHTML += h;
            }); 
        });
        document.body.classList.add('printing-rosters'); window.print(); document.body.classList.remove('printing-rosters');
    }

    function generateDispatchSlips() {
        const c = document.getElementById('dispatchSection');
        c.innerHTML = '';
        let teamsOnly = []; appState.forEach(e => { if (e.isTeam) teamsOnly.push(e); });
        teamsOnly.forEach(e => {
            let h = `<div class="dispatch-slip" style="page-break-after: always;"><div class="dispatch-header"><h1>TEAM: ${e.tName || 'UNNAMED TEAM'}</h1></div>
                        <table class="print-table"><thead><tr><th>ANGLER</th><th>DAY 1</th>${matchDays === 2 ? '<th>DAY 2</th>' : ''}
                        <th style="width:100px;">POT (£)</th><th style="width:120px;">PAIRS (£)</th><th style="width:120px;">TOTAL</th></tr></thead><tbody>`;
            e.anglers.forEach(a => { 
                h += `<tr><td>${a.name || ''} ${(accEnabled && a.mobility) ? '[A]' : ''}</td>
                        <td>${a.z1} ${a.p1}</td>${matchDays === 2 ? `<td>${a.z2} ${a.p2}</td>` : ''}<td></td><td></td><td></td></tr>`; 
            });
            h += `<tr><td colspan="${matchDays === 2 ? 5 : 4}" style="text-align: right; font-weight: 900; font-size: 14px; padding: 10px;">TEAM HANDOVER TOTAL:</td>
                    <td style="font-weight: 900; font-size: 14px; background: #f8fafc;">£</td></tr></tbody></table></div>`;
            c.innerHTML += h;
        });
        
        let solosOnly = []; appState.forEach(e => { if (!e.isTeam) solosOnly.push(e); });
        for (let i = 0; i < solosOnly.length; i += 4) {
            let batch = [];
            for (let j = 0; j < 4; j++) { if (i + j < solosOnly.length) batch.push(solosOnly[i + j]); }
            const page = document.createElement('div'); page.style.pageBreakAfter = 'always';
            batch.forEach(e => { 
                const a = e.anglers[0]; 
                let h = `<div class="dispatch-slip"><div class="dispatch-header"><h1>SOLO: ${a.name || 'UNNAMED'} ${(accEnabled && a.mobility) ? '[A]' : ''}</h1></div>
                            <table class="print-table"><thead><tr><th>DAY 1</th>${matchDays === 2 ? '<th>DAY 2</th>' : ''}
                            <th style="width:100px;">POT (£)</th><th style="width:120px;">PAIRS (£)</th><th style="width:120px;">TOTAL</th></tr></thead><tbody>
                            <tr><td>${a.z1} ${a.p1}</td>${matchDays === 2 ? `<td>${a.z2} ${a.p2}</td>` : ''}<td></td><td></td><td></td></tr></tbody></table></div>`; 
                page.innerHTML += h; 
            });
            c.appendChild(page);
        }
        document.body.classList.add('printing-dispatch'); window.print(); document.body.classList.remove('printing-dispatch');
    }

    function shareDraw() {
        const el = document.getElementById('resultsSection'); 
        el.classList.add('mobile-pdf-export');
        html2pdf().set({ margin: 0.1, filename: 'DRAW_REPORT.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, scrollY: 0 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } }).from(el).save().then(() => {
            el.classList.remove('mobile-pdf-export');
        });
    }

    let saveTimeout;
    document.addEventListener('input', function(e) {
        if (isAppReady && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
            persistState();
            if (e.target.id !== 'importRawData' && e.target.closest('#entrySection')) {
                runEntryValidation();
            }
            
            const ind = document.getElementById('saveIndicator');
            if (ind) {
                ind.style.opacity = '1'; clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => { ind.style.opacity = '0'; }, 1000);
            }
        }
    });

    // MANUAL MODAL TOGGLE LOGIC
    function openManualModal() {
        document.getElementById('manualModal').style.display = 'flex';
    }
    
    function closeManualModal() {
        document.getElementById('manualModal').style.display = 'none';
    }

    window.onload = () => {
        isAppReady = false; 
        let saved = localStorage.getItem('zonedraw_current_state_v1');
        if (saved) {
            let e = JSON.parse(saved);
            document.getElementById('matchTitle').value = e.title || '';
            document.getElementById('accPegs1_a').value = e.safePegs1_a || ''; 
            document.getElementById('accPegs2_a').value = e.safePegs2_a || '';
            if (e.anchorZone) document.getElementById('anchorZoneSelect').value = e.anchorZone;
            if (e.anchorZone2) document.getElementById('anchorZoneSelect2').value = e.anchorZone2;
            
            setMobilityMode(e.mobilityMode || 'A'); setDays(e.days || 2); 
            appState = e.data || []; 
            scoreState = e.scores || {}; 
            currentZoneSize = e.zoneSize || 0;
            accEnabled = e.accEnabled ? true : false;
            sweepstakeOptIns = e.sweepstakeOptIns || {};
            applyAccToggleUI();
            
            if (appState.length > 0) { 
                document.getElementById('rosterEntryZone').style.display = 'none';
                document.getElementById('commandBar').style.display = 'flex'; 
                document.getElementById('amendTools').style.display = 'flex';
                let tCount = 0, iCount = 0;
                appState.forEach(item => { if (item.isTeam) tCount++; else iCount++; });
                document.getElementById('initTeams').value = tCount; document.getElementById('initIndivs').value = iCount;
            }
            
            let hasDraw = false;
            appState.forEach(x => { x.anglers.forEach(a => { if (a.z1) hasDraw = true; }); });
            if (hasDraw) displayDraw(); else handleAmend(false);
        } else { startNewDraw(); }
        setTimeout(() => { isAppReady = true; }, 500);
    };

    function handleScoreEnter(event) {
        if (event.key === 'Enter') {
            event.target.blur();
            showToast("✅ SCORE SAVED");
            clearSearch();
        }
    }
    
    function clearSearch() {
        const input = document.getElementById('scoreSearch');
        input.value = '';
        filterScorecards(); 
        input.focus();      
    }
    
    // --- SCROLL AUTO-HIDE FOR ACTION BAR ---
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        const actionBar = document.getElementById('masterActionBar');
        
        if (!actionBar || actionBar.style.display === 'none') return;
        
        let currentScrollY = window.scrollY;
        
        if (currentScrollY > lastScrollY && currentScrollY > 50) {
            actionBar.style.transform = 'translateY(150%)'; 
        } else {
            actionBar.style.transform = 'translateY(0)';
        }
        
        lastScrollY = currentScrollY;
    });

    function showExportModal() {
        document.getElementById('exportGuideModal').style.display = 'flex';
    }

    function closeExportModal() {
        document.getElementById('exportGuideModal').style.display = 'none';
    }

// CONTROLLER FOR SWITCHING BETWEEN THE 5 LEADERBOARD PANELS
function switchLeaderboardSubTab(subTabId) {
    // 1. Reset all leaderboard sub-tab pills back to the default dark inactive layout
    document.querySelectorAll('#leaderboardTab button').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = '#1e293b';
        btn.style.color = '#94a3b8';
        btn.style.borderColor = 'rgba(255,255,255,0.05)';
    });
    
    // 2. Hide all leaderboard sub-content panels
    document.querySelectorAll('.sub-leaderboard-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // 3. Dynamic High-Contrast Style Assignment for Active Pill
    const targetBtn = document.getElementById(`subBtn-${subTabId}`);
    if (targetBtn) {
        targetBtn.classList.add('active');
        targetBtn.style.background = '#ffffff';
        targetBtn.style.color = '#0f172a';
        targetBtn.style.borderColor = 'transparent';
    }
    
    // 4. Reveal the corresponding results layout container
    const targetContent = document.getElementById(`subTab-${subTabId}`);
    if (targetContent) {
        targetContent.style.display = 'block';
    }

    // 5. Automated Leaderboard Calculation Data Hooks
    // 5. Automated Leaderboard Calculation Data Hooks
    if (subTabId === 'lbd1') {
        calculateAndRenderZoneLeaderboard(1, 'day1ZonesContainer');
    } else if (subTabId === 'lbd2') {
        calculateAndRenderZoneLeaderboard(2, 'day2ZonesContainer');
    } else if (subTabId === 'lbind') {
        calculateAndRenderIndividualLeaderboard('indivChampionContainer');
    } else if (subTabId === 'lbteam') {
        calculateAndRenderTeamLeaderboard('teamChampionContainer');
    } else if (subTabId === 'lbfish') {
        calculateAndRenderBiggestFishLeaderboard('biggestFishContainer');
    }
}
// CORE MATH ENGINE: CALCULATES AND RENDERS ZONE LEADERBOARDS FOR DAY 1 OR DAY 2
function calculateAndRenderZoneLeaderboard(dayNum, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // 1. DYNAMIC MATCH DAY CHECK: If Day 2 is clicked but it's a 1-day comp
    if (dayNum === 2 && typeof matchDays !== 'undefined' && matchDays === 1) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 50px 20px; color: #94a3b8; background: rgba(30, 41, 59, 0.7); border: 1px solid var(--border); border-radius: 12px; font-weight: 800; font-size: 14px; letter-spacing: 0.5px;">
                🚫 NOT APPLICABLE FOR 1-DAY COMPETITIONS
            </div>`;
        return;
    }
    
    // Ensure core application data structures exist
    if (typeof appState === 'undefined' || !appState || appState.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: #94a3b8; font-weight:800;">NO LIVE TOURNAMENT DATA FOUND. RUN DRAW SETUP FIRST.</div>`;
        return;
    }

    const zones = ['RED', 'YELLOW', 'GREEN', 'BLUE'];
    let htmlOutput = '';

    // Process each color-coded zone individually
    zones.forEach(zoneName => {
        let zoneAnglers = [];

        // Loop through appState structures matching your scorecard loops
        appState.forEach(teamEntry => {
            teamEntry.anglers.forEach((angler, aIdx) => {
                const targetZone = dayNum === 1 ? angler.z1 : angler.z2;

                // Only include the angler if they have a valid name and are assigned to this specific zone
                if (!angler.name || targetZone !== zoneName) return;

                // Construct the exact composite lookup key used by scoreState
                const scoreKey = `${teamEntry.id}_${aIdx}_${dayNum}`;
                const rawScore = (typeof scoreState !== 'undefined' && scoreState[scoreKey]) 
                    ? scoreState[scoreKey] 
                    : { len: '', count: '', big: '', spec: '' };

                // Handle string entries and species conversions cleanly
                let rawSpecies = String(rawScore.spec || '').trim();
                let computedSpecies = 0;
                if (rawSpecies !== '') {
                    if (!isNaN(rawSpecies)) {
                        computedSpecies = Number(rawSpecies);
                    } else {
                        computedSpecies = rawSpecies.split(',').filter(item => item.trim().length > 0).length;
                    }
                }

                zoneAnglers.push({
                    name: angler.name,
                    team: (teamEntry.isTeam && teamEntry.tName && teamEntry.tName.trim().toUpperCase() !== 'SOLO') ? teamEntry.tName.trim() : 'SOLO',
                    length: Number(rawScore.len) || 0,
                    count: Number(rawScore.count) || 0,
                    max: Number(rawScore.big) || 0,
                    species: computedSpecies,
                    zonePoints: 0
                });
            });
        });

        // Sort Anglers based on the strict Tie-Breaker Hierarchy
        zoneAnglers.sort((a, b) => {
            if (b.length !== a.length) return b.length - a.length; 
            if (b.count !== a.count) return b.count - a.count;     
            if (b.max !== a.max) return b.max - a.max;             
            return b.species - a.species;                          
        });

        // Enforce Zone Points and handling for Blanks/No-Shows
        let currentRank = 1;
        while (currentRank <= zoneAnglers.length) {
            let tieGroup = [zoneAnglers[currentRank - 1]];
            let nextIdx = currentRank;
            
            while (nextIdx < zoneAnglers.length && 
                   zoneAnglers[nextIdx].length === tieGroup[0].length &&
                   zoneAnglers[nextIdx].count === tieGroup[0].count &&
                   zoneAnglers[nextIdx].max === tieGroup[0].max &&
                   zoneAnglers[nextIdx].species === tieGroup[0].species) {
                tieGroup.push(zoneAnglers[nextIdx]);
                nextIdx++;
            }

            let pointsToAssign = 0;
            if (tieGroup[0].length === 0) {
                pointsToAssign = zoneAnglers.length;
            } else {
                let sumRanks = 0;
                for (let r = currentRank; r <= nextIdx; r++) {
                    sumRanks += r;
                }
                pointsToAssign = sumRanks / tieGroup.length;
            }

            tieGroup.forEach(angler => {
                angler.zonePoints = pointsToAssign;
            });

            currentRank = nextIdx + 1;
        }

        // Re-sort cleanly by points to keep list layout immaculate
        zoneAnglers.sort((a, b) => a.zonePoints - b.zonePoints);

        const zoneColors = { RED: '#ef4444', YELLOW: '#eab308', GREEN: '#10b981', BLUE: '#3b82f6' };
        const activeColor = zoneColors[zoneName] || '#64748b';

        // UI Generation: Removing bottom-margin for zero vertical spacing gap between zones
        htmlOutput += `
        <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid var(--border); overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
            <div style="background: ${activeColor}; color: #ffffff; padding: 12px; text-align: center; font-size: 14px; font-weight: 900; letter-spacing: 1px;">
                ZONE ${zoneName}
            </div>
            <div style="padding: 6px; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; color: #ffffff; table-layout: auto;">
                    <thead>
                        <tr style="border-bottom: 2px solid rgba(255,255,255,0.1); color: #94a3b8; font-weight: 800; font-size: 11px;">
                            <th style="padding: 6px 2px; text-align: center; width: 35px;">PTS</th>
                            <th style="padding: 6px 6px;">ANGLER</th>
                            <th style="padding: 6px 2px; text-align: right; width: 140px;">DATA MATRIX (L/F/B/S)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (zoneAnglers.length === 0) {
            htmlOutput += `<tr><td colspan="3" style="text-align:center; padding:20px; color:#64748b; font-weight:700;">No anglers assigned to this zone</td></tr>`;
        } else {
            zoneAnglers.forEach(angler => {
                const dataString = `${angler.length} / ${angler.count} / ${angler.max} / ${angler.species}`;
                htmlOutput += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); font-weight: 600;">
                        <td style="padding: 10px 2px; text-align: center; color: var(--accent); font-weight: 900; font-size: 15px;">${angler.zonePoints}</td>
                        <td style="padding: 10px 6px; text-transform: uppercase; white-space: nowrap;">
                            <span style="font-weight: 800; color: #ffffff; font-size: 14px;">${angler.name}</span>
                            <span style="font-size: 10px; color: #94a3b8; font-weight: 600; margin-left: 8px;">(${angler.team})</span>
                        </td>
                        <td style="padding: 10px 2px; text-align: right; font-family: monospace; font-size: 13px; letter-spacing: 0.5px; color: #e2e8f0; white-space: nowrap;">${dataString}</td>
                    </tr>
                `;
            });
        }

        htmlOutput += `
                    </tbody>
                </table>
            </div>
        </div>
        `;
    });

    container.innerHTML = htmlOutput;
}

// INDIVIDUAL CHAMPION MASTER LEADERBOARD MATH ENGINE
function calculateAndRenderIndividualLeaderboard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (typeof appState === 'undefined' || !appState || appState.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 40px; color: #94a3b8; font-weight:800;">NO LIVE TOURNAMENT DATA FOUND. RUN DRAW SETUP FIRST.</div>`;
        return;
    }

    // Determine if this competition is configured for 1 Day or 2 Days
    const isTwoDayMatch = (typeof matchDays !== 'undefined' && matchDays === 2);
    let masterList = [];

    // Auxiliary sub-routine to process zone ranks & scores for point calculations
    function getDayZonePointsMap(dayNum) {
        let zonePointsMap = {};
        const zones = ['RED', 'YELLOW', 'GREEN', 'BLUE'];

        zones.forEach(zoneName => {
            let zoneAnglers = [];
            appState.forEach(teamEntry => {
                teamEntry.anglers.forEach((angler, aIdx) => {
                    const targetZone = dayNum === 1 ? angler.z1 : angler.z2;
                    if (!angler.name || targetZone !== zoneName) return;

                    const scoreKey = `${teamEntry.id}_${aIdx}_${dayNum}`;
                    const rawScore = (typeof scoreState !== 'undefined' && scoreState[scoreKey]) ? scoreState[scoreKey] : { len:'', count:'', big:'', spec:'' };
                    
                    let rawSpec = String(rawScore.spec || '').trim();
                    let compSpec = (rawSpec !== '') ? (!isNaN(rawSpec) ? Number(rawSpec) : rawSpec.split(',').filter(i => i.trim().length > 0).length) : 0;

                    zoneAnglers.push({
                        key: scoreKey,
                        length: Number(rawScore.len) || 0,
                        count: Number(rawScore.count) || 0,
                        max: Number(rawScore.big) || 0,
                        species: compSpec
                    });
                });
            });

            // Rank hierarchy sort within zone
            zoneAnglers.sort((a, b) => {
                if (b.length !== a.length) return b.length - a.length;
                if (b.count !== a.count) return b.count - a.count;
                if (b.max !== a.max) return b.max - a.max;
                return b.species - a.species;
            });

            // Calculate zone ranks and assign points
            let currentRank = 1;
            while (currentRank <= zoneAnglers.length) {
                let tieGroup = [zoneAnglers[currentRank - 1]];
                let nextIdx = currentRank;
                while (nextIdx < zoneAnglers.length && 
                       zoneAnglers[nextIdx].length === tieGroup[0].length &&
                       zoneAnglers[nextIdx].count === tieGroup[0].count &&
                       zoneAnglers[nextIdx].max === tieGroup[0].max &&
                       zoneAnglers[nextIdx].species === tieGroup[0].species) {
                    tieGroup.push(zoneAnglers[nextIdx]);
                    nextIdx++;
                }

                let pointsToAssign = 0;
                if (tieGroup[0].length === 0) {
                    pointsToAssign = zoneAnglers.length;
                } else {
                    let sumRanks = 0;
                    for (let r = currentRank; r <= nextIdx; r++) sumRanks += r;
                    pointsToAssign = sumRanks / tieGroup.length;
                }

                tieGroup.forEach(item => { zonePointsMap[item.key] = pointsToAssign; });
                currentRank = nextIdx + 1;
            }
        });
        return zonePointsMap;
    }

    // Pull calculations maps for both days
    const day1Points = getDayZonePointsMap(1);
    const day2Points = getDayZonePointsMap(2);

    // 1. Gather stats and map combined totals matrices
    appState.forEach(teamEntry => {
        teamEntry.anglers.forEach((angler, aIdx) => {
            if (!angler.name || !angler.z1) return;

            const k1 = `${teamEntry.id}_${aIdx}_1`;
            const k2 = `${teamEntry.id}_${aIdx}_2`;

            const s1 = (typeof scoreState !== 'undefined' && scoreState[k1]) ? scoreState[k1] : { len:'', count:'', big:'', spec:'' };
            const s2 = (typeof scoreState !== 'undefined' && scoreState[k2]) ? scoreState[k2] : { len:'', count:'', big:'', spec:'' };

            let specRaw1 = String(s1.spec || '').trim();
            let sp1 = (specRaw1 !== '') ? (!isNaN(specRaw1) ? Number(specRaw1) : specRaw1.split(',').filter(i => i.trim().length > 0).length) : 0;

            let specRaw2 = String(s2.spec || '').trim();
            let sp2 = (specRaw2 !== '') ? (!isNaN(specRaw2) ? Number(specRaw2) : specRaw2.split(',').filter(i => i.trim().length > 0).length) : 0;

            // Individual component extractions
            let d1Pts = day1Points[k1] !== undefined ? day1Points[k1] : (angler.z1 ? 0 : 0);
            let d1Len = Number(s1.len) || 0;
            let d1Cnt = Number(s1.count) || 0;
            let d1Big = Number(s1.big) || 0;
            let d1Spc = sp1;

            let d2Pts = isTwoDayMatch && day2Points[k2] !== undefined ? day2Points[k2] : 0;
            let d2Len = isTwoDayMatch ? (Number(s2.len) || 0) : 0;
            let d2Cnt = isTwoDayMatch ? (Number(s2.count) || 0) : 0;
            let d2Big = isTwoDayMatch ? (Number(s2.big) || 0) : 0;
            let d2Spc = isTwoDayMatch ? sp2 : 0;

            // Combined calculation processing
            let combPts = d1Pts + d2Pts;
            let combLen = d1Len + d2Len;
            let combCnt = d1Cnt + d2Cnt;
            let combBig = Math.max(d1Big, d2Big); // Dynamic check: Largest fish overall wins tie-breaker
            let combSpc = d1Spc + d2Spc;

            masterList.push({
                name: angler.name,
                team: (teamEntry.isTeam && teamEntry.tName && teamEntry.tName.trim().toUpperCase() !== 'SOLO') ? teamEntry.tName.trim() : 'SOLO',
                d1: { pts: d1Pts, len: d1Len, cnt: d1Cnt, big: d1Big, spc: d1Spc },
                d2: { pts: d2Pts, len: d2Len, cnt: d2Cnt, big: d2Big, spc: d2Spc },
                comb: { pts: combPts, len: combLen, cnt: combCnt, big: combBig, spc: combSpc }
            });
        });
    });

    // 2. Global Leaderboard Sorting Engine (Hierarchy: Points -> Length -> Count -> Biggest -> Species)
    masterList.sort((a, b) => {
        const targetA = isTwoDayMatch ? a.comb : a.d1;
        const targetB = isTwoDayMatch ? b.comb : b.d1;

        if (targetA.pts !== targetB.pts) return targetA.pts - targetB.pts; // Lower points wins match
        if (targetB.len !== targetA.len) return targetB.len - targetA.len;
        if (targetB.cnt !== targetA.cnt) return targetB.cnt - targetA.cnt;
        if (targetB.big !== targetA.big) return targetB.big - targetA.big;
        return targetB.spc - targetA.spc;
    });

    // 3. Render Dashboard Interface layout mapping (EXTRA-LARGE READABILITY UPGRADE)
    let html = `
    <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 16px; color: #ffffff; white-space: nowrap;">
                <thead>
                    <!-- Master Header Sections Category Decks -->
                    <tr style="background: rgba(15, 23, 42, 0.6); color: #e2e8f0; font-weight: 900; font-size: 16px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <th style="padding: 16px 14px; text-align: left; font-size: 16px;">RANK / ANGLER DETAILS</th>
                        <th style="padding: 16px 8px; background: rgba(59, 130, 246, 0.15); border-left: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05);">DAY 1 PERFORMANCE</th>
                        ${isTwoDayMatch ? `
                        <th style="padding: 16px 8px; background: rgba(16, 185, 129, 0.15); border-right: 1px solid rgba(255,255,255,0.05);">DAY 2 PERFORMANCE</th>
                        <th style="padding: 16px 8px; background: rgba(234, 179, 8, 0.15);">COMBINED MATCH TOTALS</th>` : ''}
                    </tr>
                    <!-- Matrix Column Subheaders Decks -->
                    <tr style="border-bottom: 2px solid rgba(255,255,255,0.1); color: #cbd5e1; font-weight: 800; font-size: 14px; background: rgba(15, 23, 42, 0.3);">
                        <th style="padding: 12px 14px; text-align: left;">POS & ANGLER (TEAM)</th>
                        <!-- Day 1 Sub matrix -->
                        <th style="padding: 12px 8px; background: rgba(59, 130, 246, 0.05); border-left: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05); letter-spacing: 1px;">
                            <span style="display:inline-block; width:55px; color:var(--accent); font-weight: 900;">PTS</span>|
                            <span style="display:inline-block; width:65px;">CM</span>|
                            <span style="display:inline-block; width:45px;">CT</span>|
                            <span style="display:inline-block; width:55px;">BIG</span>|
                            <span style="display:inline-block; width:45px;">SPC</span>
                        </th>
                        ${isTwoDayMatch ? `
                        <!-- Day 2 Sub matrix -->
                        <th style="padding: 12px 8px; background: rgba(16, 185, 129, 0.05); border-right: 1px solid rgba(255,255,255,0.05); letter-spacing: 1px;">
                            <span style="display:inline-block; width:55px; color:var(--accent); font-weight: 900;">PTS</span>|
                            <span style="display:inline-block; width:65px;">CM</span>|
                            <span style="display:inline-block; width:45px;">CT</span>|
                            <span style="display:inline-block; width:55px;">BIG</span>|
                            <span style="display:inline-block; width:45px;">SPC</span>
                        </th>
                        <!-- Combined Sub matrix -->
                        <th style="padding: 12px 8px; background: rgba(234, 179, 8, 0.05); letter-spacing: 1px;">
                            <span style="display:inline-block; width:55px; color:var(--accent); font-weight:900;">PTS</span>|
                            <span style="display:inline-block; width:65px; font-weight:900;">CM</span>|
                            <span style="display:inline-block; width:45px; font-weight:800;">CT</span>|
                            <span style="display:inline-block; width:55px; font-weight:800;">BIG</span>|
                            <span style="display:inline-block; width:45px; font-weight:800;">SPC</span>
                        </th>` : ''}
                    </tr>
                </thead>
                <tbody>
    `;

    if (masterList.length === 0) {
        html += `<tr><td colspan="${isTwoDayMatch ? 4 : 2}" style="padding:40px; color:#64748b; font-weight:800; font-size:16px;">No competitor score matrices compiled.</td></tr>`;
    } else {
        masterList.forEach((row, index) => {
            const currentRank = index + 1;
            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.07); font-weight:600; height:52px;">
                    <!-- Angler Name Info Details -->
                    <td style="padding: 12px 14px; text-align: left; text-transform: uppercase;">
                        <span style="color:var(--accent); font-weight:900; font-size:18px; margin-right:14px;">${currentRank}</span>
                        <span style="font-weight:800; color:#ffffff; font-size:17px; letter-spacing: 0.3px;">${row.name}</span>
                        <span style="font-size:13px; color:#a3a3a3; font-weight:700; margin-left:10px; opacity:0.9;">(${row.team})</span>
                    </td>
                    <!-- Day 1 Values Matrix -->
                    <td style="padding: 12px 8px; font-family:monospace; font-size:16px; background: rgba(59, 130, 246, 0.02); border-left: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05); letter-spacing: 0.5px;">
                        <span style="display:inline-block; width:55px; color:var(--accent); font-weight:900; font-size:17px;">${row.d1.pts}</span> 
                        <span style="display:inline-block; width:65px; color:#ffffff; font-weight:700;">${row.d1.len}</span> 
                        <span style="display:inline-block; width:45px; color:#cbd5e1;">${row.d1.cnt}</span> 
                        <span style="display:inline-block; width:55px; color:#cbd5e1;">${row.d1.big}</span> 
                        <span style="display:inline-block; width:45px; color:#94a3b8;">${row.d1.spc}</span>
                    </td>
                    ${isTwoDayMatch ? `
                    <!-- Day 2 Values Matrix -->
                    <td style="padding: 12px 8px; font-family:monospace; font-size:16px; background: rgba(16, 185, 129, 0.02); border-right: 1px solid rgba(255,255,255,0.05); letter-spacing: 0.5px;">
                        <span style="display:inline-block; width:55px; color:var(--accent); font-weight:900; font-size:17px;">${row.d2.pts}</span> 
                        <span style="display:inline-block; width:65px; color:#ffffff; font-weight:700;">${row.d2.len}</span> 
                        <span style="display:inline-block; width:45px; color:#cbd5e1;">${row.d2.cnt}</span> 
                        <span style="display:inline-block; width:55px; color:#cbd5e1;">${row.d2.big}</span> 
                        <span style="display:inline-block; width:45px; color:#94a3b8;">${row.d2.spc}</span>
                    </td>
                    <!-- Combined Match Values Matrix -->
                    <td style="padding: 12px 8px; font-family:monospace; font-size:16px; background: rgba(234, 179, 8, 0.04); letter-spacing: 0.5px;">
                        <span style="display:inline-block; width:55px; color:#ffffff; font-weight:900; font-size:17px;">${row.comb.pts}</span> 
                        <span style="display:inline-block; width:65px; color:var(--accent); font-weight:900; font-size:17px;">${row.comb.len}</span> 
                        <span style="display:inline-block; width:45px; color:#ffffff; font-weight:800;">${row.comb.cnt}</span> 
                        <span style="display:inline-block; width:55px; color:#ffffff; font-weight:800;">${row.comb.big}</span> 
                        <span style="display:inline-block; width:45px; color:#cbd5e1; font-weight:700;">${row.comb.spc}</span>
                    </td>` : ''}
                </tr>
            `;
        });
    }

    html += `
                </tbody>
            </table>
        </div>
    </div>
    `;

    container.innerHTML = html;
}

// TEAM CHAMPIONSHIP MASTER LEADERBOARD MATH ENGINE
function calculateAndRenderTeamLeaderboard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (typeof appState === 'undefined' || !appState || appState.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 40px; color: #94a3b8; font-weight:800;">NO LIVE TOURNAMENT DATA FOUND. RUN DRAW SETUP FIRST.</div>`;
        return;
    }

    const isTwoDayMatch = (typeof matchDays !== 'undefined' && matchDays === 2);
    let teamList = [];

    // Helper sub-routine to process zone ranks & scores for point calculations exactly matching individuals
    function getDayZonePointsMap(dayNum) {
        let zonePointsMap = {};
        const zones = ['RED', 'YELLOW', 'GREEN', 'BLUE'];

        zones.forEach(zoneName => {
            let zoneAnglers = [];
            appState.forEach(teamEntry => {
                teamEntry.anglers.forEach((angler, aIdx) => {
                    const targetZone = dayNum === 1 ? angler.z1 : angler.z2;
                    if (!angler.name || targetZone !== zoneName) return;

                    const scoreKey = `${teamEntry.id}_${aIdx}_${dayNum}`;
                    const rawScore = (typeof scoreState !== 'undefined' && scoreState[scoreKey]) ? scoreState[scoreKey] : { len:'', count:'', big:'', spec:'' };
                    
                    let rawSpec = String(rawScore.spec || '').trim();
                    let compSpec = (rawSpec !== '') ? (!isNaN(rawSpec) ? Number(rawSpec) : rawSpec.split(',').filter(i => i.trim().length > 0).length) : 0;

                    zoneAnglers.push({
                        key: scoreKey,
                        length: Number(rawScore.len) || 0,
                        count: Number(rawScore.count) || 0,
                        max: Number(rawScore.max) || 0,
                        species: compSpec
                    });
                });
            });

            zoneAnglers.sort((a, b) => {
                if (b.length !== a.length) return b.length - a.length;
                if (b.count !== a.count) return b.count - a.count;
                if (b.max !== a.max) return b.max - a.max;
                return b.species - a.species;
            });

            let currentRank = 1;
            while (currentRank <= zoneAnglers.length) {
                let tieGroup = [zoneAnglers[currentRank - 1]];
                let nextIdx = currentRank;
                while (nextIdx < zoneAnglers.length && 
                       zoneAnglers[nextIdx].length === tieGroup[0].length &&
                       zoneAnglers[nextIdx].count === tieGroup[0].count &&
                       zoneAnglers[nextIdx].max === tieGroup[0].max &&
                       zoneAnglers[nextIdx].species === tieGroup[0].species) {
                    tieGroup.push(zoneAnglers[nextIdx]);
                    nextIdx++;
                }

                let pointsToAssign = 0;
                if (tieGroup[0].length === 0) {
                    pointsToAssign = zoneAnglers.length;
                } else {
                    let sumRanks = 0;
                    for (let r = currentRank; r <= nextIdx; r++) sumRanks += r;
                    pointsToAssign = sumRanks / tieGroup.length;
                }

                tieGroup.forEach(item => { zonePointsMap[item.key] = pointsToAssign; });
                currentRank = nextIdx + 1;
            }
        });
        return zonePointsMap;
    }

    const day1Points = getDayZonePointsMap(1);
    const day2Points = getDayZonePointsMap(2);

    // 1. Process teams from appState (Ignore entries explicitly marked as SOLO)
    appState.forEach(teamEntry => {
        const teamNameClean = (teamEntry.tName || '').trim();
        if (!teamEntry.isTeam || teamNameClean === '' || teamNameClean.toUpperCase() === 'SOLO') return;

        let totalTeamPoints = 0;
        let totalTeamLength = 0;
        let totalTeamCount = 0;
        let anglerBreakdowns = [];

        teamEntry.anglers.forEach((angler, aIdx) => {
            if (!angler.name) return;

            const k1 = `${teamEntry.id}_${aIdx}_1`;
            const k2 = `${teamEntry.id}_${aIdx}_2`;

            const s1 = (typeof scoreState !== 'undefined' && scoreState[k1]) ? scoreState[k1] : { len:'', count:'' };
            const s2 = (typeof scoreState !== 'undefined' && scoreState[k2]) ? scoreState[k2] : { len:'', count:'' };

            // Individual Accumulations
            let a1Pts = day1Points[k1] !== undefined ? day1Points[k1] : 0;
            let a1Len = Number(s1.len) || 0;
            let a1Cnt = Number(s1.count) || 0;

            let a2Pts = isTwoDayMatch && day2Points[k2] !== undefined ? day2Points[k2] : 0;
            let a2Len = isTwoDayMatch ? (Number(s2.len) || 0) : 0;
            let a2Cnt = isTwoDayMatch ? (Number(s2.count) || 0) : 0;

            let individualTotalPoints = a1Pts + a2Pts;
            let individualTotalLength = a1Len + a2Len;
            let individualTotalCount = a1Cnt + a2Cnt;

            // Add to team sums
            totalTeamPoints += individualTotalPoints;
            totalTeamLength += individualTotalLength;
            totalTeamCount += individualTotalCount;

            // Push details to inner breakdown array
            anglerBreakdowns.push({
                name: angler.name,
                pts: individualTotalPoints,
                len: individualTotalLength,
                cnt: individualTotalCount
            });
        });

        // Sort inside the team: Best performing (lowest zone points) to worst performing
        anglerBreakdowns.sort((a, b) => {
            if (a.pts !== b.pts) return a.pts - b.pts;
            return b.len - a.len; // Tie break internal breakdown by total length
        });

        teamList.push({
            name: teamNameClean.toUpperCase(),
            pts: totalTeamPoints,
            len: totalTeamLength,
            cnt: totalTeamCount,
            members: anglerBreakdowns
        });
    });

    // 2. Global Leaderboard Sorting Engine (Hierarchy: Points -> Length -> Count)
    teamList.sort((a, b) => {
        if (a.pts !== b.pts) return a.pts - b.pts; // Main: Lowest Team Zone Points Wins
        if (b.len !== a.len) return b.len - a.len; // 1st Tie-Breaker: Highest Combined Team Length
        return b.cnt - a.cnt;                     // 2nd Tie-Breaker: Highest Combined Team Fish Count
    });

    // 3. Render Dashboard Interface Layout Mapping (OPTIMIZED COLUMN SPACE)
    let html = `
    <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 16px; color: #ffffff; white-space: nowrap;">
                <thead>
                    <!-- Master Header Deck Category Columns -->
                    <tr style="background: rgba(15, 23, 42, 0.6); color: #e2e8f0; font-weight: 900; font-size: 16px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <th style="padding: 16px 14px; text-align: left; width: 220px;">RANK / TEAM NAME</th>
                        <th style="padding: 16px 4px; background: rgba(59, 130, 246, 0.15); width: 45px; color: var(--accent);">PTS</th>
                        <th style="padding: 16px 4px; background: rgba(16, 185, 129, 0.15); width: 55px;">CM</th>
                        <th style="padding: 16px 4px; background: rgba(234, 179, 8, 0.15); width: 55px;">FISH CT</th>
                        <th style="padding: 16px 14px; text-align: left; background: rgba(15, 23, 42, 0.4);">TEAM CATCH BREAKDOWN</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (teamList.length === 0) {
        html += `<tr><td colspan="5" style="padding:40px; color:#64748b; font-weight:800; font-size:16px;">No registered teams found with scored data logs.</td></tr>`;
    } else {
        teamList.forEach((team, index) => {
            const currentRank = index + 1;
            
            // Build string layout for individual member contributions
            let breakdownHTML = '';
            team.members.forEach((m, idx) => {
                breakdownHTML += `
                    <div style="display: inline-block; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 6px; margin-right: 6px; font-size: 13px; white-space: nowrap;">
                        <span style="font-weight: 800; color: #ffffff;">${m.name}</span> 
                        <span style="color: #94a3b8; font-family: monospace; font-size: 12px; margin-left: 4px;">(${m.pts}pts / ${m.len}cm / ${m.cnt}f)</span>
                    </div>
                `;
            });

            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.07); font-weight: 600; height: 56px;">
                    <!-- Rank & Team Name Details -->
                    <td style="padding: 12px 14px; text-align: left; text-transform: uppercase;">
                        <span style="color: var(--accent); font-weight: 900; font-size: 18px; margin-right: 12px;">${currentRank}</span>
                        <span style="font-weight: 900; color: #ffffff; font-size: 17px; letter-spacing: 0.5px;">${team.name}</span>
                    </td>
                    <!-- Cumulative Team Points Column -->
                    <td style="padding: 12px 4px; font-size: 17px; font-weight: 900; color: var(--accent); background: rgba(59, 130, 246, 0.02); border-left: 1px solid rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.03); font-family: monospace;">
                        ${team.pts}
                    </td>
                    <!-- Cumulative Team Length Column -->
                    <td style="padding: 12px 4px; font-size: 16px; font-weight: 800; color: #ffffff; background: rgba(16, 185, 129, 0.02); border-right: 1px solid rgba(255,255,255,0.03); font-family: monospace;">
                        ${team.len}
                    </td>
                    <!-- Cumulative Team Fish Count Column -->
                    <td style="padding: 12px 4px; font-size: 16px; font-weight: 800; color: #e2e8f0; background: rgba(234, 179, 8, 0.02); border-right: 1px solid rgba(255,255,255,0.03); font-family: monospace;">
                        ${team.cnt}
                    </td>
                    <!-- Dynamic Catch Contribution Blocks -->
                    <td style="padding: 12px 14px; text-align: left; background: rgba(15, 23, 42, 0.1); white-space: nowrap;">
                        ${breakdownHTML}
                    </td>
                </tr>
            `;
        });
    }

    html += `
                </tbody>
            </table>
        </div>
    </div>
    `;

    container.innerHTML = html;
}
