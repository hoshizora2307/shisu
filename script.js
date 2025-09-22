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
    let forecastDataCache = {}; 

    // 星空指数を計算する関数
    function calculateStargazingIndex(dayData) {
        if (!dayData?.hourly?.cloudcover || !dayData?.daily?.moon_phase) return { totalScore: null };

        const cloudCover = dayData.hourly.cloudcover[21]; 
        const moonPhase = dayData.daily.moon_phase[0]; 
        const weatherCode = dayData.daily.weathercode[0];

        let cloudScore = Math.round((100 - cloudCover) * 0.8);
        let moonScore = 0;
        if (moonPhase.includes('new')) moonScore = 20;
        else if (moonPhase.includes('crescent')) moonScore = 15;
        else if (moonPhase.includes('quarter')) moonScore = 10;
        else if (moonPhase.includes('gibbous')) moonScore = 5;
        else if (moonPhase.includes('full')) moonScore = 0;

        let weatherBonus = 0;
        if ([0, 1].includes(weatherCode)) weatherBonus = 5;
        if (weatherCode >= 51) weatherBonus = -10;

        let totalScore = cloudScore + moonScore + weatherBonus;
        totalScore = Math.max(0, Math.min(100, totalScore));

        return {
            totalScore,
            cloudCover,
            moonPhase: getMoonPhaseName(moonPhase),
            weather: getWeatherName(weatherCode)
        };
    }

    // 天気予報データをAPIから取得する関数
    async function fetchForecast(year, month) {
        const cacheKey = `${year}-${month}`;
        if (forecastDataCache[cacheKey]) return forecastDataCache[cacheKey];

        loadingSpinner.classList.remove('hidden');
        calendarBody.classList.add('hidden');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 今日の始まりに設定
        const forecastEndDate = new Date();
        forecastEndDate.setDate(today.getDate() + 15); // APIは最大16日先まで提供

        const requestStartDate = new Date(year, month - 1, 1);
        const requestEndDate = new Date(year, month, 0);

        // リクエスト期間が完全に予報提供期間より未来の場合は、APIを呼び出さない
        if (requestStartDate > forecastEndDate) {
            loadingSpinner.classList.add('hidden');
            calendarBody.classList.remove('hidden');
            const emptyData = { isEmpty: true, daysInMonth: requestEndDate.getDate() };
            forecastDataCache[cacheKey] = emptyData;
            return emptyData;
        }

        // ▼▼▼ 修正点: APIに渡す日付のフォーマットを確実なものに変更 ▼▼▼
        const formatDate = (date) => date.toISOString().split('T')[0];

        const apiStartDate = formatDate(requestStartDate < today ? today : requestStartDate);
        const apiEndDate = formatDate(requestEndDate > forecastEndDate ? forecastEndDate : requestEndDate);

        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&daily=weathercode,moon_phase&hourly=cloudcover&start_date=${apiStartDate}&end_date=${apiEndDate}&timezone=Asia%2FTokyo`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('APIサーバーが応答しませんでした。');
            const data = await response.json();
            if (data.error) throw new Error(`APIエラー: ${data.reason}`);
            
            data.daysInMonth = requestEndDate.getDate();
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
        
        const daysInMonth = forecast.daysInMonth;
        const firstDay = new Date(year, month - 1, 1).getDay();

        for (let i = 0; i < firstDay; i++) {
            calendarBody.innerHTML += `<div class="day-cell other-month"></div>`;
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            
            const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayIndex = forecast.daily?.time.indexOf(dayStr);

            if (dayIndex > -1) {
                 const dayData = {
                    daily: {
                        moon_phase: [forecast.daily.moon_phase[dayIndex]],
                        weathercode: [forecast.daily.weathercode[dayIndex]]
                    },
                    hourly: {
                        cloudcover: forecast.hourly.cloudcover.slice(dayIndex * 24, (dayIndex + 1) * 24)
                    }
                };
                const index = calculateStargazingIndex(dayData);
                
                let scoreClass = 'score-bad';
                if (index.totalScore >= 80) scoreClass = 'score-good';
                else if (index.totalScore >= 50) scoreClass = 'score-normal';

                cell.innerHTML = `
                    <div class="date-number">${day}</div>
                    <div class="star-score ${scoreClass}">${index.totalScore}</div>
                `;
                cell.addEventListener('click', () => showModal(year, month, day, index));
            } else {
                cell.innerHTML = `
                    <div class="date-number">${day}</div>
                    <div class="star-score">-</div>
                `;
                cell.style.cursor = 'default';
            }
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

    function getMoonPhaseName(phase) {
        const phases = { new_moon: '新月', waxing_crescent: '三日月', first_quarter: '上弦の月', waxing_gibbous: '十三夜', full_moon: '満月', waning_gibbous: '十六夜', last_quarter: '下弦の月', waning_crescent: '有明月'};
        return phases[phase] || phase;
    }
    function getWeatherName(code) {
        const codes = { 0: "快晴", 1: "晴れ", 2: "一部曇", 3: "曇り", 45: "霧", 48: "霧氷", 51: "霧雨", 53: "霧雨", 55: "霧雨", 61: "雨", 63: "雨", 65: "雨", 71: "雪", 73: "雪", 75: "雪", 80: "にわか雨", 81: "にわか雨", 82: "にわか雨", 95: "雷雨" };
        return codes[code] || '不明';
    }

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

    renderCalendar(currentDate);
});
