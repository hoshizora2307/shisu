document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const calendarBody = document.getElementById('calendar-body');
    const monthYearLabel = document.getElementById('month-year-label');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const modal = document.getElementById('modal');
    const closeModalButton = document.getElementById('close-button');
    const modalDate = document.getElementById('modal-date');
    const modalBody = document.getElementById('modal-body');

    // 志賀高原(山ノ内町)の緯度経度
    const LATITUDE = 36.70;
    const LONGITUDE = 138.50;

    let currentDate = new Date();
    let forecastDataCache = {}; // 取得したデータをキャッシュ

    // 星空指数を計算する関数
    function calculateStargazingIndex(dayData) {
        //夜21時の雲量(%)
        const cloudCover = dayData.hourly.cloudcover[21]; 
        //月の満ち欠け
        const moonPhase = dayData.daily.moon_phase[0]; 
        //天気コード
        const weatherCode = dayData.daily.weathercode[0];

        // 1. 雲量に基づくスコア (最大80点)
        // 雲量0%で80点、100%で0点
        let cloudScore = Math.round((100 - cloudCover) * 0.8);

        // 2. 月の満ち欠けに基づくスコア (最大20点)
        let moonScore = 0;
        // 月の光が少ないほど高得点
        if (moonPhase.includes('new')) moonScore = 20;
        else if (moonPhase.includes('crescent')) moonScore = 15;
        else if (moonPhase.includes('quarter')) moonScore = 10;
        else if (moonPhase.includes('gibbous')) moonScore = 5;
        else if (moonPhase.includes('full')) moonScore = 0;

        // 3. 天気によるボーナス/減点
        let weatherBonus = 0;
        if ([0, 1].includes(weatherCode)) weatherBonus = 5; // 快晴/晴れ
        if ([2, 3].includes(weatherCode)) weatherBonus = 0; // 曇り
        if (weatherCode >= 51) weatherBonus = -10; // 雨/雪

        let totalScore = cloudScore + moonScore + weatherBonus;
        // 0-100の範囲に収める
        if (totalScore > 100) totalScore = 100;
        if (totalScore < 0) totalScore = 0;

        return {
            totalScore,
            cloudCover,
            moonPhase: getMoonPhaseName(moonPhase),
            weather: getWeatherName(weatherCode)
        };
    }

    // 天気予報データをAPIから取得
    async function fetchForecast(year, month) {
        const cacheKey = `${year}-${month}`;
        if (forecastDataCache[cacheKey]) {
            return forecastDataCache[cacheKey];
        }

        loadingSpinner.classList.remove('hidden');
        calendarBody.classList.add('hidden');
        
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&daily=weathercode,moon_phase&hourly=cloudcover&start_date=${startDate}&end_date=${endDate}&timezone=Asia%2FTokyo`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('APIからのデータ取得に失敗しました。');
            const data = await response.json();
            forecastDataCache[cacheKey] = data;
            return data;
        } catch (error) {
            console.error(error);
            alert(error.message);
            return null;
        } finally {
            loadingSpinner.classList.add('hidden');
            calendarBody.classList.remove('hidden');
        }
    }

    // カレンダーを生成して表示
    async function renderCalendar(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        monthYearLabel.textContent = `${year}年 ${month}月`;
        calendarBody.innerHTML = '';

        const forecast = await fetchForecast(year, month);
        if (!forecast) return;

        const firstDay = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();

        // 1日までの空白セルを生成
        for (let i = 0; i < firstDay; i++) {
            calendarBody.innerHTML += `<div class="day-cell other-month"></div>`;
        }
        
        // 日付セルを生成
        for (let day = 1; day <= daysInMonth; day++) {
            const dayData = {
                daily: {
                    moon_phase: [forecast.daily.moon_phase[day - 1]],
                    weathercode: [forecast.daily.weathercode[day - 1]]
                },
                hourly: {
                    cloudcover: forecast.hourly.cloudcover.slice((day - 1) * 24, day * 24)
                }
            };
            const index = calculateStargazingIndex(dayData);
            
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            
            let scoreClass = 'score-bad';
            if (index.totalScore >= 80) scoreClass = 'score-good';
            else if (index.totalScore >= 50) scoreClass = 'score-normal';

            cell.innerHTML = `
                <div class="date-number">${day}</div>
                <div class="star-score ${scoreClass}">${index.totalScore}</div>
            `;
            cell.addEventListener('click', () => showModal(year, month, day, index));
            calendarBody.appendChild(cell);
        }
    }
    
    function showModal(year, month, day, index) {
        modalDate.textContent = `${year}年${month}月${day}日の星空予報`;
        modalBody.innerHTML = `
            <p><strong>星空指数:</strong> <span class="${index.totalScore >= 80 ? 'score-good' : index.totalScore >= 50 ? 'score-normal' : 'score-bad'}">${index.totalScore}</span> / 100</p>
            <p><strong>夜間の雲量 (21時):</strong> ${index.cloudCover}%</p>
            <p><strong>月齢:</strong> ${index.moonPhase}</p>
            <p><strong>天気:</strong> ${index.weather}</p>
        `;
        modal.classList.remove('hidden');
    }

    // --- 補助関数 ---
    function getMoonPhaseName(phase) {
        const phases = { new_moon: '新月', waxing_crescent: '三日月', first_quarter: '上弦の月', waxing_gibbous: '十三夜', full_moon: '満月', waning_gibbous: '十六夜', last_quarter: '下弦の月', waning_crescent: '有明月'};
        return phases[phase] || phase;
    }
    function getWeatherName(code) {
        const codes = { 0: "快晴", 1: "晴れ", 2: "一部曇", 3: "曇り", 45: "霧", 48: "霧氷", 51: "霧雨", 53: "霧雨", 55: "霧雨", 61: "雨", 63: "雨", 65: "雨", 71: "雪", 73: "雪", 75: "雪", 80: "にわか雨", 81: "にわか雨", 82: "にわか雨", 95: "雷雨" };
        return codes[code] || '不明';
    }

    // --- イベントリスナー ---
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    });
    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    });
    closeModalButton.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    // --- 初期化 ---
    renderCalendar(currentDate);
});
